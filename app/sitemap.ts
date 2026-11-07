import type { MetadataRoute } from "next";
import { publicOrigin, siteIndexable } from "../lib/seo";
import { publicSlugs } from "../lib/public-routes";
export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteIndexable()) return [];
  return ["/", ...publicSlugs.map(slug => `/${slug}`)].map(path => ({ url: `${publicOrigin()}${path}` }));
}
