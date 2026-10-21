import { getD1 } from "../../../../lib/d1";
import { findBooking } from "../../../../lib/bookings";
import { ensurePlatform } from "../../../../lib/platform";
import { queueEmail } from "../../../../lib/notifications";
import { endpoint,HttpError,json } from "../../../../lib/security";
import { stripe,verifyStripeEvent } from "../../../../lib/stripe";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  const length=Number(request.headers.get("content-length"));if(length>1000000)throw new HttpError("Webhook too large.",413);
  const body=await request.text();if(body.length>1000000)throw new HttpError("Webhook too large.",413);
  const event=await verifyStripeEvent(body,request.headers.get("stripe-signature")||"");await ensurePlatform();
  if(await getD1().prepare(`SELECT id FROM app_stripe_events WHERE id=?`).bind(event.id).first())return json({received:true,duplicate:true});
  const object=event.data.object;
  let intentId=event.type==="payment_intent.succeeded"?object.id:event.type==="checkout.session.completed"?object.payment_intent:null;
  if(event.type==="charge.refunded")intentId=object.payment_intent;
  if(!intentId)return json({received:true});
  const intent=await stripe(`payment_intents/${encodeURIComponent(intentId)}`),bookingId=intent.metadata?.booking_id;if(!bookingId)return json({received:true});
  const record=await getD1().prepare(`SELECT reference FROM bookings WHERE id=?`).bind(bookingId).first<{reference:string}>();if(!record)throw new HttpError("Booking has not been recorded yet.",409);
  const row=await findBooking(record.reference);if(!row)throw new HttpError("Booking not available.",409);
  if(intent.amount!==row.price_cents||intent.currency!=="nzd")throw new HttpError("Payment does not match booking.",409);
  const now=new Date().toISOString();const changes:D1PreparedStatement[]=[getD1().prepare(`INSERT INTO app_stripe_events(id,type,processed_at) VALUES(?,?,?)`).bind(event.id,event.type,now)];
  if(event.type==="charge.refunded"){
    // Verify full refund on the provider object; do not trust an old partial-refund event.
    const charge=await stripe(`charges/${encodeURIComponent(object.id)}`) as Awaited<ReturnType<typeof stripe>>&{amount_refunded?:number};
    if(charge.amount_refunded===row.price_cents)changes.push(getD1().prepare(`UPDATE bookings SET payment_state='refunded',updated_at=? WHERE id=?`).bind(now,row.id));
  }else if(intent.status==="succeeded"){
    let receiptUrl:string|null=null;if(intent.latest_charge){const charge=await stripe(`charges/${encodeURIComponent(intent.latest_charge)}`);receiptUrl=charge.receipt_url||null;}
    changes.push(getD1().prepare(`UPDATE app_booking_details SET payment_intent=?,receipt_url=?,updated_at=? WHERE booking_id=?`).bind(intent.id,receiptUrl,now,row.id),getD1().prepare(`UPDATE bookings SET payment_state=CASE WHEN payment_state IN ('refunded','refund_pending') THEN payment_state ELSE 'paid' END,status=CASE WHEN status='awaiting_payment' THEN CASE WHEN EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=bookings.id AND state='accepted') THEN 'accepted' ELSE 'awaiting_dispatch' END WHEN status='cancelled' AND payment_state!='refunded' THEN 'cancel_pending' ELSE status END,updated_at=? WHERE id=?`).bind(now,row.id),getD1().prepare(`INSERT OR IGNORE INTO payments(id,booking_id,provider_reference,operation,idempotency_key,amount_cents,currency,state,created_at) VALUES(?,?,?,'capture',?,?,'NZD','paid',?)`).bind(crypto.randomUUID(),row.id,intent.id,`capture:${intent.id}`,row.price_cents,now),queueEmail(`paid:${intent.id}`,row.customer_email,`Payment received for ${row.reference}`,"Your card payment has been received. Check your private booking link for your booking status, driver and vehicle details."));
  }
  changes.push(getD1().prepare(`INSERT INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) VALUES(?,'payment',?,?,'stripe','{}',?)`).bind(event.id,row.id,event.type,now));
  try{await getD1().batch(changes);}catch(error){if(!await getD1().prepare(`SELECT id FROM app_stripe_events WHERE id=?`).bind(event.id).first())throw error;}
  return json({received:true});
});}

