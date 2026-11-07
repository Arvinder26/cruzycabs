import { setting } from "../../../lib/config";
import { bearer,endpoint,equal,HttpError,json } from "../../../lib/security";
import { runJobs } from "../../../lib/jobs";
export function POST(request:Request){return endpoint(async()=>{const secret=setting("JOBS_SECRET");if(secret.length<32||!equal(bearer(request),secret))throw new HttpError("Not authorised.",403);return json(await runJobs());});}
export function GET(request:Request){return endpoint(async()=>{const secret=setting("CRON_SECRET");if(secret.length<32||!equal(bearer(request),secret))throw new HttpError("Not authorised.",403);return json(await runJobs());});}
