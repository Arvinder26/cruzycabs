import { equal,HttpError } from "./security";
export async function verifyTotp(secret:string,code:string,now=Date.now()){
  if(!/^[A-Z2-7]{32,}$/i.test(secret)||!/^\d{6}$/.test(code))return false;
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits="";for(const char of secret.toUpperCase())bits+=alphabet.indexOf(char).toString(2).padStart(5,"0");
  const bytes=new Uint8Array(Math.floor(bits.length/8));for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(bits.slice(i*8,i*8+8),2);
  const key=await crypto.subtle.importKey("raw",bytes,{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  for(const delta of [-1,0,1]){const counter=new ArrayBuffer(8),view=new DataView(counter);view.setBigUint64(0,BigInt(Math.floor(now/30000)+delta));const hash=new Uint8Array(await crypto.subtle.sign("HMAC",key,counter)),offset=hash[hash.length-1]&15;const value=((hash[offset]&127)<<24)|(hash[offset+1]<<16)|(hash[offset+2]<<8)|hash[offset+3];if(equal(String(value%1000000).padStart(6,"0"),code))return true;}return false;
}
export function requireTotp(value:unknown){if(typeof value!=="string"||!/^\d{6}$/.test(value))throw new HttpError("Enter your six-digit authenticator code.",401);return value;}
