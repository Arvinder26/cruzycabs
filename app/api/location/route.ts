import { identity,hasRole } from "../../../lib/auth";
import { getD1 } from "../../../lib/d1";
import { rateLimit } from "../../../lib/platform";
import { endpoint,HttpError,json,readObject,sameOrigin } from "../../../lib/security";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"location",60);const user=await identity(request.headers);if(!user||!user.mfaVerified||!hasRole(user.email,"driver"))throw new HttpError("Driver authenticator sign-in required.",403);
  const driver=await getD1().prepare(`SELECT d.id FROM app_drivers d JOIN app_assignments a ON a.driver_id=d.id WHERE d.email=? AND a.state IN ('accepted','arrived','on_trip')`).bind(user.email).first<{id:string}>();if(!driver)throw new HttpError("No active assignment.",409);
  const body=await readObject(request);const latitude=Number(body.latitude),longitude=Number(body.longitude),accuracy=Number(body.accuracy);
  if(!Number.isFinite(latitude)||latitude< -42||latitude> -34||!Number.isFinite(longitude)||longitude<172||longitude>179||!Number.isFinite(accuracy)||accuracy<0||accuracy>500)throw new HttpError("Invalid or imprecise location.");
  await getD1().prepare(`INSERT INTO app_locations(driver_id,latitude,longitude,accuracy,observed_at) VALUES(?,?,?,?,?) ON CONFLICT(driver_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,observed_at=excluded.observed_at`).bind(driver.id,latitude,longitude,accuracy,new Date().toISOString()).run();return json({ok:true});
});}
