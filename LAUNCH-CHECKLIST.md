# cruzycabs activation and launch checklist

## Current status

Implementation uses the real provider interfaces, with credentials configured separately. Local automated verification uses provider mocks. The site has not been published or tested against live Stripe, Google, Resend, or production Cloudflare resources.

Domain: cruzycabs.co.nz. Support: operations@cruzycabs.co.nz. Hours: 24/7. Legal business name and support phone remain unspecified. Stripe business verification remains pending; use test mode until Stripe enables live payments.

## Activate infrastructure

1. Provision Cloudflare D1 binding `DB` and private R2 binding `COMPLIANCE_FILES` in the hosting configuration. Apply `drizzle/0000_thick_smiling_tiger.sql` followed by `drizzle/0001_production.sql` to an empty production database. Preserve and back up existing data before any migration. Verify restore with a separate database.
2. Add the secrets and settings listed in `.env.example` through the hosting secret manager. Generate stable random signing and jobs secrets; never expose them in client code. Set `SITE_URL=https://cruzycabs.co.nz`, `LOCAL_PREVIEW=false`, and the verified legal operator details.
3. Enable Google Routes API and Geocoding API, billing and appropriate server key restrictions. Verify Auckland and North Island routes, luggage/accessibility review, scheduled trips and provider errors.
4. Configure Stripe test secret and matching webhook signing secret. Register `/api/webhooks/stripe` for `payment_intent.succeeded`, `checkout.session.completed`, and `charge.refunded`. Exercise test Checkout, duplicate webhooks, expiry, cancellation and refund recovery. Complete Stripe business verification before switching both secrets and webhook endpoint to live mode. Live Checkout requires the legal business name.
5. Configure Resend and verify the cruzycabs.com sender domain DNS. Test customer confirmations, staff OTP, outbox retries and operations alerts. The website domain and email domain differ deliberately.
6. Bind verified staff emails to least-privilege roles. Provision a unique base32 TOTP secret per staff member securely in their authenticator and `STAFF_TOTP_BINDINGS`; never paste secrets into chat. Scope each partner with `PARTNER_PROVIDER_BINDINGS`. Onboard actual verified drivers, vehicles and compliance expiry dates.
7. Confirm the Worker minute cron is provisioned. If the hosting service does not activate native scheduled triggers, invoke `POST /api/jobs` every minute with the jobs Bearer secret from a trusted scheduler. Monitor failed email deliveries, cancellation recovery and unassigned trips.
8. Configure domain DNS/TLS and uptime/error monitoring. Deploy a preview first and run the complete provider-backed flow on it. Configure D1 backup retention, R2 document retention, incident response and access removal.

## Operational sign-off still required

- Verify legal operator identity, New Zealand transport licensing, driver endorsements, vehicle inspections, insurance and airport permissions. Obtain legal review of published terms/privacy and the full pre-trip refund policy.
- Confirm pickup instructions, service coverage, pricing, GST treatment, support escalation and 24/7 staffing. Supply a real support phone if telephone service is offered.
- Validate keyboard/screen-reader usability, mobile devices, real route failures and weak connectivity. Run a production-like load test and recovery rehearsal before scaling.
- Confirm retention/deletion rules for customer records, audit history and uploaded compliance evidence. Uploads are restricted to administrators and checked by type/size; document malware scanning remains an infrastructure decision.

## Deliberately unsupported services

Online payment is card-only Stripe Checkout. Cash, Total Mobility subsidies, corporate credit accounts, flight tracking, masked calls/SMS, automatic fleet optimisation, payroll/partner settlement and native background location are not integrated. Tour/corporate/accessibility requests enter manual operations review. Location sharing is an explicit driver action; the offline page cannot submit bookings. Do not advertise these additional services until their contracts, integrations and end-to-end verification are complete.

## Verification recorded

21 executable API/domain tests passed, including canonical pricing, duplicate checkout, signed webhook amount checks, refund retry, authorisation, driver transitions, enquiries, OTP reuse and clean-database migration. Type checking, lint and production build passed on the final revision. Local browser verification exercised the booking enquiry fallback, stop fields and persisted operations case. Provider activation and production load tests remain separate launch gates.

