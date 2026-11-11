import { getD1 } from "./d1";
import { defaultPricing,type PricingRules } from "./pricing";
export async function activePricing():Promise<PricingRules> {
  const row=await getD1().prepare(`SELECT rules_json FROM app_pricing ORDER BY created_at DESC LIMIT 1`).first<{rules_json:string}>();
  if(!row) return defaultPricing;

  // Older published versions used fixed vehicle factors. Preserve their fares until rates are republished.
  return {...defaultPricing,vanPercent:148,accessiblePercent:136,...JSON.parse(row.rules_json)};
}
