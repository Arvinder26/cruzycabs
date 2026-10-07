import { env } from "../../../lib/runtime-env";
import { put,get } from "@vercel/blob";
import { identity,hasRole } from "../../../lib/auth";
import { getD1 } from "../../../lib/d1";
import { audit,rateLimit } from "../../../lib/platform";
import { endpoint,HttpError,json,sameOrigin,text } from "../../../lib/security";
async function manager(request:Request){const user=await identity(request.headers);if(!user||!user.mfaVerified||!hasRole(user.email,"admin"))throw new HttpError("Admin permission and recent authenticator sign-in required.",403);const bucket=(env.COMPLIANCE_FILES as R2Bucket|undefined)||(process.env.BLOB_READ_WRITE_TOKEN?{
  async put(key:string,value:ArrayBuffer,options?:{httpMetadata?:{contentType?:string}}){return put(key,value,{access:"private",addRandomSuffix:false,contentType:options?.httpMetadata?.contentType});},
  async get(key:string){const value=await get(key,{access:"private"});return value?{body:value.stream}:null;},
}:undefined);if(!bucket)throw new HttpError("Private compliance document storage is not configured.",503);return {user,bucket};}
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"compliance-upload",10);const {user,bucket}=await manager(request),reader=request.body?.getReader();if(!reader)throw new HttpError("Upload required.");let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();throw new HttpError("Maximum upload size is 5 MB.",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const form=await new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData(),driverId=text(form.get("driverId"),"Driver",64),file=form.get("file");
  if(!(file instanceof File)||!["application/pdf","image/jpeg","image/png"].includes(file.type))throw new HttpError("Upload a PDF, PNG or JPEG document.");
  if(!await getD1().prepare(`SELECT id FROM app_drivers WHERE id=?`).bind(driverId).first())throw new HttpError("Driver not found.",404);
  const contents=await file.arrayBuffer(),signature=new Uint8Array(contents).slice(0,8);const valid=file.type==="application/pdf"?new TextDecoder().decode(signature).startsWith("%PDF-"):file.type==="image/png"?signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71:signature[0]===255&&signature[1]===216;
  if(!valid)throw new HttpError("File contents do not match the declared type.");
  const id=crypto.randomUUID(),key=`compliance/${driverId}/${id}`;await bucket.put(key,contents,{httpMetadata:{contentType:file.type}});
  await getD1().batch([getD1().prepare(`INSERT INTO app_documents(id,driver_id,storage_key,name,content_type,size,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,driverId,key,file.name.slice(0,180),file.type,file.size,new Date().toISOString()),audit("document",id,"document.uploaded",user.email,{driverId})]);return json({id},201);
});}
export function GET(request:Request){return endpoint(async()=>{await rateLimit(request,"documents",30);const {user,bucket}=await manager(request),id=text(new URL(request.url).searchParams.get("id"),"Document",64),row=await getD1().prepare(`SELECT storage_key,content_type FROM app_documents WHERE id=?`).bind(id).first<{storage_key:string;content_type:string}>();if(!row)throw new HttpError("Document not found.",404);const file=await bucket.get(row.storage_key);if(!file)throw new HttpError("Document is unavailable.",404);await audit("document",id,"document.read",user.email).run();return new Response(file.body,{headers:{"Content-Type":row.content_type,"Content-Disposition":"attachment","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});});}
