import type { MetadataRoute } from "next";
import { setting } from "../lib/config";
const routes=["","/airport-transfers","/north-island-transfers","/private-tours","/accessible-travel","/business-travel","/auckland-rides","/pricing","/safety","/help","/lost-property","/complaints","/privacy","/terms","/accessibility-statement","/driver-application","/partner-fleet-application"];
export default function sitemap():MetadataRoute.Sitemap{const origin=setting("SITE_URL","https://cruzycabs.co.nz");return routes.map(route=>({url:`${origin}${route}`,changeFrequency:route===""?"weekly":"monthly",priority:route===""?1:0.7}));}
