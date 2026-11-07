CREATE TABLE IF NOT EXISTS app_driver_contacts (driver_id TEXT PRIMARY KEY REFERENCES app_drivers(id), phone TEXT NOT NULL);
