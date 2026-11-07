import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const sqlite=new DatabaseSync(':memory:');
class Statement{
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const meta=sqlite.prepare(this.sql).run(...this.values);return {success:true,results:[],meta};}
}
const db={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const results=statements.map(s=>({success:true,results:sqlite.prepare(s.sql).all(...s.values)}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.__testEnv={DB:db,SITE_URL:'https://cruzycabs.co.nz',APP_SIGNING_SECRET:'a'.repeat(64),JOBS_SECRET:'b'.repeat(64),GOOGLE_MAPS_API_KEY:'test-google',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_MODE:'test',STRIPE_WEBHOOK_SECRET:'whsec_fixture',RESEND_API_KEY:'test-resend',EMAIL_FROM:'test@example.invalid',CARD_PAYMENTS_ENABLED:'true',ONLINE_VEHICLE_CLASSES:'xl,accessible',STAFF_ROLE_BINDINGS:'admin@example.invalid:admin|dispatch,driver@example.invalid:driver,other@example.invalid:driver,partner@example.invalid:partner'};
const sessions=new Map(),intents=new Map(),refunds=new Map(),refundObjects=new Map(),sent=[];let serial=0;
let autocompleteInput;
let placesAvailable=true;
let photonFixture=null;
let emailFailure=false;
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
  if(value.startsWith('https://photon.example.invalid/'))return Response.json({features:photonFixture||[
    {properties:{name:'New Zealand',countrycode:'NZ'},geometry:{coordinates:[174,-41]}},
    {properties:{name:'Bethel',countrycode:'US'},geometry:{coordinates:[-74,41]}},
    {properties:{name:'Bethells Beach',countrycode:'NZ',city:'Auckland',osm_id:12},geometry:{coordinates:[174.45,-36.89]}},
  ]});
  if(value.includes('routes.googleapis.com'))return Response.json({routes:[{distanceMeters:15000,duration:'1800s',legs:[{startLocation:{latLng:{latitude:-36.8,longitude:174.7}},endLocation:{latLng:{latitude:-36.9,longitude:174.8}}}]}]});
  if(value.includes('maps.googleapis.com'))return Response.json({status:'OK',results:[{place_id:'test-place',formatted_address:'Test Auckland address',geometry:{location:{lat:-36.8,lng:174.7}}}]});
  if(value==='https://api.resend.com/emails'){if(emailFailure)return Response.json({name:'rate_limit_exceeded'},{status:429});sent.push(JSON.parse(options.body));return Response.json({id:'email-test'});}
  if(value.startsWith('https://api.stripe.com/v1/')){
    const path=value.split('/v1/')[1],fields=options.body?Object.fromEntries(new URLSearchParams(options.body)):{};
    if(path==='checkout/sessions'){
      const retry=options.headers['Idempotency-Key'];if(sessions.has(retry))return Response.json(sessions.get(retry));
      const object={id:`cs_test_${++serial}`,url:`https://checkout.stripe.com/test-${serial}`,status:'open',payment_intent:null,metadata:{booking_id:fields['metadata[booking_id]']},amount_total:Number(fields['line_items[0][price_data][unit_amount]']),currency:'nzd',fields};sessions.set(retry,object);sessions.set(object.id,object);return Response.json(object);
    }
    if(path.startsWith('checkout/sessions/')){const id=path.split('/')[2],session=sessions.get(id);if(path.endsWith('/expire'))session.status='expired';return Response.json(session||{error:{}});}
    if(path.startsWith('payment_intents/'))return Response.json(intents.get(path.split('/')[1])||{});
    if(path.startsWith('charges/'))return Response.json({id:path.split('/')[1],receipt_url:'https://pay.stripe.com/receipts/test',amount_refunded:refunds.get(path.split('/')[1])||0});
    if(path.startsWith('refunds/'))return Response.json(refundObjects.get(path.split('/')[1])||{});
    if(path==='refunds'){const intent=intents.get(fields.payment_intent);refunds.set(intent.latest_charge,intent.amount);const refund={id:'re_test_'+intent.id,status:'succeeded',amount:intent.amount,currency:'nzd',payment_intent:intent.id};refundObjects.set(refund.id,refund);return Response.json(refund);}
  }
  throw new Error(`Unexpected provider request ${value}`);
};
const {calculateQuote}=await import('../lib/pricing.ts');
const estimateAPI=await import('../app/api/estimates/route.ts');
const {estimateDetails}=await import('../lib/journey-estimate.ts');
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
  const d=await db.prepare('SELECT id FROM app_drivers WHERE email=?').bind(address).first();
  const checkout=()=>bookingAPI.PATCH(req('/api/bookings',{reference:booking.reference,action:'checkout'},{Authorization:`Bearer ${booking.accessToken}`}));
  assert.equal((await (await checkout()).json()).checkoutUrl,null,'A request without staff acceptance must not unlock payment');
  if(accept)assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:booking.reference,driverId:d.id},{Cookie:admin}))).status,200);
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
test('onboarding saves a ten-seat van and contact without inventing compliance expiry',async()=>{
  const admin=await cookie('admin@example.invalid');
  const details={action:'onboard',name:'Test Larger Van',email:'larger-van@example.invalid',phone:'0211234567',plate:'TESTTEN',description:'White test van',vehicleClass:'xl',passengers:10,luggage:10,verified:true};
  const response=await opsAPI.POST(req('/api/operations',details,{Cookie:admin}));
  assert.equal(response.status,201);
  const saved=await db.prepare('SELECT d.*,c.phone,v.passengers,v.luggage,v.compliance_until vehicle_expiry FROM app_drivers d JOIN app_driver_contacts c ON c.driver_id=d.id JOIN app_vehicles v ON v.driver_id=d.id WHERE d.email=?').bind(details.email).first();
  assert.equal(saved.phone,'+64211234567');
  assert.equal(saved.passengers,10);assert.equal(saved.luggage,10);
  assert.equal(saved.compliance_until,'');assert.equal(saved.vehicle_expiry,'');
  assert.equal(saved.status,'offline');assert.equal(saved.provider,'cruzycabs');
  globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${details.email}:driver`;
  const driver=await cookie(details.email);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'availability',status:'available'},{Cookie:driver}))).status,403);
  const view=await opsAPI.GET(req('/api/operations',undefined,{Cookie:admin},'GET'));
  const record=(await view.json()).drivers.find(d=>d.email===details.email);
  assert.equal(record.phone,saved.phone);assert.equal(record.passengers,10);assert.equal(record.luggage,10);
  const repeat=await opsAPI.POST(req('/api/operations',details,{Cookie:admin}));
  assert.equal(repeat.status,200,'An identical retry must confirm the saved record');
  assert.equal((await repeat.json()).alreadyExists,true);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM app_drivers WHERE email=?').bind(details.email).first()).n,1);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM audit_events WHERE entity_id=? AND action=?').bind(saved.id,'compliance.approved').first()).n,1);
  const conflict=await opsAPI.POST(req('/api/operations',{...details,description:'Different van'},{Cookie:admin}));
  assert.equal(conflict.status,409,'Conflicting details must not overwrite the existing record');
  assert.match((await conflict.json()).error,/already saved/);
  assert.equal((await opsAPI.POST(req('/api/operations',{...details,email:'different-driver@example.invalid'},{Cookie:admin}))).status,409);

  assert.equal((await opsAPI.POST(req('/api/operations',{...details,email:'bad-date@example.invalid',plate:'BADDATE',complianceUntil:'2030-02-31'},{Cookie:admin}))).status,400);
  assert.equal((await opsAPI.POST(req('/api/operations',{...details,email:'too-large@example.invalid',plate:'TOOLARGE',passengers:17},{Cookie:admin}))).status,400);
});
async function webhook(event){const body=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),signature=await hmac(`${timestamp}.${body}`,'whsec_fixture');return webhookAPI.POST(new Request('https://cruzycabs.co.nz/api/webhooks/stripe',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body}));}

test('admin records compliance for an offline driver and makes them available for dispatch',async()=>{
  const admin=await cookie('admin@example.invalid');
  const details={action:'onboard',name:'Test Offline Driver',email:'offline-driver@example.invalid',plate:'TESTOFF',description:'White test van',vehicleClass:'xl',passengers:10,luggage:10,verified:true};
  assert.equal((await opsAPI.POST(req('/api/operations',details,{Cookie:admin}))).status,201);
  const {id}=await db.prepare('SELECT id FROM app_drivers WHERE email=?').bind(details.email).first();
  const set=body=>opsAPI.POST(req('/api/operations',{driverId:id,...body},{Cookie:admin}));
  assert.equal((await set({action:'driver_availability',status:'available'})).status,422,'Missing expiry must keep dispatch unavailable');
  assert.equal((await set({action:'driver_compliance',driverExpiry:'2031-06-15',vehicleExpiry:'2027-03-01'})).status,400,'Verification must be confirmed');
  assert.equal((await set({action:'driver_compliance',driverExpiry:'2031-06-15',vehicleExpiry:'2020-01-01',verified:true})).status,400,'Past vehicle expiry must be rejected');
  assert.equal((await set({action:'driver_compliance',driverExpiry:'2031-06-15',vehicleExpiry:'2027-03-01',verified:true})).status,200);
  const saved=await db.prepare('SELECT d.compliance_until,v.compliance_until vehicle_expiry FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=?').bind(id).first();
  assert.equal(saved.compliance_until,'2031-06-15');assert.equal(saved.vehicle_expiry,'2027-03-01');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM audit_events WHERE entity_id=? AND action=?').bind(id,'compliance.updated').first()).n,1);
  globalThis.__testEnv.STAFF_ROLE_BINDINGS+=',dispatch@example.invalid:dispatch';
  const dispatcher=await cookie('dispatch@example.invalid');
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'driver_availability',driverId:id,status:'available'},{Cookie:dispatcher}))).status,403);
  assert.equal((await set({action:'driver_availability',status:'available'})).status,200);
  assert.equal((await db.prepare('SELECT status FROM app_drivers WHERE id=?').bind(id).first()).status,'available');
  assert.equal((await set({action:'driver_availability',status:'offline'})).status,200);
});
test('booking reviews require private access, validate scores and save every rating once',async()=>{
  const reviewAPI=await import('../app/api/bookings/review/route.ts');
  const {data}=await book(await quote());
  const body={reference:data.reference,rating:1,comment:'The booking process could be clearer.'};
  assert.equal((await reviewAPI.POST(req('/api/bookings/review',body))).status,403);
  assert.equal((await reviewAPI.POST(req('/api/bookings/review',body,{Authorization:'Bearer wrong'}))).status,403);
  const headers={Authorization:`Bearer ${data.accessToken}`};
  assert.equal((await reviewAPI.POST(req('/api/bookings/review',body,{...headers,Origin:'https://other.example'}))).status,403);
  for(const rating of [0,6,2.5,'5',null])assert.equal((await reviewAPI.POST(req('/api/bookings/review',{...body,rating},headers))).status,400);
  assert.equal((await reviewAPI.POST(req('/api/bookings/review',{...body,comment:'x'.repeat(2001)},headers))).status,400);
  const first=await reviewAPI.POST(req('/api/bookings/review',body,headers));assert.equal(first.status,201);
  const retry=await reviewAPI.POST(req('/api/bookings/review',body,headers));assert.equal(retry.status,200);
  assert.equal((await first.json()).reference,(await retry.json()).reference);
  assert.equal((await reviewAPI.POST(req('/api/bookings/review',{...body,rating:5},headers))).status,409);
  const rows=await db.prepare("SELECT data_json FROM app_requests WHERE kind='review'").all();
  const saved=rows.results.map(row=>JSON.parse(row.data_json)).filter(row=>row.bookingReference===data.reference);
  assert.equal(saved.length,1);assert.equal(saved[0].rating,1);assert.equal(saved[0].experience,'booking');
  const details=await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}`,undefined,headers,'GET'));
  assert.equal((await details.json()).reviewSubmitted,true);
});

test('completed-journey reviews use server status and concurrent retries cannot duplicate feedback',async()=>{
  const reviewAPI=await import('../app/api/bookings/review/route.ts');
  const {data}=await book(await quote());
  await db.prepare("UPDATE bookings SET status='completed',payment_state='paid' WHERE reference=?").bind(data.reference).run();
  const body={reference:data.reference,rating:5,comment:'A helpful journey.',experience:'booking'};
  const headers={Authorization:`Bearer ${data.accessToken}`};
  const replies=await Promise.all([reviewAPI.POST(req('/api/bookings/review',body,headers)),reviewAPI.POST(req('/api/bookings/review',body,headers))]);
  assert.ok(replies.every(response=>[200,201].includes(response.status)));
  const records=await db.prepare("SELECT data_json FROM app_requests WHERE kind='review'").all();
  const saved=records.results.map(row=>JSON.parse(row.data_json)).filter(row=>row.bookingReference===data.reference);
  assert.equal(saved.length,1);assert.equal(saved[0].experience,'journey');
});

test('checkout succeeds to the thank-you page while cancellation returns to booking management',async()=>{
  const {data}=await book(await quote());
  const {checkout}=await confirm(data);
  assert.equal((await checkout()).status,200);
  const detail=await db.prepare('SELECT checkout_id FROM app_booking_details WHERE booking_id=(SELECT id FROM bookings WHERE reference=?)').bind(data.reference).first();
  const session=sessions.get(detail.checkout_id);
  const success=new URL(session.fields.success_url),cancel=new URL(session.fields.cancel_url);
  assert.equal(success.pathname,'/thank-you');assert.equal(success.searchParams.get('payment'),'return');
  assert.equal(success.searchParams.get('ref'),data.reference);assert.ok(success.hash.includes(data.accessToken));
  assert.equal(success.searchParams.has('token'),false);assert.equal(cancel.pathname,'/manage-booking');
});

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

test('street suggestions omit estate and small locality labels but retain the postal address and coordinates',async()=>{
  const key=globalThis.__testEnv.GOOGLE_MAPS_API_KEY;
  globalThis.__testEnv.GOOGLE_MAPS_API_KEY='';globalThis.__testEnv.PHOTON_API_URL='https://photon.example.invalid/api';
  photonFixture=[{properties:{housenumber:'17',street:'Example Street',name:'Example Estate',locality:'Example Development',district:'Example Suburb',city:'Example City',state:'Auckland',postcode:'2000',country:'New Zealand',countrycode:'NZ',osm_id:123},geometry:{coordinates:[174.8,-36.9]}}];
  try{
    const response=await addressAPI.GET(req('/api/addresses?q=example',undefined,{},'GET'));assert.equal(response.status,200);
    const {suggestions}=await response.json();assert.equal(suggestions.length,1);
    assert.equal(suggestions[0].primary,'17 Example Street');
    assert.equal(suggestions[0].secondary,'Example Suburb, Example City, Auckland, 2000, New Zealand');
    assert.equal(suggestions[0].label,'17 Example Street, Example Suburb, Example City, Auckland, 2000, New Zealand');
    assert.equal(suggestions[0].latitude,-36.9);assert.equal(suggestions[0].longitude,174.8);
  }finally{globalThis.__testEnv.GOOGLE_MAPS_API_KEY=key;delete globalThis.__testEnv.PHOTON_API_URL;photonFixture=null;}
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
test('pickups 40+ minutes from Takanini add a flat driver travel fee',()=>{const base=calculateQuote(journey,{distanceKm:15,durationMin:30});const near=calculateQuote(journey,{distanceKm:15,durationMin:30,positioningMin:38.6});assert.equal(near.vehicles[0].priceCents,base.vehicles[0].priceCents);assert.equal(near.positioning.feeCents,0);const far=calculateQuote(journey,{distanceKm:15,durationMin:30,positioningMin:52.4});assert.equal(far.positioning.minutes,53);assert.equal(far.vehicles[0].positioningFeeCents,53*85);assert.equal(far.vehicles[0].priceCents,base.vehicles[0].priceCents+53*85);assert.equal(base.positioning,null);});
test('equipment and long-distance trips require review',()=>{assert.equal(calculateQuote({...journey,accessible:true},{distanceKm:15,durationMin:30}).state,'manual_review');assert.equal(calculateQuote(journey,{distanceKm:250,durationMin:200}).state,'manual_review');});
test('NZ schedule validates dates, booking window and daylight saving gaps',()=>{assert.throws(()=>scheduledInstant('2020-01-01','08:00'));assert.throws(()=>scheduledInstant('2026-02-30','08:00'));assert.throws(()=>scheduledInstant('2026-09-27','02:30',Date.parse('2026-09-20T00:00:00Z')));assert.equal(scheduledInstant('2026-10-05','08:00',Date.parse('2026-10-04T00:00:00Z')),'2026-10-04T19:00:00.000Z');});
test('journey validation rejects invalid types, negative luggage, oversized groups',()=>{assert.throws(()=>validateJourney({...journey,pickup:8}));assert.throws(()=>validateJourney({...journey,luggage:-1}));assert.throws(()=>validateJourney({...journey,passengers:11}));assert.throws(()=>validateJourney({...journey,accessible:true}));});
test('quote endpoint rejects malformed/null JSON and cross-origin requests',async()=>{assert.equal((await quoteAPI.POST(req('/api/quotes',null))).status,400);assert.equal((await quoteAPI.POST(req('/api/quotes',journey,{Origin:'https://evil.invalid'}))).status,403);assert.equal((await quoteAPI.POST(req('/api/quotes',{...journey,luggage:-1}))).status,400);});
test('missing routing credentials fail without a fabricated fare',async()=>{delete globalThis.__testEnv.GOOGLE_MAPS_API_KEY;assert.equal((await quoteAPI.POST(req('/api/quotes',journey))).status,503);globalThis.__testEnv.GOOGLE_MAPS_API_KEY='test-google';});

test('enquiry estimates use active pricing while bookings are paused and create no quote or booking',async()=>{
  const previousMode=process.env.NODE_ENV,previousFlag=globalThis.__testEnv.BOOKINGS_ENABLED;
  const beforeQuotes=sqlite.prepare('SELECT COUNT(*) count FROM quotes').get().count,beforeBookings=sqlite.prepare('SELECT COUNT(*) count FROM bookings').get().count,beforeEmails=sent.length;
  process.env.NODE_ENV='production';globalThis.__testEnv.BOOKINGS_ENABLED='false';
  try{
    assert.equal((await quoteAPI.POST(req('/api/quotes',journey))).status,503);
    const response=await estimateAPI.POST(req('/api/estimates',{...journey,passengers:7}));
    assert.equal(response.status,200);const estimate=await response.json();
    assert.equal(estimate.estimateOnly,true);assert.equal(estimate.id,undefined);assert.equal(estimate.accessToken,undefined);
    assert.deepEqual(estimate.vehicles.map(v=>v.id),['xl']);
    assert.equal(estimate.vehicles[0].priceCents,calculateQuote({...journey,passengers:7},{distanceKm:15,durationMin:30}).vehicles[0].priceCents);
    assert.match(estimateDetails(estimate).join('\n'),/whole group; subject to operations confirmation/);
    const {journeyFromEnquiry}=await import('../lib/enquiry-bookings.ts');
    const details=['Journey request','Pickup: Woodhouse Mountain Lodge','Destination: 568 Matakana Road','Pickup time: As soon as available','Passengers: 7','Luggage: 0','Wheelchair assistance: No','Child seat: No','Pet: No',...estimateDetails(estimate),'Notes: '].join('\n');
    assert.equal(journeyFromEnquiry(details).passengers,7,'Estimated fare fields must preserve operations acceptance of the journey');
    assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM quotes').get().count,beforeQuotes);
    assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM bookings').get().count,beforeBookings);assert.equal(sent.length,beforeEmails);
  }finally{if(previousMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousMode;if(previousFlag===undefined)delete globalThis.__testEnv.BOOKINGS_ENABLED;else globalThis.__testEnv.BOOKINGS_ENABLED=previousFlag;}
});

test('enquiry estimates reject invalid journeys and provider failures without inventing a price',async()=>{
  assert.equal((await estimateAPI.POST(req('/api/estimates',{...journey,passengers:11}))).status,400);
  assert.deepEqual(calculateQuote({...journey,passengers:10},{distanceKm:15,durationMin:30}).vehicles.map(v=>v.id),["xl"]);
  assert.equal((await estimateAPI.POST(req('/api/estimates',journey,{Origin:'https://evil.invalid'}))).status,403);
  assert.equal((await estimateAPI.POST(req('/api/estimates',{...journey,passengers:7,accessible:true,wheelchair:'ramp'}))).status,422);
  const key=globalThis.__testEnv.GOOGLE_MAPS_API_KEY;delete globalThis.__testEnv.GOOGLE_MAPS_API_KEY;
  try{const response=await estimateAPI.POST(req('/api/estimates',journey));assert.equal(response.status,503);assert.equal((await response.json()).vehicles,undefined);}finally{globalThis.__testEnv.GOOGLE_MAPS_API_KEY=key;}
});
test('booking saves the server-priced request without opening payment',async()=>{
  const q=await quote(),before=sessions.size,{response,data}=await book(q,{journey:{pickup:'Changed',destination:'Wellington'},price:1});assert.equal(response.status,201);
  const row=await db.prepare('SELECT b.*,d.price_cents,d.checkout_id FROM bookings b JOIN app_booking_details d ON b.id=d.booking_id WHERE reference=?').bind(data.reference).first();
  assert.equal(JSON.parse(row.journey_json).destination,'Ponsonby');assert.equal(row.price_cents,q.vehicles[0].priceCents);assert.equal(row.status,'review');assert.equal(row.payment_state,'not_paid');assert.equal(row.checkout_id,null);assert.equal(data.checkoutUrl,null);assert.equal(sessions.size,before);assert.ok(data.accessToken);
  const responseBefore=await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await responseBefore.json()).checkoutUrl,null);assert.equal(sessions.size,before);
});
test('requests can be recorded while Stripe is unavailable',async()=>{const key=globalThis.__testEnv.STRIPE_SECRET_KEY;globalThis.__testEnv.STRIPE_SECRET_KEY='';try{const {response,data}=await book(await quote());assert.equal(response.status,201);assert.equal(data.checkoutUrl,null);}finally{globalThis.__testEnv.STRIPE_SECRET_KEY=key;}});

test('operations receives full booking details once, including NZ schedule and assistance',async()=>{
  const pickup=new Date(Date.now()+86400000),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(pickup).map(p=>[p.type,p.value]));
  const q=await quote({when:'schedule',date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,accessible:true,wheelchair:'hoist',childSeat:true,pet:true,stops:['10 Queen Street'],airportTerminal:'International',flightNumber:'NZ123'});
  const extra={vehicleId:'accessible',bookingForOther:true,customer:{name:'Dispatch Passenger',email:'dispatch-test@example.invalid',phone:'+64211234567',notes:'Meet by arrivals'}};
  const {data,response}=await book(q,extra);assert.equal(response.status,201);
  const messages=sent.filter(m=>m.to.includes('operations@cruzycabs.co.nz')&&m.subject.includes(data.reference));assert.equal(messages.length,1);
  for(const value of ['Dispatch Passenger','dispatch-test@example.invalid','+64211234567','Auckland Airport','Ponsonby','10 Queen Street','Accessible taxi','Passengers: 2','Luggage: 1','hoist','Child seat: Required','Pet: Yes','International','NZ123','Meet by arrivals','New Zealand time','Booked for someone else: Yes','NZD','not paid','/dispatch'])assert.ok(messages[0].text.includes(value),value);
  assert.ok(!messages[0].text.includes('#token='));
  await book(q,extra);assert.equal(sent.filter(m=>m.to.includes('operations@cruzycabs.co.nz')&&m.subject.includes(data.reference)).length,1);
});

test('operations mail recovers active older bookings and retries provider failures without losing a booking',async()=>{
  const {deliverOutbox}=await import('../lib/notifications.ts');
  const {data}=await book(await quote());const row=await db.prepare('SELECT id FROM bookings WHERE reference=?').bind(data.reference).first();
  await db.prepare('DELETE FROM app_outbox WHERE dedupe_key=?').bind(`operations-booking:${row.id}`).run();
  await deliverOutbox();await deliverOutbox();assert.equal((await db.prepare('SELECT COUNT(*) n FROM app_outbox WHERE dedupe_key=?').bind(`operations-booking:${row.id}`).first()).n,1);
  emailFailure=true;let failed;try{failed=await book(await quote());assert.equal(failed.response.status,201);}finally{emailFailure=false;}
  const saved=await db.prepare('SELECT id FROM bookings WHERE reference=?').bind(failed.data.reference).first();
  const pending=await db.prepare('SELECT state,attempts FROM app_outbox WHERE dedupe_key=?').bind(`operations-booking:${saved.id}`).first();assert.equal(pending.state,'pending');assert.equal(pending.attempts,1);
  await db.prepare("UPDATE app_outbox SET next_attempt='2000-01-01' WHERE state='pending'").run();await deliverOutbox();
  assert.equal(sent.filter(m=>m.to.includes('operations@cruzycabs.co.nz')&&m.subject.includes(failed.data.reference)).length,1);
});
test('removed vehicle classes cannot be booked from a previously issued quote',async()=>{for(const vehicleId of ['standard','executive']){const q=await quote();await db.prepare('UPDATE quotes SET result_json=? WHERE id=?').bind(JSON.stringify({...q,vehicles:[...q.vehicles,{id:vehicleId,priceCents:100}]}),q.id).run();assert.equal((await book(q,{vehicleId})).response.status,422);}});
test('expired and unauthorised quotes cannot be booked',async()=>{const q=await quote();await db.prepare('UPDATE quotes SET locked_until=? WHERE id=?').bind('2020-01-01T00:00:00Z',q.id).run();assert.equal((await book(q)).response.status,409);const fresh=await quote();fresh.accessToken='wrong';assert.equal((await book(fresh)).response.status,403);});
test('payment method and explicit policy consent are enforced',async()=>{const q=await quote();assert.equal((await book(q,{paymentMethod:'invalid'})).response.status,400);assert.equal((await book(q,{termsAccepted:false})).response.status,400);});
test('concurrent duplicate booking retries produce one request without payment',async()=>{const q=await quote(),results=await Promise.all([book(q),book(q)]);assert.ok(results.every(r=>[200,201].includes(r.response.status)));assert.equal(results[0].data.reference,results[1].data.reference);assert.equal((await db.prepare('SELECT COUNT(*) n FROM bookings WHERE quote_id=?').bind(q.id).first()).n,1);assert.equal(results[0].data.checkoutUrl,results[1].data.checkoutUrl);});
test('quote reuse or changed idempotency payload is rejected',async()=>{const q=await quote();await book(q);assert.equal((await book(q,{},'new-key')).response.status,409);assert.equal((await book(q,{customer:{name:'Changed',email:'customer@example.invalid',phone:'+64211234567'}})).response.status,409);});
test('secure guest management never authenticates with email/reference alone',async()=>{const q=await quote(),{data}=await book(q);assert.equal((await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}&email=customer@example.invalid`,undefined,{},'GET'))).status,403);const r=await bookingAPI.GET(req(`/api/bookings?reference=${data.reference}`,undefined,{Authorization:`Bearer ${data.accessToken}`},'GET'));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).journey.destination,'Ponsonby');});
test('Stripe signature verifies timestamp and unmodified payload',async()=>{const body=JSON.stringify({id:'evt_signature',type:'test',data:{object:{id:'test'}}}),time=Math.floor(Date.now()/1000),signature=await hmac(`${time}.${body}`,'whsec_fixture');assert.equal((await verifyStripeEvent(body,`t=${time},v1=${signature}`)).id,'evt_signature');await assert.rejects(verifyStripeEvent(body+' ',`t=${time},v1=${signature}`));await assert.rejects(verifyStripeEvent(body,`t=1,v1=${signature}`));});
test('signed paid webhook preserves the assigned driver, records a receipt and notifies operations once',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);assert.equal((await webhook(p.event)).status,200);assert.equal((await webhook(p.event)).status,200);assert.equal((await webhook({id:p.event.id+'-checkout',type:'checkout.session.completed',data:{object:{payment_intent:p.intent.id}}})).status,200);const row=await db.prepare('SELECT b.status,b.payment_state,d.receipt_url FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.id=?').bind(p.row.id).first();assert.equal(row.status,'accepted');assert.equal(row.payment_state,'paid');assert.match(row.receipt_url,/stripe/);assert.equal((await db.prepare('SELECT COUNT(*) n FROM payments WHERE booking_id=? AND operation=?').bind(p.row.id,'capture').first()).n,1);assert.equal(sent.filter(e=>e.to[0]==='operations@cruzycabs.co.nz'&&e.subject===`Payment confirmed for ${data.reference}`).length,1);});
test('payment with mismatched amount cannot fulfil a booking',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);p.intent.amount=1;assert.equal((await webhook(p.event)).status,409);assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'awaiting_payment');});
test('paid cancellation refunds through Stripe and is safely retryable',async()=>{const q=await quote(),{data}=await book(q),p=await paid(data);await webhook(p.event);const change=()=>bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await change()).status,200);assert.equal((await change()).status,200);assert.equal(refunds.get(p.intent.latest_charge),p.intent.amount);assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'cancelled');});
test('legacy identity headers cannot grant staff access',async()=>{const r=await opsAPI.GET(req('/api/operations',undefined,{'oai-authenticated-user-email':'admin@example.invalid','oai-authenticated-user-id':'spoof'},'GET'));assert.equal(r.status,403);});
test('staff assignment unlocks payment and paid trips complete the state machine',async()=>{
  const q=await quote(),{data}=await book(q),{driver,id,admin}=await confirm(data),other=await cookie('other@example.invalid');
  const row=await db.prepare('SELECT * FROM bookings WHERE reference=?').bind(data.reference).first();assert.equal(row.status,'awaiting_payment');assert.equal(row.payment_state,'not_paid');
  assert.ok(sent.some(e=>e.subject.includes(data.reference)&&e.subject.includes('accepted')&&e.text.includes('private booking link')));
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
test('reviewed requests cannot open payment or bypass the accept or decline decision',async()=>{
  const {data}=await book(await quote({childSeat:true})),admin=await cookie('admin@example.invalid'),before=sessions.size;
  const bypass=await opsAPI.POST(req('/api/operations',{action:'approve',reference:data.reference,note:'Child seat requirements checked'},{Cookie:admin}));assert.equal(bypass.status,403);assert.equal(sessions.size,before);
  assert.equal((await db.prepare('SELECT status FROM bookings WHERE reference=?').bind(data.reference).first()).status,'review');
  const checkout=await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}));assert.equal((await checkout.json()).checkoutUrl,null);
});
test('legacy awaiting payment requests without a confirmed driver cannot open checkout',async()=>{
  const {data}=await book(await quote());await db.prepare("UPDATE bookings SET status='awaiting_payment' WHERE reference=?").bind(data.reference).run();
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}))).status,409);
});
test('staff decline closes a priced request without requesting payment',async()=>{
  const {data}=await book(await quote()),before=sessions.size,admin=await cookie('admin@example.invalid');
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'decline_booking',reference:data.reference,note:'No suitable vehicle available'},{Cookie:admin}))).status,200);
  const row=await db.prepare('SELECT status,payment_state FROM bookings WHERE reference=?').bind(data.reference).first();assert.equal(row.status,'declined');assert.equal(row.payment_state,'not_paid');
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'checkout'},{Authorization:`Bearer ${data.accessToken}`}))).status,200);assert.equal(sessions.size,before);
  assert.ok(sent.some(e=>e.subject.includes(data.reference)&&e.subject.includes('declined')));
});
test('competing accept and decline decisions produce one final outcome',async()=>{
  const {data}=await book(await quote()),{admin,id}=await confirm(data,{accept:false});
  const results=await Promise.all([
    opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId:id},{Cookie:admin})),
    opsAPI.POST(req('/api/operations',{action:'decline_booking',reference:data.reference,note:'No suitable vehicle'},{Cookie:admin})),
  ]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  const row=await db.prepare('SELECT status FROM bookings WHERE reference=?').bind(data.reference).first();
  assert.ok(['awaiting_payment','declined'].includes(row.status));
  const messages=sent.filter(item=>item.to[0]==='customer@example.invalid'&&item.subject.includes(data.reference)&&(/accepted|declined/.test(item.subject)));
  assert.equal(messages.length,1);
});
test('unpaid cancellation never creates a checkout or refund',async()=>{
  const {data}=await book(await quote()),before=sessions.size,refundCount=refunds.size;
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:`Bearer ${data.accessToken}`}))).status,200);
  assert.equal(sessions.size,before);assert.equal(refunds.size,refundCount);
});
test('enquiry forms persist cases and send confirmation with idempotent retry',async()=>{const body={kind:'tour',name:'Test Enquirer',email:'enquirer@example.invalid',phone:'+64211234567',details:'Private tour request',consent:true},headers={'Idempotency-Key':'test-enquiry'};const first=await requestAPI.POST(req('/api/requests',body,headers)),second=await requestAPI.POST(req('/api/requests',body,headers));assert.equal(first.status,201);assert.equal(second.status,200);assert.equal((await first.json()).reference,(await second.json()).reference);assert.ok(sent.some(e=>e.subject.includes('enquiry')));});
test('staff accepts a complete enquiry without editing its journey and customer confirms before payment',async()=>{
  const details=['Journey request','Pickup: Woodhouse Mountain Lodge, Rodney, Auckland, New Zealand','Destination: 568 Matakana Road, Warkworth, Rodney, Auckland, 0910, New Zealand','Via: Direct','Pickup time: As soon as available','Passengers: 7','Luggage: 0','Wheelchair assistance: No','Child seat: No','Pet: No','Terminal: Not supplied','Flight: Not supplied','Notes: '].join('\n');
  const submitted=await requestAPI.POST(req('/api/requests',{kind:'journey',name:'Enquiry Passenger',email:'offer-customer@example.invalid',phone:'+64211234567',details,consent:true},{'Idempotency-Key':'unpriced-enquiry'}));
  assert.equal(submitted.status,201);
  const {reference}=await submitted.json(),enquiry=await db.prepare('SELECT id,state FROM app_requests WHERE reference=?').bind(reference).first(),admin=await cookie('admin@example.invalid');
  const onboarding=await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Enquiry Driver',email:'enquiry-driver@example.invalid',plate:'ENQ123',description:'White van',vehicleClass:'xl',passengers:7,luggage:2,complianceUntil:'2030-01-01',verified:true},{Cookie:admin}));
  assert.equal(onboarding.status,201);
  const {driverId}=await onboarding.json();
  await db.prepare("UPDATE app_drivers SET status='available' WHERE id=?").bind(driverId).run();
  const accepted=await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:12500,verified:true,journey:{pickup:'Changed by staff'}},{Cookie:admin}));
  assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
  const offer=await accepted.json();
  assert.equal(offer.status,'pending_customer_confirmation');
  const booking=await db.prepare('SELECT b.id,b.journey_json,d.price_cents FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.reference=?').bind(offer.reference).first();
  assert.equal(JSON.parse(booking.journey_json).pickup,'Woodhouse Mountain Lodge, Rodney, Auckland, New Zealand');
  assert.equal(booking.price_cents,12500);
  assert.equal((await db.prepare('SELECT state FROM app_assignments WHERE booking_id=?').bind(booking.id).first()).state,'accepted');
  assert.equal((await db.prepare('SELECT state FROM app_requests WHERE id=?').bind(enquiry.id).first()).state,'accepted');
  const access=await (await import('../lib/security.ts')).managementToken(booking.id);
  const before=await bookingAPI.GET(req('/api/bookings?reference='+offer.reference,undefined,{Authorization:`Bearer ${access}`},'GET'));
  assert.equal((await before.json()).canPay,false);
  assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:offer.reference,action:'confirm_offer',termsAccepted:true},{Authorization:`Bearer ${access}`}))).status,200);
  const after=await bookingAPI.GET(req('/api/bookings?reference='+offer.reference,undefined,{Authorization:`Bearer ${access}`},'GET'));
  assert.equal((await after.json()).canPay,true);
  assert.ok(sent.some(item=>item.to[0]==='offer-customer@example.invalid'&&item.subject.includes(offer.reference)));
  const retry=await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:12500,verified:true},{Cookie:admin}));
  assert.equal(retry.status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM bookings WHERE idempotency_key=?').bind('enquiry:'+enquiry.id).first()).n,1);
});

test('staff accepts an enquiry for in-person payment while card bookings are paused and the driver can complete it',async()=>{
  const details=['Journey request','Pickup: Woodhouse Mountain Lodge, Rodney, Auckland, New Zealand','Destination: 568 Matakana Road, Warkworth, Rodney, Auckland, 0910, New Zealand','Via: Direct','Pickup time: As soon as available','Passengers: 4','Luggage: 0','Wheelchair assistance: No','Child seat: No','Pet: No','Terminal: Not supplied','Flight: Not supplied','Notes: '].join('\n');
  const submitted=await requestAPI.POST(req('/api/requests',{kind:'journey',name:'Cash Passenger',email:'cash-customer@example.invalid',phone:'+64211234567',details,consent:true},{'Idempotency-Key':'in-person-enquiry'}));
  assert.equal(submitted.status,201);
  const {reference}=await submitted.json(),enquiry=await db.prepare('SELECT id FROM app_requests WHERE reference=?').bind(reference).first(),admin=await cookie('admin@example.invalid');
  const driverEmail='cash-driver@example.invalid';globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${driverEmail}:driver`;
  const onboarding=await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Cash Driver',email:driverEmail,plate:'CASH01',description:'White van',vehicleClass:'xl',passengers:7,luggage:2,complianceUntil:'2030-01-01',verified:true},{Cookie:admin}));
  const {driverId}=await onboarding.json();
  await db.prepare("UPDATE app_drivers SET status='available' WHERE id=?").bind(driverId).run();
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';globalThis.__testEnv.BOOKINGS_ENABLED='false';
  try{
    const card=await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:8423,paymentMethod:'card',verified:true},{Cookie:admin}));
    assert.equal(card.status,503,'Card acceptance stays paused');
    assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:8423,paymentMethod:'cheque',verified:true},{Cookie:admin}))).status,400);
    const accepted=await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:8423,paymentMethod:'in_person',verified:true},{Cookie:admin}));
    assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
    const offer=await accepted.json();
    const booking=await db.prepare('SELECT id,payment_method,payment_state FROM bookings WHERE reference=?').bind(offer.reference).first();
    assert.equal(booking.payment_method,'in_person');assert.equal(booking.payment_state,'in_person');
    assert.ok(sent.some(item=>item.to[0]==='cash-customer@example.invalid'&&item.subject.includes(offer.reference)&&/in person/.test(item.text)));
    const access=await (await import('../lib/security.ts')).managementToken(booking.id),auth={Authorization:`Bearer ${access}`};
    assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:offer.reference,action:'confirm_offer',termsAccepted:true},auth))).status,200);
    const view=await (await bookingAPI.GET(req('/api/bookings?reference='+offer.reference,undefined,auth,'GET'))).json();
    assert.equal(view.status,'accepted');assert.equal(view.canPay,false);
    assert.equal((await (await bookingAPI.PATCH(req('/api/bookings',{reference:offer.reference,action:'checkout'},auth))).json()).checkoutUrl,null);
    const retry=await opsAPI.POST(req('/api/operations',{action:'accept_request',id:enquiry.id,driverId,priceCents:8423,paymentMethod:'in_person',verified:true},{Cookie:admin}));
    assert.equal(retry.status,200);
  }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;delete globalThis.__testEnv.BOOKINGS_ENABLED;}
  const driver=await cookie(driverEmail),ref=(await db.prepare("SELECT reference FROM bookings WHERE idempotency_key=?").bind('enquiry:'+enquiry.id).first()).reference;
  for(const action of ['arrive','start','complete'])assert.equal((await opsAPI.POST(req('/api/operations',{action,reference:ref},{Cookie:driver}))).status,200,action);
  assert.equal((await db.prepare("SELECT status FROM bookings WHERE reference=?").bind(ref).first()).status,'completed');
});
test('online bookings are paid to the driver in person and card is refused unless enabled',async()=>{
  const previous=globalThis.__testEnv.CARD_PAYMENTS_ENABLED;delete globalThis.__testEnv.CARD_PAYMENTS_ENABLED;
  try{
    assert.equal((await book(await quote(),{paymentMethod:'card'})).response.status,400,'Card is refused while online payment is off');
    const {response,data}=await book(await quote(),{paymentMethod:'in_person'});
    assert.equal(response.status,201);assert.match(data.paymentMessage,/in person/);
    const row=await db.prepare('SELECT id,payment_method,payment_state,status FROM bookings WHERE reference=?').bind(data.reference).first();
    assert.equal(row.payment_method,'in_person');assert.equal(row.payment_state,'in_person');assert.equal(row.status,'review');
    const admin=await cookie('admin@example.invalid'),address=`priced-cash${++serial}@example.invalid`;
    globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${address}:driver`;
    const onboard=await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Priced Cash Driver',email:address,plate:`PCASH${serial}`,description:'Test van',vehicleClass:'xl',passengers:7,luggage:6,complianceUntil:'2030-01-01',verified:true},{Cookie:admin}));
    const {driverId}=await onboard.json();
    await db.prepare("UPDATE app_drivers SET status='available' WHERE id=?").bind(driverId).run();
    const accepted=await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId},{Cookie:admin}));
    assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
    assert.equal((await accepted.json()).status,'accepted');
    assert.ok(sent.some(item=>item.subject===`Booking ${data.reference} confirmed`&&/in person/.test(item.text)));
    const view=await (await bookingAPI.GET(req('/api/bookings?reference='+data.reference,undefined,{Authorization:`Bearer ${data.accessToken}`},'GET'))).json();
    assert.equal(view.status,'accepted');assert.equal(view.canPay,false);
    const driver=await cookie(address);
    for(const action of ['arrive','start','complete'])assert.equal((await opsAPI.POST(req('/api/operations',{action,reference:data.reference},{Cookie:driver}))).status,200,action);
    assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(row.id).first()).status,'completed');
  }finally{if(previous===undefined)delete globalThis.__testEnv.CARD_PAYMENTS_ENABLED;else globalThis.__testEnv.CARD_PAYMENTS_ENABLED=previous;}
});
test('staff can decline an open journey enquiry exactly once without creating a booking',async()=>{
  const admin=await cookie('admin@example.invalid');
  const submitted=await requestAPI.POST(req('/api/requests',{kind:'journey',name:'Decline Test',email:'decline-enquiry@example.invalid',phone:'+64211234567',details:'Journey request\nPickup: Auckland\nDestination: Hamilton',consent:true},{'Idempotency-Key':'decline-enquiry'}));
  const {reference}=await submitted.json(),record=await db.prepare('SELECT id FROM app_requests WHERE reference=?').bind(reference).first();
  const declined=await opsAPI.POST(req('/api/operations',{action:'decline_request',id:record.id,note:'No suitable vehicle available'},{Cookie:admin}));
  assert.equal(declined.status,200);
  assert.equal((await db.prepare('SELECT state FROM app_requests WHERE id=?').bind(record.id).first()).state,'declined');
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM bookings WHERE idempotency_key=?').bind('enquiry:'+record.id).first()).n,0);
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'decline_request',id:record.id,note:'Again'},{Cookie:admin}))).status,409);
  assert.equal(sent.filter(item=>item.to[0]==='decline-enquiry@example.invalid'&&item.subject===`Your cruzycabs enquiry ${reference}`).length,1);
});

test('priced requests expose the customer quote and staff acceptance cannot edit it',async()=>{
  const q=await quote(),{data}=await book(q),admin=await cookie('admin@example.invalid');
  const list=await (await opsAPI.GET(req('/api/operations',undefined,{Cookie:admin},'GET'))).json();
  const visible=list.pricedRequests.find(item=>item.reference===data.reference);
  assert.equal(visible.price_cents,q.vehicles[0].priceCents);
  assert.equal(JSON.parse(visible.journey_json).pickup,journey.pickup);
  const changed=await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId:'missing',priceCents:1,journey:{pickup:'Elsewhere'}},{Cookie:admin}));
  assert.equal(changed.status,422);
  const {id}=await confirm(data);
  const saved=await db.prepare('SELECT b.journey_json,d.price_cents FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.reference=?').bind(data.reference).first();
  assert.equal(saved.price_cents,q.vehicles[0].priceCents);assert.equal(JSON.parse(saved.journey_json).pickup,journey.pickup);
  const customer=await bookingAPI.GET(req('/api/bookings?reference='+data.reference,undefined,{Authorization:'Bearer '+data.accessToken},'GET'));
  const managed=await customer.json();assert.equal(managed.canPay,true);assert.ok(managed.assignment.name);
  assert.ok(sent.some(e=>e.to[0]==='customer@example.invalid'&&e.subject.includes(data.reference)&&e.text.includes('/manage-booking?ref=')));
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId:id},{Cookie:admin}))).status,409);
});
test('one-time email sign-in creates HttpOnly session and rejects code reuse',async()=>{const start=await authAPI.POST(req('/api/auth',{action:'request',email:'signin@example.invalid'}));assert.equal(start.status,200);const {challenge}=await start.json();const message=sent.findLast(e=>e.to[0]==='signin@example.invalid');const code=message.text.match(/code is (\d{6})/)[1];const verify=await authAPI.POST(req('/api/auth',{action:'verify',challenge,code}));assert.equal(verify.status,200);assert.match(verify.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.equal((await authAPI.POST(req('/api/auth',{action:'verify',challenge,code}))).status,401);});

test('admin sign-in persists past the old timeouts, renews its cookie and is revoked by signout',async()=>{
  const previousBindings=globalThis.__testEnv.STAFF_TOTP_BINDINGS,previousRoles=globalThis.__testEnv.STAFF_ROLE_BINDINGS,originalNow=Date.now;
  globalThis.__testEnv.STAFF_TOTP_BINDINGS=`admin@example.invalid:${'A'.repeat(32)}`;
  try{
    const start=await authAPI.POST(req('/api/auth',{action:'request',email:'admin@example.invalid'},{'cf-connecting-ip':'persistent-admin-login'}));assert.equal(start.status,200);
    const {challenge}=await start.json(),code=sent.findLast(e=>e.to[0]==='admin@example.invalid').text.match(/code is (\d{6})/)[1];
    assert.equal((await authAPI.POST(req('/api/auth',{action:'verify',challenge,code},{'cf-connecting-ip':'persistent-admin-login'}))).status,401,'New admin sign-ins must still require MFA');
    const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(originalNow()/30000)));
    const digest=createHmac('sha1',Buffer.alloc(20)).update(counter).digest(),offset=digest[digest.length-1]&15;
    const totp=String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
    const login=await authAPI.POST(req('/api/auth',{action:'verify',challenge,code,totp},{'cf-connecting-ip':'persistent-admin-login'}));assert.equal(login.status,200);
    assert.match(login.headers.get('set-cookie'),/Max-Age=34560000; HttpOnly; Secure; SameSite=Lax/);
    const session=login.headers.get('set-cookie').split(';')[0],hash=await sha(session.slice(11));
    assert.equal((await db.prepare('SELECT expires FROM app_sessions WHERE token_hash=?').bind(hash).first()).expires,0);
    assert.equal((await db.prepare('SELECT expires FROM app_session_assurance WHERE token_hash=?').bind(hash).first()).expires,0);
    const future=originalNow()+35*86400000;Date.now=()=>future;
    const {identity}=await import('../lib/auth.ts');
    assert.equal((await identity(new Headers({Cookie:session}))).mfaVerified,true);
    const operations=await opsAPI.GET(req('/api/operations',undefined,{Cookie:session,'cf-connecting-ip':'persistent-admin-read'},'GET'));assert.equal(operations.status,200);
    assert.match(operations.headers.get('set-cookie'),/Max-Age=34560000/);
    // Role removal takes effect even for a remembered admin browser.
    globalThis.__testEnv.STAFF_ROLE_BINDINGS=previousRoles.replace('admin@example.invalid:admin|dispatch','admin@example.invalid:dispatch');
    assert.equal((await opsAPI.GET(req('/api/operations',undefined,{Cookie:session},'GET'))).status,403);
    globalThis.__testEnv.STAFF_ROLE_BINDINGS=previousRoles;
    const {runJobs}=await import('../lib/jobs.ts');await runJobs('persistent-admin-fixture');
    assert.equal((await identity(new Headers({Cookie:session}))).mfaVerified,true,'Session cleanup must preserve remembered admins');
    const logout=await authAPI.POST(req('/api/auth',{action:'signout'},{Cookie:session}));assert.equal(logout.status,200);
    assert.equal(await identity(new Headers({Cookie:session})),null);
    assert.equal((await opsAPI.GET(req('/api/operations',undefined,{Cookie:session},'GET'))).status,403);
  }finally{Date.now=originalNow;globalThis.__testEnv.STAFF_ROLE_BINDINGS=previousRoles;if(previousBindings===undefined)delete globalThis.__testEnv.STAFF_TOTP_BINDINGS;else globalThis.__testEnv.STAFF_TOTP_BINDINGS=previousBindings;}
});
test('production migration matches runtime schema and applies on a clean database',()=>{const sql=['0001_production.sql','0002_audit_recovery.sql','0003_driver_contacts.sql','0004_multiple_driver_jobs.sql','0005_driver_calendar.sql'].map(file=>readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8')).join('\n');for(const statement of platformSchema)assert.ok(sql.includes(statement),statement);const fresh=new DatabaseSync(':memory:');fresh.exec(readFileSync(new URL('../drizzle/0000_thick_smiling_tiger.sql',import.meta.url),'utf8'));fresh.exec(sql);assert.ok(fresh.prepare("SELECT name FROM sqlite_master WHERE name='app_booking_details'").get());fresh.close();});

test('completed and later assignments cannot share driver location',async()=>{
  const locationAPI=await import('../app/api/location/route.ts');
  const {data:first}=await book(await quote()),{driver,id,admin}=await confirm(first),payment=await paid(first);await webhook(payment.event);
  assert.equal((await locationAPI.POST(req('/api/location',{latitude:-36.8,longitude:174.7,accuracy:5},{Cookie:driver}))).status,200);
  for(const action of ['arrive','start','complete'])assert.equal((await opsAPI.POST(req('/api/operations',{action,reference:first.reference},{Cookie:driver}))).status,200);
  const {data:second}=await book(await quote());
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:second.reference,driverId:id},{Cookie:admin}))).status,200);
  assert.equal((await locationAPI.POST(req('/api/location',{latitude:-36.9,longitude:174.8,accuracy:5},{Cookie:driver}))).status,200);
  const lookup=async b=>(await bookingAPI.GET(req('/api/bookings?reference='+b.reference,undefined,{Authorization:'Bearer '+b.accessToken},'GET'))).json();
  assert.equal((await lookup(first)).assignment.latitude,null);
  assert.equal((await lookup(second)).assignment.latitude,-36.9);
  await bookingAPI.PATCH(req('/api/bookings',{reference:second.reference,action:'cancel'},{Authorization:'Bearer '+second.accessToken}));
  assert.equal((await lookup(second)).assignment,null);
  assert.equal((await locationAPI.POST(req('/api/location',{latitude:-36.9,longitude:174.8,accuracy:5},{Cookie:driver}))).status,409);
});

test('actual signout revokes both session and staff assurance',async()=>{
  const session=await cookie('admin@example.invalid');
  assert.equal((await opsAPI.GET(req('/api/operations',undefined,{Cookie:session},'GET'))).status,200);
  const response=await authAPI.POST(req('/api/auth',{action:'signout'},{Cookie:session}));
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await opsAPI.GET(req('/api/operations',undefined,{Cookie:session},'GET'))).status,403);
  const hash=await sha(session.slice('cc_session='.length));
  assert.equal(await db.prepare('SELECT token_hash FROM app_session_assurance WHERE token_hash=?').bind(hash).first(),null);
});

test('failed refunds are actionable and rechecking never issues a second refund',async()=>{
  const {runJobs}=await import('../lib/jobs.ts');
  const {data}=await book(await quote()),p=await paid(data);await webhook(p.event);
  const original=globalThis.fetch;let creates=0;
  globalThis.fetch=async(url,options)=>{if(String(url)==='https://api.stripe.com/v1/refunds'){creates++;const refund={id:'re_failed_'+p.intent.id,status:'failed',amount:p.intent.amount,currency:'nzd',payment_intent:p.intent.id};refundObjects.set(refund.id,refund);return Response.json(refund);}return original(url,options);};
  try{
    assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:'Bearer '+data.accessToken}))).status,200);
    const row=await db.prepare('SELECT status,payment_state FROM bookings WHERE reference=?').bind(data.reference).first();assert.equal(row.status,'cancelled');assert.equal(row.payment_state,'refund_failed');
    const admin=await cookie('admin@example.invalid');const report=await (await opsAPI.GET(req('/api/operations',undefined,{Cookie:admin},'GET'))).json();assert.ok(report.metrics.pending_refunds>=1);
    assert.ok(sent.some(message=>message.subject.includes('Refund needs attention: '+data.reference)));
    await webhook({...p.event,id:p.event.id+'_delayed'});
    assert.equal((await db.prepare('SELECT status,payment_state FROM bookings WHERE id=?').bind(p.row.id).first()).payment_state,'refund_failed');
    assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'cancelled');
    await runJobs();assert.equal(creates,1);
    const refund=await db.prepare('SELECT provider_id FROM app_refunds WHERE booking_id=?').bind(p.row.id).first();refundObjects.get(refund.provider_id).status='succeeded';
    assert.equal((await opsAPI.POST(req('/api/operations',{action:'reconcile_refund',reference:data.reference},{Cookie:admin}))).status,200);
    assert.equal((await db.prepare('SELECT payment_state FROM bookings WHERE reference=?').bind(data.reference).first()).payment_state,'refunded');assert.equal(creates,1);
  }finally{globalThis.fetch=original;}
});

test('later refund failures use canonical provider state and reject mismatched amounts',async()=>{
  const {data}=await book(await quote()),p=await paid(data);await webhook(p.event);
  await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:'Bearer '+data.accessToken}));
  const record=await db.prepare('SELECT provider_id FROM app_refunds WHERE booking_id=?').bind(p.row.id).first(),refund=refundObjects.get(record.provider_id);
  const event={id:'evt_refund_failure_'+p.intent.id,type:'refund.failed',data:{object:{id:record.provider_id,status:'succeeded'}}};
  refund.amount=1;assert.equal((await webhook(event)).status,409);
  refund.amount=p.intent.amount;refund.status='failed';assert.equal((await webhook(event)).status,200);assert.equal((await webhook(event)).status,200);
  assert.equal((await db.prepare('SELECT payment_state FROM bookings WHERE id=?').bind(p.row.id).first()).payment_state,'refund_failed');
});

test('HTTP refund failure remains recoverable and jobs reconcile stale pending records',async()=>{
  const {runJobs}=await import('../lib/jobs.ts');const {data}=await book(await quote()),p=await paid(data);await webhook(p.event);
  const original=globalThis.fetch;globalThis.fetch=async(url,options)=>String(url)==='https://api.stripe.com/v1/refunds'?Response.json({error:{}},{status:503}):original(url,options);
  try{assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:'Bearer '+data.accessToken}))).status,502);}finally{globalThis.fetch=original;}
  assert.equal((await db.prepare('SELECT status FROM bookings WHERE id=?').bind(p.row.id).first()).status,'cancel_pending');
  await runJobs();await db.prepare("UPDATE app_refunds SET checked_at='2000-01-01' WHERE booking_id=?").bind(p.row.id).run();await runJobs();
  assert.equal((await db.prepare('SELECT status,payment_state FROM bookings WHERE id=?').bind(p.row.id).first()).payment_state,'refunded');
  assert.ok((await db.prepare("SELECT COUNT(*) n FROM app_job_runs WHERE state='succeeded'").first()).n>=2);
});

test('older active work remains discoverable beyond 200 closed records with scoped full exports',async()=>{
  const {data}=await book(await quote());await db.prepare("UPDATE bookings SET created_at='1999-01-01T00:00:00Z' WHERE reference=?").bind(data.reference).run();
  for(let n=0;n<205;n++){const id='closed-audit-'+n,now=new Date().toISOString();await db.prepare("INSERT INTO bookings(id,reference,quote_id,idempotency_key,customer_name,customer_email,customer_phone,journey_json,requirements_json,payment_method,payment_state,status,created_at,updated_at) SELECT ?,?,quote_id,?,customer_name,customer_email,customer_phone,journey_json,requirements_json,'card','paid','completed',?,? FROM bookings WHERE reference=?").bind(id,'CC-AUDITCLOSED-'+n,id,now,now,data.reference).run();await db.prepare("INSERT INTO app_booking_details(booking_id,quote_id,fingerprint,price_cents,terms_version,updated_at) VALUES(?,?,?,100,'audit',?)").bind(id,id,id,now).run();}
  const admin=await cookie('admin@example.invalid'),headers={Cookie:admin};
  const active=await (await opsAPI.GET(req('/api/operations',undefined,headers,'GET'))).json();assert.ok(active.bookings.some(b=>b.reference===data.reference));
  assert.equal(active.summary.awaiting_dispatch,(await db.prepare("SELECT COUNT(*) n FROM bookings WHERE status='awaiting_dispatch'").first()).n);
  const search=await (await opsAPI.GET(req('/api/operations?status=all&q='+data.reference,undefined,headers,'GET'))).json();assert.equal(search.pagination.total,1);
  const page1=await (await opsAPI.GET(req('/api/operations?status=completed&q=CC-AUDITCLOSED-&page=1',undefined,headers,'GET'))).json(),page2=await (await opsAPI.GET(req('/api/operations?status=completed&q=CC-AUDITCLOSED-&page=2',undefined,headers,'GET'))).json();assert.equal(page1.pagination.total,205);assert.equal(page1.bookings.length,50);assert.equal(page2.bookings.length,50);assert.ok(!page1.bookings.some(a=>page2.bookings.some(b=>a.id===b.id)));
  const exported=await opsAPI.GET(req('/api/operations?status=all&q=CC-AUDITCLOSED-&export=payments',undefined,headers,'GET'));assert.equal(exported.status,200);assert.equal((await exported.text()).split('\r\n').length,206);
  const partner=await cookie('partner@example.invalid');globalThis.__testEnv.PARTNER_PROVIDER_BINDINGS='partner@example.invalid=Unrelated Fleet';
  const scoped=await (await opsAPI.GET(req('/api/operations?status=all&q='+data.reference,undefined,{Cookie:partner},'GET'))).json();assert.equal(scoped.pagination.total,0);assert.equal((await opsAPI.GET(req('/api/operations?export=payments',undefined,{Cookie:partner},'GET'))).status,403);
});

test('production activation gate pauses new requests while preserving existing management',async()=>{
  const {data}=await book(await quote()),previous=process.env.NODE_ENV;process.env.NODE_ENV='production';globalThis.__testEnv.BOOKINGS_ENABLED='false';
  try{
    assert.equal((await quoteAPI.POST(req('/api/quotes',journey))).status,503);
    assert.equal((await bookingAPI.POST(req('/api/bookings',{}))).status,503);
    const admin=await cookie('admin@example.invalid');
    assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId:'unavailable'},{Cookie:admin}))).status,503);
    assert.equal((await opsAPI.POST(req('/api/operations',{action:'decline_booking',reference:data.reference,note:'Pause check'},{Cookie:admin}))).status,503);
    assert.equal((await bookingAPI.GET(req('/api/bookings?reference='+data.reference,undefined,{Authorization:'Bearer '+data.accessToken},'GET'))).status,200);
    assert.equal((await bookingAPI.PATCH(req('/api/bookings',{reference:data.reference,action:'cancel'},{Authorization:'Bearer '+data.accessToken}))).status,200);
  }finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;delete globalThis.__testEnv.BOOKINGS_ENABLED;}
});

test('review reason reflects local equipment and sign-in destinations reject offsite navigation',async()=>{
  const {internalPath}=await import('../lib/navigation.ts');
  for(const value of ['//evil.invalid','/\\evil.invalid','https://evil.invalid','/\n/evil.invalid'])assert.equal(internalPath(value),'/account');
  assert.equal(internalPath('/driver?x=1'),'/driver?x=1');
  const q=await quote({childSeat:true});assert.deepEqual(q.reviewReasons,['child-seat requirements']);assert.equal(q.state,'manual_review');
});


test('login throttling never prevents an authenticated signout',async()=>{
  const session=await cookie('admin@example.invalid'),headers={Cookie:session,'cf-connecting-ip':'audit-exhausted-login'};
  for(let i=0;i<8;i++)await authAPI.POST(req('/api/auth',{action:'invalid'},headers));
  assert.equal((await authAPI.POST(req('/api/auth',{action:'invalid'},headers))).status,429);
  assert.equal((await authAPI.POST(req('/api/auth',{action:'signout'},headers))).status,200);
  assert.equal((await opsAPI.GET(req('/api/operations',undefined,{Cookie:session},'GET'))).status,403);
});


test('an older open enquiry is discoverable beyond 200 resolved cases',async()=>{
  const now=new Date().toISOString();
  await db.prepare("INSERT INTO app_requests(id,reference,kind,name,email,phone,data_json,state,created_at,updated_at) VALUES('old-open-audit','EN-OLDOPEN','general','Audit','audit@example.invalid','+64211234567','{}','open','1999-01-01',?)").bind(now).run();
  for(let n=0;n<205;n++)await db.prepare("INSERT INTO app_requests(id,reference,kind,name,email,phone,data_json,state,created_at,updated_at) VALUES(?,?,'general','Audit','audit@example.invalid','+64211234567','{}','resolved',?,?)").bind('case-audit-'+n,'EN-CLOSED-'+n,now,now).run();
  const admin=await cookie('admin@example.invalid');
  const active=await (await opsAPI.GET(req('/api/operations',undefined,{Cookie:admin},'GET'))).json();
  assert.ok(active.requests.some(r=>r.reference==='EN-OLDOPEN'));
  assert.equal(active.summary.open_requests,(await db.prepare("SELECT COUNT(*) n FROM app_requests WHERE state='open'").first()).n+(await db.prepare("SELECT COUNT(*) n FROM bookings WHERE status='review' AND idempotency_key NOT LIKE 'enquiry:%'").first()).n);
  const all=await (await opsAPI.GET(req('/api/operations?requestStatus=all&requestPage=2',undefined,{Cookie:admin},'GET'))).json();
  assert.equal(all.requests.length,50);assert.ok(all.requestsPagination.total>205);
});


test('audit migration upgrades an existing schema without guessing a trip for legacy locations',()=>{
  const existing=new DatabaseSync(':memory:');
  existing.exec(readFileSync(new URL('../drizzle/0000_thick_smiling_tiger.sql',import.meta.url),'utf8'));
  existing.exec(readFileSync(new URL('../drizzle/0001_production.sql',import.meta.url),'utf8'));
  existing.prepare("INSERT INTO app_locations(driver_id,latitude,longitude,accuracy,observed_at) VALUES('legacy-driver',-36.8,174.7,5,'2026-10-27T00:00:00Z')").run();
  const upgrade=readFileSync(new URL('../drizzle/0002_audit_recovery.sql',import.meta.url),'utf8');existing.exec(upgrade);existing.exec(upgrade);
  assert.equal(existing.prepare('SELECT COUNT(*) n FROM app_locations').get().n,1);
  assert.equal(existing.prepare('SELECT COUNT(*) n FROM app_assignment_locations').get().n,0);
  assert.ok(existing.prepare("SELECT name FROM sqlite_master WHERE name='app_refunds'").get());
  existing.close();
});
test('online quotes offer vans only by default and explain missing accessible vehicles',async()=>{
  const previous=globalThis.__testEnv.ONLINE_VEHICLE_CLASSES;delete globalThis.__testEnv.ONLINE_VEHICLE_CLASSES;
  try{
    const response=await quoteAPI.POST(req('/api/quotes',{...journey,passengers:1,luggage:0}));
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).vehicles.map(v=>v.id),['xl']);
    const accessible=await quoteAPI.POST(req('/api/quotes',{...journey,accessible:true,wheelchair:'ramp'}));
    assert.equal(accessible.status,422);assert.match((await accessible.json()).error,/only vans/);
  }finally{if(previous===undefined)delete globalThis.__testEnv.ONLINE_VEHICLE_CLASSES;else globalThis.__testEnv.ONLINE_VEHICLE_CLASSES=previous;}
});
test('customer booking emails copy operations while sign-in codes do not',async()=>{
  const before=sent.length;
  const {data}=await book(await quote(),{paymentMethod:'in_person'});assert.ok(data.reference);
  const receipt=sent.slice(before).find(item=>item.to[0]==='customer@example.invalid'&&item.subject.includes(data.reference));
  assert.ok(receipt,'customer booking email sent');assert.deepEqual(receipt.bcc,['operations@cruzycabs.co.nz']);
  const mark=sent.length;
  assert.equal((await authAPI.POST(req('/api/auth',{action:'request',email:'copy-check@example.invalid'}))).status,200);
  const code=sent.slice(mark).find(item=>item.to[0]==='copy-check@example.invalid');
  assert.ok(code,'sign-in code sent');assert.equal(code.bcc,undefined);
});
test('customers find bookings by short number and email, and can change the pickup time',async()=>{
  const nzDate=days=>new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland'}).format(Date.now()+days*86400000);
  const {data}=await book(await quote({when:'schedule',date:nzDate(2),time:'10:00'}),{paymentMethod:'in_person'});
  assert.match(data.reference,/^CC-[2-9A-HJKMNP-Z]{6}$/);
  const typed=data.reference.slice(3).toLowerCase(),view=email=>bookingAPI.GET(req('/api/bookings?reference='+typed,undefined,{'X-Booking-Email':email},'GET'));
  assert.equal((await view('someone@example.invalid')).status,403);
  const found=await (await view('Customer@Example.invalid')).json();
  assert.equal(found.reference,data.reference);assert.equal(found.canChangeTime,true);
  const change=(body,headers={'X-Booking-Email':'customer@example.invalid'})=>bookingAPI.PATCH(req('/api/bookings',{reference:typed,action:'change_time',...body},headers,'PATCH'));
  assert.equal((await change({date:nzDate(2),time:'15:00'},{})).status,403,'Email or link required');
  const before=sent.length,changed=await change({date:nzDate(2),time:'15:00'});
  assert.equal(changed.status,200,JSON.stringify(await changed.clone().json()));
  const row=await db.prepare('SELECT b.journey_json,d.scheduled_at FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.reference=?').bind(data.reference).first();
  assert.equal(JSON.parse(row.journey_json).time,'15:00');assert.equal(row.scheduled_at,(await changed.json()).scheduledAt);
  const notice=sent.slice(before).find(item=>item.subject===`Booking ${data.reference}: pickup time changed`);
  assert.ok(notice);assert.deepEqual(notice.bcc,['operations@cruzycabs.co.nz']);
  assert.equal((await change({date:nzDate(0),time:new Intl.DateTimeFormat('en-GB',{timeZone:'Pacific/Auckland',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.now()+30*60000)})).status,400,'Less than 2 hours notice is refused');
  const admin=await cookie('admin@example.invalid'),staff=await opsAPI.POST(req('/api/operations',{action:'change_time',reference:data.reference,date:nzDate(3),time:'09:30'},{Cookie:admin}));
  assert.equal(staff.status,200,JSON.stringify(await staff.clone().json()));
  assert.equal(JSON.parse((await db.prepare('SELECT journey_json FROM bookings WHERE reference=?').bind(data.reference).first()).journey_json).date,nzDate(3));
});
test('a driver with a pre-booked job can take more jobs that do not clash',async()=>{
  const nzDate=days=>new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland'}).format(Date.now()+days*86400000);
  const admin=await cookie('admin@example.invalid'),address=`multi${++serial}@example.invalid`;
  globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${address}:driver`;
  const {driverId}=await (await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Multi Job Driver',email:address,plate:`MULTI${serial}`,description:'Test van',vehicleClass:'xl',passengers:10,luggage:6,complianceUntil:'2030-01-01',verified:true},{Cookie:admin}))).json();
  await db.prepare("UPDATE app_drivers SET status='available' WHERE id=?").bind(driverId).run();
  const accept=async time=>{const {data}=await book(await quote({when:'schedule',date:nzDate(4),time}),{paymentMethod:'in_person'});return opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId},{Cookie:admin}));};
  const first=await accept('09:00');assert.equal(first.status,200,JSON.stringify(await first.clone().json()));
  assert.equal((await db.prepare('SELECT status FROM app_drivers WHERE id=?').bind(driverId).first()).status,'on_job');
  const second=await accept('15:00');assert.equal(second.status,200,JSON.stringify(await second.clone().json()));
  const clash=await accept('10:30');assert.equal(clash.status,409);assert.match((await clash.json()).error,/within 2 hours/);
});
test('drivers get calendar invites that update and cancel with the booking, and emails use the branded layout',async()=>{
  const nzDate=days=>new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland'}).format(Date.now()+days*86400000);
  const admin=await cookie('admin@example.invalid'),address=`calendar${++serial}@example.invalid`;
  globalThis.__testEnv.STAFF_ROLE_BINDINGS+=`,${address}:driver`;
  const {driverId}=await (await opsAPI.POST(req('/api/operations',{action:'onboard',name:'Calendar Driver',email:address,plate:`CAL${serial}`,description:'Test van',vehicleClass:'xl',passengers:10,luggage:6,complianceUntil:'2030-01-01',verified:true},{Cookie:admin}))).json();
  await db.prepare("UPDATE app_drivers SET status='available' WHERE id=?").bind(driverId).run();
  const {data}=await book(await quote({when:'schedule',date:nzDate(5),time:'09:00'}),{paymentMethod:'in_person'});
  const invite=from=>sent.slice(from).filter(item=>item.to[0]===address&&item.attachments).map(item=>({...item,ics:Buffer.from(item.attachments[0].content,'base64').toString()}));
  let mark=sent.length;
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'accept_booking',reference:data.reference,driverId},{Cookie:admin}))).status,200);
  const created=invite(mark);assert.equal(created.length,1);
  assert.match(created[0].subject,/^New job /);assert.match(created[0].attachments[0].content_type,/method=REQUEST/);
  assert.match(created[0].ics,/METHOD:REQUEST/);assert.match(created[0].ics,/SEQUENCE:0/);assert.match(created[0].ics,/LOCATION:Auckland Airport/);assert.match(created[0].ics,/DTSTART:\d{8}T\d{6}Z/);
  assert.deepEqual(created[0].bcc,['operations@cruzycabs.co.nz']);
  const confirmed=sent.slice(mark).find(item=>item.subject===`Booking ${data.reference} confirmed`);
  assert.match(confirmed.html,/View your booking/);assert.match(confirmed.html,/Operations Team/);assert.match(confirmed.html,/Pickup time/);assert.doesNotMatch(confirmed.html,/>https?:\/\/[^<]*#token/,'Long private links show as a button, not raw text');
  assert.match(confirmed.text,/Kind regards,\n\nOperations Team/);
  mark=sent.length;
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'change_time',reference:data.reference,date:nzDate(5),time:'15:00'},{Cookie:admin}))).status,200);
  const updated=invite(mark);assert.equal(updated.length,1);assert.match(updated[0].subject,/^Updated job /);assert.match(updated[0].ics,/SEQUENCE:1/);
  mark=sent.length;
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'change_time',reference:data.reference,date:nzDate(5),time:'15:00'},{Cookie:admin}))).status,400,'Same time is refused');
  assert.equal((await opsAPI.POST(req('/api/operations',{action:'cancel',reference:data.reference},{Cookie:admin}))).status,200);
  const cancelled=invite(mark);assert.equal(cancelled.length,1);assert.match(cancelled[0].ics,/METHOD:CANCEL/);assert.match(cancelled[0].ics,/SEQUENCE:2/);
});
