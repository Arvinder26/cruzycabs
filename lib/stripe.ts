import { setting,siteOrigin } from "./config";
import { equal,hmac,HttpError } from "./security";
export type StripeObject={id:string;url?:string;status?:string;payment_status?:string;amount_total?:number;amount?:number;currency?:string;payment_intent?:string|null;receipt_url?:string;latest_charge?:string;metadata?:Record<string,string>;error?:{message?:string}};
export async function stripe(path:string,fields?:Record<string,string>,key?:string):Promise<StripeObject> {
  const secret=setting("STRIPE_SECRET_KEY"),mode=setting("STRIPE_MODE","test"); if(!secret.startsWith(mode==="live"?"sk_live_":"sk_test_")) throw new HttpError("Card payments are not available in the configured mode. Please contact support.",503);
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{method:fields?"POST":"GET",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/x-www-form-urlencoded",...(key?{"Idempotency-Key":key}:{})},...(fields?{body:new URLSearchParams(fields)}:{}),signal:AbortSignal.timeout(15000)});
  const value=await response.json() as StripeObject;if(!response.ok)throw new HttpError("The payment provider could not complete this operation. Please retry.",502);return value;
}
export async function createCheckout(booking:{id:string;reference:string;email:string;price:number},access:string,attempt=0) {
  if(setting("STRIPE_MODE","test")==="live"&&!setting("BUSINESS_LEGAL_NAME"))throw new HttpError("Live payments require the legal business details to be configured.",503);
  const manage=`${siteOrigin()}/manage-booking?ref=${encodeURIComponent(booking.reference)}#token=${access}`;
  return stripe("checkout/sessions",{mode:"payment","payment_method_types[0]":"card",customer_email:booking.email,client_reference_id:booking.id,"metadata[booking_id]":booking.id,"payment_intent_data[metadata][booking_id]":booking.id,"line_items[0][quantity]":"1","line_items[0][price_data][currency]":"nzd","line_items[0][price_data][unit_amount]":String(booking.price),"line_items[0][price_data][product_data][name]":`cruzycabs booking ${booking.reference}`,success_url:manage,cancel_url:manage},`checkout:${booking.id}:${attempt}`);
}
export type StripeEvent={id:string;type:string;data:{object:StripeObject}};
export async function verifyStripeEvent(body:string,signature:string,secret=setting("STRIPE_WEBHOOK_SECRET"),now=Date.now()):Promise<StripeEvent> {
  if(!secret)throw new HttpError("Webhook is not configured.",503);
  const parts=signature.split(",").map(p=>p.split("=")),timestamp=parts.find(p=>p[0]==="t")?.[1];
  if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)throw new HttpError("Invalid webhook signature.",400);
  const expected=await hmac(`${timestamp}.${body}`,secret);if(!parts.some(p=>p[0]==="v1"&&equal(p[1]||"",expected)))throw new HttpError("Invalid webhook signature.",400);
  let event:StripeEvent;try{event=JSON.parse(body) as StripeEvent;}catch{throw new HttpError("Invalid webhook body.");}
  if(!event.id||!event.type||!event.data?.object)throw new HttpError("Invalid webhook event.");return event;
}
