import { getD1 } from "../../../lib/d1";
import { setting } from "../../../lib/config";
import { audit,rateLimit } from "../../../lib/platform";
import { deliverOutbox,queueEmail } from "../../../lib/notifications";
import { email,endpoint,HttpError,json,phone,readObject,sameOrigin,sha,text } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"requests",5,600);const body=await readObject(request,12000),kind=text(body.kind,"Enquiry type",40);
  if(!["support","lost-property","complaint","privacy","tour","corporate","driver","partner","journey","accessibility"].includes(kind))throw new HttpError("Invalid enquiry type.");
  if(body.website)throw new HttpError("Request could not be accepted.");if(body.consent!==true)throw new HttpError("Please agree to be contacted about your request.");
  const name=text(body.name,"Name",100),address=email(body.email),mobile=phone(body.phone),details=text(body.details,"Details",6000),key=text(request.headers.get("idempotency-key"),"Retry key",100),id=await sha(`request:${key}`),now=new Date().toISOString(),data=JSON.stringify({details,bookingReference:text(body.bookingReference,"Booking reference",30,true)});
  const existing=await getD1().prepare(`SELECT reference,name,email,phone,data_json,kind FROM app_requests WHERE id=?`).bind(id).first<{reference:string;name:string;email:string;phone:string;data_json:string;kind:string}>();
  if(existing){if(existing.name!==name||existing.email!==address||existing.phone!==mobile||existing.data_json!==data||existing.kind!==kind)throw new HttpError("Start a new request after changing submitted details.",409);return json({reference:existing.reference});}
  const reference=`CCQ-${id.slice(0,10).toUpperCase()}`,ops=setting("SUPPORT_EMAIL","operations@cruzycabs.com");
  await getD1().batch([getD1().prepare(`INSERT INTO app_requests(id,reference,kind,name,email,phone,data_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,reference,kind,name,address,mobile,data,now,now),audit("request",id,"request.created","customer",{kind}),queueEmail(`request-receipt:${id}`,address,`cruzycabs enquiry ${reference}`,`We have received your ${kind} enquiry. Reference: ${reference}. Operations will respond using the contact details you supplied. For urgent help, email ${ops}.`),queueEmail(`request-ops:${id}`,ops,`New ${kind} enquiry ${reference}`,`Open the protected operations workspace at ${setting("SITE_URL","https://cruzycabs.co.nz")}/dispatch to review this enquiry.`)]);
  await deliverOutbox();return json({reference,message:"Your request is recorded. Operations will contact you."},201);
});}

