CREATE TABLE IF NOT EXISTS app_assignment_locations (assignment_id TEXT PRIMARY KEY, driver_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, observed_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_refunds (booking_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, amount_cents INTEGER NOT NULL, checked_at TEXT NOT NULL, updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS app_job_runs (id TEXT PRIMARY KEY, state TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, error_category TEXT);
-- Legacy app_locations rows are deliberately not copied: they cannot be
-- attributed to an assignment and must never be exposed to another trip.
