import { getD1 } from "../../../lib/d1";
import { setting } from "../../../lib/config";
import { hasRole } from "../../../lib/auth";
import { requireTotp,verifyTotp } from "../../../lib/totp";
import { ensurePlatform,rateLimit } from "../../../lib/platform";
import { queueEmail,deliverOutbox } from "../../../lib/notifications";
import { email,endpoint,HttpError,json,readObject,sameOrigin,sha,text,token } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"auth",8,600);const body=await readObject(request);
  if(body.action==="signout"){const session=request.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith("cc_session="))?.slice(11);if(session){const hash=await sha(session);await getD1().batch([getD1().prepare(`DELETE FROM app_sessions WHERE token_hash=?`).bind(hash),getD1().prepare(`DELETE FROM app_session_assurance WHERE token_hash=?`).bind(hash)]);}return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":"cc_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"}});}
  if(body.action==="request"){
    if(!setting("RESEND_API_KEY")||!setting("EMAIL_FROM"))throw new HttpError("Email sign-in is not available yet. Please contact operations.",503);
    const address=email(body.email);await ensurePlatform();const id=token(),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
    await getD1().batch([getD1().prepare(`INSERT INTO app_otp(id,email,code_hash,expires) VALUES(?,?,?,?)`).bind(id,address,await sha(`${id}:${code}`),Date.now()+600000),queueEmail(`otp:${id}`,address,"Your cruzycabs sign-in code",`Your sign-in code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`)]);
    await deliverOutbox();return json({challenge:id,message:"Check your email for a six-digit code."});
  }
  if(body.action!=="verify")throw new HttpError("Invalid sign-in action.");
  const id=text(body.challenge,"Challenge",64),code=text(body.code,"Code",6);if(!/^\d{6}$/.test(code))throw new HttpError("Enter the six-digit code.");
  const challenge=await getD1().prepare(`UPDATE app_otp SET attempts=attempts+1 WHERE id=? AND used=0 AND expires>? AND attempts<5 RETURNING email,code_hash`).bind(id,Date.now()).first<{email:string;code_hash:string}>();
  if(!challenge||challenge.code_hash!==await sha(`${id}:${code}`))throw new HttpError("Invalid or expired code.",401);
  const staff=["admin","dispatch","driver","partner"].some(role=>hasRole(challenge.email,role as Parameters<typeof hasRole>[1]));
  if(staff){const secret=setting("STAFF_TOTP_BINDINGS").split(",").map(entry=>entry.split(":")).find(([address])=>address?.trim().toLowerCase()===challenge.email)?.[1]?.trim();if(!secret)throw new HttpError("Staff authenticator access has not been configured. Contact the administrator.",503);if(!await verifyTotp(secret,requireTotp(body.totp)))throw new HttpError("Invalid authenticator code.",401);}
  const claimed=await getD1().prepare(`UPDATE app_otp SET used=1 WHERE id=? AND used=0 RETURNING id`).bind(id).first();if(!claimed)throw new HttpError("Code already used.",401);
  const session=token(),hash=await sha(session),staffWindow=hasRole(challenge.email,"admin")||hasRole(challenge.email,"dispatch")?30*60000:12*3600000;await getD1().batch([getD1().prepare(`INSERT INTO app_sessions(token_hash,email,expires) VALUES(?,?,?)`).bind(hash,challenge.email,Date.now()+7*86400000),...(staff?[getD1().prepare(`INSERT INTO app_session_assurance(token_hash,expires) VALUES(?,?)`).bind(hash,Date.now()+staffWindow)]:[])]);
  return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":`cc_session=${session}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`}});
});}

