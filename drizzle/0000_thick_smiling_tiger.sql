CREATE TABLE `airport_terminals` (
	`id` text PRIMARY KEY NOT NULL,
	`airport_code` text NOT NULL,
	`name` text NOT NULL,
	`pickup_instructions` text NOT NULL,
	`accessible_instructions` text NOT NULL,
	`effective_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`state` text NOT NULL,
	`assigned_at` text NOT NULL,
	`ended_at` text,
	`reason` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_type` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_entity` ON `audit_events` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `booking_passengers` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`passenger_profile_id` text,
	`name` text NOT NULL,
	`phone` text,
	`is_primary` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`passenger_profile_id`) REFERENCES `passenger_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `booking_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`type` text NOT NULL,
	`value_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `booking_status_events` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`status` text NOT NULL,
	`actor_type` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_booking_status_events_booking_id` ON `booking_status_events` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `booking_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`place_id` text,
	`sequence` integer NOT NULL,
	`address_text` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`quote_id` text NOT NULL,
	`customer_id` text,
	`corporate_account_id` text,
	`idempotency_key` text NOT NULL,
	`vehicle_id` text,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`journey_json` text NOT NULL,
	`requirements_json` text NOT NULL,
	`vehicle_class_id` text,
	`payment_method` text NOT NULL,
	`payment_state` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`corporate_account_id`) REFERENCES `corporate_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_class_id`) REFERENCES `vehicle_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_unique` ON `bookings` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_idempotency_key_unique` ON `bookings` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_bookings_status_created_at` ON `bookings` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `communications` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `corporate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`billing_email` text NOT NULL,
	`credit_limit_cents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`policy_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `corporate_travellers` (
	`id` text PRIMARY KEY NOT NULL,
	`corporate_account_id` text NOT NULL,
	`customer_id` text,
	`email` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`corporate_account_id`) REFERENCES `corporate_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cost_centres` (
	`id` text PRIMARY KEY NOT NULL,
	`corporate_account_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`corporate_account_id`) REFERENCES `corporate_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cost_centres_account_code` ON `cost_centres` (`corporate_account_id`,`code`);--> statement-breakpoint
CREATE TABLE `credits` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`remaining_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`phone` text,
	`preferred_channel` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `demand_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`zone_id` text NOT NULL,
	`multiplier_basis_points` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`authorised_by_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`zone_id`) REFERENCES `service_zones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorised_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `driver_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`status` text NOT NULL,
	`zone_id` text,
	`service_types_json` text DEFAULT '[]' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `driver_compliance_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` text,
	`storage_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `driver_earnings` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`commission_cents` integer NOT NULL,
	`net_cents` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `driver_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`driver_id` text NOT NULL,
	`state` text NOT NULL,
	`offered_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`provider_id` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text NOT NULL,
	`approved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_drivers_provider_status` ON `drivers` (`provider_id`,`status`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`corporate_account_id` text NOT NULL,
	`number` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`gst_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`state` text NOT NULL,
	`issued_at` text NOT NULL,
	`due_at` text NOT NULL,
	FOREIGN KEY (`corporate_account_id`) REFERENCES `corporate_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE TABLE `lost_property_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nzbn` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partner_fleets` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`organisation_id` text,
	`service_zones_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organisation_id`) REFERENCES `organisations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `passenger_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text,
	`name` text NOT NULL,
	`phone` text,
	`requirements_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_method_references` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`provider` text NOT NULL,
	`token_reference` text NOT NULL,
	`display_label` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`provider_reference` text,
	`operation` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'NZD' NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_idempotency_key_unique` ON `payments` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_reference` text,
	`display_name` text NOT NULL,
	`latitude_e6` integer,
	`longitude_e6` integer,
	`place_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`pricing_rule_id` text NOT NULL,
	`version` integer NOT NULL,
	`rule_json` text NOT NULL,
	`effective_at` text NOT NULL,
	`author_user_id` text NOT NULL,
	`approved_by_user_id` text,
	`change_reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_pricing_rule_version` ON `pricing_rule_versions` (`pricing_rule_id`,`version`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`vehicle_class_id` text,
	`zone_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_class_id`) REFERENCES `vehicle_classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `service_zones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `provider_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text NOT NULL,
	`pricing_version` text NOT NULL,
	`state` text NOT NULL,
	`locked_until` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`payment_id` text,
	`receipt_number` text NOT NULL,
	`data_json` text NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_receipt_number_unique` ON `receipts` (`receipt_number`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`authorised_by_user_id` text NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorised_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `saved_places` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`place_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`polygon_json` text NOT NULL,
	`immediate_enabled` integer NOT NULL,
	`manual_review` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_itineraries` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_itinerary_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_products` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tour_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trip_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`reported_by_user_id` text,
	`severity` text NOT NULL,
	`state` text NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trip_location_events` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`latitude_e6` integer NOT NULL,
	`longitude_e6` integer NOT NULL,
	`accuracy_metres` integer,
	`observed_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_trip_locations_trip_observed` ON `trip_location_events` (`trip_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`assignment_id` text,
	`state` text NOT NULL,
	`passenger_pin_hash` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`provider_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_roles_user_role_provider` ON `user_roles` (`user_id`,`role`,`provider_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_external_id_unique` ON `users` (`external_id`);--> statement-breakpoint
CREATE TABLE `vehicle_capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`capability` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vehicle_capability` ON `vehicle_capabilities` (`vehicle_id`,`capability`);--> statement-breakpoint
CREATE TABLE `vehicle_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`passenger_capacity` integer NOT NULL,
	`luggage_capacity` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vehicle_compliance_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` text,
	`storage_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`vehicle_class_id` text NOT NULL,
	`registration_plate` text NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`colour` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vehicle_class_id`) REFERENCES `vehicle_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_registration_plate_unique` ON `vehicles` (`registration_plate`);