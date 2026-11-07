DROP INDEX IF EXISTS app_one_driver_assignment;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS app_driver_assignments ON app_assignments(driver_id,state);
