import { setting } from "./config";
import { siteIndexable } from "./seo";

export function analyticsEnabled() {
  return process.env.NODE_ENV === "production" && siteIndexable() && setting("ANALYTICS_ENABLED", "true") !== "false";
}
