import { getD1 } from "../../../lib/d1";
import { hasRole,identity,renewAdminSession } from "../../../lib/auth";
import { bookingsEnabled,cardPaymentsEnabled,setting,siteOrigin } from "../../../lib/config";
import { reconcileRefund } from "../../../lib/refunds";
import { activePricing } from "../../../lib/pricing-store";
import { defaultPricing } from "../../../lib/pricing";
import { audit,ensurePlatform,rateLimit } from "../../../lib/platform";
import { cancelBooking,findBooking,rescheduleBooking } from "../../../lib/bookings";
import { normaliseReference } from "../../../lib/booking-reference";
import { requireNoDriverClash } from "../../../lib/driver-schedule";
import { syncDriverCalendar } from "../../../lib/calendar";
import { deliverOutbox,managementLink,queueEmail } from "../../../lib/notifications";
import { acceptEnquiryAsBooking,acceptanceEmailState,convertibleEnquiryKinds,isManualEnquiryBooking } from "../../../lib/enquiry-bookings";
import { endpoint,HttpError,json,managementToken,email,phone,readObject,sameOrigin,text } from "../../../lib/security";
export const runtime="nodejs";
async function staff(request:Request){const user=await identity(request.headers);if(!user||!user.mfaVerified||!["admin","dispatch","driver","partner"].some(r=>hasRole(user.email,r as Parameters<typeof hasRole>[1])))throw new HttpError("A recent staff authenticator sign-in is required.",403);return user;}
export function GET(request:Request){return endpoint(async()=>{
  await ensurePlatform();await rateLimit(request,"operations-read",120);const user=await staff(request),manager=hasRole(user.email,"dispatch")||hasRole(user.email,"admin");
  const driver=await getD1().prepare(`SELECT * FROM app_drivers WHERE email=?`).bind(user.email).first<{id:string;provider:string}>();
  const partner=hasRole(user.email,"partner");
  const provider=setting("PARTNER_PROVIDER_BINDINGS").split(",").map(entry=>entry.split("=")).find(([address])=>address?.trim().toLowerCase()===user.email)?.[1]?.trim() || driver?.provider || "unbound";
  const query=new URL(request.url).searchParams;
  const pageValue=Number(query.get("page")||1),requestPageValue=Number(query.get("requestPage")||1),pricedRequestPageValue=Number(query.get("pricedRequestPage")||1);
  if(![pageValue,requestPageValue,pricedRequestPageValue].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=100000))throw new HttpError("Invalid page.");
  const page=pageValue,requestPage=requestPageValue,pageSize=50,status=query.get("status")||"active",search=(query.get("q")||"").trim();
  if(search.length>200||!["active","all","completed","cancelled","declined","pending_customer_confirmation","review","awaiting_dispatch","offered","awaiting_payment","accepted","arrived","on_trip","cancel_pending"].includes(status))throw new HttpError("Invalid booking filter.");
  const joined=`FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id LEFT JOIN app_assignments a ON a.booking_id=b.id AND a.state NOT IN ('declined','expired','cancelled') ${manager?"":"JOIN app_drivers dr ON dr.id=a.driver_id"}`;
  const scope=manager?"1=1":partner?"dr.provider=?":"dr.email=?",scopeArgs=manager?[]:[partner?provider:user.email];
  const clauses=[scope],args:unknown[]=[...scopeArgs];
  if(status==="active")clauses.push("(b.status NOT IN ('completed','cancelled','declined') OR b.payment_state IN ('refund_pending','refund_failed','refund_action_required'))");
  else if(status!=="all"){clauses.push("b.status=?");args.push(status);}
  if(search){clauses.push("(b.reference LIKE ? ESCAPE '\\' OR b.customer_name LIKE ? ESCAPE '\\' OR b.journey_json LIKE ? ESCAPE '\\')");const term=`%${search.replace(/[\\%_]/g,"\\$&")}%`;args.push(term,term,term);}
  const where=`WHERE ${clauses.join(" AND ")}`;
  const totals=await getD1().prepare(`SELECT COUNT(*) total ${joined} ${where}`).bind(...args).first<{total:number}>();
  const selected=`SELECT b.id,b.reference,b.vehicle_id,b.customer_name,b.customer_phone,b.journey_json,b.requirements_json,b.status,b.payment_state,b.created_at,d.price_cents,d.scheduled_at,a.id assignment_id,a.driver_id,a.state assignment_state`;
  if(query.get("export")==="payments"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);
    if((totals?.total||0)>10000)throw new HttpError("More than 10,000 records match. Narrow your search or status filter before exporting.",413);
    const records=await getD1().prepare(`${selected} ${joined} ${where} ORDER BY b.created_at DESC`).bind(...args).all<{reference:string;customer_name:string;price_cents:number;payment_state:string;status:string}>();
    const cell=(value:string)=>`"${(/^[=+@-]/.test(value)?"'":"")+value.replaceAll('"','""')}"`;
    const csv="Reference,Customer,Total NZD,Payment,Status\r\n"+(records.results||[]).map(b=>[b.reference,b.customer_name,(b.price_cents/100).toFixed(2),b.payment_state,b.status].map(cell).join(",")).join("\r\n");
    return renewAdminSession(request,new Response(csv,{headers:{"Content-Type":"text/csv;charset=utf-8","Cache-Control":"no-store","Content-Disposition":"attachment; filename=cruzycabs-payments.csv"}}),user);
  }
  const rows=await getD1().prepare(`${selected} ${joined} ${where} ORDER BY CASE WHEN b.status NOT IN ('completed','cancelled','declined') THEN 0 ELSE 1 END,COALESCE(d.scheduled_at,b.created_at),b.id LIMIT ? OFFSET ?`).bind(...args,pageSize,(page-1)*pageSize).all();
  const summary=await getD1().prepare(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN b.status='awaiting_dispatch' THEN 1 ELSE 0 END),0) awaiting_dispatch ${joined} WHERE ${scope}`).bind(...scopeArgs).first();
  const drivers=await getD1().prepare(`SELECT d.*,c.phone,v.id vehicle_id,v.class,v.plate,v.description,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_compliance_until FROM app_drivers d LEFT JOIN app_driver_contacts c ON c.driver_id=d.id LEFT JOIN app_vehicles v ON v.driver_id=d.id ${manager?"":"WHERE "+(partner?"d.provider=?":"d.email=?")} ORDER BY d.name`).bind(...(manager?[]:[partner?provider:user.email])).all();
  const requestStatus=query.get("requestStatus")==="all"?"all":"active";
  const requests=manager?await getD1().prepare(`SELECT r.*,b.reference booking_reference,b.status booking_status,o.state acceptance_email_state FROM app_requests r LEFT JOIN bookings b ON b.idempotency_key='enquiry:' || r.id LEFT JOIN app_outbox o ON o.dedupe_key='enquiry-accepted:' || r.id ${requestStatus==="active"?"WHERE r.state IN ('open','accepted')":""} ORDER BY r.created_at,r.id LIMIT ? OFFSET ?`).bind(pageSize,(requestPage-1)*pageSize).all():{results:[]};
  const pricedCount=manager?await getD1().prepare("SELECT COUNT(*) total FROM bookings WHERE status='review' AND idempotency_key NOT LIKE 'enquiry:%'").first<{total:number}>():null;
  const pricedRequests=manager?await getD1().prepare("SELECT b.id,b.reference,b.customer_name,b.customer_email,b.customer_phone,b.vehicle_id,b.journey_json,b.requirements_json,b.created_at,d.price_cents FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id WHERE b.status='review' AND b.idempotency_key NOT LIKE 'enquiry:%' ORDER BY b.created_at,b.id LIMIT ? OFFSET ?").bind(pageSize,(pricedRequestPageValue-1)*pageSize).all():{results:[]};
  const requestCounts=manager?await getD1().prepare(`SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN state='open' THEN 1 ELSE 0 END),0) open,COALESCE(SUM(CASE WHEN state IN ('open','accepted') THEN 1 ELSE 0 END),0) active FROM app_requests`).first<{total:number;open:number;active:number}>():null;
  const metrics=manager?await getD1().prepare(`SELECT (SELECT COUNT(*) FROM app_outbox WHERE state='failed') failed_notifications,(SELECT COUNT(*) FROM bookings WHERE status='cancel_pending' OR payment_state IN ('refund_pending','refund_failed','refund_action_required')) pending_refunds`).first():null;
  const lastJob=manager?await getD1().prepare(`SELECT state,started_at,finished_at,error_category FROM app_job_runs ORDER BY started_at DESC LIMIT 1`).first():null;
  const events=hasRole(user.email,"admin")?await getD1().prepare(`SELECT entity_type,entity_id,action,actor_type,detail_json,created_at FROM audit_events ORDER BY created_at DESC LIMIT 200`).all():{results:[]};
  const documents=hasRole(user.email,"admin")?await getD1().prepare(`SELECT id,driver_id,name,content_type,created_at FROM app_documents ORDER BY created_at DESC LIMIT 200`).all():{results:[]};
  return renewAdminSession(request,json({bookings:rows.results||[],pagination:{page,pageSize,total:totals?.total||0},summary:{...summary,open_requests:(requestCounts?.open||0)+(pricedCount?.total||0)},requestsPagination:{page:requestPage,pageSize,total:requestStatus==="active"?requestCounts?.active||0:requestCounts?.total||0},pricedRequests:pricedRequests.results||[],pricedRequestsPagination:{page:pricedRequestPageValue,pageSize,total:pricedCount?.total||0},drivers:drivers.results||[],requests:requests.results||[],metrics,lastJob,manager,admin:hasRole(user.email,"admin"),events:events.results||[],documents:documents.results||[],pricing:await activePricing(),readiness:{bookingsEnabled:bookingsEnabled(),cardPayments:cardPaymentsEnabled(),stripe:Boolean(setting("STRIPE_SECRET_KEY")&&setting("STRIPE_WEBHOOK_SECRET")),routing:Boolean(setting("GOOGLE_MAPS_API_KEY")),email:Boolean(setting("RESEND_API_KEY")&&setting("EMAIL_FROM")),staffRoles:Boolean(setting("STAFF_ROLE_BINDINGS")),staffAuthenticator:Boolean(setting("STAFF_TOTP_BINDINGS")),privateDocuments:Boolean(setting("BLOB_READ_WRITE_TOKEN")),legalOperator:Boolean(setting("BUSINESS_LEGAL_NAME")),mode:setting("STRIPE_MODE","test")}}),user);
});}
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"operations-write",60);const user=await staff(request),body=await readObject(request),action=text(body.action,"Action",40),manager=hasRole(user.email,"dispatch")||hasRole(user.email,"admin"),now=new Date().toISOString();
  if(action==="pricing"){
    if(!hasRole(user.email,"admin"))throw new HttpError("Admin permission required.",403);
    const values=body.rules;if(!values||typeof values!=="object"||Array.isArray(values))throw new HttpError("Pricing rules are required.");
    const rules={...defaultPricing,version:`CC-${crypto.randomUUID().slice(0,8)}`};for(const key of Object.keys(defaultPricing).filter(key=>key!=="version") as (keyof Omit<typeof defaultPricing,"version">)[]){const n=(values as Record<string,unknown>)[key];if(typeof n!=="number"||!Number.isInteger(n)||n<0||n>100000)throw new HttpError("Rates must be integer cents between zero and 100000.");rules[key]=n;}
    const reason=text(body.note,"Pricing change reason",2000);await getD1().batch([getD1().prepare(`INSERT INTO app_pricing(id,rules_json,reason,author,created_at) VALUES(?,?,?,?,?)`).bind(rules.version,JSON.stringify(rules),reason,user.email,now),audit("pricing",rules.version,"pricing.published",user.email,{reason,rules})]);return json({ok:true});
  }
  if(action==="onboard"){
    if(!hasRole(user.email,"admin"))throw new HttpError("Admin permission required.",403);
    if(body.verified!==true)throw new HttpError("Verify the driver and vehicle compliance before approval.");
    const name=text(body.name,"Driver name",100),address=email(body.email),provider=text(body.provider,"Provider",100,true)||"cruzycabs",contact=body.phone?phone(body.phone):"",plate=text(body.plate,"Registration",20).toUpperCase(),description=text(body.description,"Vehicle description",150),vehicleClass=text(body.vehicleClass,"Class",20),expires=text(body.complianceUntil,"Compliance expiry",10,true),driverId=crypto.randomUUID();
    if(!["xl","accessible"].includes(vehicleClass)||(expires&&(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||Number.isNaN(Date.parse(expires))||new Date(expires).toISOString().slice(0,10)!==expires||expires<=now.slice(0,10))))throw new HttpError("Choose Van or Accessible and a valid future compliance expiry, or leave the expiry blank.");
    const passengers=Number(body.passengers),luggage=Number(body.luggage);if(!Number.isInteger(passengers)||passengers<1||passengers>16||!Number.isInteger(luggage)||luggage<0||luggage>20)throw new HttpError("Invalid capacity.");
    const capabilities=Array.isArray(body.capabilities)?body.capabilities:[];if(capabilities.some(v=>!["ramp","hoist","transfer","pet","child-seat"].includes(String(v))))throw new HttpError("Invalid capability.");
    const existing=await getD1().prepare(`SELECT d.id,d.name,d.email,d.provider,d.approved,d.compliance_until,c.phone,v.class,v.plate,v.description,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_expiry FROM app_drivers d LEFT JOIN app_driver_contacts c ON c.driver_id=d.id LEFT JOIN app_vehicles v ON v.driver_id=d.id WHERE d.email=? OR v.plate=?`).bind(address,plate).all<{id:string;name:string;email:string;provider:string;approved:number;compliance_until:string;phone:string|null;class:string|null;plate:string|null;description:string|null;passengers:number|null;luggage:number|null;capabilities:string|null;vehicle_expiry:string|null}>();
    if(existing.results?.length){
      const row=existing.results[0];
      const same=existing.results.length===1&&row.name===name&&row.email===address&&row.provider===provider&&row.approved===1&&row.compliance_until===expires&&(row.phone||"")===contact&&row.class===vehicleClass&&row.plate===plate&&row.description===description&&row.passengers===passengers&&row.luggage===luggage&&row.vehicle_expiry===expires&&JSON.stringify((JSON.parse(row.capabilities||"[]") as string[]).sort())===JSON.stringify([...capabilities].sort());
      if(same)return json({ok:true,alreadyExists:true,driverId:row.id});
      throw new HttpError("This driver email or vehicle registration is already saved. Review the existing record in Drivers before making changes.",409);
    }
    try{await getD1().batch([getD1().prepare(`INSERT INTO app_drivers(id,email,name,provider,approved,compliance_until,created_at) VALUES(?,?,?,?,1,?,?)`).bind(driverId,address,name,provider,expires,now),getD1().prepare(`INSERT INTO app_driver_contacts(driver_id,phone) VALUES(?,?)`).bind(driverId,contact),getD1().prepare(`INSERT INTO app_vehicles(id,driver_id,class,plate,description,passengers,luggage,capabilities,compliance_until) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),driverId,vehicleClass,plate,description,passengers,luggage,JSON.stringify(capabilities),expires),audit("driver",driverId,"compliance.approved",user.email,{expires:expires||null,plate,verificationConfirmed:true,dispatchReady:Boolean(expires)})]);}catch(error){
      if(error instanceof Error&&/UNIQUE constraint failed: app_(?:drivers\.email|vehicles\.plate)/.test(error.message))throw new HttpError("This driver email or vehicle registration is already saved. Review the existing record in Drivers before making changes.",409);
      throw error;
    }
    return json({ok:true,driverId},201);
  }
  if(action==="availability"){
    const status=text(body.status,"Availability",20);if(!["available","offline","break"].includes(status))throw new HttpError("Invalid availability.");
    const driver=await getD1().prepare(`SELECT id FROM app_drivers WHERE email=? AND approved=1 AND compliance_until>?`).bind(user.email,now.slice(0,10)).first<{id:string}>();if(!driver)throw new HttpError("Approved driver profile required.",403);
    await getD1().batch([getD1().prepare(`UPDATE app_drivers SET status=? WHERE id=?`).bind(status,driver.id),audit("driver",driver.id,"availability.changed",user.email,{status})]);return json({ok:true});
  }
  if(action==="driver_compliance"){
    if(!hasRole(user.email,"admin"))throw new HttpError("Admin permission required.",403);
    if(body.verified!==true)throw new HttpError("Verify the driver and vehicle compliance before recording expiry dates.");
    const driverId=text(body.driverId,"Driver",64),future=(value:unknown,label:string)=>{const date=text(value,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<=now.slice(0,10))throw new HttpError(`Enter a valid future ${label.toLowerCase()}.`);return date;};
    const driverExpiry=future(body.driverExpiry,"Driver compliance expiry"),vehicleExpiry=future(body.vehicleExpiry,"Vehicle compliance expiry");
    const changed=await getD1().prepare(`UPDATE app_drivers SET compliance_until=?,approved=1 WHERE id=? RETURNING id`).bind(driverExpiry,driverId).first();if(!changed)throw new HttpError("Driver not found.",404);
    await getD1().batch([getD1().prepare(`UPDATE app_vehicles SET compliance_until=? WHERE driver_id=?`).bind(vehicleExpiry,driverId),audit("driver",driverId,"compliance.updated",user.email,{driverExpiry,vehicleExpiry,verificationConfirmed:true})]);return json({ok:true});
  }
  if(action==="driver_availability"){
    if(!hasRole(user.email,"admin"))throw new HttpError("Admin permission required.",403);
    const driverId=text(body.driverId,"Driver",64),status=text(body.status,"Availability",20);if(!["available","offline","break"].includes(status))throw new HttpError("Invalid availability.");
    const driver=await getD1().prepare(`SELECT d.id FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=? AND d.approved=1 AND v.active=1 AND (?<>'available' OR (d.compliance_until>? AND v.compliance_until>?))`).bind(driverId,status,now.slice(0,10),now.slice(0,10)).first<{id:string}>();
    if(!driver)throw new HttpError("Record future driver and vehicle compliance expiry dates before making this driver available.",422);
    await getD1().batch([getD1().prepare(`UPDATE app_drivers SET status=? WHERE id=?`).bind(status,driverId),audit("driver",driverId,"availability.changed",user.email,{status,setBy:"admin"})]);return json({ok:true});
  }
  if(action==="resolve_request"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);const id=text(body.id,"Request",64),note=text(body.note,"Resolution note",2000);
    const changed=await getD1().prepare(`UPDATE app_requests SET state='resolved',updated_at=? WHERE id=? AND state='open' RETURNING id`).bind(now,id).first();
    if(!changed)throw new HttpError("This enquiry is no longer open. Refresh before changing it.",409);
    await audit("request",id,"request.resolved",user.email,{note}).run();return json({ok:true});
  }
  if(action==="accept_request"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);
    const result=await acceptEnquiryAsBooking(body,user.email);await syncDriverCalendar(String(result.reference));
    await deliverOutbox();return json({ok:true,...result});
  }
  if(action==="decline_request"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);
    const id=text(body.id,"Enquiry",64),note=text(body.note,"Decline reason",1000);
    const requestRow=await getD1().prepare("SELECT reference,kind,email,state FROM app_requests WHERE id=?").bind(id).first<{reference:string;kind:string;email:string;state:string}>();
    if(!requestRow||!convertibleEnquiryKinds.includes(requestRow.kind)||requestRow.state!=="open")throw new HttpError("Only an open journey enquiry can be declined.",409);
    const result=await getD1().batch([
      getD1().prepare("UPDATE app_requests SET state='declined',updated_at=? WHERE id=? AND state='open' RETURNING id").bind(now,id),
      getD1().prepare("INSERT OR IGNORE INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'request',?,'request.declined','staff',?,? WHERE EXISTS(SELECT 1 FROM app_requests WHERE id=? AND state='declined')").bind(crypto.randomUUID(),id,JSON.stringify({actor:user.email,reason:note}),now,id),
      getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_requests WHERE id=? AND state='declined')").bind(crypto.randomUUID(),`enquiry-declined:${id}`,requestRow.email,`Your cruzycabs enquiry ${requestRow.reference}`,`Operations cannot accept enquiry ${requestRow.reference}. Reason: ${note}. Please reply to operations@cruzycabs.co.nz if you would like to discuss another arrangement.`,now,now,id),
    ]);
    if(!result[0].results?.length)throw new HttpError("This enquiry changed. Refresh before deciding.",409);
    await deliverOutbox();return json({ok:true,status:"declined"});
  }
  if(action==="retry_request_email"){
    if(!hasRole(user.email,"admin"))throw new HttpError("Admin permission required.",403);
    const id=text(body.id,"Enquiry",64),record=await getD1().prepare("SELECT state FROM app_requests WHERE id=?").bind(id).first<{state:string}>();
    if(record?.state!=="accepted")throw new HttpError("Only accepted booking offers can be emailed again.",409);
    await getD1().prepare("UPDATE app_outbox SET state='pending',next_attempt=?,lease_until=NULL WHERE dedupe_key=? AND state IN ('pending','failed') AND (lease_until IS NULL OR lease_until<?)").bind(now,`enquiry-accepted:${id}`,now).run();
    try{await deliverOutbox();}catch{console.error(JSON.stringify({event:"enquiry.acceptance_delivery_deferred"}));}
    return json({ok:true,emailState:await acceptanceEmailState(id)});
  }
  const reference=normaliseReference(text(body.reference,"Reference",30)),row=await findBooking(reference);if(!row)throw new HttpError("Booking not found.",404);
  if(action==="reconcile_refund"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);
    const refund=await getD1().prepare(`SELECT provider_id FROM app_refunds WHERE booking_id=?`).bind(row.id).first<{provider_id:string}>();
    if(!refund)throw new HttpError("No refund reference is recorded. Reconcile the original payment with operations.",409);
    await reconcileRefund(refund.provider_id);await deliverOutbox();return json({ok:true});
  }
  if(action==="cancel"){if(!manager)throw new HttpError("Dispatch permission required.",403);await cancelBooking(row,user.email);await deliverOutbox();return json({ok:true});}
  if(action==="change_time"){if(!manager)throw new HttpError("Dispatch permission required.",403);const result=await rescheduleBooking(row,text(body.date,"Date",10),text(body.time,"Time",5),user.email);await deliverOutbox();return json({ok:true,...result});}
  if(action==="decline_booking"){
    if(!manager||row.status!=="review"||!["not_paid","in_person"].includes(row.payment_state)||isManualEnquiryBooking(row.requirements_json))throw new HttpError("Only an undecided priced booking can be declined.",409);
    if(!bookingsEnabled())throw new HttpError("Online booking decisions are paused until activation.",503);
    const note=text(body.note,"Decline reason",1000);
    const emailId=crypto.randomUUID(),eventId=crypto.randomUUID(),auditId=crypto.randomUUID();
    const changed=await getD1().batch([
      getD1().prepare("UPDATE bookings SET status='declined',updated_at=? WHERE id=? AND status='review' AND payment_state IN ('not_paid','in_person') AND NOT EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND state NOT IN ('declined','expired','cancelled','completed')) RETURNING id").bind(now,row.id,row.id),
      getD1().prepare("INSERT OR IGNORE INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) SELECT ?,?,'declined','staff',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='declined')").bind(eventId,row.id,note,now,row.id),
      getD1().prepare("INSERT OR IGNORE INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'booking',?,'booking.declined','staff',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='declined')").bind(auditId,row.id,JSON.stringify({actor:user.email,note}),now,row.id),
      getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='declined')").bind(emailId,`booking-declined:${row.id}`,row.customer_email,`Booking request ${reference} declined`,`Operations could not accept booking request ${reference}. No payment was taken. Please contact operations@cruzycabs.co.nz if you need another journey arrangement. Your private booking link remains available for the recorded details.`,now,now,row.id),
    ]);
    if(!changed[0].results?.length)throw new HttpError("This booking changed. Refresh before deciding.",409);
    await deliverOutbox();return json({ok:true,status:"declined"});
  }
  if(action==="accept_booking"){
    if(!manager||row.status!=="review"||!["not_paid","in_person"].includes(row.payment_state)||isManualEnquiryBooking(row.requirements_json))throw new HttpError("Only an undecided priced booking can be accepted.",409);
    const inPerson=row.payment_state==="in_person",confirmed=inPerson?"accepted":"awaiting_payment";
    if(!bookingsEnabled()||!setting("RESEND_API_KEY")||!setting("EMAIL_FROM")||(!inPerson&&(!setting("STRIPE_SECRET_KEY")||!setting("STRIPE_WEBHOOK_SECRET"))))throw new HttpError(inPerson?"Bookings and email must be ready before accepting a priced request.":"Booking, card payment and email must be ready before accepting a priced request.",503);
    const driverId=text(body.driverId,"Driver",64);
    const driver=await getD1().prepare("SELECT d.*,v.class,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_expiry,v.plate,v.description FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=? AND d.approved=1 AND d.status IN ('available','on_job') AND v.active=1").bind(driverId).first<{name:string;plate:string;description:string;compliance_until:string;vehicle_expiry:string;class:string;passengers:number;luggage:number;capabilities:string;email:string}>();
    const journey=JSON.parse(row.journey_json) as {passengers:number;luggage:number;accessible:boolean;wheelchair:string;pet:boolean;childSeat:boolean};
    const capabilities=driver?JSON.parse(driver.capabilities) as string[]:[];
    if(!driver||!driver.compliance_until||!driver.vehicle_expiry||driver.compliance_until<=now.slice(0,10)||driver.vehicle_expiry<=now.slice(0,10)||driver.class!==row.vehicle_id||driver.passengers<journey.passengers||driver.luggage<journey.luggage||(journey.accessible&&!capabilities.includes(journey.wheelchair))||(journey.pet&&!capabilities.includes("pet"))||(journey.childSeat&&!capabilities.includes("child-seat")))throw new HttpError("Driver or vehicle does not meet this booking's capacity and compliance requirements.",422);
    if(row.scheduled_at&&Date.parse(row.scheduled_at)<Date.now()+15*60000)throw new HttpError("The requested pickup time is too close or has passed. Decline this request and ask the customer to obtain a new quote.",409);
    await requireNoDriverClash(driverId,row.id,row.scheduled_at);
    const assignmentId=crypto.randomUUID(),link=managementLink(reference,await managementToken(row.id)),fare=`NZD ${(row.price_cents/100).toFixed(2)}`;
    const trip=JSON.parse(row.journey_json) as {pickup:string;destination:string;stops?:string[];passengers:number;luggage:number},pickupTime=row.scheduled_at?new Intl.DateTimeFormat("en-NZ",{timeZone:"Pacific/Auckland",dateStyle:"full",timeStyle:"short"}).format(new Date(row.scheduled_at)):"As soon as possible";
    const confirmedText=[`Your booking ${reference} is confirmed and your driver is assigned.`,"",`Pickup time: ${pickupTime}`,`Pickup: ${trip.pickup}`,...(trip.stops?.length?[`Stops: ${trip.stops.join(" → ")}`]:[]),`Destination: ${trip.destination}`,`Passengers: ${trip.passengers}`,`Bags: ${trip.luggage}`,`Driver: ${driver.name}`,`Vehicle: ${driver.description} (${driver.plate})`,`Fare: ${fare}`,"Payment: Pay your driver in person (cash or EFTPOS)","","See your driver, change your pickup time or cancel from your booking page:",link].join("\n");
    const accepted=await getD1().batch([
      getD1().prepare("INSERT INTO app_assignments(id,booking_id,driver_id,state,created_at,updated_at) SELECT ?,?,?,'accepted',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='review' AND payment_state IN ('not_paid','in_person')) AND EXISTS(SELECT 1 FROM app_drivers WHERE id=? AND status IN ('available','on_job') AND approved=1) AND NOT EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND state NOT IN ('declined','expired','cancelled','completed')) RETURNING id").bind(assignmentId,row.id,driverId,now,now,row.id,driverId,row.id),
      getD1().prepare("UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status='review' AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(confirmed,now,row.id,assignmentId),
      getD1().prepare("UPDATE app_drivers SET status='on_job' WHERE id=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?) AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(driverId,row.id,confirmed,assignmentId),
      getD1().prepare("INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) SELECT ?,?,?,'staff','Quoted fare accepted and driver assigned',? WHERE EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(crypto.randomUUID(),row.id,confirmed,now,assignmentId),
      getD1().prepare("INSERT INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) SELECT ?,'booking',?,'booking.accepted','staff',?,? WHERE EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(crypto.randomUUID(),row.id,JSON.stringify({actor:user.email,driverId,priceCents:row.price_cents,paymentMethod:inPerson?"in_person":"card"}),now,assignmentId),
      getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(crypto.randomUUID(),`booking-accepted:${row.id}`,row.customer_email,inPerson?`Booking ${reference} confirmed`:`Booking ${reference} accepted — pay securely`,inPerson?confirmedText:`Operations accepted your quoted fare of ${fare} and assigned ${driver.name}, driving ${driver.description} (${driver.plate}). Open your private booking link to review the driver and pay securely by card through Stripe: ${link}. Travel is not ready to start until payment is confirmed.`,now,now,assignmentId),
      getD1().prepare("INSERT OR IGNORE INTO app_outbox(id,dedupe_key,recipient,subject,text,next_attempt,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state='accepted')").bind(crypto.randomUUID(),`staff-assigned:${assignmentId}`,driver.email,`Assigned cruzycabs booking ${reference}`,`Operations assigned booking ${reference} to you. Review the journey in your driver workspace: ${siteOrigin()}/driver. ${inPerson?"Collect the fare in person (cash or EFTPOS).":"Wait for confirmed customer payment before starting the trip."}`,now,now,assignmentId),
    ]);
    if(!accepted[0].results?.length)throw new HttpError("This booking or driver changed. Refresh before deciding.",409);
    await syncDriverCalendar(row.id);await deliverOutbox();return json({ok:true,status:confirmed});
  }
  if(action==="assign"){
    if(!manager||!["awaiting_dispatch","awaiting_payment"].includes(row.status))throw new HttpError("Only requests awaiting a driver can be assigned.",409);
    if(!bookingsEnabled()&&isManualEnquiryBooking(row.requirements_json))throw new HttpError("Driver offers for accepted enquiries are paused until bookings and payment are activated.",503);
    if(await getD1().prepare(`SELECT id FROM app_assignments WHERE booking_id=? AND state NOT IN ('declined','expired','cancelled','completed')`).bind(row.id).first())throw new HttpError("This booking already has a driver offer or confirmation.",409);
    const driverId=text(body.driverId,"Driver",64),driver=await getD1().prepare(`SELECT d.*,v.class,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_expiry FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=? AND d.approved=1 AND d.status IN ('available','on_job') AND v.active=1`).bind(driverId).first<{compliance_until:string;vehicle_expiry:string;class:string;passengers:number;luggage:number;capabilities:string;email:string}>();
    const journey=JSON.parse(row.journey_json) as {passengers:number;luggage:number;accessible:boolean;wheelchair:string;pet:boolean;childSeat:boolean};
    const capabilities=driver?JSON.parse(driver.capabilities) as string[]:[];
    if(!driver||!driver.compliance_until||!driver.vehicle_expiry||driver.compliance_until<=now.slice(0,10)||driver.vehicle_expiry<=now.slice(0,10)||driver.class!==row.vehicle_id||driver.passengers<journey.passengers||driver.luggage<journey.luggage||(journey.accessible&&!capabilities.includes(journey.wheelchair))||(journey.pet&&!capabilities.includes("pet"))||(journey.childSeat&&!capabilities.includes("child-seat")))throw new HttpError("Driver or vehicle does not meet this booking's capacity and compliance requirements.",422);
    await requireNoDriverClash(driverId,row.id,row.scheduled_at);
    const offered=await getD1().batch([getD1().prepare(`INSERT INTO app_assignments(id,booking_id,driver_id,state,created_at,updated_at) SELECT ?,?,?,'offered',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?) RETURNING id`).bind(crypto.randomUUID(),row.id,driverId,now,now,row.id,row.status),getD1().prepare(`UPDATE bookings SET status='offered',updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND driver_id=? AND state='offered')`).bind(now,row.id,row.status,row.id,driverId),audit("booking",row.id,"driver.offered",user.email,{driverId}),queueEmail(`offer:${row.id}:${driverId}:${now}`,driver.email,`New cruzycabs offer ${reference}`,`Sign in to your driver workspace to review the complete journey and accept or decline: ${siteOrigin()}/driver`)]);
    if(!offered[0].results?.length)throw new HttpError("Booking changed. Refresh and retry.",409);
    await deliverOutbox();return json({ok:true});
  }
  const assignment=await getD1().prepare(`SELECT a.*,d.email FROM app_assignments a JOIN app_drivers d ON d.id=a.driver_id WHERE a.booking_id=? AND a.state NOT IN ('cancelled','expired','declined','completed')`).bind(row.id).first<{id:string;state:string;driver_id:string;email:string}>();
  if(!assignment||assignment.email!==user.email||!hasRole(user.email,"driver"))throw new HttpError("This offer is not assigned to your driver account.",403);
  const transitions:Record<string,[string,string]>={accept:["offered","accepted"],decline:["offered","declined"],arrive:["accepted","arrived"],start:["arrived","on_trip"],complete:["on_trip","completed"]};const transition=transitions[action];if(!transition||assignment.state!==transition[0]||row.status!==transition[0])throw new HttpError("This trip action is not allowed at its current stage.",409);
  if(["arrive","start","complete"].includes(action)&&!["paid","in_person"].includes(row.payment_state))throw new HttpError("Wait for the customer to complete payment before progressing the trip.",409);
  const next=transition[1],bookingStatus=next==="declined"?"awaiting_dispatch":next==="accepted"&&!["paid","in_person"].includes(row.payment_state)?"awaiting_payment":next;
  const transitionResult=await getD1().batch([
    getD1().prepare(`UPDATE app_assignments SET state=?,updated_at=? WHERE id=? AND state=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?) RETURNING id`).bind(next,now,assignment.id,transition[0],row.id,transition[0]),
    getD1().prepare(`UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state=? AND updated_at=?)`).bind(bookingStatus,now,row.id,transition[0],assignment.id,next,now),
    getD1().prepare(`UPDATE app_drivers SET status=? WHERE id=? AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state=? AND updated_at=?)`).bind(["declined","completed"].includes(next)?"available":"on_job",assignment.driver_id,assignment.id,next,now)
  ]);
  if(!transitionResult[0].results?.length)throw new HttpError("Trip changed. Refresh and retry.",409);
  const link=managementLink(reference,await managementToken(row.id)),paymentDue=bookingStatus==="awaiting_payment";
  await getD1().batch([getD1().prepare(`INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) VALUES(?,?,?,'driver','Driver trip update',?)`).bind(crypto.randomUUID(),row.id,bookingStatus,now),audit("booking",row.id,`trip.${next}`,user.email),queueEmail(`trip:${row.id}:${next}:${assignment.id}`,row.customer_email,paymentDue?`Booking ${reference} confirmed — payment now available`:`Booking ${reference}: ${bookingStatus}`,paymentDue?`A suitable driver has accepted and your booking is confirmed. Please complete your card payment before travel using your secure booking link: ${link}. Your driver and vehicle details are available there.`:`Your booking is now ${bookingStatus.replaceAll("_"," ")}. View details at ${link}.`)]);
  await syncDriverCalendar(row.id);await deliverOutbox();return json({ok:true});
});}

