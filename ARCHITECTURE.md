# cruzycabs architecture

Updated 27 October 2026. Current release: **Next.js 16 on Vercel, Node 24, Sydney**, with Turso/libSQL persistence and private Vercel Blob compliance storage. `lib/d1.ts` adapts the existing prepared-statement/atomic-batch interface to libSQL. Cloudflare Worker/D1/R2 bindings remain a separate legacy entry, not the Vercel activation path. The larger Drizzle model is not proof that every commercial feature is implemented.

The real handlers use core quote/booking/payment/event tables and `app_*` operational tables in `lib/platform.ts`. Ordered migrations are 0000, 0001 and 0002; see CURRENT-OPERATIONS.md. Runtime additive schema creation does not replace migration and restore acceptance.

## Booking and payment

Google Routes supplies road distance/time; server validation enforces supported journey, capacity and Pacific/Auckland schedule rules. Canonical inputs and integer-cent versioned fare are stored with a hashed quote token and five-minute expiry. Retries recover the same booking; client fares/changed routes cannot replace the stored journey. Production new requests require explicit `BOOKINGS_ENABLED` activation; retrieval/cancellation are independent.

Requests enter review or await dispatch without payment. Driver offers and conditional acceptance precede checkout eligibility. Stripe hosts card collection; signed events verify canonical amount/currency and dedupe payment state. Driver arrival/start/completion requires payment. Changes to a booked itinerary are handled manually with a fresh agreed quote.

Cancellation has idempotent external operations and recoverable `cancel_pending` state. `app_refunds` stores provider reference/state and canonical amount; failures/action-required states are visible and alerted. Recovery rechecks pending objects; it never blindly issues a second refund. Terminal failures require an authorised operator decision. See the runbook for provider-backed reconciliation and settlement acceptance.

## Identity, operations and location

Email OTP issues hashed HttpOnly/Secure/SameSite sessions; staff additionally require configured roles and recent TOTP assurance. Logout revokes session/assurance through POST. Partner reads are provider-scoped and driver writes are assignment-owned, with backend checks on every action. Operations filters/pagination/search are server-side; complete scoped counts do not depend on the displayed page. Payment exports cover all matching pages up to an explicit bound.

`app_assignment_locations` belongs to one active assignment. The API does not join a driver's current location into completed bookings. Unscoped legacy location rows are not migrated into assignments. Driver sharing is explicit and not native background tracking. Private management links use fragments/session storage or matching-email sessions; do not include tokens in logs or analytics.

## Recovery and boundaries

A leased, deduplicated outbox uses Resend with bounded retry. A separately provisioned authenticated scheduler runs recovery; `app_job_runs` records metadata for verification. Monitoring, alert ownership, backup/restore and business sign-off remain external responsibilities requiring evidence.

Consent-gated Google measurement runs in an isolated first-party document only on allowed public paths. Private records/tokens/addresses do not belong in measurement. Offline cache holds only static offline help/icons and never submits customer actions.

Tours, accessible suitability, corporate arrangements, cruise/hourly itineraries, journey changes and privacy/support cases are manual operations. No automated subsidy, corporate credit, flight monitoring, continuous location, payroll or settlement is implied. Follow [CURRENT-OPERATIONS.md](CURRENT-OPERATIONS.md) and [WEBSITE-AUDIT.md](WEBSITE-AUDIT.md) for the exact acceptance boundaries.
