import { calculateQuote } from "../../../lib/pricing";
import { bookingsEnabled,onlineVehicleClasses } from "../../../lib/config";
import { activePricing } from "../../../lib/pricing-store";
import { validateJourney } from "../../../lib/validation";
import { routeJourney } from "../../../lib/routing";
import { getD1 } from "../../../lib/d1";
import { ensurePlatform,rateLimit } from "../../../lib/platform";
import { endpoint,HttpError,json,readObject,sameOrigin,sha,token } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);if(!bookingsEnabled())throw new HttpError("Online booking requests are paused. Send a journey enquiry or contact operations.",503);await rateLimit(request,"quotes",15);const input=validateJourney(await readObject(request)),offered=onlineVehicleClasses(),calculation=calculateQuote(input,await routeJourney(input),await activePricing(),offered);
  if(!calculation.vehicles.length)throw new HttpError(input.accessible&&!offered.includes("accessible")?"Wheelchair-accessible vehicles are not available right now; only vans are running. Please send an enquiry.":"No suitable vehicle class fits these requirements. Please send an enquiry.",422);
  await ensurePlatform();const id=crypto.randomUUID(),accessToken=token(),now=new Date().toISOString(),lockedUntil=new Date(Date.now()+5*60000).toISOString();
  await getD1().batch([getD1().prepare(`INSERT INTO quotes(id,input_json,result_json,pricing_version,state,locked_until,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,JSON.stringify(input),JSON.stringify(calculation),calculation.pricingVersion,calculation.state,lockedUntil,now),getD1().prepare(`INSERT INTO app_quote_access(quote_id,token_hash) VALUES(?,?)`).bind(id,await sha(accessToken))]);
  return json({id,accessToken,...calculation,lockedUntil});
});}

