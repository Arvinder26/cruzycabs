import { setting } from "../../../lib/config";
import { getD1 } from "../../../lib/d1";
import { cancelBooking,findBooking } from "../../../lib/bookings";
import { deliverOutbox,queueEmail } from "../../../lib/notifications";
import { ensurePlatform } from "../../../lib/platform";
import { bearer,endpoint,equal,HttpError,json } from "../../../lib/security";
export async function runJobs(){
  await ensurePlatform();const now=new Date().toISOString(),past=new Date(Date.now()-120000).toISOString();
  await getD1().batch([getD1().prepare(`UPDATE app_assignments SET state='expired',updated_at=? WHERE state='offered' AND created_at<?`).bind(now,past),getD1().prepare(`UPDATE bookings SET status='awaiting_dispatch',updated_at=? WHERE status='offered' AND NOT EXISTS(SELECT 1 FROM app_assignments a WHERE a.booking_id=bookings.id AND a.state='offered')`).bind(now),getD1().prepare(`DELETE FROM app_limits WHERE expires<?`).bind(Math.floor(Date.now()/1000)),getD1().prepare(`DELETE FROM app_otp WHERE expires<?`).bind(Date.now()-86400000),getD1().prepare(`DELETE FROM app_sessions WHERE expires<?`).bind(Date.now()),getD1().prepare(`DELETE FROM app_locations WHERE observed_at<?`).bind(new Date(Date.now()-24*3600000).toISOString())]);
  const cancelled=await getD1().prepare(`SELECT reference FROM bookings WHERE status='cancel_pending' LIMIT 20`).all<{reference:string}>();
  for(const item of cancelled.results||[]){const row=await findBooking(item.reference);if(row)try{await cancelBooking(row,"recovery-job");}catch{console.error(JSON.stringify({event:"refund.retry_failed",reference:item.reference}));}}
  await getD1().prepare(`DELETE FROM app_session_assurance WHERE expires<?`).bind(Date.now()).run();
  const atRisk=await getD1().prepare(`SELECT b.id,b.reference FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.status IN ('awaiting_dispatch','offered') AND (d.scheduled_at IS NOT NULL AND d.scheduled_at<? OR d.scheduled_at IS NULL AND b.created_at<?) LIMIT 100`).bind(new Date(Date.now()+30*60000).toISOString(),new Date(Date.now()-5*60000).toISOString()).all<{id:string;reference:string}>();
  for(const row of atRisk.results||[])await queueEmail(`risk:${row.id}`,setting("SUPPORT_EMAIL","operations@cruzycabs.co.nz"),`Action required: ${row.reference} needs a driver`,`Review ${row.reference} in the dispatch workspace. Confirm availability or cancel and refund if it cannot be fulfilled.`).run();
  return deliverOutbox();
}
export function POST(request:Request){return endpoint(async()=>{const secret=setting("JOBS_SECRET");if(secret.length<32||!equal(bearer(request),secret))throw new HttpError("Not authorised.",403);return json(await runJobs());});}
export function GET(request:Request){return endpoint(async()=>{const secret=setting("CRON_SECRET");if(secret.length<32||!equal(bearer(request),secret))throw new HttpError("Not authorised.",403);return json(await runJobs());});}
