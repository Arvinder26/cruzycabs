import { calculateQuote } from "../../../lib/pricing";
import { activePricing } from "../../../lib/pricing-store";
import { validateJourney } from "../../../lib/validation";
import { routeJourney } from "../../../lib/routing";
import { getD1 } from "../../../lib/d1";
import { ensurePlatform,rateLimit } from "../../../lib/platform";
import { endpoint,HttpError,json,readObject,sameOrigin,sha,token } from "../../../lib/security";
export const runtime="nodejs";
export function POST(request:Request){return endpoint(async()=>{
  sameOrigin(request);await rateLimit(request,"quotes",15);const input=validateJourney(await readObject(request)),calculation=calculateQuote(input,await routeJourney(input),await activePricing());
  if(!calculation.vehicles.length)throw new HttpError("No suitable vehicle class fits these requirements. Please send an enquiry.",422);
  await ensurePlatform();const id=crypto.randomUUID(),accessToken=token(),now=new Date().toISOString(),lockedUntil=new Date(Date.now()+5*60000).toISOString();
  await getD1().batch([getD1().prepare(`INSERT INTO quotes(id,input_json,result_json,pricing_version,state,locked_until,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,JSON.stringify(input),JSON.stringify(calculation),calculation.pricingVersion,calculation.state,lockedUntil,now),getD1().prepare(`INSERT INTO app_quote_access(quote_id,token_hash) VALUES(?,?)`).bind(id,await sha(accessToken))]);
  return json({id,accessToken,...calculation,lockedUntil});
});}

