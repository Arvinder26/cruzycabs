import { getD1 } from "./d1";
import { localPreview,setting } from "./config";
import { sha } from "./security";
import { ensurePlatform } from "./platform";
export type Identity={userId:string;email:string;displayName:string;fullName:string|null;mfaVerified:boolean};
export async function identity(headers:Headers):Promise<Identity|null> {
  if(localPreview()&&/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(headers.get("host")||""))return {userId:"local-preview",email:"preview@cruzycabs.local",displayName:"Local preview",fullName:null,mfaVerified:true};
  const cookie=headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith("cc_session="))?.slice(11);
  if(!cookie||!/^[a-f0-9]{64}$/.test(cookie))return null;
  await ensurePlatform();const row=await getD1().prepare(`SELECT s.email,a.expires assurance_expires FROM app_sessions s LEFT JOIN app_session_assurance a ON a.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires>?`).bind(await sha(cookie),Date.now()).first<{email:string;assurance_expires:number|null}>();
  return row?{userId:await sha(row.email),email:row.email,displayName:row.email,fullName:null,mfaVerified:Boolean(row.assurance_expires&&row.assurance_expires>Date.now())}:null;
}
export type Role="driver"|"dispatch"|"admin"|"partner";
export function hasRole(email:string,role:Role){
  if(localPreview()&&email==="preview@cruzycabs.local")return true;
  return setting("STAFF_ROLE_BINDINGS").split(",").some(entry=>{const [address,roles=""]=entry.trim().split(":");return address.toLowerCase()===email.toLowerCase()&&(roles.split("|").includes(role)||roles.split("|").includes("all"));});
}
