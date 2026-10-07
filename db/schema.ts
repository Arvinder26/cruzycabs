import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  externalId: text("external_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const userRoles = sqliteTable("user_roles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").notNull(),
  providerId: text("provider_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("uq_user_roles_user_role_provider").on(table.userId, table.role, table.providerId)]);

export const customerProfiles = sqliteTable("customer_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  phone: text("phone"),
  preferredChannel: text("preferred_channel"),
  ...timestamps,
});

export const passengerProfiles = sqliteTable("passenger_profiles", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customerProfiles.id),
  name: text("name").notNull(),
  phone: text("phone"),
  requirementsJson: text("requirements_json").notNull().default("{}"),
  ...timestamps,
});

export const organisations = sqliteTable("organisations", { id: text("id").primaryKey(), name: text("name").notNull(), nzbn: text("nzbn"), status: text("status").notNull(), ...timestamps });
export const corporateAccounts = sqliteTable("corporate_accounts", { id: text("id").primaryKey(), organisationId: text("organisation_id").notNull().references(() => organisations.id), billingEmail: text("billing_email").notNull(), creditLimitCents: integer("credit_limit_cents").notNull().default(0), status: text("status").notNull(), policyJson: text("policy_json").notNull().default("{}"), ...timestamps });
export const corporateTravellers = sqliteTable("corporate_travellers", { id: text("id").primaryKey(), corporateAccountId: text("corporate_account_id").notNull().references(() => corporateAccounts.id), customerId: text("customer_id").references(() => customerProfiles.id), email: text("email").notNull(), status: text("status").notNull(), ...timestamps });
export const costCentres = sqliteTable("cost_centres", { id: text("id").primaryKey(), corporateAccountId: text("corporate_account_id").notNull().references(() => corporateAccounts.id), code: text("code").notNull(), name: text("name").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps }, (table) => [uniqueIndex("uq_cost_centres_account_code").on(table.corporateAccountId, table.code)]);

export const providers = sqliteTable("providers", { id: text("id").primaryKey(), type: text("type").notNull(), name: text("name").notNull(), status: text("status").notNull(), settingsJson: text("settings_json").notNull().default("{}"), ...timestamps });
export const partnerFleets = sqliteTable("partner_fleets", { id: text("id").primaryKey(), providerId: text("provider_id").notNull().references(() => providers.id), organisationId: text("organisation_id").references(() => organisations.id), serviceZonesJson: text("service_zones_json").notNull().default("[]"), ...timestamps });
export const drivers = sqliteTable("drivers", { id: text("id").primaryKey(), userId: text("user_id").references(() => users.id), providerId: text("provider_id").notNull().references(() => providers.id), displayName: text("display_name").notNull(), status: text("status").notNull(), approvedAt: text("approved_at"), ...timestamps }, (table) => [index("idx_drivers_provider_status").on(table.providerId, table.status)]);
export const driverComplianceDocuments = sqliteTable("driver_compliance_documents", { id: text("id").primaryKey(), driverId: text("driver_id").notNull().references(() => drivers.id), type: text("type").notNull(), status: text("status").notNull(), expiresAt: text("expires_at"), storageKey: text("storage_key"), ...timestamps });
export const driverAvailability = sqliteTable("driver_availability", { id: text("id").primaryKey(), driverId: text("driver_id").notNull().references(() => drivers.id), status: text("status").notNull(), zoneId: text("zone_id"), serviceTypesJson: text("service_types_json").notNull().default("[]"), startsAt: text("starts_at").notNull(), endsAt: text("ends_at") });

export const vehicleClasses = sqliteTable("vehicle_classes", { id: text("id").primaryKey(), name: text("name").notNull(), passengerCapacity: integer("passenger_capacity").notNull(), luggageCapacity: integer("luggage_capacity").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps });
export const vehicles = sqliteTable("vehicles", { id: text("id").primaryKey(), providerId: text("provider_id").notNull().references(() => providers.id), vehicleClassId: text("vehicle_class_id").notNull().references(() => vehicleClasses.id), registrationPlate: text("registration_plate").notNull().unique(), make: text("make").notNull(), model: text("model").notNull(), colour: text("colour").notNull(), status: text("status").notNull(), ...timestamps });
export const vehicleCapabilities = sqliteTable("vehicle_capabilities", { id: text("id").primaryKey(), vehicleId: text("vehicle_id").notNull().references(() => vehicles.id), capability: text("capability").notNull(), detailJson: text("detail_json").notNull().default("{}"), ...timestamps }, (table) => [uniqueIndex("uq_vehicle_capability").on(table.vehicleId, table.capability)]);
export const vehicleComplianceDocuments = sqliteTable("vehicle_compliance_documents", { id: text("id").primaryKey(), vehicleId: text("vehicle_id").notNull().references(() => vehicles.id), type: text("type").notNull(), status: text("status").notNull(), expiresAt: text("expires_at"), storageKey: text("storage_key"), ...timestamps });

export const serviceZones = sqliteTable("service_zones", { id: text("id").primaryKey(), name: text("name").notNull(), polygonJson: text("polygon_json").notNull(), immediateEnabled: integer("immediate_enabled", { mode: "boolean" }).notNull(), manualReview: integer("manual_review", { mode: "boolean" }).notNull(), ...timestamps });
export const airportTerminals = sqliteTable("airport_terminals", { id: text("id").primaryKey(), airportCode: text("airport_code").notNull(), name: text("name").notNull(), pickupInstructions: text("pickup_instructions").notNull(), accessibleInstructions: text("accessible_instructions").notNull(), effectiveAt: text("effective_at").notNull(), ...timestamps });
export const places = sqliteTable("places", { id: text("id").primaryKey(), providerReference: text("provider_reference"), displayName: text("display_name").notNull(), latitudeE6: integer("latitude_e6"), longitudeE6: integer("longitude_e6"), placeType: text("place_type").notNull(), ...timestamps });
export const savedPlaces = sqliteTable("saved_places", { id: text("id").primaryKey(), customerId: text("customer_id").notNull().references(() => customerProfiles.id), placeId: text("place_id").notNull().references(() => places.id), label: text("label").notNull(), ...timestamps });

export const pricingRules = sqliteTable("pricing_rules", { id: text("id").primaryKey(), name: text("name").notNull(), vehicleClassId: text("vehicle_class_id").references(() => vehicleClasses.id), zoneId: text("zone_id").references(() => serviceZones.id), status: text("status").notNull(), ...timestamps });
export const pricingRuleVersions = sqliteTable("pricing_rule_versions", { id: text("id").primaryKey(), pricingRuleId: text("pricing_rule_id").notNull().references(() => pricingRules.id), version: integer("version").notNull(), ruleJson: text("rule_json").notNull(), effectiveAt: text("effective_at").notNull(), authorUserId: text("author_user_id").notNull().references(() => users.id), approvedByUserId: text("approved_by_user_id").references(() => users.id), changeReason: text("change_reason").notNull(), createdAt: text("created_at").notNull() }, (table) => [uniqueIndex("uq_pricing_rule_version").on(table.pricingRuleId, table.version)]);
export const demandAdjustments = sqliteTable("demand_adjustments", { id: text("id").primaryKey(), zoneId: text("zone_id").notNull().references(() => serviceZones.id), multiplierBasisPoints: integer("multiplier_basis_points").notNull(), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), authorisedByUserId: text("authorised_by_user_id").notNull().references(() => users.id), reason: text("reason").notNull(), createdAt: text("created_at").notNull() });

export const quotes = sqliteTable("quotes", { id: text("id").primaryKey(), inputJson: text("input_json").notNull(), resultJson: text("result_json").notNull(), pricingVersion: text("pricing_version").notNull(), state: text("state").notNull(), lockedUntil: text("locked_until").notNull(), createdAt: text("created_at").notNull() });
export const quoteLineItems = sqliteTable("quote_line_items", { id: text("id").primaryKey(), quoteId: text("quote_id").notNull().references(() => quotes.id), code: text("code").notNull(), label: text("label").notNull(), amountCents: integer("amount_cents").notNull(), sortOrder: integer("sort_order").notNull() });
export const bookings = sqliteTable("bookings", { id: text("id").primaryKey(), reference: text("reference").notNull().unique(), quoteId: text("quote_id").notNull().references(() => quotes.id), customerId: text("customer_id").references(() => customerProfiles.id), corporateAccountId: text("corporate_account_id").references(() => corporateAccounts.id), idempotencyKey: text("idempotency_key").notNull().unique(), vehicleId: text("vehicle_id"), customerName: text("customer_name").notNull(), customerEmail: text("customer_email").notNull(), customerPhone: text("customer_phone").notNull(), journeyJson: text("journey_json").notNull(), requirementsJson: text("requirements_json").notNull(), vehicleClassId: text("vehicle_class_id").references(() => vehicleClasses.id), paymentMethod: text("payment_method").notNull(), paymentState: text("payment_state").notNull(), status: text("status").notNull(), ...timestamps }, (table) => [index("idx_bookings_status_created_at").on(table.status, table.createdAt)]);
export const bookingPassengers = sqliteTable("booking_passengers", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), passengerProfileId: text("passenger_profile_id").references(() => passengerProfiles.id), name: text("name").notNull(), phone: text("phone"), isPrimary: integer("is_primary", { mode: "boolean" }).notNull(), createdAt: text("created_at").notNull() });
export const bookingStops = sqliteTable("booking_stops", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), placeId: text("place_id").references(() => places.id), sequence: integer("sequence").notNull(), addressText: text("address_text").notNull(), notes: text("notes"), createdAt: text("created_at").notNull() });
export const bookingRequirements = sqliteTable("booking_requirements", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), type: text("type").notNull(), valueJson: text("value_json").notNull(), createdAt: text("created_at").notNull() });
export const bookingStatusEvents = sqliteTable("booking_status_events", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), status: text("status").notNull(), actorType: text("actor_type").notNull(), note: text("note"), createdAt: text("created_at").notNull() }, (table) => [index("idx_booking_status_events_booking_id").on(table.bookingId, table.createdAt)]);
export const driverOffers = sqliteTable("driver_offers", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), driverId: text("driver_id").notNull().references(() => drivers.id), state: text("state").notNull(), offeredAt: text("offered_at").notNull(), expiresAt: text("expires_at").notNull(), respondedAt: text("responded_at") });
export const assignments = sqliteTable("assignments", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), driverId: text("driver_id").notNull().references(() => drivers.id), vehicleId: text("vehicle_id").notNull().references(() => vehicles.id), state: text("state").notNull(), assignedAt: text("assigned_at").notNull(), endedAt: text("ended_at"), reason: text("reason") });
export const trips = sqliteTable("trips", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), assignmentId: text("assignment_id").references(() => assignments.id), state: text("state").notNull(), passengerPinHash: text("passenger_pin_hash"), startedAt: text("started_at"), completedAt: text("completed_at"), ...timestamps });
export const tripLocationEvents = sqliteTable("trip_location_events", { id: text("id").primaryKey(), tripId: text("trip_id").notNull().references(() => trips.id), latitudeE6: integer("latitude_e6").notNull(), longitudeE6: integer("longitude_e6").notNull(), accuracyMetres: integer("accuracy_metres"), observedAt: text("observed_at").notNull(), createdAt: text("created_at").notNull() }, (table) => [index("idx_trip_locations_trip_observed").on(table.tripId, table.observedAt)]);
export const tripIncidents = sqliteTable("trip_incidents", { id: text("id").primaryKey(), tripId: text("trip_id").notNull().references(() => trips.id), reportedByUserId: text("reported_by_user_id").references(() => users.id), severity: text("severity").notNull(), state: text("state").notNull(), detailJson: text("detail_json").notNull(), ...timestamps });

export const payments = sqliteTable("payments", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), providerReference: text("provider_reference"), operation: text("operation").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull().default("NZD"), state: text("state").notNull(), createdAt: text("created_at").notNull() });
export const paymentMethodReferences = sqliteTable("payment_method_references", { id: text("id").primaryKey(), customerId: text("customer_id").notNull().references(() => customerProfiles.id), provider: text("provider").notNull(), tokenReference: text("token_reference").notNull(), displayLabel: text("display_label").notNull(), ...timestamps });
export const refunds = sqliteTable("refunds", { id: text("id").primaryKey(), paymentId: text("payment_id").notNull().references(() => payments.id), amountCents: integer("amount_cents").notNull(), reason: text("reason").notNull(), authorisedByUserId: text("authorised_by_user_id").notNull().references(() => users.id), state: text("state").notNull(), createdAt: text("created_at").notNull() });
export const credits = sqliteTable("credits", { id: text("id").primaryKey(), customerId: text("customer_id").notNull().references(() => customerProfiles.id), amountCents: integer("amount_cents").notNull(), remainingCents: integer("remaining_cents").notNull(), reason: text("reason").notNull(), expiresAt: text("expires_at"), createdAt: text("created_at").notNull() });
export const driverEarnings = sqliteTable("driver_earnings", { id: text("id").primaryKey(), driverId: text("driver_id").notNull().references(() => drivers.id), tripId: text("trip_id").notNull().references(() => trips.id), grossCents: integer("gross_cents").notNull(), commissionCents: integer("commission_cents").notNull(), netCents: integer("net_cents").notNull(), state: text("state").notNull(), createdAt: text("created_at").notNull() });
export const providerSettlements = sqliteTable("provider_settlements", { id: text("id").primaryKey(), providerId: text("provider_id").notNull().references(() => providers.id), periodStart: text("period_start").notNull(), periodEnd: text("period_end").notNull(), amountCents: integer("amount_cents").notNull(), state: text("state").notNull(), createdAt: text("created_at").notNull() });
export const invoices = sqliteTable("invoices", { id: text("id").primaryKey(), corporateAccountId: text("corporate_account_id").notNull().references(() => corporateAccounts.id), number: text("number").notNull().unique(), subtotalCents: integer("subtotal_cents").notNull(), gstCents: integer("gst_cents").notNull(), totalCents: integer("total_cents").notNull(), state: text("state").notNull(), issuedAt: text("issued_at").notNull(), dueAt: text("due_at").notNull() });
export const receipts = sqliteTable("receipts", { id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id), paymentId: text("payment_id").references(() => payments.id), receiptNumber: text("receipt_number").notNull().unique(), dataJson: text("data_json").notNull(), issuedAt: text("issued_at").notNull() });

function simpleEntity(name: string) {
  return sqliteTable(name, { id: text("id").primaryKey(), state: text("state").notNull().default("open"), dataJson: text("data_json").notNull().default("{}"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull() });
}
export const promotions = simpleEntity("promotions");
export const tourProducts = simpleEntity("tour_products");
export const tourRequests = simpleEntity("tour_requests");
export const tourItineraries = simpleEntity("tour_itineraries");
export const tourItineraryVersions = simpleEntity("tour_itinerary_versions");
export const tourLineItems = simpleEntity("tour_line_items");
export const notifications = simpleEntity("notifications");
export const communications = simpleEntity("communications");
export const supportCases = simpleEntity("support_cases");
export const complaints = simpleEntity("complaints");
export const lostPropertyCases = simpleEntity("lost_property_cases");
export const consentRecords = simpleEntity("consent_records");
export const auditEvents = sqliteTable("audit_events", { id: text("id").primaryKey(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), action: text("action").notNull(), actorType: text("actor_type").notNull(), detailJson: text("detail_json").notNull(), createdAt: text("created_at").notNull() }, (table) => [index("idx_audit_events_entity").on(table.entityType, table.entityId, table.createdAt)]);
export const featureFlags = simpleEntity("feature_flags");
export const contentPages = simpleEntity("content_pages");
