import { setting,siteOrigin } from "./config";
import { getD1 } from "./d1";
import { ensurePlatform } from "./platform";
import { recoverOperationsEmails } from "./operations-email";
export function queueEmail(key:string,recipient:string,subject:string,text:string) {const now=new Date().toISOString();return getD1().prepare(`INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),key,recipient,subject,text,now,now);}
export async function deliverOutbox() {
  await ensurePlatform();const apiKey=setting("RESEND_API_KEY"),from=setting("EMAIL_FROM");if(!apiKey||!from){console.error(JSON.stringify({event:"email.not_configured",missing:[!apiKey?"RESEND_API_KEY":null,!from?"EMAIL_FROM":null].filter(Boolean)}));return {configured:false,sent:0};}
  await recoverOperationsEmails();
  const now=new Date().toISOString(),rows=await getD1().prepare(`SELECT * FROM app_outbox WHERE state='pending' AND next_attempt<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY CASE WHEN dedupe_key LIKE 'operations-booking:%' THEN 0 ELSE 1 END,created_at LIMIT 20`).bind(now,now).all<{id:string;recipient:string;subject:string;text:string;attempts:number}>();let sent=0;
  for(const row of rows.results||[]) {
    const claim=await getD1().prepare(`UPDATE app_outbox SET lease_until=? WHERE id=? AND state='pending' AND (lease_until IS NULL OR lease_until<?) RETURNING id`).bind(new Date(Date.now()+60000).toISOString(),row.id,now).first();if(!claim)continue;
    try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":row.id},body:JSON.stringify({from,to:[row.recipient],subject:row.subject,text:row.text}),signal:AbortSignal.timeout(10000)});if(!r.ok){const result=await r.json().catch(()=>({})) as {name?:string};console.error(JSON.stringify({event:"email.provider_rejected",outboxId:row.id,status:r.status,code:result.name}));throw new Error("Email rejected");}const result=await r.json() as {id?:string};await getD1().prepare(`UPDATE app_outbox SET state='sent',lease_until=NULL WHERE id=?`).bind(row.id).run();console.info(JSON.stringify({event:"email.accepted",outboxId:row.id,providerId:result.id}));sent++;}
    catch{const attempts=row.attempts+1;console.error(JSON.stringify({event:"email.retry_scheduled",outboxId:row.id,attempts}));await getD1().prepare(`UPDATE app_outbox SET attempts=?,state=?,lease_until=NULL,next_attempt=? WHERE id=?`).bind(attempts,attempts>=8?"failed":"pending",new Date(Date.now()+Math.min(86400,30*2**attempts)*1000).toISOString(),row.id).run();}
  }return {configured:true,sent};
}
export function managementLink(reference:string,token:string){return `${siteOrigin()}/manage-booking?ref=${encodeURIComponent(reference)}#token=${token}`;}
