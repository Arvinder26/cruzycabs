import { getD1 } from "../../../lib/d1";
import { POLICY_VERSION,bookingsEnabled,cardPaymentsEnabled } from "../../../lib/config";
import { identity } from "../../../lib/auth";
import { ensurePlatform,rateLimit,audit } from "../../../lib/platform";
import { authorisedBooking,bookingEmail,canCustomerReschedule,cancelBooking,checkoutBooking,findBooking,rescheduleBooking } from "../../../lib/bookings";
import { normaliseReference,shortReference } from "../../../lib/booking-reference";
import { deliverOutbox } from "../../../lib/notifications";
import { operationsBookingEmail } from "../../../lib/operations-email";
import { scheduledInstant } from "../../../lib/validation";
import { bearer,email,endpoint,equal,HttpError,json,managementToken,phone,readObject,sameOrigin,sha,text } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);if(!bookingsEnabled())throw new HttpError("Online booking requests are paused. Contact operations before retrying.",503);await rateLimit(request,"bookings",10);const body=await readObject(request),quoteId=text(body.quoteId,"Quote",64),vehicleId=text(body.vehicleId,"Vehicle",30),key=text(request.headers.get("idempotency-key"),"Retry key",180);
  const customer=body.customer;if(!customer||typeof customer!=="object"||Array.isArray(customer))throw new HttpError("Passenger contact details are required.");
  const c=customer as Record<string,unknown>,name=text(c.name,"Passenger name",100),address=email(c.email),mobile=phone(c.phone),notes=text(c.notes,"Notes",2000,true);
  const paymentMethod=body.paymentMethod,inPerson=paymentMethod==="in_person";
  if(!inPerson&&!(paymentMethod==="card"&&cardPaymentsEnabled()))throw new HttpError("Fares are paid to your driver in person. Online card payment is not offered.");
  if(body.termsAccepted!==true)throw new HttpError("Accept the terms and cancellation policy before booking.");
  const quote=await getD1().prepare(`SELECT q.*,a.token_hash FROM quotes q JOIN app_quote_access a ON a.quote_id=q.id WHERE q.id=?`).bind(quoteId).first<{input_json:string;result_json:string;locked_until:string;state:string;token_hash:string}>();
  if(!quote||!equal(await sha(bearer(request)),quote.token_hash))throw new HttpError("Quote access is invalid. Request a new price.",403);
  const fingerprint=await sha(JSON.stringify({quoteId,vehicleId,name,address,mobile,notes,terms:POLICY_VERSION}));
  const existing=await getD1().prepare(`SELECT b.reference,d.fingerprint,b.idempotency_key FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE d.quote_id=? OR b.idempotency_key=?`).bind(quoteId,key).first<{reference:string;fingerprint:string;idempotency_key:string}>();
  if(existing){if(existing.fingerprint!==fingerprint||existing.idempotency_key!==key)throw new HttpError("That quote has already been used. Request a fresh quote.",409);const row=await findBooking(existing.reference);if(!row)throw new HttpError("Booking unavailable.",503);return json({reference:row.reference,status:row.status,accessToken:await managementToken(row.id),checkoutUrl:null});}
  if(Date.parse(quote.locked_until)<=Date.now())throw new HttpError("Your quote expired. Request a new price.",409);
  const result=JSON.parse(quote.result_json) as {vehicles:{id:string;priceCents:number}[]},vehicle=result.vehicles.find(v=>v.id===vehicleId);if(!vehicle)throw new HttpError("Vehicle does not fit this quote.",422);
  if(!["xl","accessible"].includes(vehicleId))throw new HttpError("Only Van and Accessible vehicles are currently available. Request a new quote.",422);
  const journey=JSON.parse(quote.input_json) as {scheduledAt?:string},id=crypto.randomUUID(),reference=shortReference(),now=new Date().toISOString(),status="review",access=await managementToken(id),user=await identity(request.headers);
  try{await getD1().batch([
    getD1().prepare(`INSERT INTO bookings(id,reference,quote_id,idempotency_key,vehicle_id,customer_name,customer_email,customer_phone,journey_json,requirements_json,payment_method,payment_state,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,reference,quoteId,key,vehicleId,name,address,mobile,quote.input_json,JSON.stringify({notes,bookingForOther:Boolean(body.bookingForOther)}),inPerson?"in_person":"card",inPerson?"in_person":"not_paid",status,now,now),
    getD1().prepare(`INSERT INTO app_booking_details(booking_id,quote_id,fingerprint,price_cents,scheduled_at,terms_version,customer_identity,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,quoteId,fingerprint,vehicle.priceCents,journey.scheduledAt||null,POLICY_VERSION,user?.email===address?user.userId:null,now),
    getD1().prepare(`INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) VALUES(?,?,?,'customer','Request recorded',?)`).bind(crypto.randomUUID(),id,status,now),audit("booking",id,"booking.created","customer",{terms:POLICY_VERSION}),
    bookingEmail({id,reference,customer_email:address,status,payment_state:inPerson?"in_person":"not_paid"} as Parameters<typeof bookingEmail>[0],access),
    operationsBookingEmail({id,reference,customer_name:name,customer_email:address,customer_phone:mobile,journey_json:quote.input_json,requirements_json:JSON.stringify({notes,bookingForOther:Boolean(body.bookingForOther)}),vehicle_id:vehicleId,status,payment_state:inPerson?"in_person":"not_paid",price_cents:vehicle.priceCents,scheduled_at:journey.scheduledAt||null,created_at:now})
  ]);}catch(error){const retry=await getD1().prepare(`SELECT b.reference,d.fingerprint,b.idempotency_key FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE d.quote_id=?`).bind(quoteId).first<{reference:string;fingerprint:string;idempotency_key:string}>();if(!retry||retry.fingerprint!==fingerprint||retry.idempotency_key!==key)throw error;const row=await findBooking(retry.reference);if(!row)throw error;return json({reference:row.reference,status:row.status,accessToken:await managementToken(row.id),checkoutUrl:null});}
  await deliverOutbox();return json({reference,status,accessToken:access,checkoutUrl:null,paymentMessage:inPerson?"No payment is taken online. Operations will review your quoted fare and assign a suitable driver, then email your confirmation. You pay your driver in person.":"No payment is due yet. Operations will review your quoted fare and assign a suitable driver before sending your secure payment link."},201);
});}
export function GET(request:Request){return endpoint(async()=>{
  await ensurePlatform();await rateLimit(request,"manage",20);const reference=normaliseReference(text(new URL(request.url).searchParams.get("reference"),"Reference",30)),row=await authorisedBooking(request,reference);
  const assignment=await getD1().prepare(`SELECT a.state,d.name,v.plate,v.description,l.latitude,l.longitude,l.observed_at FROM app_assignments a JOIN app_drivers d ON d.id=a.driver_id JOIN app_vehicles v ON v.driver_id=d.id LEFT JOIN app_assignment_locations l ON l.assignment_id=a.id AND a.state IN ('accepted','arrived','on_trip') AND ? IN ('awaiting_payment','accepted','arrived','on_trip') WHERE a.booking_id=? AND a.state NOT IN ('declined','expired','cancelled') ORDER BY a.created_at DESC LIMIT 1`).bind(row.status,row.id).first();
  const review=await getD1().prepare("SELECT id FROM app_requests WHERE id=?").bind(await sha(`booking-review:${row.id}`)).first();
  return json({reference:row.reference,customer_name:row.customer_name,vehicle_id:row.vehicle_id,status:row.status,payment_state:row.payment_state,canPay:row.status==="awaiting_payment"&&row.payment_state==="not_paid"&&assignment?.state==="accepted",reviewSubmitted:Boolean(review),canChangeTime:canCustomerReschedule(row),price_cents:row.price_cents,receipt_url:row.receipt_url,journey:JSON.parse(row.journey_json),requirements:JSON.parse(row.requirements_json),assignment:assignment?.state==="offered"?null:assignment,updated_at:row.updated_at});
});}
export function PATCH(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"booking-change",10);const body=await readObject(request),row=await authorisedBooking(request,normaliseReference(text(body.reference,"Reference",30)));
  if(body.action==="change_time"){const result=await rescheduleBooking(row,text(body.date,"Date",10),text(body.time,"Time",5),"customer");await deliverOutbox();return json(result);}
  if(body.action==="confirm_offer"){
    if(body.termsAccepted!==true)throw new HttpError("Review and accept the terms and cancellation policy before confirming.");
    if(row.status!=="pending_customer_confirmation")throw new HttpError("This offer is no longer waiting for confirmation. Refresh its status.",409);
    const journey=JSON.parse(row.journey_json) as {when:string;date?:string;time?:string};
    if(journey.when==="schedule"){
      try{scheduledInstant(journey.date||"",journey.time||"");}catch{throw new HttpError("The proposed pickup time is now too close or has passed. Contact operations for a new offer.",409);}
    }
    const now=new Date().toISOString(),eventId=await sha(`enquiry-confirmed:${row.id}`),auditId=await sha(`enquiry-confirmed-audit:${row.id}`);
    const assigned=await getD1().prepare("SELECT id FROM app_assignments WHERE booking_id=? AND state='accepted'").bind(row.id).first();
    const confirmedStatus=assigned?(row.payment_state==="in_person"?"accepted":"awaiting_payment"):"awaiting_dispatch";
    await getD1().batch([
      getD1().prepare("UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status='pending_customer_confirmation'").bind(confirmedStatus,now,row.id),
      getD1().prepare("UPDATE app_booking_details SET terms_version=?,updated_at=? WHERE booking_id=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?)").bind(POLICY_VERSION,now,row.id,row.id,confirmedStatus),
      getD1().prepare("INSERT OR IGNORE INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) SELECT ?,?,?,'customer','Customer accepted proposed fare and terms',? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?)").bind(eventId,row.id,confirmedStatus,now,row.id,confirmedStatus),
      getD1().prepare("INSERT OR IGNORE INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'booking',?,'offer.customer_confirmed','customer',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?)").bind(auditId,row.id,JSON.stringify({terms:POLICY_VERSION}),now,row.id,confirmedStatus),
      bookingEmail(row,await managementToken(row.id)),
      operationsBookingEmail({...row,status:confirmedStatus,scheduled_at:row.scheduled_at}),
    ]);
    await deliverOutbox();return json({status:confirmedStatus});
  }
  if(body.action==="checkout")return json(await checkoutBooking(row));
  if(body.action!=="cancel")throw new HttpError("Invalid booking action.");await cancelBooking(row,"customer");await deliverOutbox();return json({status:"cancelled"});
});}

