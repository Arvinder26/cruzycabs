import { getD1 } from "./d1";
import { bearer,equal,HttpError,managementToken } from "./security";
import { identity } from "./auth";
import { createCheckout,stripe } from "./stripe";
import { audit } from "./platform";
import { managementLink,queueEmail } from "./notifications";
import { refundPaymentState,saveRefund } from "./refunds";
import { bookingsEnabled } from "./config";
import { isManualEnquiryBooking } from "./enquiry-bookings";
import { scheduledInstant } from "./validation";
import { driverClash,pickupGapHours } from "./driver-schedule";
import { syncDriverCalendar } from "./calendar";
import type { QuoteInput } from "./pricing";
export type BookingRow={id:string;reference:string;customer_name:string;customer_email:string;customer_phone:string;journey_json:string;requirements_json:string;vehicle_id:string;status:string;payment_state:string;payment_method:string;price_cents:number;checkout_id:string|null;checkout_url:string|null;payment_intent:string|null;receipt_url:string|null;scheduled_at:string|null;created_at:string;updated_at:string};
export async function findBooking(reference:string){return getD1().prepare(`SELECT b.*,d.price_cents,d.checkout_id,d.checkout_url,d.payment_intent,d.receipt_url,d.scheduled_at FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.reference=?`).bind(reference).first<BookingRow>();}
export async function authorisedBooking(request:Request,reference:string){
  const row=await findBooking(reference);if(!row)throw new HttpError("Booking not found.",404);
  // The booking number with the booking email is an alternative to the private link, for customers whose mail or network strips the link.
  const access=bearer(request),user=await identity(request.headers),typedEmail=request.headers.get("x-booking-email")?.trim().toLowerCase()||"";
  if(!(access&&equal(access,await managementToken(row.id)))&&user?.email!==row.customer_email&&!(typedEmail&&equal(typedEmail,row.customer_email.toLowerCase())))throw new HttpError("Enter the email used for this booking, open the secure booking link or sign in with the booking email.",403);
  return row;
}
export async function checkoutBooking(row:BookingRow){
  row=await findBooking(row.reference)||row;
  if(row.payment_method==="in_person")return {checkoutUrl:null};
  if(!bookingsEnabled()&&isManualEnquiryBooking(row.requirements_json))throw new HttpError("Card payment for accepted enquiries is paused until booking activation. Contact operations.",503);
  if(row.status!=="awaiting_payment")return {checkoutUrl:null};
  if(row.payment_state!=="not_paid")return {checkoutUrl:null};
  const confirmed=await getD1().prepare(`SELECT id FROM app_assignments WHERE booking_id=? AND state='accepted'`).bind(row.id).first();
  if(!confirmed)throw new HttpError("Payment opens after operations accepts the request and assigns a suitable driver.",409);
  const access=await managementToken(row.id);
  await getD1().prepare(`INSERT OR IGNORE INTO app_checkout_generation(booking_id,attempt) VALUES(?,0)`).bind(row.id).run();
  if(row.checkout_id){const session=await stripe(`checkout/sessions/${encodeURIComponent(row.checkout_id)}`);if(session.status==="open"&&session.url)return {checkoutUrl:session.url};if(session.status==="complete")return {checkoutUrl:null};
    await getD1().batch([getD1().prepare(`UPDATE app_checkout_generation SET attempt=attempt+1 WHERE booking_id=? AND EXISTS(SELECT 1 FROM app_booking_details WHERE booking_id=? AND checkout_id=?)`).bind(row.id,row.id,row.checkout_id),getD1().prepare(`UPDATE app_booking_details SET checkout_id=NULL,checkout_url=NULL WHERE booking_id=? AND checkout_id=?`).bind(row.id,row.checkout_id)]);
  }
  const generation=await getD1().prepare(`SELECT attempt FROM app_checkout_generation WHERE booking_id=?`).bind(row.id).first<{attempt:number}>();
  const session=await createCheckout({id:row.id,reference:row.reference,email:row.customer_email,price:row.price_cents},access,generation?.attempt||0);
  if(!session.url)throw new HttpError("Payment checkout is unavailable.",502);
  await getD1().batch([getD1().prepare(`UPDATE app_booking_details SET checkout_id=?,checkout_url=?,updated_at=? WHERE booking_id=?`).bind(session.id,session.url,new Date().toISOString(),row.id),getD1().prepare(`INSERT OR IGNORE INTO payments(id,booking_id,provider_reference,operation,idempotency_key,amount_cents,currency,state,created_at) VALUES(?,?,?,'checkout',?,?,'NZD','open',?)`).bind(crypto.randomUUID(),row.id,session.id,session.id,row.price_cents,new Date().toISOString())]);
  return {checkoutUrl:session.url};
}
export async function cancelBooking(row:BookingRow,actor:string){
  if(row.status==="cancelled")return;
  if(!["pending_customer_confirmation","review","awaiting_payment","awaiting_dispatch","offered","accepted","arrived","cancel_pending"].includes(row.status))throw new HttpError("This trip cannot be cancelled online. Please contact operations.",409);
  const claim=await getD1().prepare(`UPDATE bookings SET status='cancel_pending',updated_at=? WHERE id=? AND status=? RETURNING id`).bind(new Date().toISOString(),row.id,row.status).first();if(!claim)throw new HttpError("Booking changed. Refresh and retry.",409);
  // External operations are idempotent. A failure leaves a recoverable cancel_pending state.
  if(row.checkout_id&&!row.payment_intent){const session=await stripe(`checkout/sessions/${encodeURIComponent(row.checkout_id)}`);if(session.status==="open")await stripe(`checkout/sessions/${session.id}/expire`,{},`expire:${row.id}`);if(session.payment_intent)row.payment_intent=session.payment_intent;}
  let refundState="not_paid";
  if(row.payment_intent){const intent=await stripe(`payment_intents/${encodeURIComponent(row.payment_intent)}`);if(intent.status==="succeeded"){const refund=await stripe("refunds",{payment_intent:intent.id},`refund:${row.id}`);await saveRefund(row.id,row.price_cents,refund);refundState=refundPaymentState(refund.status);}else if(!["canceled"].includes(intent.status||""))await stripe(`payment_intents/${intent.id}/cancel`,{},`void:${row.id}`);}
  const now=new Date().toISOString();
  await getD1().batch([getD1().prepare(`UPDATE bookings SET status='cancelled',payment_state=CASE WHEN payment_state='refunded' THEN 'refunded' ELSE ? END,updated_at=? WHERE id=? AND status='cancel_pending'`).bind(refundState,now,row.id),getD1().prepare(`UPDATE app_drivers SET status='available' WHERE id IN (SELECT driver_id FROM app_assignments WHERE booking_id=? AND state NOT IN ('completed','declined','expired'))`).bind(row.id),getD1().prepare(`UPDATE app_assignments SET state='cancelled',updated_at=? WHERE booking_id=? AND state NOT IN ('completed','declined','expired')`).bind(now,row.id),getD1().prepare(`DELETE FROM app_assignment_locations WHERE assignment_id IN (SELECT id FROM app_assignments WHERE booking_id=?)`).bind(row.id),audit("booking",row.id,"booking.cancelled",actor),queueEmail(`cancel:${row.id}`,row.customer_email,`Booking ${row.reference} cancelled`,refundState==="refund_failed"||refundState==="refund_action_required"?"Your booking is cancelled. Your card refund needs operations attention. Contact operations and check your private booking link for updates.":"Your booking has been cancelled. Any completed card payment has been submitted for a full refund. Check your private booking link for its status; your bank controls when funds appear.")]);
  await syncDriverCalendar(row.id);
}
// Bookings that have not started can move to a new pickup time. Fares do not depend on the time of day, so the price stays the same.
const reschedulable=["review","pending_customer_confirmation","awaiting_dispatch","offered","awaiting_payment","accepted"],customerNoticeMs=2*3600000;
export function canCustomerReschedule(row:BookingRow){const journey=JSON.parse(row.journey_json) as QuoteInput,current=row.scheduled_at||journey.scheduledAt;return reschedulable.includes(row.status)&&journey.when==="schedule"&&Boolean(current)&&Date.parse(current||"")>=Date.now()+customerNoticeMs;}
export async function rescheduleBooking(row:BookingRow,date:string,time:string,actor:string){
  const customer=actor==="customer",journey=JSON.parse(row.journey_json) as QuoteInput,current=row.scheduled_at||journey.scheduledAt||null;
  if(!reschedulable.includes(row.status))throw new HttpError("This booking can no longer be changed online. Contact operations.",409);
  if(customer&&(journey.when!=="schedule"||!current))throw new HttpError("Only scheduled pickups can be changed online. Contact operations.",409);
  if(customer&&Date.parse(current||"")<Date.now()+customerNoticeMs)throw new HttpError("Your pickup is less than 2 hours away. Call or email operations to change it.",409);
  const scheduledAt=scheduledInstant(date,time);
  if(customer&&Date.parse(scheduledAt)<Date.now()+customerNoticeMs)throw new HttpError("Choose a new pickup time at least 2 hours from now, or contact operations.");
  if(scheduledAt===current)throw new HttpError("That is already the pickup time.");
  const now=new Date().toISOString(),updated=JSON.stringify({...journey,when:"schedule",date,time,scheduledAt}),db=getD1();
  const when=new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland",dateStyle:"full",timeStyle:"short"}).format(new Date(scheduledAt));
  const driver=await db.prepare("SELECT a.driver_id,d.email FROM app_assignments a JOIN app_drivers d ON d.id=a.driver_id WHERE a.booking_id=? AND a.state IN ('offered','accepted') ORDER BY a.created_at DESC LIMIT 1").bind(row.id).first<{driver_id:string;email:string}>();
  const clash=driver?await driverClash(driver.driver_id,row.id,scheduledAt):null;
  if(clash)throw new HttpError(customer?"Your driver is not free at that time. Choose another time or contact operations.":`The assigned driver has booking ${clash.reference} within ${pickupGapHours} hours of that time. Choose another time or reassign the booking.`,409);
  const link=managementLink(row.reference,await managementToken(row.id)),changed="EXISTS(SELECT 1 FROM bookings WHERE id=? AND journey_json=?)";
  const email=(key:string,to:string,subject:string,text:string)=>db.prepare(`INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE ${changed}`).bind(crypto.randomUUID(),key,to,subject,text,now,now,row.id,updated);
  const claim=await db.batch([
    db.prepare("UPDATE bookings SET journey_json=?,updated_at=? WHERE id=? AND status=? AND journey_json=? RETURNING id").bind(updated,now,row.id,row.status,row.journey_json),
    db.prepare(`UPDATE app_booking_details SET scheduled_at=?,updated_at=? WHERE booking_id=? AND ${changed}`).bind(scheduledAt,now,row.id,row.id,updated),
    db.prepare(`INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) SELECT ?,?,?,?,?,? WHERE ${changed}`).bind(crypto.randomUUID(),row.id,row.status,customer?"customer":"staff",`Pickup time changed to ${date} ${time}`,now,row.id,updated),
    db.prepare(`INSERT INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'booking',?,'booking.rescheduled',?,?,? WHERE ${changed}`).bind(crypto.randomUUID(),row.id,customer?"customer":"staff",JSON.stringify({actor,from:current,to:scheduledAt}),now,row.id,updated),
    email(`reschedule:${row.id}:${scheduledAt}`,row.customer_email,`Booking ${row.reference}: pickup time changed`,`Your pickup time for booking ${row.reference} is now ${when} (New Zealand time), from ${journey.pickup}. Your fare is unchanged.${driver?" Your driver has been told about the new time.":""} If this is not right, reply to operations@cruzycabs.co.nz. Manage your booking: ${link}`),
  ]);
  if(!claim[0].results?.length)throw new HttpError("This booking changed while you were editing it. Refresh and try again.",409);
  // The driver is told through their updated calendar invite.
  await syncDriverCalendar(row.id);
  return {scheduledAt,date,time};
}
export function bookingEmail(row:BookingRow,access:string){if(row.payment_state==="in_person"&&row.status==="review")return queueEmail(`booking:${row.id}`,row.customer_email,`cruzycabs request ${row.reference}`,`Your booking request is recorded. No payment is taken online. Operations will review the quoted fare and journey, then assign a suitable driver or decline the request. If accepted, we will email your confirmation and driver details. You pay your driver in person (cash or EFTPOS) for the journey. Manage your request: ${managementLink(row.reference,access)}`);if(row.payment_state==="in_person")return queueEmail(`booking:${row.id}`,row.customer_email,`cruzycabs booking ${row.reference} confirmed`,`Your booking is confirmed and your driver is assigned. Please pay your driver in person (cash or EFTPOS) for the journey. Manage your booking: ${managementLink(row.reference,access)}`);return queueEmail(`booking:${row.id}`,row.customer_email,`cruzycabs request ${row.reference}`,`Your booking request is recorded. No payment is due yet. Operations will review the quoted fare and journey, then assign a suitable driver or decline the request. If accepted, you will receive a secure link to see your driver and pay by card. Manage your request: ${managementLink(row.reference,access)}`);}
