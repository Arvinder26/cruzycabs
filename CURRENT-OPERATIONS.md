# Current cruzycabs operation and release runbook

Updated 28 October 2026. This is the current procedure. The older deployment, SEO and design reports are historical evidence, not proof of active integrations. See `WEBSITE-AUDIT.md` for acceptance and remaining external gates.

**Current operations account:** `operations@cruzycabs.co.nz` has production-only **admin and dispatch** roles and a protected individual authenticator binding as of the 28 October same-source redeployments. The owner reported successful `/dispatch` sign-in with a fresh email code and Google Authenticator code, then confirmed `/admin` opened after the role upgrade. The local setup page was removed after enrolment. Driver accounts still need their own approved profiles, roles and authenticators. New online booking requests were **enabled** on 28 October (about 7:40 pm NZDT) with payment to the driver in person; no online payment is taken (see RELEASE-2026-10-28.md).

## Product and confirmed contacts

The website supports journey enquiries and card bookings in Auckland and the North Island. Van and Accessible are the online classes. Equipment, child-seat, pet and complex route requirements need operations review. Tours, business arrangements, cruise transfers, hourly hire, returns and journey changes require manual agreement. No automated subsidy, credit account, settlement, flight monitoring or continuous background tracking is supplied.

Confirmed public details are in `lib/business.ts`: cruzycabs, `027 266 1398` / `+64272661398`, `operations@cruzycabs.co.nz`, **Bookings open 24/7**. Booking hours do not promise instant vehicles or continuous staff availability. Owner verification of legal operator, tax treatment, fleet, equipment, staffing, airport/port access and policies remains required.

## Hosting and local development

The current release path is standard Next.js 16 on Vercel, Node 24, Sydney region. Turso/libSQL stores SQLite records; private Vercel Blob stores compliance files. Cloudflare Worker/D1/R2 files are a separate legacy path. Do not provision a Cloudflare database to activate the Vercel application.

Use the repository-pinned pnpm version and Node 24. Install with `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local`, configure local-only settings and run `pnpm dev`. Next reads `.env.local`; `.dev.vars` belongs to the legacy Worker setup. Never copy production data or secrets into a browser fixture. Local file SQLite is allowed only in development; production requires remote persistence. `LOCAL_PREVIEW=true` is an explicit development-only bypass and must be false in deployed environments.

Read the installed `node_modules/next/dist/docs/` before framework changes. Current error-boundary retry and route conventions must follow that installed version.

## Activate a separated preview before sales

1. Use the existing Vercel project/team and verify the intended source revision. Configure separate test database, provider keys and private document storage. Set the test host's HTTPS `SITE_URL`, `SITE_INDEXABLE=false` and `LOCAL_PREVIEW=false`. Never decrypt or print production secrets for a setup report.
2. Back up any existing database before migration. For a fresh database, apply `drizzle/0000_thick_smiling_tiger.sql`, `0001_production.sql`, then `0002_audit_recovery.sql` in order. The additive runtime schema can create application tables, but does not replace a documented migration/restore rehearsal. Migration 0002 adds assignment-scoped locations, refund recovery state and recovery-job history; old unscoped location rows are never copied into a trip.
3. Set stable `APP_SIGNING_SECRET` (at least 32 characters), `JOBS_SECRET` and `CRON_SECRET`; securely generate their values. Signing-secret rotation invalidates existing private booking links and requires an operator migration plan.
4. Configure restricted Google Places API (New) and Routes API credentials. Exercise supported/ambiguous locations, stops, service-area rejection, timeouts, invalid dates and NZ DST transitions.
5. Configure Stripe **test** secret and matching webhook secret/mode. Register payment/Checkout/full-refund events plus `refund.created`, `refund.updated` and `refund.failed`. Test hosted success, cancellation, decline, delayed/duplicate/out-of-order webhooks, expired sessions and refund failures. Verify persisted canonical amount/currency and receipt; a thank-you page is not proof of payment.
6. Verify the Resend sender for **cruzycabs.co.nz** and set `RESEND_API_KEY` / `EMAIL_FROM`. Test only authorised test inboxes: passenger requests/links, OTP, offers, payment/cancellation updates, operational alerts and retries.
7. Bind verified staff emails through `STAFF_ROLE_BINDINGS`, individual base32 authenticator secrets through `STAFF_TOTP_BINDINGS`, and partner organisation scopes through `PARTNER_PROVIDER_BINDINGS`. Provision authenticators securely outside chat. Test each role, wrong-role denial, session/assurance expiry and real logout. Onboard only verified test drivers/vehicles in staging; never make a live operational assignment for QA.
8. Attach a **private** Blob store and set `BLOB_READ_WRITE_TOKEN`. Test admin-only upload/download, file size/type/signature, missing storage/file, and access logging. Confirm retention and malware-handling arrangements; no public document URL is supplied.
9. After provider, staff and operational acceptance, set `BOOKINGS_ENABLED=true` in the intended environment and **rebuild**. Production defaults to paused new online booking requests. Existing secure management/cancellation and manual enquiries remain available. Do not enable merely because keys are present. Preview/test cards must never be presented as live payment activation.
10. Keep production Stripe in test mode until the owner verifies live provider approval, legal operator/policies and release acceptance. Then change live mode/key/webhook consistently through the hosting secret manager and approve the exact tested release. No paid plan change, live transaction, DNS change or production promotion is implied by this runbook.

## Admin sign-in persistence

New admin sign-ins remain trusted until explicit sign-out. Email and authenticator codes are still required at sign-in; both stored session records are revoked on sign-out. Successful operations refreshes renew the secure browser cookie within its 400-day limit. Clearing cookies also ends browser access. Older sessions need a fresh sign-in to adopt this policy. Other staff roles retain timed verification. Admin role removal still takes effect immediately.

## Request, driver and payment lifecycle

The server stores validated route/requirements and the integer-cent quote for five minutes. Submitting consumes the canonical quote without immediate payment. Operations reviews specialised requests and offers a suitable compliant driver. Acceptance opens payment. A signed provider success verifies amount/currency, records payment/receipt and permits trip progression. Driver arrival/start/completion cannot bypass payment. A changed journey needs a fresh agreed quote; support handles changes manually.

Dispatch defaults to active work and refund attention. Search/status filters and pagination query the backend; counts cover the role's complete scope. All matching payment records can be exported across pages, up to 10,000; larger selections fail explicitly and need narrower filters. Reconcile exports with Stripe before settlement. Check ordered stops, NZ pickup time, people/bags, wheelchair mode, child-seat/pet requirements, flight/terminal and notes before approving or accepting.

Location updates are explicit driver actions, scoped to the active assignment. Completed/cancelled customers cannot see subsequent journeys. Tell staff to share only while safely stopped; it is not continuous tracking.

## Scheduler and failure recovery

Provide a trusted scheduler invoking `GET /api/jobs` with `Authorization: Bearer <CRON_SECRET>` or `POST /api/jobs` with the jobs secret, normally every minute. Do not expose tokens in URLs or logs. `vercel.json` deliberately does not enable a paid minute-frequency cron automatically; the owner must choose a supported plan/scheduler. Verify actual invocation history, not just secret existence.

Each run records start/finish/state and a non-sensitive error category in `app_job_runs`; the admin connection panel shows the latest run. This operational metadata is pruned after 30 days. A running/failed or absent record is not proof of a healthy scheduler. Monitoring must detect missed/failed runs independently of the same scheduler.

Jobs expire old offers, recover `cancel_pending`, reconcile due pending refunds, retry leased email, clean temporary auth/location records and flag requests needing review, driver allocation or payment attention. Existing at-risk timing is an internal triage aid, not a customer response-time promise. Owner must approve escalation/staffing and handling of overdue review or unpaid accepted trips.

- **HTTP payment/refund failure:** leave the booking recoverable, verify provider state and stable idempotency keys, then run recovery. Do not create a second booking/refund because the browser timed out.
- **Failed/cancelled/action-required refund:** finance shows an exception, stores its provider ID/status and alerts operations. “Check refund with Stripe” reconciles the provider object; it does not issue a new refund. Failed terminal states require an authorised operator decision in Stripe and customer follow-up. Verify the full charge/refund before any new money movement. Canonical full-refund events or checked successful objects mark completion.
- **Notification failure:** inspect pending/failed outbox states and attempt counts, fix sender/provider issues, and use a reviewed replay procedure preserving the dedupe/idempotency key. Never silently discard a customer's request. Assign an owner to failed deliveries.
- **Stale operations view/auth expiry:** actions pause when refresh fails; use Refresh or sign in again. A displayed old record is not current assignment authority. Server role and state checks remain authoritative.
- **Incident/retention requests:** verify identity, restrict access and use the owner's approved incident/privacy/retention procedures. This repository does not establish that those procedures or legal approvals already exist.

## Backup, restore and rollback rehearsal

Record the actual Turso/private-file backup mechanism, retention, responsible person and last successful run. Restore into a separate database/store with no live provider credentials. Check booking counts, canonical fare/status/events, management access under controlled signing keys, refunds/outbox dedupe, roles, pricing and private files. Verify read/write and job recovery using `.invalid` records only. Record timing and evidence. A successful schema migration or local SQLite rollback test does not establish production restore readiness.

Before release, record the deployed revision and backup/snapshot, run the exact tests/typecheck/lint/build, check browser/role/accessibility journeys and obtain owner release approval. Roll back application code using the chosen hosting release process; preserve additive tables and provider state. Never drop financial/refund/location records as an automatic rollback. Reconcile provider events arriving across a rollback before re-enabling booking requests.

## Final acceptance

Use the audit's per-finding acceptance conditions and completion status. Keep unverified external gates explicit: real provider lifecycle, production staff/compliance access, scheduler/monitoring, restore, field CWV, physical devices, screen readers and qualified business/legal sign-off. Passing local checks is not permission to declare the service production-ready.
