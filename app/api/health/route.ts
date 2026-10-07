import { getD1 } from "../../../lib/d1";
import { json } from "../../../lib/security";
export async function GET(){try{await getD1().prepare("SELECT 1 AS healthy").first();return json({status:"ok"});}catch{return json({status:"unavailable"},503);}}
