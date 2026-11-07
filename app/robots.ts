import type { MetadataRoute } from "next";
import { publicOrigin, siteIndexable } from "../lib/seo";
export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  // Let crawlers see noindex on account/workspace pages. Authentication protects data.
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${publicOrigin()}/sitemap.xml` };
}
