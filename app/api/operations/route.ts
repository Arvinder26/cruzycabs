import { getD1 } from "../../../lib/d1";
import { hasRole,identity } from "../../../lib/auth";
import { setting } from "../../../lib/config";
import { activePricing } from "../../../lib/pricing-store";
import { defaultPricing } from "../../../lib/pricing";
import { audit,ensurePlatform,rateLimit } from "../../../lib/platform";
import { cancelBooking,findBooking } from "../../../lib/bookings";
import { deliverOutbox,managementLink,queueEmail } from "../../../lib/notifications";
import { endpoint,HttpError,json,managementToken,email,readObject,sameOrigin,text } from "../../../lib/security";
export const runtime="nodejs";
async function staff(request:Request){const user=await identity(request.headers);if(!user||!user.mfaVerified||!["admin","dispatch","driver","partner"].some(r=>hasRole(user.email,r as Parameters<typeof hasRole>[1])))throw new HttpError("A recent staff authenticator sign-in is required.",403);return user;}
export function GET(request:Request){return endpoint(async()=>{
  await ensurePlatform();await rateLimit(request,"operations-read",120);const user=await staff(request),manager=hasRole(user.email,"dispatch")||hasRole(user.email,"admin");
  const driver=await getD1().prepare(`SELECT * FROM app_drivers WHERE email=?`).bind(user.email).first<{id:string;provider:string}>();
  const partner=hasRole(user.email,"partner");
  const provider=setting("PARTNER_PROVIDER_BINDINGS").split(",").map(entry=>entry.split("=")).find(([address])=>address?.trim().toLowerCase()===user.email)?.[1]?.trim() || driver?.provider || "unbound";
  const rows=await getD1().prepare(`SELECT b.id,b.reference,b.vehicle_id,b.customer_name,b.customer_phone,b.journey_json,b.requirements_json,b.status,b.payment_state,b.created_at,d.price_cents,d.scheduled_at,a.id assignment_id,a.driver_id,a.state assignment_state FROM bookings b JOIN app_booking_details d ON d.booking_id=b.id LEFT JOIN app_assignments a ON a.booking_id=b.id AND a.state NOT IN ('declined','expired','cancelled') ${manager?"":"JOIN app_drivers dr ON dr.id=a.driver_id"} ${manager?"":"WHERE "+(partner?"dr.provider=?":"dr.email=?")} ORDER BY b.created_at DESC LIMIT 200`).bind(...(manager?[]:[partner?provider:user.email])).all();
  const drivers=await getD1().prepare(`SELECT d.*,v.id vehicle_id,v.class,v.plate,v.description,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_compliance_until FROM app_drivers d LEFT JOIN app_vehicles v ON v.driver_id=d.id ${manager?"":"WHERE "+(partner?"d.provider=?":"d.email=?")} ORDER BY d.name`).bind(...(manager?[]:[partner?provider:user.email])).all();
  const requests=manager?await getD1().prepare(`SELECT * FROM app_requests ORDER BY created_at DESC LIMIT 200`).all():{results:[]};
  const metrics=manager?await getD1().prepare(`SELECT (SELECT COUNT(*) FROM app_outbox WHERE state='failed') failed_notifications,(SELECT COUNT(*) FROM bookings WHERE status='cancel_pending') pending_refunds`).first():null;
  const events=hasRole(user.email,"admin")?await getD1().prepare(`SELECT entity_type,entity_id,action,actor_type,detail_json,created_at FROM audit_events ORDER BY created_at DESC LIMIT 200`).all():{results:[]};
  const documents=hasRole(user.email,"admin")?await getD1().prepare(`SELECT id,driver_id,name,content_type,created_at FROM app_documents ORDER BY created_at DESC LIMIT 200`).all():{results:[]};
  return json({bookings:rows.results||[],drivers:drivers.results||[],requests:requests.results||[],metrics,manager,admin:hasRole(user.email,"admin"),events:events.results||[],documents:documents.results||[],pricing:await activePricing(),readiness:{stripe:Boolean(setting("STRIPE_SECRET_KEY")&&setting("STRIPE_WEBHOOK_SECRET")),routing:Boolean(setting("GOOGLE_MAPS_API_KEY")),email:Boolean(setting("RESEND_API_KEY")&&setting("EMAIL_FROM")),legalOperator:Boolean(setting("BUSINESS_LEGAL_NAME")),mode:setting("STRIPE_MODE","test")}});
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
    const name=text(body.name,"Driver name",100),address=email(body.email),provider=text(body.provider,"Provider",100),plate=text(body.plate,"Registration",20).toUpperCase(),description=text(body.description,"Vehicle description",150),vehicleClass=text(body.vehicleClass,"Class",20),expires=text(body.complianceUntil,"Compliance expiry",10),driverId=crypto.randomUUID();
    if(!["xl","accessible"].includes(vehicleClass)||!/^\d{4}-\d{2}-\d{2}$/.test(expires)||expires<=now.slice(0,10))throw new HttpError("Choose Van or Accessible and a future compliance expiry.");
    const passengers=Number(body.passengers),luggage=Number(body.luggage);if(!Number.isInteger(passengers)||passengers<1||passengers>7||!Number.isInteger(luggage)||luggage<0||luggage>6)throw new HttpError("Invalid capacity.");
    const capabilities=Array.isArray(body.capabilities)?body.capabilities:[];if(capabilities.some(v=>!["ramp","hoist","transfer","pet","child-seat"].includes(String(v))))throw new HttpError("Invalid capability.");
    await getD1().batch([getD1().prepare(`INSERT INTO app_drivers(id,email,name,provider,approved,compliance_until,created_at) VALUES(?,?,?,?,1,?,?)`).bind(driverId,address,name,provider,expires,now),getD1().prepare(`INSERT INTO app_vehicles(id,driver_id,class,plate,description,passengers,luggage,capabilities,compliance_until) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),driverId,vehicleClass,plate,description,passengers,luggage,JSON.stringify(capabilities),expires),audit("driver",driverId,"compliance.approved",user.email,{expires,plate})]);return json({ok:true},201);
  }
  if(action==="availability"){
    const status=text(body.status,"Availability",20);if(!["available","offline","break"].includes(status))throw new HttpError("Invalid availability.");
    const driver=await getD1().prepare(`SELECT id FROM app_drivers WHERE email=? AND approved=1 AND compliance_until>?`).bind(user.email,now.slice(0,10)).first<{id:string}>();if(!driver)throw new HttpError("Approved driver profile required.",403);
    await getD1().batch([getD1().prepare(`UPDATE app_drivers SET status=? WHERE id=?`).bind(status,driver.id),audit("driver",driver.id,"availability.changed",user.email,{status})]);return json({ok:true});
  }
  if(action==="resolve_request"){
    if(!manager)throw new HttpError("Dispatch permission required.",403);const id=text(body.id,"Request",64),note=text(body.note,"Resolution note",2000);
    await getD1().batch([getD1().prepare(`UPDATE app_requests SET state='resolved',updated_at=? WHERE id=?`).bind(now,id),audit("request",id,"request.resolved",user.email,{note})]);return json({ok:true});
  }
  const reference=text(body.reference,"Reference",30),row=await findBooking(reference);if(!row)throw new HttpError("Booking not found.",404);
  if(action==="cancel"){if(!manager)throw new HttpError("Dispatch permission required.",403);await cancelBooking(row,user.email);return json({ok:true});}
  if(action==="approve"){
    if(!manager||row.status!=="review")throw new HttpError("This request cannot be approved.",409);
    const note=text(body.note,"Approval reason",2000);await getD1().batch([getD1().prepare(`UPDATE bookings SET status='awaiting_dispatch',updated_at=? WHERE id=? AND status='review'`).bind(now,row.id),audit("booking",row.id,"review.approved",user.email,{note}),queueEmail(`approved:${row.id}`,row.customer_email,`Your request ${reference} has been reviewed`,`Operations has reviewed your requirements and is finding a suitable driver. No payment is due until a driver accepts and your booking is confirmed. Track your request: ${managementLink(reference,await managementToken(row.id))}`)]);
    await deliverOutbox();return json({ok:true});
  }
  if(action==="assign"){
    if(!manager||!["awaiting_dispatch","awaiting_payment"].includes(row.status))throw new HttpError("Only requests awaiting a driver can be assigned.",409);
    if(await getD1().prepare(`SELECT id FROM app_assignments WHERE booking_id=? AND state NOT IN ('declined','expired','cancelled','completed')`).bind(row.id).first())throw new HttpError("This booking already has a driver offer or confirmation.",409);
    const driverId=text(body.driverId,"Driver",64),driver=await getD1().prepare(`SELECT d.*,v.class,v.passengers,v.luggage,v.capabilities,v.compliance_until vehicle_expiry FROM app_drivers d JOIN app_vehicles v ON v.driver_id=d.id WHERE d.id=? AND d.approved=1 AND d.status='available' AND v.active=1`).bind(driverId).first<{compliance_until:string;vehicle_expiry:string;class:string;passengers:number;luggage:number;capabilities:string;email:string}>();
    const journey=JSON.parse(row.journey_json) as {passengers:number;luggage:number;accessible:boolean;wheelchair:string;pet:boolean;childSeat:boolean};
    const capabilities=driver?JSON.parse(driver.capabilities) as string[]:[];
    if(!driver||driver.compliance_until<=now.slice(0,10)||driver.vehicle_expiry<=now.slice(0,10)||driver.class!==row.vehicle_id||driver.passengers<journey.passengers||driver.luggage<journey.luggage||(journey.accessible&&!capabilities.includes(journey.wheelchair))||(journey.pet&&!capabilities.includes("pet"))||(journey.childSeat&&!capabilities.includes("child-seat")))throw new HttpError("Driver or vehicle does not meet this booking's capacity and compliance requirements.",422);
    const offered=await getD1().batch([getD1().prepare(`INSERT INTO app_assignments(id,booking_id,driver_id,state,created_at,updated_at) SELECT ?,?,?,'offered',?,? WHERE EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?) RETURNING id`).bind(crypto.randomUUID(),row.id,driverId,now,now,row.id,row.status),getD1().prepare(`UPDATE bookings SET status='offered',updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM app_assignments WHERE booking_id=? AND driver_id=? AND state='offered')`).bind(now,row.id,row.status,row.id,driverId),audit("booking",row.id,"driver.offered",user.email,{driverId}),queueEmail(`offer:${row.id}:${driverId}:${now}`,driver.email,`New cruzycabs offer ${reference}`,"Sign in to your driver workspace to accept or decline the offer.")]);
    if(!offered[0].results?.length)throw new HttpError("Booking changed. Refresh and retry.",409);
    await deliverOutbox();return json({ok:true});
  }
  const assignment=await getD1().prepare(`SELECT a.*,d.email FROM app_assignments a JOIN app_drivers d ON d.id=a.driver_id WHERE a.booking_id=? AND a.state NOT IN ('cancelled','expired','declined','completed')`).bind(row.id).first<{id:string;state:string;driver_id:string;email:string}>();
  if(!assignment||assignment.email!==user.email||!hasRole(user.email,"driver"))throw new HttpError("This offer is not assigned to your driver account.",403);
  const transitions:Record<string,[string,string]>={accept:["offered","accepted"],decline:["offered","declined"],arrive:["accepted","arrived"],start:["arrived","on_trip"],complete:["on_trip","completed"]};const transition=transitions[action];if(!transition||assignment.state!==transition[0]||row.status!==transition[0])throw new HttpError("This trip action is not allowed at its current stage.",409);
  if(["arrive","start","complete"].includes(action)&&row.payment_state!=="paid")throw new HttpError("Wait for the customer to complete payment before progressing the trip.",409);
  const next=transition[1],bookingStatus=next==="declined"?"awaiting_dispatch":next==="accepted"&&row.payment_state!=="paid"?"awaiting_payment":next;
  const transitionResult=await getD1().batch([
    getD1().prepare(`UPDATE app_assignments SET state=?,updated_at=? WHERE id=? AND state=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status=?) RETURNING id`).bind(next,now,assignment.id,transition[0],row.id,transition[0]),
    getD1().prepare(`UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status=? AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state=? AND updated_at=?)`).bind(bookingStatus,now,row.id,transition[0],assignment.id,next,now),
    getD1().prepare(`UPDATE app_drivers SET status=? WHERE id=? AND EXISTS(SELECT 1 FROM app_assignments WHERE id=? AND state=? AND updated_at=?)`).bind(["declined","completed"].includes(next)?"available":"on_job",assignment.driver_id,assignment.id,next,now)
  ]);
  if(!transitionResult[0].results?.length)throw new HttpError("Trip changed. Refresh and retry.",409);
  const link=managementLink(reference,await managementToken(row.id)),paymentDue=bookingStatus==="awaiting_payment";
  await getD1().batch([getD1().prepare(`INSERT INTO booking_status_events(id,booking_id,status,actor_type,note,created_at) VALUES(?,?,?,'driver','Driver trip update',?)`).bind(crypto.randomUUID(),row.id,bookingStatus,now),audit("booking",row.id,`trip.${next}`,user.email),queueEmail(`trip:${row.id}:${next}:${assignment.id}`,row.customer_email,paymentDue?`Booking ${reference} confirmed — payment now available`:`Booking ${reference}: ${bookingStatus}`,paymentDue?`A suitable driver has accepted and your booking is confirmed. Please complete your card payment before travel using your secure booking link: ${link}. Your driver and vehicle details are available there.`:`Your booking is now ${bookingStatus.replaceAll("_"," ")}. View details at ${link}.`)]);
  await deliverOutbox();return json({ok:true});
});}

