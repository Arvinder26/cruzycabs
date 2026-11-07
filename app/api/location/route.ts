import { identity,hasRole } from "../../../lib/auth";
import { getD1 } from "../../../lib/d1";
import { rateLimit } from "../../../lib/platform";
import { endpoint,HttpError,json,readObject,sameOrigin } from "../../../lib/security";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"location",60);const user=await identity(request.headers);if(!user||!user.mfaVerified||!hasRole(user.email,"driver"))throw new HttpError("Driver authenticator sign-in required.",403);
  const driver=await getD1().prepare(`SELECT d.id,a.id assignment_id FROM app_drivers d JOIN app_assignments a ON a.driver_id=d.id JOIN bookings b ON b.id=a.booking_id WHERE d.email=? AND a.state IN ('accepted','arrived','on_trip') AND b.status IN ('awaiting_payment','accepted','arrived','on_trip')`).bind(user.email).first<{id:string;assignment_id:string}>();if(!driver)throw new HttpError("No active assignment.",409);
  const body=await readObject(request);const latitude=Number(body.latitude),longitude=Number(body.longitude),accuracy=Number(body.accuracy);
  if(!Number.isFinite(latitude)||latitude< -42||latitude> -34||!Number.isFinite(longitude)||longitude<172||longitude>179||!Number.isFinite(accuracy)||accuracy<0||accuracy>500)throw new HttpError("Invalid or imprecise location.");
  const saved=await getD1().prepare(`INSERT INTO app_assignment_locations(assignment_id,driver_id,latitude,longitude,accuracy,observed_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_assignments a JOIN bookings b ON b.id=a.booking_id WHERE a.id=? AND a.state IN ('accepted','arrived','on_trip') AND b.status IN ('awaiting_payment','accepted','arrived','on_trip')) ON CONFLICT(assignment_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,observed_at=excluded.observed_at RETURNING assignment_id`).bind(driver.assignment_id,driver.id,latitude,longitude,accuracy,new Date().toISOString(),driver.assignment_id).first();
  if(!saved)throw new HttpError("The assignment ended. Refresh your workspace.",409);
  return json({ok:true});
});}
