import { getD1 } from "./d1";
import { stripe, type StripeObject } from "./stripe";
import { HttpError } from "./security";
import { queueEmail } from "./notifications";
import { setting } from "./config";

export function refundPaymentState(state: string | undefined) {
  if (state === "failed" || state === "canceled") return "refund_failed";
  if (state === "requires_action") return "refund_action_required";
  return "refund_pending";
}

export async function saveRefund(bookingId: string, amount: number, refund: StripeObject) {
  if (!refund.id) throw new HttpError("The refund provider did not return a reference. Operations must reconcile this payment.",502);
  const now=new Date().toISOString();
  await getD1().prepare(`INSERT INTO app_refunds(booking_id,provider_id,state,amount_cents,checked_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET provider_id=excluded.provider_id,state=excluded.state,checked_at=excluded.checked_at,updated_at=excluded.updated_at`).bind(bookingId,refund.id,refund.status||"unknown",amount,now,now).run();
  if (["failed","canceled","requires_action"].includes(refund.status||"")) await refundAttention(bookingId,refund.id,refund.status||"unknown");
}

async function refundAttention(bookingId:string,providerId:string,state:string) {
  const row=await getD1().prepare(`SELECT reference FROM bookings WHERE id=?`).bind(bookingId).first<{reference:string}>();
  if(row)await queueEmail(`refund-attention:${providerId}:${state}`,setting("OPERATIONS_EMAIL")||setting("SUPPORT_EMAIL","operations@cruzycabs.co.nz"),`Refund needs attention: ${row.reference}`,`The refund for ${row.reference} has provider status ${state}. Review the payment in the protected finance workspace and Stripe. Do not issue a second refund without reconciliation.`).run();
}

// Query the provider object, never a browser or webhook's claimed status.
// Failed/cancelled refunds require an operator decision; jobs do not blindly
// issue another refund or replace the original idempotency key.
export async function reconcileRefund(providerId:string) {
  const refund=await stripe(`refunds/${encodeURIComponent(providerId)}`);
  const record=await getD1().prepare(`SELECT r.booking_id,r.provider_id,b.reference,d.payment_intent,d.price_cents FROM app_refunds r JOIN bookings b ON b.id=r.booking_id JOIN app_booking_details d ON d.booking_id=b.id WHERE r.provider_id=?`).bind(providerId).first<{booking_id:string;provider_id:string;reference:string;payment_intent:string;price_cents:number}>();
  if(!record)throw new HttpError("Refund has not been recorded yet.",409);
  if(refund.id!==record.provider_id||refund.payment_intent!==record.payment_intent||refund.amount!==record.price_cents||refund.currency!=="nzd")throw new HttpError("Refund does not match the recorded booking payment.",409);
  if(!["pending","requires_action","succeeded","failed","canceled"].includes(refund.status||""))throw new HttpError("Unknown refund status. Operations must reconcile the payment.",502);
  const now=new Date().toISOString();
  await getD1().batch([
    getD1().prepare(`UPDATE app_refunds SET state=?,checked_at=?,updated_at=? WHERE booking_id=?`).bind(refund.status,now,now,record.booking_id),
    getD1().prepare(`UPDATE bookings SET payment_state=CASE WHEN payment_state='refunded' THEN 'refunded' ELSE ? END,updated_at=? WHERE id=? AND status IN ('cancelled','cancel_pending')`).bind(refund.status==="succeeded"?"refunded":refundPaymentState(refund.status),now,record.booking_id),
  ]);
  if(["failed","canceled","requires_action"].includes(refund.status||""))await refundAttention(record.booking_id,providerId,refund.status||"unknown");
  return {state:refund.status};
}

export async function reconcilePendingRefunds() {
  const rows=await getD1().prepare(`SELECT r.provider_id FROM app_refunds r JOIN bookings b ON b.id=r.booking_id WHERE b.payment_state IN ('refund_pending','refund_action_required') AND r.checked_at<? ORDER BY r.checked_at LIMIT 20`).bind(new Date(Date.now()-5*60000).toISOString()).all<{provider_id:string}>();
  for(const row of rows.results||[])try{await reconcileRefund(row.provider_id);}catch{console.error(JSON.stringify({event:"refund.reconciliation_failed"}));}
}
