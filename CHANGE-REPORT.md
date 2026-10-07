# Everything changed for cruzycabs

This report covers the rebranding and deployment work completed in this chat. The workspace has no tracked source baseline, so Git cannot produce a reliable before-and-after diff. This is an implementation inventory, not a claim that every existing file was newly created.

## Brand and public website

- Changed the customer-facing name to cruzycabs, including navigation, footer, page titles, booking communications and application metadata.
- Set the production website to https://cruzycabs.co.nz, support email to operations@cruzycabs.co.nz and operating hours to 24/7. Removed the placeholder support phone.
- Updated canonical URLs, sitemap, robots rules, application icons and manifest. Customer and staff pages are excluded from indexing.
- Added real enquiry forms for journeys, accessibility, tours, corporate travel, support, lost property, complaints, privacy, driver applications and partner enquiries. Submission creates a saved case/reference.
- Changed tour submission into an operations enquiry with the itinerary, rather than implying a completed reservation.
- Replaced blanket airport pickup directions with instructions to confirm the operator-authorised meeting point. Linked official airport guidance.
- Added booking/cancellation and privacy details, with a visible requirement to supply the legal operator before live bookings.
- Updated responsive layouts and form styles. Images use Next Image with unoptimised delivery of the existing compressed assets.

Main files: app/KauriRideApp.tsx, app/[slug]/page.tsx, app/EnquiryForm.tsx, app/TourPlanner.tsx, app/AirportGuide.tsx, app/PolicyDetails.tsx, app/SiteHeader.tsx, app/SiteFooter.tsx, app/layout.tsx, app/globals.css, app/sitemap.ts, app/robots.ts, public/manifest.webmanifest and application icons.

## Quotes and booking

- Replaced fabricated route estimates with server-side Google road distance/duration. Missing routing credentials produce an honest enquiry fallback.
- Validated passenger/luggage limits, assistance requirements, stops and input types. Added actual stop fields and enforced compatible vehicle capacities.
- Validated scheduled pickup dates against a booking window and Pacific/Auckland daylight-saving transitions.
- Stored integer NZD-cent prices, versioned pricing rules and five-minute quotes. Added opaque quote access tokens.
- Bookings use the stored quote and fare; changing browser-supplied journey or price cannot change the purchased trip.
- Added duplicate/retry protection so the same booking request produces one booking and one Checkout session.
- Require explicit terms acceptance and card payment. Equipment and complex long-distance requests enter operations review before payment.
- Added passenger-contact guidance when booking for someone else.

Main files: lib/routing.ts, lib/pricing.ts, lib/pricing-store.ts, lib/validation.ts, app/api/quotes/route.ts, app/api/bookings/route.ts, app/AddressAutocomplete.tsx.

## Stripe payments and refunds

- Implemented hosted Stripe Checkout with server-only credentials and server-stored fares.
- Defaulted to Stripe test mode. Live Checkout also requires a configured legal business name.
- Added stable idempotency keys and persistent Checkout attempts for retries/expired sessions.
- Added raw-body webhook signature checks, timestamp checks, duplicate event protection, and canonical amount/currency verification.
- Successful payments move the booking to dispatch and record actual provider receipts. Payment alone does not confirm travel.
- Added cancellation, Checkout expiry, PaymentIntent cancellation and full pre-trip refunds.
- Failed cancellation/refund operations remain recoverable and are retried by background jobs.

Main files: lib/stripe.ts, lib/bookings.ts, app/api/webhooks/stripe/route.ts.

## Guest management and customer accounts

- Replaced email/reference-only access with private signed booking tokens or a verified same-email account session.
- Private links use URL fragments; the browser moves tokens to session storage and strips them from the displayed URL.
- Added real booking status, Checkout retry, cancellation, payment receipts, accepted driver details and latest shared location.
- Added account booking history and scoped saved-place creation/deletion.

Main files: app/ManageBooking.tsx, app/manage-booking/page.tsx, app/account/page.tsx, app/account/SavedPlaces.tsx, app/api/account/route.ts.

## Sign-in and security

- Removed trust in arbitrary authentication headers.
- Implemented email one-time codes with expiry, attempt limits and single-use consumption.
- Added hashed sessions and HttpOnly/Secure/SameSite cookies, plus sign-out revocation.
- Added staff role allowlists, partner organisation scopes and authenticator TOTP checks.
- Added request size/type validation, same-origin mutation checks, rate limits, safer errors and no-store sensitive responses.
- Added CSP, no-referrer, frame protection, content-type protection, permissions policy and HTTPS HSTS response headers.

Main files: lib/auth.ts, lib/security.ts, lib/totp.ts, app/api/auth/route.ts, app/sign-in/SignIn.tsx, app/sign-in/page.tsx, app/staff-auth.tsx, worker/index.ts.

## Dispatch, drivers, administration and partners

- Replaced simulated staff data with saved bookings, cases, drivers, vehicles and assignments.
- Added verified fleet onboarding with vehicle capacity, capabilities and compliance expiry.
- Added driver availability, paid-booking assignment, offer acceptance/decline, arrival, trip start and completion.
- Added ownership/role checks, conditional transitions and uniqueness constraints to prevent simultaneous active assignments.
- Added manual-review approval and payment links, case resolution and audit entries.
- Added admin pricing versions, audit viewer, readiness indicators and finance export with spreadsheet-formula escaping.
- Added private admin compliance uploads/downloads backed by R2 with type/size checks and access auditing.
- Added explicit driver location sharing for active assignments. Partner results are limited to the configured provider.

Main files: app/OperationsConsole.tsx, app/admin/page.tsx, app/dispatch/page.tsx, app/driver/page.tsx, app/partner/page.tsx, app/api/operations/route.ts, app/api/location/route.ts, app/api/compliance/route.ts.

## Email, persistence and background work

- Added Resend email delivery for booking/enquiry confirmations, sign-in codes and operations notifications.
- Added durable outbox deduplication, delivery leases, bounded retries and failure states.
- Added a scheduled jobs entry point for offer expiry, cancellation recovery, temporary-record cleanup and unassigned-trip alerts.
- Added application database tables and a migration matching the runtime schema. Schema initialisation retries after failures.
- Added a basic database health endpoint and private R2 binding configuration.
- Added an offline page/service worker which caches only static fallback assets, never customer records or API responses.

Main files: lib/notifications.ts, lib/platform.ts, lib/d1.ts, lib/config.ts, drizzle/0001_production.sql, app/api/jobs/route.ts, app/api/health/route.ts, worker/index.ts, vite.config.ts, cloudflare.d.ts, .openai/hosting.json, app/OfflineSupport.tsx, public/sw.js, public/offline.html.

## Checks and deployment documentation

- Replaced source-text assertions with 21 executable domain/API tests using in-memory SQLite and mocked Google, Stripe and email providers.
- Covered invalid input, scheduling, quote expiry/access, canonical fares, concurrent duplicate Checkout, webhook signatures/amounts, refunds, authorisation, driver transitions, enquiries, OTP reuse and clean migrations.
- Added a TypeScript test loader and typecheck script, updated package identity, and ignored local secret files.
- Added GitHub CI for tests, type checking, lint and production build.
- Rewrote README, architecture and launch checklist; updated the original audit with the implementation outcome.
- Final local results: 21 tests passed, TypeScript passed, ESLint passed and production build passed. Browser checks covered the enquiry fallback, stop fields, persisted staff case and mobile layout without horizontal overflow or captured console errors.

Main files: tests/production.test.mjs, tests/register.mjs, tests/typescript-loader.mjs, .github/workflows/verify.yml, package.json, .gitignore, .env.example, README.md, ARCHITECTURE.md, DEPLOYMENT-AUDIT.md, LAUNCH-CHECKLIST.md.

## Still needed before production

The website has not been deployed. Provider interfaces have been implemented, but live provider behaviour has not been verified with your accounts.

- Complete Stripe business verification and configure test/live keys plus a matching webhook endpoint.
- Configure Google Maps and verified Resend sender credentials.
- Provision production Cloudflare D1/R2, secrets, staff roles/TOTP, scheduled jobs and domain DNS/TLS.
- Supply the legal business name and confirm transport licensing, airport permissions, pricing/tax, support staffing and legal/privacy terms.
- Validate backups/restores, monitoring, retention, provider-backed journeys, accessibility and production-like load.
- Cash, Total Mobility integration, corporate credit, flight tracking, masked SMS/calls, automatic dispatch optimisation, payouts/settlements and native background location remain unsupported. Tours/corporate/accessibility requests use manual review.

No production deployment, live card charge or external test email was performed. Local preview can show staff screens without sign-in only when explicitly enabled in development.
