import { env } from "./runtime-env";
import { sqliteDatabase } from "./sqlite-adapter";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    input_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    pricing_version TEXT NOT NULL,
    state TEXT NOT NULL,
    locked_until TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    quote_id TEXT NOT NULL,
    customer_id TEXT,
    corporate_account_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    vehicle_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    journey_json TEXT NOT NULL,
    requirements_json TEXT NOT NULL,
    vehicle_class_id TEXT,
    payment_method TEXT NOT NULL,
    payment_state TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(id)
  )`,
  `CREATE TABLE IF NOT EXISTS booking_status_events (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    provider_reference TEXT,
    operation TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NZD',
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at ON bookings(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking_id ON booking_status_events(booking_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at)`,
];

let ready: Promise<void> | null = null;
let external:D1Database|undefined;

export function getD1() {
  if(env.DB)return env.DB as D1Database;
  const url=process.env.TURSO_DATABASE_URL;
  if(!url)throw new Error("Persistent booking storage is unavailable.");
  if(process.env.NODE_ENV==="production"&&!url.startsWith("libsql://")&&!url.startsWith("https://"))throw new Error("Production requires remote persistent storage.");
  return external??=sqliteDatabase(url,process.env.TURSO_AUTH_TOKEN);
}

export async function ensureCoreSchema() {
  if (!ready) {
    ready = (async () => {
      const db = getD1();
      await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
    })().catch((error) => { ready = null; throw error; });
  }
  return ready;
}
