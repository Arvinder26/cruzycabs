import { setting,siteOrigin } from "./config";
import { getD1 } from "./d1";
import { ensurePlatform } from "./platform";
export function queueEmail(key:string,recipient:string,subject:string,text:string) {const now=new Date().toISOString();return getD1().prepare(`INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),key,recipient,subject,text,now,now);}
export async function deliverOutbox() {
  await ensurePlatform();const apiKey=setting("RESEND_API_KEY"),from=setting("EMAIL_FROM");if(!apiKey||!from)return {configured:false,sent:0};
  const now=new Date().toISOString(),rows=await getD1().prepare(`SELECT * FROM app_outbox WHERE state='pending' AND next_attempt<=? AND (lease_until IS NULL OR lease_until<?) LIMIT 20`).bind(now,now).all<{id:string;recipient:string;subject:string;text:string;attempts:number}>();let sent=0;
  for(const row of rows.results||[]) {
    const claim=await getD1().prepare(`UPDATE app_outbox SET lease_until=? WHERE id=? AND state='pending' AND (lease_until IS NULL OR lease_until<?) RETURNING id`).bind(new Date(Date.now()+60000).toISOString(),row.id,now).first();if(!claim)continue;
    try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json","Idempotency-Key":row.id},body:JSON.stringify({from,to:[row.recipient],subject:row.subject,text:row.text}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error("Email rejected");await getD1().prepare(`UPDATE app_outbox SET state='sent',lease_until=NULL WHERE id=?`).bind(row.id).run();sent++;}
    catch{const attempts=row.attempts+1;await getD1().prepare(`UPDATE app_outbox SET attempts=?,state=?,lease_until=NULL,next_attempt=? WHERE id=?`).bind(attempts,attempts>=8?"failed":"pending",new Date(Date.now()+Math.min(86400,30*2**attempts)*1000).toISOString(),row.id).run();}
  }return {configured:true,sent};
}
export function managementLink(reference:string,token:string){return `${siteOrigin()}/manage-booking?ref=${encodeURIComponent(reference)}#token=${token}`;}
