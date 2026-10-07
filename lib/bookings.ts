import { getD1 } from "./d1";
import { bearer,equal,HttpError,managementToken } from "./security";
import { identity } from "./auth";
import { createCheckout,stripe } from "./stripe";
import { audit } from "./platform";
import { managementLink,queueEmail } from "./notifications";
export type BookingRow={id:string;reference:string;customer_name:string;customer_email:string;customer_phone:string;journey_json:string;requirements_json:string;vehicle_id:string;status:string;payment_state:string;payment_method:string;price_cents:number;checkout_id:string|null;checkout_url:string|null;payment_intent:string|null;receipt_url:string|null;scheduled_at:string|null;created_at:string;updated_at:string};
export async function findBooking(reference:string){return getD1().prepare(`SELECT b.*,d.price_cents,d.checkout_id,d.checkout_url,d.payment_intent,d.receipt_url,d.scheduled_at FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.reference=?`).bind(reference).first<BookingRow>();}
export async function authorisedBooking(request:Request,reference:string){
  const row=await findBooking(reference);if(!row)throw new HttpError("Booking not found.",404);
  const access=bearer(request),user=await identity(request.headers);
  if(!(access&&equal(access,await managementToken(row.id)))&&user?.email!==row.customer_email)throw new HttpError("Use the secure booking link or sign in with the booking email.",403);
  return row;
}
export async function checkoutBooking(row:BookingRow){
  row=await findBooking(row.reference)||row;
  if(row.status!=="awaiting_payment")return {checkoutUrl:null};
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
  if(!["review","awaiting_payment","awaiting_dispatch","offered","accepted","arrived","cancel_pending"].includes(row.status))throw new HttpError("This trip cannot be cancelled online. Please contact operations.",409);
  const claim=await getD1().prepare(`UPDATE bookings SET status='cancel_pending',updated_at=? WHERE id=? AND status=? RETURNING id`).bind(new Date().toISOString(),row.id,row.status).first();if(!claim)throw new HttpError("Booking changed. Refresh and retry.",409);
  // External operations are idempotent. A failure leaves a recoverable cancel_pending state.
  if(row.checkout_id&&!row.payment_intent){const session=await stripe(`checkout/sessions/${encodeURIComponent(row.checkout_id)}`);if(session.status==="open")await stripe(`checkout/sessions/${session.id}/expire`,{},`expire:${row.id}`);if(session.payment_intent)row.payment_intent=session.payment_intent;}
  let refundPending=false;
  if(row.payment_intent){const intent=await stripe(`payment_intents/${encodeURIComponent(row.payment_intent)}`);if(intent.status==="succeeded"){await stripe("refunds",{payment_intent:intent.id},`refund:${row.id}`);refundPending=true;}else if(!["canceled"].includes(intent.status||""))await stripe(`payment_intents/${intent.id}/cancel`,{},`void:${row.id}`);}
  const now=new Date().toISOString();row.payment_intent=refundPending?row.payment_intent:null;
  await getD1().batch([getD1().prepare(`UPDATE bookings SET status='cancelled',payment_state=?,updated_at=? WHERE id=? AND status='cancel_pending'`).bind(row.payment_intent?"refund_pending":"not_paid",now,row.id),getD1().prepare(`UPDATE app_drivers SET status='available' WHERE id IN (SELECT driver_id FROM app_assignments WHERE booking_id=? AND state NOT IN ('completed','declined','expired'))`).bind(row.id),getD1().prepare(`UPDATE app_assignments SET state='cancelled',updated_at=? WHERE booking_id=? AND state NOT IN ('completed','declined','expired')`).bind(now,row.id),audit("booking",row.id,"booking.cancelled",actor),queueEmail(`cancel:${row.id}`,row.customer_email,`Booking ${row.reference} cancelled`,"Your booking has been cancelled. Any completed card payment is being refunded in full. Your bank controls when it appears.")]);
}
export function bookingEmail(row:BookingRow,access:string){return queueEmail(`booking:${row.id}`,row.customer_email,`cruzycabs request ${row.reference}`,`Your request is recorded. Travel is confirmed only after a suitable driver accepts. Manage or pay for your booking: ${managementLink(row.reference,access)}`);}
