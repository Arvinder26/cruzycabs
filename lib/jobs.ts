import { setting } from "./config";
import { getD1 } from "./d1";
import { cancelBooking,findBooking } from "./bookings";
import { deliverOutbox,queueEmail } from "./notifications";
import { ensurePlatform } from "./platform";
import { reconcilePendingRefunds } from "./refunds";

async function processJobs(){
  await ensurePlatform();const now=new Date().toISOString(),past=new Date(Date.now()-120000).toISOString();
  await getD1().batch([getD1().prepare(`UPDATE app_assignments SET state='expired',updated_at=? WHERE state='offered' AND created_at<?`).bind(now,past),getD1().prepare(`UPDATE bookings SET status='awaiting_dispatch',updated_at=? WHERE status='offered' AND NOT EXISTS(SELECT 1 FROM app_assignments a WHERE a.booking_id=bookings.id AND a.state='offered')`).bind(now),getD1().prepare(`DELETE FROM app_limits WHERE expires<?`).bind(Math.floor(Date.now()/1000)),getD1().prepare(`DELETE FROM app_otp WHERE expires<?`).bind(Date.now()-86400000),getD1().prepare(`DELETE FROM app_sessions WHERE expires>0 AND expires<?`).bind(Date.now()),getD1().prepare(`DELETE FROM app_locations WHERE observed_at<?`).bind(new Date(Date.now()-24*3600000).toISOString())]);
  const cancelled=await getD1().prepare(`SELECT reference FROM bookings WHERE status='cancel_pending' LIMIT 20`).all<{reference:string}>();
  for(const item of cancelled.results||[]){const row=await findBooking(item.reference);if(row)try{await cancelBooking(row,"recovery-job");}catch{console.error(JSON.stringify({event:"refund.retry_failed",reference:item.reference}));}}
  await getD1().batch([getD1().prepare(`DELETE FROM app_session_assurance WHERE expires>0 AND expires<?`).bind(Date.now()),getD1().prepare(`DELETE FROM app_assignment_locations WHERE observed_at<? OR NOT EXISTS(SELECT 1 FROM app_assignments a WHERE a.id=app_assignment_locations.assignment_id AND a.state IN ('accepted','arrived','on_trip'))`).bind(new Date(Date.now()-24*3600000).toISOString())]);
  await reconcilePendingRefunds();
  const atRisk=await getD1().prepare(`SELECT b.id,b.reference FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.status IN ('review','awaiting_dispatch','offered','awaiting_payment') AND (d.scheduled_at IS NOT NULL AND d.scheduled_at<? OR d.scheduled_at IS NULL AND b.created_at<?) LIMIT 100`).bind(new Date(Date.now()+30*60000).toISOString(),new Date(Date.now()-5*60000).toISOString()).all<{id:string;reference:string}>();
  for(const row of atRisk.results||[])await queueEmail(`risk:${row.id}`,setting("SUPPORT_EMAIL","operations@cruzycabs.co.nz"),`Action required: ${row.reference} needs review`,`Review ${row.reference} in the dispatch workspace. Check requirements, driver availability and payment status. Contact the customer or cancel and refund if travel cannot be fulfilled.`).run();
  return deliverOutbox();
}

export async function runJobs(){
  await ensurePlatform();const id=crypto.randomUUID();
  await getD1().prepare(`INSERT INTO app_job_runs(id,state,started_at) VALUES(?,'running',?)`).bind(id,new Date().toISOString()).run();
  try{const result=await processJobs();await getD1().prepare(`UPDATE app_job_runs SET state='succeeded',finished_at=? WHERE id=?`).bind(new Date().toISOString(),id).run();await getD1().prepare(`DELETE FROM app_job_runs WHERE started_at<?`).bind(new Date(Date.now()-30*86400000).toISOString()).run();return result;}
  catch(error){await getD1().prepare(`UPDATE app_job_runs SET state='failed',finished_at=?,error_category=? WHERE id=?`).bind(new Date().toISOString(),error instanceof Error?error.name:"unknown",id).run();throw error;}
}
