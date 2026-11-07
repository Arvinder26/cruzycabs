import { getD1 } from "./d1";
import { localPreview,setting } from "./config";
import { sha } from "./security";
import { ensurePlatform } from "./platform";
import { sessionCookie,sessionToken } from "./session-policy";
export type Identity={userId:string;email:string;displayName:string;fullName:string|null;mfaVerified:boolean;persistentAdmin?:boolean};
export async function identity(headers:Headers):Promise<Identity|null> {
  if(localPreview()&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(headers.get("host")||""))return {userId:"local-preview",email:"preview@cruzycabs.local",displayName:"Local preview",fullName:null,mfaVerified:true};
  const cookie=sessionToken(headers);
  if(!cookie)return null;
  await ensurePlatform();const row=await getD1().prepare(`SELECT s.email,s.expires session_expires,a.expires assurance_expires FROM app_sessions s LEFT JOIN app_session_assurance a ON a.token_hash=s.token_hash WHERE s.token_hash=? AND (s.expires=0 OR s.expires>?)`).bind(await sha(cookie),Date.now()).first<{email:string;session_expires:number;assurance_expires:number|null}>();
  if(!row)return null;
  const persistentAdmin=row.session_expires===0&&row.assurance_expires===0&&hasRole(row.email,"admin");
  return {userId:await sha(row.email),email:row.email,displayName:row.email,fullName:null,mfaVerified:persistentAdmin||Boolean(row.assurance_expires&&row.assurance_expires>Date.now()),persistentAdmin};
}
export function renewAdminSession(request:Request,response:Response,user:Identity){
  const value=sessionToken(request.headers);
  if(value&&user.persistentAdmin&&user.mfaVerified)response.headers.set("Set-Cookie",sessionCookie(value,true));
  return response;
}
export type Role="driver"|"dispatch"|"admin"|"partner";
export function hasRole(email:string,role:Role){
  if(localPreview()&&email==="preview@cruzycabs.local")return true;
  return setting("STAFF_ROLE_BINDINGS").split(",").some(entry=>{const [address,roles=""]=entry.trim().split(":");return address.toLowerCase()===email.toLowerCase()&&(roles.split("|").includes(role)||roles.split("|").includes("all"));});
}
