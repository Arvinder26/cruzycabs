import { setting,siteOrigin } from "./config";
import { getD1 } from "./d1";
import { ensurePlatform } from "./platform";
import { recoverOperationsEmails } from "./operations-email";
import { emailHtml,emailText } from "./email-layout";
export function queueEmail(key:string,recipient:string,subject:string,text:string) {const now=new Date().toISOString();return getD1().prepare(`INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),key,recipient,subject,text,now,now);}
// Customer booking emails send operations a private copy; sign-in codes and staff or driver mail never do.
const customerCopyKeys=["booking:","enquiry-accepted:","enquiry-declined:","booking-accepted:","booking-declined:","trip:","cancel:","paid:","request-receipt:","reschedule:"];
// Driver calendar invites also copy operations, so the office sees every job that is assigned.
const operationsCopyKeys=[...customerCopyKeys,"calendar:"];
export async function deliverOutbox() {
  await ensurePlatform();const apiKey=setting("RESEND_API_KEY"),from=setting("EMAIL_FROM");if(!apiKey||!from){console.error(JSON.stringify({event:"email.not_configured",missing:[!apiKey?"RESEND_API_KEY":null,!from?"EMAIL_FROM":null].filter(Boolean)}));return {configured:false,sent:0};}
  await recoverOperationsEmails();
  const now=new Date().toISOString(),rows=await getD1().prepare(`SELECT o.*,x.filename,x.content_type,x.content attachment FROM app_outbox o LEFT JOIN app_outbox_attachments x ON x.outbox_key=o.dedupe_key WHERE o.state='pending' AND o.next_attempt<=? AND (o.lease_until IS NULL OR o.lease_until<?) ORDER BY CASE WHEN o.dedupe_key LIKE 'operations-booking:%' THEN 0 ELSE 1 END,o.created_at LIMIT 20`).bind(now,now).all<{id:string;dedupe_key:string;recipient:string;subject:string;text:string;attempts:number;filename:string|null;content_type:string|null;attachment:string|null}>();const operations=setting("OPERATIONS_EMAIL")||setting("SUPPORT_EMAIL")||"operations@cruzycabs.co.nz";let sent=0;
  for(const row of rows.results||[]) {
    const claim=await getD1().prepare(`UPDATE app_outbox SET lease_until=? WHERE id=? AND state='pending' AND (lease_until IS NULL OR lease_until<?) RETURNING id`).bind(new Date(Date.now()+60000).toISOString(),row.id,now).first();if(!claim)continue;
    try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":row.id},body:JSON.stringify({from,to:[row.recipient],...(operationsCopyKeys.some(key=>row.dedupe_key.startsWith(key))&&row.recipient.toLowerCase()!==operations.toLowerCase()?{bcc:[operations]}:{}),subject:row.subject,text:emailText(row.text),html:emailHtml(row.subject,row.text),...(row.attachment&&row.filename?{attachments:[{filename:row.filename,content:Buffer.from(row.attachment).toString("base64"),content_type:row.content_type}]}:{})}),signal:AbortSignal.timeout(10000)});if(!r.ok){const result=await r.json().catch(()=>({})) as {name?:string};console.error(JSON.stringify({event:"email.provider_rejected",outboxId:row.id,status:r.status,code:result.name}));throw new Error("Email rejected");}const result=await r.json() as {id?:string};await getD1().prepare(`UPDATE app_outbox SET state='sent',lease_until=NULL WHERE id=?`).bind(row.id).run();console.info(JSON.stringify({event:"email.accepted",outboxId:row.id,providerId:result.id}));sent++;}
    catch{const attempts=row.attempts+1;console.error(JSON.stringify({event:"email.retry_scheduled",outboxId:row.id,attempts}));await getD1().prepare(`UPDATE app_outbox SET attempts=?,state=?,lease_until=NULL,next_attempt=? WHERE id=?`).bind(attempts,attempts>=8?"failed":"pending",new Date(Date.now()+Math.min(86400,30*2**attempts)*1000).toISOString(),row.id).run();}
  }return {configured:true,sent};
}
export function managementLink(reference:string,token:string){return `${siteOrigin()}/manage-booking?ref=${encodeURIComponent(reference)}#token=${token}`;}
