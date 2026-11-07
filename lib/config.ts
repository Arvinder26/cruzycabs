import { env } from "./runtime-env";

export function setting(name: string, fallback = "") {
  const value = env[name] ?? process.env[name];
  return typeof value === "string" ? value : fallback;
}
export function localPreview() { return setting("LOCAL_PREVIEW") === "true" && process.env.NODE_ENV === "development"; }
export function databaseConfigured(){return Boolean(env.DB||setting("TURSO_DATABASE_URL"));}
// Production activation is an explicit operator release decision, not inferred
// from the existence of a database or a provider key. Existing bookings remain
// retrievable/cancellable while new requests are paused.
export function bookingsEnabled(){return process.env.NODE_ENV!=="production"||setting("BOOKINGS_ENABLED")==="true";}
// Fares are paid to the driver in person. Online card payment stays off unless explicitly enabled.
export function cardPaymentsEnabled(){return setting("CARD_PAYMENTS_ENABLED")==="true";}
// Vehicle classes offered for online quotes. Only vans are running until accessible vehicles return.
export function onlineVehicleClasses(){return setting("ONLINE_VEHICLE_CLASSES","xl").split(",").map(value=>value.trim()).filter(Boolean);}
export function siteOrigin() {
  const value = setting("SITE_URL");
  if (!value && localPreview()) return "http://localhost:3000";
  const url = new URL(value);
  if(localPreview() && url.protocol==="http:" && ["localhost","127.0.0.1"].includes(url.hostname))return url.origin;
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Configure the public HTTPS SITE_URL.");
  return url.origin;
}
export const POLICY_VERSION = "2026-10-28";
