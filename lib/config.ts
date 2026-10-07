import { env } from "./runtime-env";

export function setting(name: string, fallback = "") {
  const value = env[name] ?? process.env[name];
  return typeof value === "string" ? value : fallback;
}
export function localPreview() { return setting("LOCAL_PREVIEW") === "true" && process.env.NODE_ENV === "development"; }
export function siteOrigin() {
  const value = setting("SITE_URL");
  if (!value && localPreview()) return "http://localhost:3000";
  const url = new URL(value);
  if(localPreview() && url.protocol==="http:" && ["localhost","127.0.0.1"].includes(url.hostname))return url.origin;
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Configure the public HTTPS SITE_URL.");
  return url.origin;
}
export const POLICY_VERSION = "2026-10-04";
