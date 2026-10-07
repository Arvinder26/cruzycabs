# cruzycabs production deployment audit

Audit date: 4 October 2026, Pacific/Auckland.

## Verdict

Not ready for a full production taxi service. The public website and persistent guest booking foundation work locally, but the system cannot yet collect real payment, reserve capacity, dispatch a real driver, fulfil a trip, or operate customer support. These are launch blockers, not cosmetic tasks.

This report distinguishes locally reproduced defects, source-confirmed missing functionality, and production configuration that cannot be verified from this workspace. No live deployment, provider credentials, airport operating agreement or business licence was verified. Application code was not changed during this audit.

## Verification performed

| Check | Result | Limit |
| --- | --- | --- |
| Production compilation | Passed all five Vinext build stages | Compilation does not prove a deployed Worker or external integrations work |
| TypeScript | Passed `tsc --noEmit` | Static checks only |
| Existing test suite | 9 passed | Tests search source text with regular expressions; they do not exercise pricing maths, HTTP behavior, database concurrency or real user flows |
| ESLint on app, lib, worker and db | Failed: 42 errors, 3 warnings | Many are internal anchor navigation rules; React effect errors also need attention |
| HTTP route sweep | All 26 checked pages/metadata endpoints returned 200 | Staff/account pages use automatic localhost preview access |
| Browser | Homepage renders with no captured warning/error logs; help page inspected; tour submission and Add stop inspected | No complete device matrix, screen-reader audit or paid trip lifecycle tested |
| Runtime API probes | Reproduced invalid input acceptance and booking/quote mismatch | Local D1 only |

Routes checked: `/`, `/airport-transfers`, `/north-island-transfers`, `/private-tours`, `/accessible-travel`, `/business-travel`, `/auckland-rides`, `/pricing`, `/safety`, `/help`, `/lost-property`, `/complaints`, `/privacy`, `/terms`, `/accessibility-statement`, `/driver-application`, `/partner-fleet-application`, `/manage-booking`, `/account`, `/driver`, `/dispatch`, `/admin`, `/partner`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`.

Local probes created test quotes and one clearly labelled test booking, `KR-52C9KC`, for `deployment-audit@example.invalid`. No real payment or dispatch occurred. Test records remain in local storage.

## P0: block accepting live bookings

| Gap | Evidence | Required completion |
| --- | --- | --- |
| Real fares/routing absent | `lib/pricing.ts:32`: distances use destination name matching or the difference between address string lengths. Selected coordinates do not drive routing. | Production geocoding/routing with validated pickup and destination, service boundaries, traffic/duration, tolls, approved fare rules and fallback policy. |
| Payments are simulated | `app/api/bookings/route.ts:40` stores `simulated_authorisation` with provider reference `development_adapter`; no payment/webhook API exists. | Tokenized payment checkout, authorization/capture/void/refund, signed webhooks, replay protection, reconciliation and failure recovery. Server-side eligibility for cash and corporate credit. |
| No real dispatch or trip fulfilment | `app/OperationsConsole.tsx` uses hardcoded bookings/drivers and React state; only three API route files exist. | Persisted dispatch APIs, driver offers, atomic acceptance, actual vehicle reservation, status state machine, expiry/reassignment, scheduled-job execution and customer updates. |
| Priced journey can differ from booked journey | Runtime: an Airport-to-Ponsonby quote accepted a booking with an unrelated pickup and Wellington destination, returning 201. `app/api/bookings/route.ts:46` stores `body.journey`. | Read the canonical journey and requirements from stored quote input. Require a new quote for changes. Persist actual class/vehicle and fare snapshot consistently. |
| Quote lock unenforced | `locked_until` is selected but never compared to current time in the booking endpoint. | Reject/requote expired quotes and enforce quote consumption/allowed reuse and customer ownership. |
| Invalid API payloads accepted | Runtime: past scheduled date plus luggage -10 returned 200; arbitrary payment method returned 201; JSON `null` returned 500 on both POST endpoints. | Runtime schema validation for every field, types, length/body bounds, allowed enums, contact formats, coordinates, date/time, advance window and timezone. Return safe 4xx errors. |
| Capacity rules are unsafe | Runtime: 8 bags returned a van quote declaring capacity 6. `lib/pricing.ts:75` bypasses luggage limits for vans. | Enforce actual passenger/luggage/equipment limits. Resolve 8–11 passenger choices despite maximum current vehicle capacity 7. Confirm real accessible equipment and inventory. |
| Production identity boundary unverified | `app/chatgpt-auth.ts` trusts `oai-authenticated-*` headers; `app/staff-auth.tsx` automatically grants localhost access based on Host. | Verify hosting gateway strips spoofed headers and origin is inaccessible directly; use verified sessions/identity on other hosts. Disable preview bypass through trusted environment config, enforce roles on every write API, MFA and provider/driver/customer scoping. No production exploit was tested. |
| Guest management needs stronger protection | Reference plus email retrieves/cancels bookings, with no app-level throttling or token authentication. Email travels in GET URL. Response has no explicit `Cache-Control`. | Expiring high-entropy management tokens or verified session/OTP, rate limits, restricted response fields, no-store caching and safe logging. |
| Cancellation has no lifecycle policy | PATCH cancels any matching status other than already-cancelled; no cutoff, in-progress/completed restriction, fee/refund, driver notification or atomic conditional transition. | Approved policy implemented in a server-side state machine, with payment and dispatch synchronization and concurrent-update safety. |
| No booking communications | No SMS/email delivery adapter, notification worker or delivery retry path. | Deliver reference, secure management link and actual status; notify dispatch, driver and customer; track retries and failures. |
| Operational support unavailable | Help page has guidance and manage-booking link, without a working support phone/email/contact flow; configured phone is a placeholder and not consumed. | Staffed support contact and hours, phone-booking workflow, incident handling, lost-property and complaint case intake with reference and escalation. |
| Legal/operational clearance incomplete | Terms/privacy are short placeholder guidance; footer says working name not legally cleared; launch checklist remains unchecked. | Identify operating entity, licence model, verified fleet/driver requirements, insurance, airport permissions, final terms/privacy/refund policy and retention/incident responsibilities. |

## P1: complete the advertised website and workflows

| Surface | Missing behavior |
| --- | --- |
| Homepage booking | Add stop always shows a message rather than adding a stop. No return-trip workflow; schedule validation only checks that date/time exist in browser. Terms/cancellation acceptance text lacks direct policy links and recorded policy version. |
| Manage booking | Lookup and cancellation only: no reschedule/address update/requote, actual driver/vehicle, ETA, live tracking, fare/receipt view or support case action. Fetch failures lack try/catch/finally and may leave loading active. |
| Tours | Submit only sets a local preview message. No contact details, persistence, planner notification, request reference, itinerary approval, deposit/payment, attraction availability or accurate route/time estimate. Custom stops without coordinates contribute no distance. |
| Business travel | Corporate CTA goes to ordinary booking. No account application, approval, traveller/coordinator separation, cost centres, budgets, billing credit enforcement or invoices. |
| Driver/partner applications | Both aliases display the business-travel page rather than an onboarding form. No review pipeline or compliance upload/approval. |
| Help/lost property/complaints/privacy | Promised case and privacy-officer actions are absent. Generic action routing sends most CTAs to booking, including Contact support, Submit feedback and Contact the privacy officer. |
| Customer account | Upcoming rides and saved places are hardcoded zero; receipts hardcoded None. Booking creation never associates the booking with a signed-in customer. |
| Driver workspace | No actual offers, navigation, pickup verification, location reporting, authenticated trip state updates, earnings/settlement or offline recovery. Local demo trip progression also needs a proper state machine. |
| Dispatch | No live booking queue, persisted assignments, search, phone booking, capacity calendar, genuine map, alerts or support-case tools. Several buttons and sidebar items are inert. |
| Admin/finance | Price version increments only in local state. No approved rule publishing, compliance review, staff permissions, refund approval, reconciliation, receipt generation, exports or audit viewer. |
| Partner fleet | Hardcoded partner and jobs; availability is local state. No organisation isolation, fleet onboarding, compliance, allocated-job acceptance or settlement reporting. |
| Accessibility | Boolean wheelchair option does not capture ramp vs hoist, wheelchair dimensions/weight, seated passenger, assistance, service animals or boarding time despite public claims. WCAG acceptance remains unverified. |
| Airport | Flight number is captured but no flight monitoring, arrival delay handling, actual meeting instructions, operator-specific pickup permissions or verified fee adapter exists. |
| Safety | Verified driver/plate, passenger PIN, trip sharing, masked calling and incident workflows are described but not implemented. |

Marketing copy must be checked against implemented behavior before launch: do not promise verified assignment, tracking, invoices, case references or reserved accessibility equipment until those workflows exist.

## P1: production infrastructure, security and scale

- Provision and verify the production Worker, D1 binding, domain/TLS and required secrets. `vite.config.ts` has a local placeholder database ID; Sites may inject real bindings, but that provisioning was not inspected. Environment variable examples alone do not connect providers.
- Establish separate development/staging/production environments, reproducible dependency install, version-controlled releases, CI checks, deployment approval and rollback. All project source was untracked at audit start; no CI workflow exists in the supplied tree.
- Use one authoritative migration workflow. Runtime `ensureCoreSchema` creates only the core subset while Drizzle defines the larger schema. Verify a clean migrated database, upgrades, foreign keys, reference data, indexes and restoration. A rejected cached schema-initialization promise currently has no retry reset.
- Fix idempotency races: a read-before-insert with a unique constraint can still throw under concurrent duplicate requests. Store request fingerprint, scope retry keys, and return the original result after conflicts. Test timeouts and retries across booking/payment boundaries.
- Design durable asynchronous processing for notifications, scheduled dispatch, payment events and retries. Persist outbound events alongside transactions and make consumers idempotent. Add failed-job replay and dead-letter handling.
- Add app-level abuse controls and body limits to public APIs. Review CSRF/origin protections for mutations, authenticated authorization and log redaction. Harden CSP, frame policy, content-type, referrer and permissions headers. Local responses lack the checked headers; production edge configuration may supply them and must be verified there. HSTS should be assessed on the HTTPS deployment.
- Define PII/document/location retention, access logs, privacy requests, incident response and breach notification. Storage for compliance documents is absent (`r2: null`), and there is no upload route.
- Add structured error/event logging, crash tracking, uptime/API checks, alerts and dashboards for quote failures, booking failures, unassigned requests, late pickups, payment discrepancies and message failures. Do not log full contact details, management tokens or journey data unnecessarily.
- Verify backup/restore, disaster recovery and operational runbooks with stated RPO/RTO, duty owner and alert response. Load-test realistic concurrent quotes, booking retries, dispatch acceptance and location ingestion; measure D1 contention, Worker limits, provider quotas and costs before choosing a scaling architecture.
- Replace the public Photon endpoint or establish an approved production geocoder with quota/SLA, attribution, privacy and failure handling. Current address route has a timeout/manual fallback, but no configured provider adapter.
- Audit dependencies and runtime support. Vinext is a beta dependency; validate the exact deployed platform behavior, compatibility, auth proxy, metadata routes and Worker bindings rather than treating local compilation as production proof.

## P2: search, presentation and device quality

- Configure the real public origin: locally served sitemap currently contains `https://cruzycabs.example`.
- Add canonical metadata and handle alias URLs deliberately to avoid duplicate content. Sitemap omits Auckland rides, lost property and complaints while including manage-booking. Keep account/management pages out of search using appropriate metadata and access controls.
- Add real business contact/location data and only verified structured data. Staff/account pages currently inherit generic site titles.
- Add favicon/app icons and complete manifest requirements. No icons or service worker are supplied; driver PWA installation, push and offline behavior are not implemented.
- Resolve lint findings; review image optimization, cache policy, lazy loading and Core Web Vitals. Measure real mobile connections rather than inferring speed from compilation.
- Complete mobile/device testing, keyboard/focus/error announcement review, zoom and reduced-motion checks, screen-reader testing and recovery after network interruption. Add error/not-found/loading experiences where needed.
- Maintain brand/domain/legal entity consistency. Internal KR reference prefixes, file names and pricing version are historical identifiers, not evidence of functional failure; decide whether customer-facing reference prefixes should change without breaking old bookings.

## Compliance verification sources

These are external launch dependencies, not legal sign-off from this audit.

- [NZTA small passenger service licensing](https://www.nzta.govt.nz/business/transport-service-licences/small-passenger-service): confirms the licensing category includes taxi, app-based, shuttle and private-hire services.
- [NZTA passenger-service driving requirements](https://nzta.govt.nz/business/taxis-shuttles-buses-and-other-passenger-services/driving-a-passenger-service-vehicle): use to confirm driver licence/endorsement and applicable operational conditions.
- [Auckland Airport transport guidance](https://www.prod.aucklandairport.co.nz/transport): distinguishes pre-booked taxi meeting instructions from off-site parking/accommodation shuttle pickup. The website currently presents off-site transfer instructions for private travel generally; confirm the correct instructions for cruzycabs' actual operating permission/category.
- [Privacy Commissioner breach guidance](https://www.privacy.org.nz/assets/New-order/Resources-/Publications/Guidance-resources/Privacy-Act-2020-Information-sheet-2-breach-notifications.pdf): incorporate applicable notification requirements into the incident process.
- Verify Total Mobility participation and rules with Auckland Transport before advertising eligibility/subsidy support. This audit did not verify participation.

## Recommended implementation order and acceptance gates

1. **Booking integrity and security:** runtime schemas; canonical stored journey; expiry; capacity; idempotency; safe cancellations; trusted identity; guest tokens and throttling. Gate: behavioral API tests reject the reproduced failures, with concurrency and authorization tests.
2. **Operable booking service:** real routing, approved fares, payment provider, communications, staff-backed dispatch, verified drivers/vehicles and support. Gate: a staging customer can quote, pay, receive confirmation, be assigned, complete a trip and receive a receipt; cancellation/refund and no-driver recovery also pass.
3. **Complete advertised products:** tours, corporate, accessibility, airport and onboarding workflows; customer account; finance/partner tools. Gate: every advertised CTA has a real outcome and every advertised service has operational capacity and an accountable owner.
4. **Production release and scale:** domain/secrets/migrations, CI, monitoring, restore/rollback drills, load tests, mobile/accessibility acceptance and business/legal sign-off. Gate: documented operational approval plus tested staging-to-production release and recovery.

A smaller initial launch is possible after steps 1, 2 and the applicable parts of 4, with unimplemented products removed or converted into genuine human-reviewed enquiries. A full-scale launch requires all advertised service and staff workflows to be complete.

## Implementation update — 4 October 2026

The original findings above describe the earlier preview. See LAUNCH-CHECKLIST.md for the current state. Simulated payment and operations flows have been replaced with hosted Stripe Checkout and persisted APIs. Quotes use Google road metrics; expiry, capacities, policy consent, secure guest access, roles/MFA, request forms, real accounts, refunds, retries, private documents and pricing/audit administration are implemented. Domain/email/hours now use the supplied cruzycabs settings.

Final local verification: 21 executable tests passed; TypeScript and ESLint passed; production build passed. Mobile at 390 pixels rendered without horizontal overflow or captured console errors. Provider-backed deployment, business verification, legal/operator details, backups/load testing and the optional services listed in the launch checklist remain outstanding. No production deployment was performed.
