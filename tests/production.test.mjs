import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const sqlite=new DatabaseSync(':memory:');
class Statement{
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const meta=sqlite.prepare(this.sql).run(...this.values);return {success:true,results:[],meta};}
}
const db={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const results=statements.map(s=>({success:true,results:sqlite.prepare(s.sql).all(...s.values)}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.__testEnv={DB:db,SITE_URL:'https://cruzycabs.co.nz',APP_SIGNING_SECRET:'a'.repeat(64),JOBS_SECRET:'b'.repeat(64),GOOGLE_MAPS_API_KEY:'test-google',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_MODE:'test',STRIPE_WEBHOOK_SECRET:'whsec_fixture',RESEND_API_KEY:'test-resend',EMAIL_FROM:'test@example.invalid',STAFF_ROLE_BINDINGS:'admin@example.invalid:admin|dispatch,driver@example.invalid:driver,other@example.invalid:driver,partner@example.invalid:partner'};
const sessions=new Map(),intents=new Map(),refunds=new Map(),sent=[];let serial=0;
let autocompleteInput;
let placesAvailable=true;
globalThis.fetch=async(url,options={})=>{
  const value=String(url);
  if(value==='https://places.googleapis.com/v1/places:autocomplete'){
    if(!placesAvailable)return Response.json({error:{status:'PERMISSION_DENIED'}},{status:403});
    autocompleteInput=JSON.parse(options.body);
    return Response.json({suggestions:[
      {placePrediction:{placeId:'country',types:['country'],text:{text:'New Zealand'}}},
      {placePrediction:{placeId:'bethells',types:['locality'],text:{text:'Bethells Beach, Auckland, New Zealand'},structuredFormat:{mainText:{text:'Bethells Beach'},secondaryText:{text:'Auckland, New Zealand'}}}},
      {placePrediction:{placeId:'road',types:['street_address'],text:{text:'10 Bethells Road, Auckland, New Zealand'},structuredFormat:{mainText:{text:'10 Bethells Road'},secondaryText:{text:'Auckland, New Zealand'}}}},
    ]});
  }
  if(value.startsWith('https://places.googleapis.com/v1/places/'))return Response.json({location:{latitude:-36.89,longitude:174.45},addressComponents:[{types:['country'],shortText:'NZ'}]});
  if(value.startsWith('https://photon.example.invalid/'))return Response.json({features:[
    {properties:{name:'New Zealand',countrycode:'NZ'},geometry:{coordinates:[174,-41]}},
    {properties:{name:'Bethel',countrycode:'US'},geometry:{coordinates:[-74,41]}},
    {properties:{name:'Bethells Beach',countrycode:'NZ',city:'Auckland',osm_id:12},geometry:{coordinates:[174.45,-36.89]}},
  ]});
  if(value.includes('routes.googleapis.com'))return Response.json({routes:[{distanceMeters:15000,duration:'1800s',legs:[{startLocation:{latLng:{latitude:-36.8,longitude:174.7}},endLocation:{latLng:{latitude:-36.9,longitude:174.8}}}]}]});
  if(value.includes('maps.googleapis.com'))return Response.json({status:'OK',results:[{place_id:'test-place',formatted_address:'Test Auckland address',geometry:{location:{lat:-36.8,lng:174.7}}}]});
  if(value==='https://api.resend.com/emails'){sent.push(JSON.parse(options.body));return Response.json({id:'email-test'});}
  if(value.startsWith('https://api.stripe.com/v1/')){
    const path=value.split('/v1/')[1],fields=options.body?Object.fromEntries(new URLSearchParams(options.body)):{};
    if(path==='checkout/sessions'){
      const retry=options.headers['Idempotency-Key'];if(sessions.has(retry))return Response.json(sessions.get(retry));
      const object={id:`cs_test_${++serial}`,url:`https://checkout.stripe.com/test-${serial}`,status:'open',payment_intent:null,metadata:{booking_id:fields['metadata[booking_id]']},amount_total:Number(fields['line_items[0][price_data][unit_amount]']),currency:'nzd',fields};sessions.set(retry,object);sessions.set(object.id,object);return Response.json(object);
    }
    if(path.startsWith('checkout/sessions/')){const id=path.split('/')[2],session=sessions.get(id);if(path.endsWith('/expire'))session.status='expired';return Response.json(session||{error:{}});}
    if(path.startsWith('payment_intents/'))return Response.json(intents.get(path.split('/')[1])||{});
    if(path.startsWith('charges/'))return Response.json({id:path.split('/')[1],receipt_url:'https://pay.stripe.com/receipts/test',amount_refunded:refunds.get(path.split('/')[1])||0});
    if(path==='refunds'){const intent=intents.get(fields.payment_intent);refunds.set(intent.latest_charge,intent.amount);return Response.json({id:'re_test',status:'succeeded'});}
  }
  throw new Error(`Unexpected provider request ${value}`);
};
const {calculateQuote}=await import('../lib/pricing.ts');
const {scheduledInstant,validateJourney}=await import('../lib/validation.ts');
const {hmac,sha,phone,verifyStripeEvent:unused}=await import('../lib/security.ts');void unused;
const addressAPI=await import('../app/api/addresses/route.ts');
const {verifyStripeEvent}=await import('../lib/stripe.ts');
const {ensurePlatform,platformSchema}=await import('../lib/platform.ts');
const quoteAPI=await import('../app/api/quotes/route.ts'),bookingAPI=await import('../app/api/bookings/route.ts'),webhookAPI=await import('../app/api/webhooks/stripe/route.ts'),opsAPI=await import('../app/api/operations/route.ts'),requestAPI=await import('../app/api/requests/route.ts'),authAPI=await import('../app/api/auth/route.ts');
await ensurePlatform();
let ip=0;
function req(path,body,headers={},method='POST'){return new Request('https://cruzycabs.co.nz'+path,{method,headers:{'Content-Type':'application/json',Origin:'https://cruzycabs.co.nz','cf-connecting-ip':`test-${++ip}`,...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
const journey={pickup:'Auckland Airport',destination:'Ponsonby',when:'now',passengers:2,luggage:1,accessible:false,childSeat:false,pet:false,stops:[]};
async function quote(extra={}){const response=await quoteAPI.POST(req('/api/quotes',{...journey,...extra}));assert.equal(response.status,200);return response.json();}
async function book(q,extra={},key=q.id){const response=await bookingAPI.POST(req('/api/bookings',{quoteId:q.id,vehicleId:'xl',customer:{name:'Test Customer',email:'customer@example.invalid',phone:'+64211234567',notes:''},paymentMethod:'card',termsAccepted:true,...extra},{Authorization:`Bearer ${q.accessToken}`,'Idempotency-Key':key}));return {response,data:await response.json()};}
async function cookie(address){const raw=String(++serial).padStart(64,'0');await db.prepare('INSERT INTO app_sessions(token_hash,email,expires) VALUES(?,?,?)').bind(await sha(raw),address,Date.now()+600000).run();await db.prepare('INSERT INTO app_session_assurance(token_hash,expires) VALUES(?,?)').bind(await sha(raw),Date.now()+600000).run();return `cc_session=${raw}`;}
async function confirm(booking,{accept=true}={}){
  const admin=await cookie('admin@example.invalid'),address=`driver${++serial}@example.invalid`;
  globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${address}:driver`;
  const driver=await cookie(address);
  const onboard=await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Test Driver',email:address,provider:'Test Fleet',plate:`TEST${serial}`,description:'Test van',vehicleClass:'xl',passengers:7,luggage:6,capabilities:['child-seat','pet'],complianceUntil:'2030-01-01',verified:true},{Cookie:admin}));assert.equal(onboard.status,201);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'availability',status:'available'},{Cookie:driver}))).status,200);
  const row=await db.prepare('SELECT * FROM bookings WHERE reference=?').bind(booking.reference).first();
  if(row.status==='review')assert.equal((await opsAPI.POST(req('/api/operations',{action:'approve',reference:booking.reference,note:'Equipment and route reviewed'},{Cookie:admin}))).status,200);
  const d=await db.prepare('SELECT id FROM app_drivers WHERE email=?').bind(address).first();
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'assign',reference:booking.reference,driverId:d.id},{Cookie:admin}))).status,200);
  const checkout=()=>bookingAPI.PATCH(req('/api/bookings',{reference:booking.reference,action:'checkout'},{Authorization:`Bearer ${booking.accessToken}`}));
  assert.equal((await (await checkout()).json()).checkoutUrl,null,'An offer alone must not unlock payment');
  if(accept)assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept',reference:booking.reference},{Cookie:driver}))).status,200);
  return {driver,admin,id:d.id,checkout};
}
async function paid(booking){
  const row=await db.prepare('SELECT * FROM bookings WHERE reference=?').bind(booking.reference).first();
  if(row.status!=='awaiting_payment')await confirm(booking);
  const checkout=await bookingAPI.PATCH(req('/api/bookings',{reference:booking.reference,action:'checkout'},{Authorization:`Bearer ${booking.accessToken}`}));assert.equal(checkout.status,200);assert.ok((await checkout.json()).checkoutUrl);
  const detail=await db.prepare('SELECT * FROM app_booking_details WHERE booking_id=?').bind(row.id).first();
  const intent={id:`pi_test_${++serial}`,status:'succeeded',amount:detail.price_cents,currency:'nzd',metadata:{booking_id:row.id},latest_charge:`ch_test_${serial}`};intents.set(intent.id,intent);sessions.get(detail.checkout_id).status='complete';sessions.get(detail.checkout_id).payment_intent=intent.id;
  const event={id:`evt_${serial}`,type:'payment_intent.succeeded',data:{object:intent}};return {row,intent,event};
}
async function webhook(event){const body=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),signature=await hmac(`${timestamp}.${body}`,'whsec_fixture');return webhookAPI.POST(new Request('https://cruzycabs.co.nz/api/webhooks/stripe',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body}));}

test('NZ phone formats normalize without requiring the customer to type +64',()=>{
  for(const value of ['0271234567','027 123 4567','(027) 123-4567','64271234567','0064271234567','+64 27 123 4567'])assert.equal(phone(value),'+64271234567');
  assert.equal(phone('021123456'),'+6421123456');
  assert.equal(phone('02212345678'),'+642212345678');
  assert.equal(phone('09 123 4567'),'+6491234567');
  assert.equal(phone('+61 412 345 678'),'+61412345678');
  for(const value of ['027','027abc4567','+640271234567','+6427','+64091234567','1234567'])assert.throws(()=>phone(value));
});

test('autocomplete searches incomplete input within NZ and excludes country-only results',async()=>{
  const response=await addressAPI.GET(req('/api/addresses?q=bethel',undefined,{},'GET'));
  assert.equal(response.status,200);
  const {suggestions}=await response.json();
  assert.deepEqual(autocompleteInput.includedRegionCodes,['nz']);
  assert.equal(autocompleteInput.input,'bethel');
  assert.equal(autocompleteInput.regionCode,'nz');
  assert.equal(suggestions.length,2);
  assert.equal(suggestions[0].primary,'Bethells Beach');
  assert.equal(suggestions[1].label,'10 Bethells Road, Auckland, New Zealand');
  assert.equal(suggestions[0].source,'google');
});

test('Photon suggestions exclude overseas and country-only results',async()=>{
  const key=globalThis.__testEnv.GOOGLE_MAPS_API_KEY;
  globalThis.__testEnv.GOOGLE_MAPS_API_KEY='';globalThis.__testEnv.PHOTON_API_URL='https://photon.example.invalid/api';
  try {
    const response=await addressAPI.GET(req('/api/addresses?q=bethel',undefined,{},'GET'));
    assert.equal(response.status,200);
    const {suggestions}=await response.json();
    assert.equal(suggestions.length,1);assert.equal(suggestions[0].primary,'Bethells Beach');
  } finally {globalThis.__testEnv.GOOGLE_MAPS_API_KEY=key;delete globalThis.__testEnv.PHOTON_API_URL;}
});

test('selected Google predictions resolve NZ coordinates for itinerary estimates',async()=>{
  const response=await addressAPI.GET(req('/api/addresses?placeId=bethells',undefined,{},'GET'));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{latitude:-36.89,longitude:174.45});
});

test('Places permission errors fall back to NZ Photon suggestions',async()=>{
  placesAvailable=false;globalThis.__testEnv.PHOTON_API_URL='https://photon.example.invalid/api';
  try {
    const response=await addressAPI.GET(req('/api/addresses?q=bethel',undefined,{},'GET'));
    assert.equal(response.status,200);
    const {suggestions}=await response.json();assert.equal(suggestions[0].primary,'Bethells Beach');assert.equal(suggestions[0].source,'photon');
  } finally {placesAvailable=true;delete globalThis.__testEnv.PHOTON_API_URL;}
});

test('booking stores a local NZ mobile in international format',async()=>{
  const q=await quote();
  const {response,data}=await book(q,{customer:{name:'NZ Passenger',email:'nz@example.invalid',phone:'027 123 4567',notes:''}});
  assert.equal(response.status,201);
  const stored=await db.prepare('SELECT customer_phone FROM bookings WHERE reference=?').bind(data.reference).first();
  assert.equal(stored.customer_phone,'+64271234567');
});

test('pricing uses road metrics, integer cents and strict capacities',()=>{const value=calculateQuote(journey,{distanceKm:15,durationMin:30});assert.equal(value.distanceKm,15);assert.equal(value.vehicles[0].priceCents,Math.round((650+3525+1440+850)*1.48));assert.deepEqual(value.vehicles.map(v=>v.id),['xl','accessible']);assert.ok(value.vehicles.every(v=>Number.isInteger(v.priceCents)));assert.deepEqual(calculateQuote({...journey,luggage:8},{distanceKm:15,durationMin:30}).vehicles,[]);});
test('equipment and long-distance trips require review',()=>{assert.equal(calculateQuote({...journey,accessible:true},{distanceKm:15,durationMin:30}).state,'manual_review');assert.equal(calculateQuote(journey,{distanceKm:250,durationMin:200}).state,'manual_review');});
test('NZ schedule validates dates, booking window and daylight saving gaps',()=>{assert.throws(()=>scheduledInstant('2020-01-01','08:00'));assert.throws(()=>scheduledInstant('2026-02-30','08:00'));assert.throws(()=>scheduledInstant('2026-09-27','02:30',Date.parse('2026-09-20T00:00:00Z')));assert.equal(scheduledInstant('2026-10-05','08:00',Date.parse('2026-10-04T00:00:00Z')),'2026-10-04T19:00:00.000Z');});
test('journey validation rejects invalid types, negative luggage, oversized groups',()=>{assert.throws(()=>validateJourney({...journey,pickup:8}));assert.throws(()=>validateJourney({...journey,luggage:-1}));assert.throws(()=>validateJourney({...journey,passengers:11}));assert.throws(()=>validateJourney({...journey,accessible:true}));});
test('quote endpoint rejects malformed/null JSON and cross-origin requests',async()=>{assert.equal((await quoteAPI.POST(req('/api/quotes',null))).status,400);assert.equal((await quoteAPI.POST(req('/api/quotes',journey,{Origin:'https://evil.invalid'}))).status,403);assert.equal((await quoteAPI.POST(req('/api/quotes',{...journey,luggage:-1}))).status,400);});
test('missing routing credentials fail without a fabricated fare',async()=>{delete globalThis.__testEnv.GOOGLE_MAPS_API_KEY;assert.equal((await quoteAPI.POST(req('/api/quotes',journey))).status,503);globalThis.__testEnv.GOOGLE_MAPS_API_KEY='test-google';});
test('booking saves the server-priced request without opening payment',async()=>{
  const q=await quote(),before=sessions.size,{response,data}=await book(q,{journey:{pickup:'Changed',destination:'Wellington'},price:1});assert.equal(response.status,201);
  const row=await db.prepare('SELECT b.*,d.price_cents,d.checkout_id FROM bookings b JOIN app_booking_details d ON b.id=d.booking_id WHERE reference=?').bind(data.reference).first();
  assert.equal(JSON.parse(row.journey_json).destination,'Ponsonby');assert.equal(row.price_cents,q.vehicles[0].priceCents);assert.equal(row.status,'awaiting_dispatch');assert.equal(row.payment_state,'not_paid');assert.equal(row.checkout_id,null);assert.equal(data.checkoutUrl,null);assert.equal(sessions.size,before);assert.ok(data.accessToken);
  const responseBefore=await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await responseBefore.json()).checkoutUrl,null);assert.equal(sessions.size,before);
});
test('requests can be recorded while Stripe is unavailable',async()=>{const key=globalThis.__testEnv.STRIPE_SECRET_KEY;globalThis.__testEnv.STRIPE_SECRET_KEY='';try{const {response,data}=await book(await quote());assert.equal(response.status,201);assert.equal(data.checkoutUrl,null);}finally{globalThis.__testEnv.STRIPE_SECRET_KEY=key;}});
test('removed vehicle classes cannot be booked from a previously issued quote',async()=>{for(const vehicleId of ['standard','executive']){const q=await quote();await db.prepare('UPDATE quotes SET result_json=? WHERE id=?').bind(JSON.stringify({...q,vehicles:[...q.vehicles,{id:vehicleId,priceCents:100}]}),q.id).run();assert.equal((await book(q,{vehicleId})).response.status,422);}});
test('expired and unauthorised quotes cannot be booked',async()=>{const q=await quote();await db.prepare('UPDATE quotes SET locked_until=? WHERE id=?').bind('2020-01-01T00:00:00Z',q.id).run();assert.equal((await book(q)).response.status,409);const fresh=await quote();fresh.accessToken='wrong';assert.equal((await book(fresh)).response.status,403);});
test('payment method and explicit policy consent are enforced',async()=>{const q=await quote();assert.equal((await book(q,{paymentMethod:'invalid'})).response.status,400);assert.equal((await book(q,{termsAccepted:false})).response.status,400);});
test('concurrent duplicate booking retries produce one request without payment',async()=>{const q=await quote(),results=await Promise.all([book(q),book(q)]);assert.ok(results.every(r=>[200,201].includes(r.response.status)));assert.equal(results[0].data.reference,results[1].data.reference);assert.equal((await db.prepare('SELECT COUNT(*) n FROM bookings WHERE quote_id=?').bind(q.id).first()).n,1);assert.equal(results[0].data.checkoutUrl,results[1].data.checkoutUrl);});
test('quote reuse or changed idempotency payload is rejected',async()=>{const q=await quote();await book(q);assert.equal((await book(q,{},'new-key')).response.status,409);assert.equal((await book(q,{customer:{name:'Changed',email:'customer@example.invalid',phone:'+64211234567'}})).response.status,409);});
test('secure guest management never authenticates with email/reference alone',async()=>{const q=await quote(),{data}=await book(q);assert.equal((await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}&email=customer@example.invalid`,undefined,{},'GET'))).status,403);const r=await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}`,undefined,{Authorization:`Bearer ${data.accessToken}`},'GET'));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).journey.destination,'Ponsonby');});
test('Stripe signature verifies timestamp and unmodified payload',async()=>{const body=JSON.stringify({id:'evt_signature',type:'test',data:{object:{id:'test'}}}),time=Math.floor(Date.now()/1000),signature=await hmac(`${time}.${body}`,'whsec_fixture');assert.equal((await verifyStripeEvent(body,`t=${time},v1=${signature}`)).id,'evt_signature');await assert.rejects(verifyStripeEvent(body+' ',`t=${time},v1=${signature}`));await assert.rejects(verifyStripeEvent(body,`t=1,v1=${signature}`));});
test('signed paid webhook preserves the confirmed driver and records a receipt once',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);assert.equal((await webhook(p.event)).status,200);assert.equal((await webhook(p.event)).status,200);const row=await db.prepare('SELECT b.status,b.payment_state,d.receipt_url FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.id=?').bind(p.row.id).first();assert.equal(row.status,'accepted');assert.equal(row.payment_state,'paid');assert.match(row.receipt_url,/stripe/);assert.equal((await db.prepare('SELECT COUNT(*) n FROM payments WHERE booking_id=? AND operation=?').bind(p.row.id,'capture').first()).n,1);});
test('payment with mismatched amount cannot fulfil a booking',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);p.intent.amount=1;assert.equal((await webhook(p.event)).status,409);assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'awaiting_payment');});
test('paid cancellation refunds through Stripe and is safely retryable',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);await webhook(p.event);const change=()=>bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await change()).status,200);assert.equal((await change()).status,200);assert.equal(refunds.get(p.intent.latest_charge),p.intent.amount);assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'cancelled');});
test('legacy identity headers cannot grant staff access',async()=>{const r=await opsAPI.GET(req('/api/operations',undefined,{'oai-authenticated-user-email':'admin@example.invalid','oai-authenticated-user-id':'spoof'},'GET'));assert.equal(r.status,403);});
test('driver confirmation unlocks payment and paid trips complete the state machine',async()=>{
  const q=await quote(),{data}=await book(q),{driver,id,admin}=await confirm(data),other=await cookie('other@example.invalid');
  const row=await db.prepare('SELECT * FROM bookings WHERE reference=?').bind(data.reference).first();assert.equal(row.status,'awaiting_payment');assert.equal(row.payment_state,'not_paid');
  assert.ok(sent.some(e=>e.subject.includes(data.reference)&&e.subject.includes('confirmed')&&e.text.includes('secure booking link')));
  const manage=await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}`,undefined,{Authorization:`Bearer ${data.accessToken}`},'GET'));assert.equal((await manage.json()).canPay,true);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'arrive',reference:data.reference},{Cookie:driver}))).status,409);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'assign',reference:data.reference,driverId:id},{Cookie:admin}))).status,409);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'complete',reference:data.reference},{Cookie:driver}))).status,409);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept',reference:data.reference},{Cookie:other}))).status,403);
  const before=sessions.size,p=await paid(data);assert.equal(sessions.size,before+2);await webhook(p.event);
  const again=await book(q);assert.equal(again.data.checkoutUrl,null);
  for(const action of ['arrive','start','complete'])assert.equal((await opsAPI.POST(req('/api/operations',{action,reference:data.reference},{Cookie:driver}))).status,200,action);
  assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'completed');
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:`Bearer ${data.accessToken}`}))).status,409);
});
test('manual review approval goes to driver matching without enabling checkout',async()=>{
  const {data}=await book(await quote({childSeat:true})),admin=await cookie('admin@example.invalid'),before=sessions.size;
  const approved=await opsAPI.POST(req('/api/operations',{action:'approve',reference:data.reference,note:'Child seat requirements checked'},{Cookie:admin}));assert.equal(approved.status,200);assert.equal(sessions.size,before);
  assert.equal((await db.prepare('SELECT status FROM bookings WHERE reference=?').bind(data.reference).first()).status,'awaiting_dispatch');
  const checkout=await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await checkout.json()).checkoutUrl,null);
});
test('legacy awaiting payment requests without a confirmed driver cannot open checkout',async()=>{
  const {data}=await book(await quote());await db.prepare("UPDATE bookings SET status='awaiting_payment' WHERE reference=?").bind(data.reference).run();
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}))).status,409);
});
test('a declined offer returns to driver matching without requesting payment',async()=>{
  const {data}=await book(await quote()),before=sessions.size,{driver,checkout}=await confirm(data,{accept:false});
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'decline',reference:data.reference},{Cookie:driver}))).status,200);
  const row=await db.prepare('SELECT status,payment_state FROM bookings WHERE reference=?').bind(data.reference).first();assert.equal(row.status,'awaiting_dispatch');assert.equal(row.payment_state,'not_paid');
  assert.equal((await (await checkout()).json()).checkoutUrl,null);assert.equal(sessions.size,before);
});
test('unpaid cancellation never creates a checkout or refund',async()=>{
  const {data}=await book(await quote()),before=sessions.size,refundCount=refunds.size;
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:`Bearer ${data.accessToken}`}))).status,200);
  assert.equal(sessions.size,before);assert.equal(refunds.size,refundCount);
});
test('enquiry forms persist cases and send confirmation with idempotent retry',async()=>{const body={kind:'tour',name:'Test Enquirer',email:'enquirer@example.invalid',phone:'+64211234567',details:'Private tour request',consent:true},headers={'Idempotency-Key':'test-enquiry'};const first=await requestAPI.POST(req('/api/requests',body,headers)),second=await requestAPI.POST(req('/api/requests',body,headers));assert.equal(first.status,201);assert.equal(second.status,200);assert.equal((await first.json()).reference,(await second.json()).reference);assert.ok(sent.some(e=>e.subject.includes('enquiry')));});
test('one-time email sign-in creates HttpOnly session and rejects code reuse',async()=>{const start=await authAPI.POST(req('/api/auth',{action:'request',email:'signin@example.invalid'}));assert.equal(start.status,200);const {challenge}=await start.json();const message=sent.findLast(e=>e.to[0]==='signin@example.invalid');const code=message.text.match(/code is (\d{6})/)[1];const verify=await authAPI.POST(req('/api/auth',{action:'verify',challenge,code}));assert.equal(verify.status,200);assert.match(verify.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.equal((await authAPI.POST(req('/api/auth',{action:'verify',challenge,code}))).status,401);});
test('production migration matches runtime schema and applies on a clean database',()=>{const sql=readFileSync(new URL('../drizzle/0001_production.sql',import.meta.url),'utf8');for(const statement of platformSchema)assert.ok(sql.includes(statement),statement);const fresh=new DatabaseSync(':memory:');fresh.exec(readFileSync(new URL('../drizzle/0000_thick_smiling_tiger.sql',import.meta.url),'utf8'));fresh.exec(sql);assert.ok(fresh.prepare("SELECT name FROM sqlite_master WHERE name='app_booking_details'").get());fresh.close();});
