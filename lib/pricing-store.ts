import { getD1 } from "./d1";
import { defaultPricing,type PricingRules } from "./pricing";
export async function activePricing(){const row=await getD1().prepare(`SELECT rules_json FROM app_pricing ORDER BY created_at DESC LIMIT 1`).first<{rules_json:string}>();return row?JSON.parse(row.rules_json) as PricingRules:defaultPricing;}
