import { ensureCoreSchema, getD1 } from "./d1";
import { HttpError, sha } from "./security";

export const platformSchema = [
  `CREATE TABLE IF NOT EXISTS app_quote_access (quote_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_booking_details (booking_id TEXT PRIMARY KEY, quote_id TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, price_cents INTEGER NOT NULL, scheduled_at TEXT, terms_version TEXT NOT NULL, checkout_id TEXT, checkout_url TEXT, payment_intent TEXT, receipt_url TEXT, customer_identity TEXT, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_requests (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, data_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_outbox (id TEXT PRIMARY KEY, dedupe_key TEXT NOT NULL UNIQUE, recipient TEXT NOT NULL, subject TEXT NOT NULL, text TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt TEXT NOT NULL, lease_until TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_otp (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS app_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_drivers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'offline', approved INTEGER NOT NULL DEFAULT 0, compliance_until TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_vehicles (id TEXT PRIMARY KEY, driver_id TEXT NOT NULL UNIQUE, class TEXT NOT NULL, plate TEXT NOT NULL UNIQUE, description TEXT NOT NULL, passengers INTEGER NOT NULL, luggage INTEGER NOT NULL, capabilities TEXT NOT NULL, compliance_until TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS app_assignments (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, driver_id TEXT NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS app_one_booking_assignment ON app_assignments(booking_id) WHERE state NOT IN ('declined','expired','cancelled','completed')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS app_one_driver_assignment ON app_assignments(driver_id) WHERE state NOT IN ('declined','expired','cancelled','completed')`,
  `CREATE TABLE IF NOT EXISTS app_locations (driver_id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, observed_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_stripe_events (id TEXT PRIMARY KEY, type TEXT NOT NULL, processed_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS app_outbox_due ON app_outbox(state,next_attempt)`,
  `CREATE TABLE IF NOT EXISTS app_saved_places (id TEXT PRIMARY KEY, email TEXT NOT NULL, label TEXT NOT NULL, address TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_checkout_generation (booking_id TEXT PRIMARY KEY, attempt INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS app_pricing (id TEXT PRIMARY KEY, rules_json TEXT NOT NULL, reason TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_documents (id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_session_assurance (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL)`,
];
let ready:Promise<void>|null=null;
export async function ensurePlatform() {
  if(!ready) ready=(async()=>{await ensureCoreSchema(); await getD1().batch(platformSchema.map(sql=>getD1().prepare(sql)));})().catch(error=>{ready=null;throw error;});
  await ready;
}
export async function rateLimit(request:Request,bucket:string,limit=30,seconds=60) {
  await ensurePlatform(); const ip=request.headers.get("cf-connecting-ip") || "local";
  const now=Math.floor(Date.now()/1000); const window=Math.floor(now/seconds); const key=await sha(`${bucket}:${ip}:${window}`);
  const row=await getD1().prepare(`INSERT INTO app_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`).bind(key,now+seconds).first<{count:number}>();
  if(!row || row.count>limit) throw new HttpError("Too many requests. Please try again shortly.",429);
}
export function audit(entity:string,id:string,action:string,actor:string,detail:unknown={}) {
  return getD1().prepare(`INSERT INTO audit_events(id,entity_type,entity_id,action,actor_type,detail_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),entity,id,action,actor,JSON.stringify(detail),new Date().toISOString());
}
