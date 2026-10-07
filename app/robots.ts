import type { MetadataRoute } from "next";
import { setting } from "../lib/config";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/admin","/dispatch","/driver","/partner","/account","/manage-booking","/sign-in","/api/"]},sitemap:`${setting("SITE_URL","https://cruzycabs.co.nz")}/sitemap.xml`};}
