import { getD1 } from "../../../lib/d1";
import { POLICY_VERSION } from "../../../lib/config";
import { identity } from "../../../lib/auth";
import { ensurePlatform,rateLimit,audit } from "../../../lib/platform";
import { authorisedBooking,bookingEmail,cancelBooking,checkoutBooking,findBooking } from "../../../lib/bookings";
import { deliverOutbox } from "../../../lib/notifications";
import { bearer,email,endpoint,equal,HttpError,json,managementToken,phone,readObject,sameOrigin,sha,text } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"bookings",10);const body=await readObject(request),quoteId=text(body.quoteId,"Quote",64),vehicleId=text(body.vehicleId,"Vehicle",30),key=text(request.headers.get("idempotency-key"),"Retry key",180);
  const customer=body.customer;if(!customer||typeof customer!=="object"||Array.isArray(customer))throw new HttpError("Passenger contact details are required.");
  const c=customer as Record<string,unknown>,name=text(c.name,"Passenger name",100),address=email(c.email),mobile=phone(c.phone),notes=text(c.notes,"Notes",2000,true);
  if(body.paymentMethod!=="card")throw new HttpError("Online bookings currently require card payment. Contact operations for other arrangements.");
  if(body.termsAccepted!==true)throw new HttpError("Accept the terms and cancellation policy before booking.");
  const quote=await getD1().prepare(`SELECT q.*,a.token_hash FROM quotes q JOIN app_quote_access a ON a.quote_id=q.id WHERE q.id=?`).bind(quoteId).first<{input_json:string;result_json:string;locked_until:string;state:string;token_hash:string}>();
  if(!quote||!equal(await sha(bearer(request)),quote.token_hash))throw new HttpError("Quote access is invalid. Request a new price.",403);
  const fingerprint=await sha(JSON.stringify({quoteId,vehicleId,name,address,mobile,notes,terms:POLICY_VERSION}));
  const existing=await getD1().prepare(`SELECT b.reference,d.fingerprint,b.idempotency_key FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE d.quote_id=? OR b.idempotency_key=?`).bind(quoteId,key).first<{reference:string;fingerprint:string;idempotency_key:string}>();
  if(existing){if(existing.fingerprint!==fingerprint||existing.idempotency_key!==key)throw new HttpError("That quote has already been used. Request a fresh quote.",409);const row=await findBooking(existing.reference);if(!row)throw new HttpError("Booking unavailable.",503);return json({reference:row.reference,status:row.status,accessToken:await managementToken(row.id),...await checkoutBooking(row)});}
  if(Date.parse(quote.locked_until)<=Date.now())throw new HttpError("Your quote expired. Request a new price.",409);
  const result=JSON.parse(quote.result_json) as {vehicles:{id:string;priceCents:number}[]},vehicle=result.vehicles.find(v=>v.id===vehicleId);if(!vehicle)throw new HttpError("Vehicle does not fit this quote.",422);
  const journey=JSON.parse(quote.input_json) as {scheduledAt?:string},id=crypto.randomUUID(),reference=`CC-${crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase()}`,now=new Date().toISOString(),status=quote.state==="manual_review"?"review":"awaiting_payment",access=await managementToken(id),user=await identity(request.headers);
  try{await getD1().batch([
    getD1().prepare(`INSERT INTO bookings(id,reference,quote_id,idempotency_key,vehicle_id,customer_name,customer_email,customer_phone,journey_json,requirements_json,payment_method,payment_state,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'card','not_paid',?,?,?)`).bind(id,reference,quoteId,key,vehicleId,name,address,mobile,quote.input_json,JSON.stringify({notes,bookingForOther:Boolean(body.bookingForOther)}),status,now,now),
    getD1().prepare(`INSERT INTO app_booking_details(booking_id,quote_id,fingerprint,price_cents,scheduled_at,terms_version,customer_identity,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,quoteId,fingerprint,vehicle.priceCents,journey.scheduledAt||null,POLICY_VERSION,user?.email===address?user.userId:null,now),
    getD1().prepare(`INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) VALUES(?,?,?,'customer','Request recorded',?)`).bind(crypto.randomUUID(),id,status,now),audit("booking",id,"booking.created","customer",{terms:POLICY_VERSION}),
    bookingEmail({id,reference,customer_email:address} as Parameters<typeof bookingEmail>[0],access)
  ]);}catch(error){const retry=await getD1().prepare(`SELECT b.reference,d.fingerprint,b.idempotency_key FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE d.quote_id=?`).bind(quoteId).first<{reference:string;fingerprint:string;idempotency_key:string}>();if(!retry||retry.fingerprint!==fingerprint||retry.idempotency_key!==key)throw error;const row=await findBooking(retry.reference);if(!row)throw error;return json({reference:row.reference,status:row.status,accessToken:await managementToken(row.id),...await checkoutBooking(row)});}
  const row=await findBooking(reference);if(!row)throw new HttpError("Booking unavailable.",503);
  // Persist the booking first so a provider timeout can be safely retried with the same key.
  let checkoutUrl:string|null=null,paymentMessage="";try{checkoutUrl=(await checkoutBooking(row)).checkoutUrl;}catch{paymentMessage="Your request is saved. Open Manage booking to retry payment when available.";}
  await deliverOutbox();return json({reference,status,accessToken:access,checkoutUrl,paymentMessage},201);
});}
export function GET(request:Request){return endpoint(async()=>{
  await ensurePlatform();await rateLimit(request,"manage",20);const reference=text(new URL(request.url).searchParams.get("reference"),"Reference",30).toUpperCase(),row=await authorisedBooking(request,reference);
  const assignment=await getD1().prepare(`SELECT a.state,d.name,v.plate,v.description,l.latitude,l.longitude,l.observed_at FROM app_assignments a JOIN app_drivers d ON d.id=a.driver_id JOIN app_vehicles v ON v.driver_id=d.id LEFT JOIN app_locations l ON l.driver_id=d.id WHERE a.booking_id=? AND a.state NOT IN ('declined','expired','cancelled') ORDER BY a.created_at DESC LIMIT 1`).bind(row.id).first();
  return json({reference:row.reference,customer_name:row.customer_name,vehicle_id:row.vehicle_id,status:row.status,payment_state:row.payment_state,price_cents:row.price_cents,receipt_url:row.receipt_url,journey:JSON.parse(row.journey_json),requirements:JSON.parse(row.requirements_json),assignment:assignment?.state==="offered"?null:assignment,updated_at:row.updated_at});
});}
export function PATCH(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"booking-change",10);const body=await readObject(request),row=await authorisedBooking(request,text(body.reference,"Reference",30).toUpperCase());
  if(body.action==="checkout")return json(await checkoutBooking(row));
  if(body.action!=="cancel")throw new HttpError("Invalid booking action.");await cancelBooking(row,"customer");await deliverOutbox();return json({status:"cancelled"});
});}

