# cruzycabs website and application audit

> **Production release — 28 October 2026:** the tested changes have now been deployed with the user's authorisation. Live public routes, redirects, privacy headers and Google consent behaviour passed; see [RELEASE-2026-10-28.md](RELEASE-2026-10-28.md). Business/provider activation, scheduling/restore and device/account evidence remain separate gates. The original audit observations below are historical.

> **Implementation update — 27 October 2026, after the authorised 5:50 pm start:** source fixes for 23 findings are locally verified. WA-04/05/21/22/25 retain external activation, release or hosted-verification gates. See [AUDIT-FIXES.md](AUDIT-FIXES.md) for the complete WA-01–WA-28 closure ledger, 64 passing tests, browser evidence, migration/release behaviour and exact remaining dependencies. No production deployment or provider/customer transaction was performed. The audit below preserves the original observations; its “current”, failing-test and “no functionality changed” statements describe the **pre-fix audit baseline**, not the subsequent implementation.

**Audit date:** 27 October 2026, Pacific/Auckland. **Disposition:** not ready for an unrestricted, end-to-end customer-service launch. The public website is deployed and has a useful booking foundation, but privacy, authentication, refund exception handling and operational fulfilment need work before launch sign-off.

This review changed no application functionality and made no production bookings, assignments, payments, refunds, messages, deployments or configuration changes. All write tests used isolated SQLite records and mocked providers. Existing user changes were preserved. This report is the acceptance checklist for subsequent implementation.

## A. Executive assessment

### Readiness and priorities

The most consequential findings are:

1. **WA-01 — location privacy:** a completed booking can expose the same driver's location from a later booking. Reproduced against real handlers with isolated records.
2. **WA-02 — ineffective sign-out links:** Account and Operations sign-out links leave the session valid. The sign-out API itself works.
3. **WA-03 — refund exceptions:** a provider refund object with `status: failed` is treated as pending and receives no recovery or exception count.
4. **WA-04/05/25 — launch activation:** production has no listed staff role/TOTP/provider bindings or private Blob credential, is configured for Stripe **test** mode, and lacks verified operator and recovery-runbook sign-off. Provider account activation, scheduling, monitoring and restore readiness remain separate gates.
5. **WA-06/07 — dispatch reliability:** staff cards omit booked stops and structured assistance/flight details; an older active request disappears from the queue after 200 newer records.

No P0 exploit, real financial loss or production data loss was demonstrated within this safe audit. P1 findings require attention before relying on the application for real customer fulfilment. This does not establish the absence of other security defects.

### Strong aspects to preserve

- A coherent green, sage, warm-neutral visual identity, consistent primary buttons, readable public-page layouts, and a booking-first header.
- A clear distinction in the current local implementation between **request received**, **driver accepted**, **payment due**, **paid**, and **journey completed**. Driver acceptance precedes payment eligibility.
- Server-stored quote inputs, integer NZD-cent pricing, five-minute quote expiry, explicit policy consent and duplicate-booking protection. Browser-supplied fares and changed journeys cannot replace the stored quote.
- Guest access through private fragment tokens or the matching-email session; no authentication by reference/email alone. Protected APIs enforce roles and assurance on the server.
- Raw-body signed payment webhooks, amount/currency validation, duplicate-event protection and recoverable HTTP/provider failures in cancellation.
- Real persisted enquiry cases, private feedback accepting all ratings, scoped saved places, provider-scoped partner queries and audit records.
- Local consent controls successfully prevent Google requests before consent, remember decline, support withdrawal and exclude private pages. These improvements are not yet on the live revision.
- Public pages have no observed horizontal overflow across the six baseline widths. Proper local 404s, canonical URLs, sitemap contents and permanent alias redirects are implemented.

### Scope, evidence and limits

Evidence is in [output/website-audit](output/website-audit/). Start with [scope-inventory.md](output/website-audit/scope-inventory.md), [deployment-evidence.json](output/website-audit/deployment-evidence.json), [local-routes.json](output/website-audit/local-routes.json) and [live-routes.json](output/website-audit/live-routes.json). Screenshots are genuine browser captures; synthetic records are explicitly labelled.

| Environment | What was actually inspected | Limits |
| --- | --- | --- |
| **L — local production** | Unmodified source built with Next.js 16.3.8; `next start` at `127.0.0.1:3210`; public/customer pages, denial screens, keyboard/consent/offline states, metadata, headers and lab performance | No real provider credentials. Home intentionally shows enquiry/contact fallback. Anonymous staff denial screens do not prove authorised workspace usability. |
| **P — public production** | `https://cruzycabs.co.nz`, www/HTTP/alternate-host behavior, 27 route candidates at 390/1440, assets, metadata, headers, aliases, robots, health and lab performance | Read-only. No production customer or staff sessions, production record inspection, mutation or provider transaction. |
| **F — configured local fixture** | Real Next dev/Webpack pages at `127.0.0.1:3212`, separate `output/website-audit/fixture.db`, mocked Google/Resend and blocked Stripe; actual booking persistence; seeded customer/staff sessions; four authorised roles at six widths | CSP bypass was necessary for development Webpack eval. Local API origins were mapped to the expected HTTPS origin. This does **not** validate production CSP or hosted authentication. Production CSP was inspected separately without bypass. |
| **I — isolated source/API** | Real route handlers, in-memory SQLite, mocked Google/Stripe/Resend; canonical booking, MFA/roles, payments, refunds, retry/expiry, provider scope, queue and privacy probes | No hosted Stripe browser transaction, provider-backed email delivery, remote database concurrency or private Blob upload/download. |
| **B — production UI with isolated API bridge** | Unmodified L Manage Booking UI, API requests forwarded to the F database/real handlers; secure retrieval, reload and unpaid cancellation persisted successfully | Safe integration bridge, not a hosted provider test. No CSP bypass. |
| **S — synthetic browser responses** | Production thank-you UI at 320/390/1440: request, awaiting-payment, paid/receipt, completed, saved feedback, unauthorised and delayed-payment states | Rendered state verification; synthetic success alone is not transaction proof. Persistence/payment logic was checked separately in I. |

Browser: **Microsoft Edge / Chromium 156.0.4314.42**, headless, CSS viewport emulation. Firefox and WebKit launch attempts found their Playwright executables absent. No physical iOS/Android device, Safari, Firefox engine or real screen-reader session was tested. No user interviews or usability study were conducted; journey observations are expert inspections, not research with participants.

Some early F client-navigation runs produced `Invalid or unexpected token` and timeouts. Those remain in the fixture logs as **inconclusive development-harness results**. Manage Booking was subsequently verified successfully in B; saved-place add/remove passed a fresh F context. They are not reported as production defects or as fully passing development runs.

### Current source of truth

- Local HEAD is **`6c4008ec412d3f83d7f1b8e7fbfa61d7054f0c0b`**, with extensive existing modified/untracked files. Their initial inventory is [initial-git-status.txt](output/website-audit/initial-git-status.txt). The audited local product includes those changes, not just HEAD.
- Vercel confirms project **`cruzycabs`**, team **`arvinder`**, project ID `prj_SlbGRNAoZ4gnrnopHEgLtfXhNNXz`, Next.js, Node 24, Sydney (`syd1`). The READY production deployment is **`dpl_8L8a2E1C2csWC7N9XBQg3BmPB1Co`**, sourced from that HEAD. It does **not** include the local changes.
- Verified attached domains include apex, www and `cruzycabs.vercel.app`. Actual responses identify Vercel. Apex is publicly reachable without login; HTTP and www resolve to HTTPS apex. The alternate Vercel host serves another indexable copy rather than redirecting.
- Current active architecture: **Next.js on Vercel → Turso/libSQL adapter**, with a private Vercel Blob adapter for compliance evidence. `next.config.ts`, `vercel.json`, `lib/d1.ts`, `lib/sqlite-adapter.ts` and `app/api/compliance/route.ts` support this. Production health returned 200 for `SELECT 1`; this does not verify every table, migration or backup.
- Cloudflare Worker/D1/R2 code remains as a legacy path. The larger Drizzle domain schema describes additional entities; it is not evidence those commercial features are active. Current handlers predominantly use core tables plus `app_*` tables in `lib/platform.ts`.
- Read `AGENTS.md`, `CLAUDE.md`, README, architecture, launch, Vercel deployment, deployment audit, UX update, SEO audit/launch, change report, analytics and thank-you documents. Consulted installed Next guides for route handlers, `notFound`, not-found/error conventions, headers and local development before framework-specific recommendations.
- Git initially required an ownership exception. Commands used a per-command `safe.directory` setting; global Git configuration was not changed. Next dev temporarily regenerated two `next-env.d.ts` imports; they were restored and the file has no final Git diff.

| Historical assertion | Current evidence / resolution |
| --- | --- |
| Cloudflare is the main hosting target; the site is unpublished | Superseded by Vercel deployment/domain evidence and public HTTP 200 responses. |
| Database/maps/email/Stripe credentials are all absent | Names exist in production Vercel settings. Values were not decrypted. Database health passes; provider usability and account approval are still unverified. |
| Phone is unspecified | Superseded by owner-confirmed `lib/business.ts`: **027 266 1398**, `+64272661398`. Local pages use it; the older live pages do not. |
| Payment precedes dispatch | Current source and isolated state-machine tests require suitable driver acceptance before payment opens. |
| Passing prior reports establishes readiness | Rejected. Current tests were rerun; lint now fails on an existing `.local` script, and new privacy/operations defects were reproduced. |

### Configuration inspected without secret disclosure

Local environment had no supplied DB, maps, email, Stripe, signing or staff credentials; only `.env.example` was present. F used artificial audit settings. Vercel variable inspection requested **no decryption**; the saved evidence contains names/types/targets only.

| Production settings | Observation | What this proves |
| --- | --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Present, production target | Configuration names exist; health confirms a DB connection. No migration/restore claim. |
| `GOOGLE_MAPS_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Present, production target | Provider configuration exists; key validity, sender verification, webhook registration and delivery were not tested. |
| `STRIPE_MODE` | `test` on production/preview | Live card acceptance is not configured as a live release. Secret key mode was not decrypted. |
| `APP_SIGNING_SECRET`, `JOBS_SECRET`, `CRON_SECRET` | Present, production/preview | Access/recovery credentials are provisioned; actual scheduler invocation is not proved. |
| `STAFF_ROLE_BINDINGS`, `STAFF_TOTP_BINDINGS`, `PARTNER_PROVIDER_BINDINGS` | Absent from returned list; hidden production env count 0 | Current Vercel runtime has no listed staff/partner access activation through these required settings. |
| `BLOB_READ_WRITE_TOKEN`, `BUSINESS_LEGAL_NAME`, `BUSINESS_NZBN`, `BUSINESS_GST_NUMBER` | Absent from returned list | Compliance storage/operator configuration is incomplete through the current adapters. Business registration itself was not investigated. |
| Preview | Provider/database names above are production-only | A configured, isolated provider-backed preview was not available for this review. |

### What the product does today

**Audience:** passengers and booking coordinators needing Auckland/airport travel, groups requesting North Island transfers/tours, people arranging accessible travel, drivers, dispatchers, administrators and fleet partners.

**Implemented in source:** address suggestions/manual confirmation; routed quotes; Van and Accessible options; immediate/scheduled travel; up to three stops; guest request creation; manual-review states; driver offers and lifecycle; pay-after-acceptance card checkout; secure management/cancellation/receipts; email OTP and staff TOTP; history/saved places; enquiry cases; private reviews; finance export; pricing versions; private compliance adapter; outbox/recovery jobs; consent and public-page analytics.

**Manual operations:** accessible/child-seat/pet suitability, complex transfers, returns, tours, cruise meeting points, hourly-hire itineraries, corporate arrangements, journey changes/requotes, support cases and privacy requests. These are not automated reservations, account credit approvals or guaranteed equipment availability. Chair dimensions, extra boarding time, service animals and actual vehicle fit still need a human conversation/notes.

**Intentionally unsupported:** online cash/corporate credit, Total Mobility subsidy integration, automatic flight tracking, live continuous tracking, masked calls/SMS, automated fleet optimisation, native background location, payroll and partner settlement. Location is a manual driver action. Tours/hourly hire do not have automated checkout. Saved places can be stored but are not offered as shortcuts in the booking form.

**Business facts:** `lib/business.ts` is the authoritative project source for cruzycabs, the phone/email, **Bookings open 24/7**, Google review link and hourly guide. Local hourly hire is **NZ$120 per van/hour including GST**, three-hour minimum, 30 km per booked hour, NZ$2.50 per extra km; the itinerary and additional charges need agreement. This audit does not verify profitability, operator licensing, airport/port permissions, fleet inventory, GST status, legal approval or continuous staff availability.

## B. Coverage matrix

Statuses: **PASS** = the stated bounded check passed; **FAIL** = verified defect; **PARTIAL** = inspected/tested with remaining states; **BLOCKED** = named external dependency; **N/A** = deliberately unsupported or not a separate route. A route returning 200 is not a passing customer journey.

**Baseline rendering:** every page below was visited in L at **320, 375, 390, 768, 1024 and 1440 × 900** (162 visits), and in P at **390/1440 × 900** (54 visits). Axe 4.10.3 ran on all 27 candidates at 390/1440 in each environment. Screenshots sample every distinct public template and utility/staff state. Route JSON records headings, links, images, metadata, headers, errors and scan details.

### Public/customer/staff routes

| Route | Audience / purpose / primary action | Entry → onward | Dependencies | Actual result and remaining scope |
| --- | --- | --- | --- | --- |
| `/` | Passenger; start quote/request | Landing/header/footer → vehicle → contacts → thank-you | DB/maps; email/signing | **PARTIAL/FAIL:** L fallback and F persisted booking work; quote/review/focus/terminal issues WA-09–13/17. P older homepage is live. |
| `/airport-transfers` | Airport traveller; book | Header/home/footer → booking, guide/help | Actual terminal instructions; quote integrations | **PARTIAL/FAIL:** content and CTA inspected; contrast/motion issues; P mobile LCP above target. No physical terminal/permit validation. |
| `/auckland-rides` | Local/family traveller; quote | Home/footer/services → booking/help/hire | Vehicle/equipment review | **PARTIAL:** L 200, working entry; public content differentiates requests and availability. Real capacity/child-seat fulfilment blocked. |
| `/north-island-transfers` | Intercity traveller; plan transfer | Header/home/footer → booking/tour | Routing/manual operating review | **PARTIAL:** L/P rendered; I route bounds/rates checked. Return/rest/accommodation plan is manual, not operationally verified. |
| `/private-tours` | Group; planner/enquiry | Header/home/footer → planner → contact/case | Manual itinerary; DB/email | **PARTIAL/FAIL:** planner inspected, S/F enquiry logic; hidden focus and assurance contrast; P LCP issue. No itinerary/attraction booking verified. |
| `/accessible-travel` | Passenger/assistant; request suitable travel | Header/home/footer → enquiry/booking/help | Human equipment review; fleet | **PARTIAL/FAIL:** ramp/hoist/transfer and capacity code checked; empty related Help link WA-18. Real equipment/assistive-tech use blocked. |
| `/business-travel` | Coordinator; discuss travel | Header/home → corporate enquiry | Manual agreement | **PARTIAL:** form/content reviewed. No automatic credit/invoicing; no corporate approval was claimed. |
| `/cruise-transfers` | Cruise passenger; itinerary enquiry | Home/footer/related → prefilled enquiry | Ship/berth permission/manual confirmation | **PARTIAL:** L 200 and clear next step; **P 404**, undeployed. No ship/port access validation. |
| `/hourly-van-hire` | Group; hire enquiry | Home/footer/related → prefilled enquiry | Manual itinerary/pricing agreement | **PARTIAL:** L 200; F invalid-phone/retry persists a case. **P 404**, undeployed. Final guide pricing requires owner approval of costs. |
| `/pricing` | Price comparison; request quote | Footer/services → booking | Active DB rates or defaults | **PARTIAL:** L/P rendered; I maths/capacities/canonical fares pass. Owner must approve thresholds/allowances; no live route quote submitted. |
| `/safety` | Passenger; obtain help | Footer → help/enquiry | Verified driver/fleet and incident process | **PARTIAL:** content/CTA reviewed. Driver identity appears only after acceptance; real safety operations not verified. |
| `/help` | Customer; manage/contact | Header/footer → manage, phone, lost property/case | DB/email for form; staffed channels | **PARTIAL:** local phone links/FAQs/navigation work. Response staffing and support outcomes blocked. |
| `/lost-property` | Past passenger; report item | Help/footer → case | DB/email/manual follow-up | **PARTIAL:** form/source/routes inspected; generic case persistence passes I. Actual item follow-up untested. |
| `/complaints` | Reporter; submit feedback | Help/footer → case | DB/email/manual escalation | **PARTIAL:** route/form reviewed; no real complaint sent. Owner escalation/response commitments blocked. |
| `/privacy` | Data subject; information/request/settings | Footer → privacy case/cookie dialog | Owner retention/identity verification | **PARTIAL:** local cookie controls pass; rights request is manual. Published retention/incident process not owner-verified. |
| `/terms` | Customer; review obligations | Booking/footer → booking | Legal operator/policy approval | **PARTIAL/BLOCKED:** terms explain lifecycle/refund; visible legal/operator incompleteness. No legal compliance conclusion. |
| `/accessibility-statement` | Disabled visitor; feedback | Footer → enquiry | Manual support | **PARTIAL:** route/copy reviewed; statement appropriately acknowledges work. Actual AA conformance not established. |
| `/driver-application` | Prospective driver; apply | Footer → enquiry/manual onboarding | Compliance/role activation | **PARTIAL:** genuine form, not old business-page alias. P robots prefix blocks public page discovery. Actual application approval blocked. |
| `/partner-fleet-application` | Fleet; enquire | Source/sitemap → enquiry | Agreement/provider binding | **PARTIAL:** route/form exists; limited internal discovery. P robots prefix blocks it. No agreement/scoped real account available. |
| `/manage-booking` | Booking owner; status/pay/cancel | Email/footer/account/thank-you → receipt/help/review | Private token or same-email session; Stripe | **PARTIAL:** B secure view/reload/unpaid cancellation **PASS** with stored state; I access/refund tests pass bounded scope. WA-01/03/15 remain. Real hosted payment/refund blocked. |
| `/thank-you` | Booking owner; next steps/review | Request/Checkout/manage → manage/pay/receipt/review | Authorised API; provider webhook | **PARTIAL:** F request persisted; S status/delay/review/privacy suite **PASS**; **P 404**, undeployed. No real transaction inferred from UI. |
| `/sign-in` | Customer/staff; OTP/TOTP | Account/denial/email → account/next | DB/Resend; staff roles/TOTP | **PARTIAL/FAIL:** I wrong/expired/reused OTP, MFA, expiry and API logout pass; F expired-code recovery fails WA-14. Hosted delivery blocked. |
| `/account` | Customer; history/places/receipts | Header/sign-in → manage/receipt | Session/matching email/DB | **PARTIAL/FAIL:** unauthenticated redirect passes; F history and fresh-context saved-place add/remove pass. Sign-out WA-02; actual receipt/provider flow blocked. |
| `/driver` | Driver; offers/trip/location | Protected direct link/offer email | Role+MFA/profile/assignment | **PARTIAL/FAIL:** L/P denial correct; F authorised UI/24 role-width samples and I ownership/state machine checked. Narrow-screen overflow, omitted stops, privacy leak. No real dispatch. |
| `/dispatch` | Dispatcher; queue/review/offer/cases | Protected direct URL | Role+MFA/fleet/DB | **PARTIAL/FAIL:** F UI and I actions; queue truncation and requirements visibility fail. No real staffed queue verified. |
| `/admin` | Admin; pricing/onboarding/compliance/audit | Protected direct URL | Role+MFA; private storage | **PARTIAL/FAIL:** F authorised UI/forms inspected; I access restrictions checked. Mobile overflow. Private storage not activated/round-tripped. |
| `/partner` | Fleet partner; scoped records | Protected direct URL | Role+MFA/provider binding | **PARTIAL:** F UI; I out-of-provider data denial passes. Mobile overflow. It is a scoped viewer; acceptance remains a driver-account action. |

The `vehicle`, contact/review and confirmation steps are states of `/`, not additional URLs. Private rating is embedded in `/thank-you`; `/api/bookings/review` persists it. Stripe Checkout is an external destination, not an application checkout route. No undiscovered arbitrary `[slug]` pages were assumed: `publicSlugs` is a finite allowlist.

### Every redirect alias

Each alias was requested with `?audit_check=1` and redirects disabled in the HTTP client. **L PASS:** all sixteen return 308 and preserve the parameter. **P FAIL/pending release:** all sixteen still return 200 duplicate content at the alias URL.

| Alias | Canonical destination |
| --- | --- |
| `/local-auckland-taxis` | `/auckland-rides` |
| `/fare-estimate` | `/pricing` |
| `/how-pricing-works` | `/pricing` |
| `/contact` | `/help` |
| `/telephone-booking` | `/help` |
| `/total-mobility` | `/accessible-travel` |
| `/family-and-child-seat-travel` | `/auckland-rides` |
| `/pet-friendly-rides` | `/auckland-rides` |
| `/corporate-accounts` | `/business-travel` |
| `/vehicle-options` | `/auckland-rides` |
| `/service-areas` | `/auckland-rides` |
| `/about-cruzycabs` | `/safety` |
| `/about-kauri-ride` | `/safety` |
| `/cancellation-and-refund-policy` | `/terms` |
| `/conditions-of-carriage` | `/terms` |
| `/cookie-settings` | `/privacy` (actual settings are footer dialog and `/privacy#cookies`) |

### API, metadata, error and support surfaces

| Surface / methods | Purpose / dependency | Verification status |
| --- | --- | --- |
| `/api/addresses` GET | NZ suggestions/place detail; Google/Photon | **PARTIAL:** I Google/Photon fixtures, country exclusions/detail resolution; L keyboard fallback. Live provider quota/ambiguity untested. |
| `/api/quotes` POST | Validated routed server quote | **PARTIAL:** I malformed/null/cross-origin/capacity/time/geography/provider failures and pricing pass; F real stored quote. No live mutation. |
| `/api/bookings` POST/GET/PATCH | Create/retrieve/checkout/cancel | **PARTIAL/FAIL:** canonical input/idempotency/access/pay gating checked; privacy/refund findings remain. |
| `/api/bookings/review` POST | One private rating per authorised booking | **PASS within I/S:** ratings 1–5, invalid scores, length, auth, repeat/concurrent submissions, server-derived experience; no Google review posted. |
| `/api/auth` POST | Request/verify OTP, TOTP, signout | **PASS within I** for tested security states; F recovery UX fails. Resend-backed login blocked. |
| `/api/account` POST | Scoped place creation/removal | **PASS within I/F:** other customer cannot remove owner record; add/remove persisted. Reuse from booking form unsupported. |
| `/api/operations` GET/POST | Role-scoped operational reads/writes | **PARTIAL/FAIL:** forged identity/customer/expired-MFA denied; driver transitions/partner scope verified; queue/detail findings. Remote contention untested. |
| `/api/compliance` GET/POST | Admin-only private evidence | **PARTIAL/BLOCKED:** source type/size/signature/access boundaries reviewed; I unauth 403, authorised-without-storage 503. Real Blob upload/download, malware scanning and retention not verified. |
| `/api/location` POST | Assured assigned driver's explicit update | **FAIL:** I active assignment required; subsequent cross-booking disclosure WA-01 reproduced. No physical GPS test. |
| `/api/requests` POST | Enquiries, applications, support cases | **PASS within I/F** for persisted case, invalid phone, retry/idempotency and fake-email delivery. Real follow-up blocked. |
| `/api/webhooks/stripe` POST | Signed payment/refund state changes | **PARTIAL:** I signature freshness/tamper, amount mismatch, dedupe, paid receipt/full-refund tests. Hosted retries/delays/provider mode blocked; failed refund handling fails. |
| `/api/jobs` GET/POST | Secret-authenticated cron/manual recovery | **PARTIAL:** handlers/source reviewed; I offer expiry, HTTP refund recovery and outbox retry pass. Real scheduler invocation/alerting blocked. |
| `/api/health` GET | DB liveness only | **PASS P 200**; **L 503 expected** with no DB. Not a business-readiness check. |
| `/analytics-frame` GET | Consent-checked minimal analytics document | **PASS L/S:** no-consent 204, allowlist/private exclusions, no-store/noindex and isolated CSP; **P 404**, undeployed. |
| `/robots.txt` | Crawler instructions | **PASS L**; **FAIL P:** `/driver` and `/partner` prefixes block public application pages. |
| `/sitemap.xml` | Canonical public discovery | **PASS L:** 19 public canonical pages, no private/alias URLs; P has older 17-page list. Search Console ingestion blocked. |
| `/manifest.webmanifest`, `/icon.svg`, `/app-icon-192.png`, `/app-icon-512.png`, `/og.png` | Install/share assets | **PASS HTTP** in L/P. Metadata/available images checked; actual installed-device/social-platform previews untested. |
| `/sw.js`, `/offline.html` | Safe offline navigation | **PASS bounded L:** offline page displays; cache contains only offline page/icons. **FAIL content:** WA-23. No offline booking promised. |
| `/images/kauri-route-panorama.webp`, `/images/north-island-map-clean.webp`, `/images/private-tour-hero.webp`, `/images/cruzycabs-logo.png`, other discovered rendered assets | Brand/service images | **PASS bounded rendering:** no broken images in sweeps; hero delivery differs L/P. Actual fleet authenticity not established by illustrations. |
| `/audit-no-such-route-20261027`, `/unknown/nested` | Unknown route | **PASS L/P:** genuine 404. Default framework recovery UI; no custom `error.tsx`/`not-found.tsx` found. |
| `/constructor`, `/toString`, `/__proto__` | Prototype-like unknown slugs | **PASS L 404; FAIL P 500**, fixed locally/pending release. No internal stack trace was claimed from this probe. |
| Internal `/_not-found`, framework `/_next/*` | Framework fallback/assets | Build manifest/source and delivered asset requests inspected. Not advertised customer routes; no separate functionality claimed. |

### Critical journey coverage and usability observations

| Journey | Verified behavior | Friction / unresolved state | Status |
| --- | --- | --- | --- |
| Airport arrival, unfamiliar address | Terminal shortcuts, flight field, keyboard/manual address fallback; F airport + stop + child-seat quote → stored request → thank-you | Destination edits erase terminal; no operator-specific meeting point in stored product; ops must communicate it manually | **PARTIAL / WA-06,09–13** |
| Quick mobile ride | Public layouts fit 320–1440; prominent booking CTA, native selects, preserved form state on controlled errors | Small secondary copy, lost step focus; online-route failure does not expose a prefilled enquiry fallback | **PARTIAL / WA-13,15,17** |
| Family with luggage/child seat | Server capacity limits; child-seat flag/allowance/manual review; no payment before acceptance | Wrong North Island review label; no child age/seat specifics until notes/manual discussion; staff card hides structured flag | **PARTIAL / WA-06,10** |
| Accessible passenger | Ramp/hoist/transfer input; limits; backend capability match and review | Physical dimensions/equipment availability require owner review; service animal/extra time not distinct structured fields; real disabled-user/SR testing unavailable | **PARTIAL/BLOCKED** |
| Tours/business/cruise/hourly | Distinct descriptions; planner/prefilled enquiries; I/F saved case and no-payment messaging | Large tour groups need manual vehicle plan; no automatic itinerary/invoice; two live pages absent | **PARTIAL / WA-21** |
| Returning customer | B private link retrieval/reload/cancel; F history/saved places; matching-email access enforced | Account sign-out ineffective; raw vehicle/status labels; saved places not booking shortcuts | **PARTIAL / WA-02,28** |
| Bad address/routing/connectivity | Keyboard manual-confirm path; I route rejection/geography/provider errors; outbox/provider retry; safe offline navigation | Manual confirmation is not a verified pickup; need useful recovery action and preserved journey on real errors | **PARTIAL / WA-13,23** |
| Driver acceptance → hosted payment | I offer alone does not unlock pay; acceptance does; signed payment → accepted/receipt → arrived/start/complete | Hosted Stripe browser success/cancel/failure, provider activation and actual customer email remain unverified | **PARTIAL/BLOCKED** |
| Cancellation/refund | B unpaid cancellation persists; I paid cancellation, HTTP failure recovery and full-refund webhook pass | Failed refund object remains pending/unmonitored; real bank/provider settlement not tested | **FAIL / WA-03** |
| Dispatcher/driver/partner work | I backend restrictions/transitions; F authorised templates at six widths | Mobile overflow; missing journey requirements; 200-record window can hide active work | **FAIL / WA-06–08** |
| Authentication/recovery | I OTP reuse/attempt/expiry, TOTP assurance, session expiry and API signout pass | Expired OTP has no resend/change-email path; staff return destination lost; UI logout ineffective | **FAIL / WA-02,14,24** |

These are realistic task inspections with synthetic data, not persona-based research results. Research hypotheses worth testing later: whether the guide/final-fare distinctions are understood; whether people find the booking-to-driver-to-payment sequence predictable; and whether enquiry handoff feels sufficiently concrete for urgent travel.

## C. Prioritised findings

Severity follows the requested definitions: **P0** critical exposure/data loss/incorrect financial behavior requiring immediate response; **P1** core task blocked or seriously compromised; **P2** material usability/accessibility/reliability/consistency; **P3** minor polish or optional improvement. Confidence applies to the observed scope, not untested production exploitation.

### WA-01 — P1 — Completed customers can see a later trip's driver location

- **Category / users / reference:** privacy; drivers and later passengers; `app/api/bookings/route.ts:36`, `app/api/location/route.ts`, `app/ManageBooking.tsx`.
- **Expected → observed:** location access ends with the authorised active assignment. The GET query includes completed assignments and joins the latest location by **driver ID**, not booking/assignment. I completed trip A, assigned the same driver to B, shared a new location, then retrieved A using its valid old token. A returned B's new coordinates and timestamp.
- **Reproduce / evidence:** follow those two-trip steps in [additional-api-probes.json](output/website-audit/additional-api-probes.json), “Completed-booking access to later driver location”. All coordinates/contacts are synthetic.
- **Correction / acceptance:** bind location to assignment/booking and enforce active status in both write and retrieval. Old/completed/cancelled tokens must never retrieve subsequent-trip coordinates. Regression test A completion → B assignment/update → A gets no new location, while B gets only its authorised update.
- **Confidence / dependencies:** high, reproduced. Fix before enabling location sharing; no production customer data was accessed.

### WA-02 — P1 — Sign-out links do not end the session

- **Category / users / reference:** authentication/privacy; customers and all staff; `app/chatgpt-auth.ts:8`, `app/OperationsConsole.tsx`, `app/sign-in/SignIn.tsx`.
- **Expected → observed:** clicking Account/Operations “Sign out” revokes the session. It navigates to `/sign-in?signout=1`; SignIn does not consume that parameter. F retained the cookie and server session, and `/account` remained accessible. I confirms the explicit sign-out API does revoke access.
- **Reproduce / evidence:** sign in/seed a valid session → Account → Sign out → revisit Account. See [fixture-flows.json](output/website-audit/fixture-flows.json) and [recovery-api-probes.json](output/website-audit/recovery-api-probes.json).
- **Correction / acceptance:** invoke the existing POST signout action from every logout control, handle failure and revoke before redirect. Old cookie replay must fail for Account and Operations; clear associated assurance. Test all roles and browser back/reload.
- **Confidence / dependencies:** high for source and seeded-session reproduction; verify hosted sessions after activation.

### WA-03 — P1 — Failed refunds can remain unmonitored as pending

- **Category / users / reference:** payment/recovery; paid customers and finance; `lib/bookings.ts` cancellation, `lib/jobs.ts:10`, `app/api/operations/route.ts:20`, Stripe webhook handler.
- **Expected → observed:** a failed provider refund becomes an actionable exception. A mocked successful HTTP response containing `{status:'failed'}` resulted in `cancelled/refund_pending`, HTTP 200, and no retry after jobs ran. Jobs recover only `cancel_pending`; the attention metric counts that status rather than failed/stale refunds. The separate HTTP-502 recovery path does work.
- **Reproduce / evidence:** [refund-failure-probe.json](output/website-audit/refund-failure-probe.json); successful HTTP retry/full-refund evidence in [recovery-api-probes.json](output/website-audit/recovery-api-probes.json). Stripe documents `failed`/`canceled` refund states in its [Refund object reference](https://docs.stripe.com/api/refunds/object) and describes [later refund failures](https://docs.stripe.com/refunds#handle-failed-refunds).
- **Correction / acceptance:** persist refund provider ID/state; handle failed/cancelled/pending outcomes and later provider events; reconcile stale pending refunds and expose them in finance/alerts. A failed object or later failure event must not disappear from attention. Test safe idempotent retry/reconciliation without double refund.
- **Confidence / dependencies:** high for demonstrated failed-object handling; provider-backed asynchronous failure delivery remains a staging test.

### WA-04 — P1 — Production staff and compliance activation is incomplete

- **Category / users / reference:** release/operations; all staff/partners; `lib/auth.ts`, `lib/totp.ts`, `app/api/compliance/route.ts`, deployment evidence.
- **Expected → observed:** named staff can authenticate with least privilege and manage requests. The returned production variable list has no staff role/TOTP/provider bindings or `BLOB_READ_WRITE_TOKEN`. Current code requires them; legacy Cloudflare bindings are not supplied by this Vercel path. A present email or DB key does not activate staff access.
- **Reproduce / evidence:** inspect names/targets in [deployment-evidence.json](output/website-audit/deployment-evidence.json) and the server role/assurance checks. Production staff login was deliberately not attempted with a real person's address.
- **Correction / acceptance:** provision verified staff roles, individual authenticator secrets, explicit partner scope and private storage in separated environments. Demonstrate admin/dispatch/driver/partner access and wrong-role denial, then a private document round trip. Do not open automated customer fulfilment on the strength of “keys present”.
- **Confidence / dependencies:** high for missing listed settings; owner-approved staff identities and storage activation required. Actual fleet readiness is unverified.

### WA-05 — P1 — Live-payment and operator release gates remain open

- **Category / users / reference:** payment/trust; customers/owner; Vercel settings, `lib/stripe.ts`, `app/PolicyDetails.tsx`, launch documents.
- **Expected → observed:** a live service uses an approved operator/policy basis and a verified live payment lifecycle. Production `STRIPE_MODE` is `test`; legal operator fields are not listed. Terms visibly say operator details/legal review are required. No real hosted provider test or approval evidence was supplied.
- **Reproduce / evidence:** deployment names/non-secret mode plus L/P Terms. This is an activation/sign-off gap, not proof that the business is unregistered or that a real payment was lost.
- **Correction / acceptance:** owner verifies legal identity, tax/fare treatment, fleet/airport permissions and reviewed policies; complete Stripe test-mode end-to-end acceptance first, then explicitly approve consistent live keys/webhook/mode. Demonstrate request → actual driver acceptance → hosted payment → signed persisted result → receipt → cancellation/refund/reconciliation on an authorised test plan.
- **Confidence / dependencies:** high for configured test mode; external business/provider approvals blocked and must be supplied by owner/qualified advisers.

### WA-06 — P1 — Staff/driver cards omit critical booked requirements

- **Category / users / reference:** fulfilment/safety/UX; dispatchers/drivers/passengers; `app/OperationsConsole.tsx` booking cards.
- **Expected → observed:** before approval/acceptance/travel, staff see the full route and equipment/airport requirements. Cards show pickup/destination, counts and free-text notes, but omit structured stops, wheelchair mode, child-seat/pet flag, terminal and flight. An isolated airport booking stored a stop and `NZ123`; the dispatch card omitted both. Backend matching does enforce basic capabilities, but that does not give drivers their complete itinerary.
- **Reproduce / evidence:** [targeted-fixture-retests.json](output/website-audit/targeted-fixture-retests.json), dispatch card text; [screenshot](output/website-audit/fixture-dispatch-missing-requirements.png). Operations emails carry more details, but the driver offer email does not replace the workspace requirement.
- **Correction / acceptance:** share a consistent, role-appropriate journey summary showing ordered stops, local pickup time, flight/terminal, all assistance/equipment needs and notes. Test child-seat/hoist/pet/multi-stop records on dispatch and assigned-driver screens before acceptance; minimise unrelated data.
- **Confidence / dependencies:** high, stored data compared with rendered card. Owner must define additional equipment details required for safe manual approval.

### WA-07 — P1 — The 200-record window can hide active work and undercount/export it

- **Category / users / reference:** operations/reliability; dispatch/finance; `app/api/operations/route.ts:17`, OperationsConsole search/metrics/export.
- **Expected → observed:** active requests remain discoverable regardless of newer completed records. GET returns only 200 newest-created bookings, with no pagination/filter. Search, counts and payment export operate only on that subset. I seeded one older active request plus 200 newer closed records: the API returned 200, omitted the active request, and the UI-derived awaiting count became zero.
- **Reproduce / evidence:** [queue-window-probe.json](output/website-audit/queue-window-probe.json). No production records were added.
- **Correction / acceptance:** server-side active/status/date/search filters, truthful total counts, pagination and explicit export scope. An older scheduled or unresolved booking must remain searchable/actionable with >200 newer closed records. Export must disclose or cover its selected full scope.
- **Confidence / dependencies:** high, API reproduction; include production-like volume and database query/index verification.

### WA-08 — P2 — Authenticated workspaces overflow narrow screens

- **Category / users / reference:** responsive/accessibility; mobile staff/drivers; `.ops-sidebar`, `.ops-main`, metrics in `app/globals.css`.
- **Expected → observed:** primary actions and text reflow without page-wide horizontal scrolling. At 320/375/390, seeded authorised views measured **472 px Admin**, **467 px Dispatch**, **448 px Driver**, **459 px Partner**. Anonymous denial screens fit, so the public sweep alone would have missed this.
- **Reproduce / evidence:** [targeted-fixture-retests.json](output/website-audit/targeted-fixture-retests.json), [Admin screenshot](output/website-audit/fixture-admin-390.png). Wider 768/1024/1440 samples did not overflow.
- **Correction / acceptance:** wrap/restructure sidebar identity/navigation, allow grid children to shrink, and stack actions/metrics appropriately. All four authenticated roles must fit 320–1440 with long emails/names/addresses; verify WCAG 1.4.10 reflow and real mobile touch/keyboard use.
- **Confidence / dependencies:** high in F; retest hosted authorised pages and physical devices.

### WA-09 — P2 — Final request step is not a complete review

- **Category / users / reference:** error prevention/booking; all bookers; `app/KauriRideApp.tsx:446`.
- **Expected → observed:** immediately before agreeing/requesting, customers can confirm route, stops, time, counts, requirements, contacts and fare. The final step shows vehicle, time and total, but omits route/stops/counts/flight/equipment. F screenshots/text verify the omission; correcting route requires multiple Back/Edit actions.
- **Reproduce / evidence:** complete a stop/child-seat airport quote → Continue → contacts; [final review screenshot](output/website-audit/fixture-final-review-390.png) and fixture JSON.
- **Correction / acceptance:** add a compact complete review with meaningful Edit links and preserve contacts/consent appropriately on recalculation. Test wrong stop/date/seat correction without losing unrelated input. Evaluate WCAG 3.3.4 at the eventual financial agreement as well; initial request takes no payment.
- **Confidence / dependencies:** high; shared journey summary can resolve WA-06 too.

### WA-10 — P2 — All manual-review reasons are described as a North Island journey

- **Category / users / reference:** status/content; accessible/family/pet customers; `app/KauriRideApp.tsx:409`, `lib/pricing.ts`.
- **Expected → observed:** review messaging names the actual reason. `manual_review` also covers short local accessible/child-seat/pet trips. F's 25 km airport/child-seat request displayed “This North Island journey needs availability confirmation”.
- **Reproduce / evidence:** local trip + Child seat → quote; [fixture-manual-review-390.png](output/website-audit/fixture-manual-review-390.png), quote text in fixture JSON.
- **Correction / acceptance:** return/display reason codes or accurate general equipment/route review copy. Separate tests for each flag and distance condition must describe the required next step without inventing vehicle availability.
- **Confidence / dependencies:** high; pricing review rules need owner approval, not a visual redesign.

### WA-11 — P2 — Entering the other address clears the airport terminal

- **Category / users / reference:** form/data consistency; airport customers/dispatch; `app/KauriRideApp.tsx:195–205`.
- **Expected → observed:** selecting International pickup remains selected while entering the destination. Both address update paths clear shared `airportTerminal`; choosing a destination can clear it again. F stored an International-shortcut pickup and `NZ123` with `airportTerminal: ''` after destination entry.
- **Reproduce / evidence:** International quick pickup → enter/confirm destination → flight → submit. Inspect stored journey in [fixture-flows.json](output/website-audit/fixture-flows.json). Full pickup text still names International, but the structured field is inconsistent.
- **Correction / acceptance:** derive terminal from the relevant endpoint or keep independent pickup/destination terminal state. Test both travel directions, editing unrelated address, replacing airport with a non-airport and airport-to-airport scenarios.
- **Confidence / dependencies:** high, source plus persisted reproduction.

### WA-12 — P2 — Quote expiry and time-zone guidance do not match server rules

- **Category / users / reference:** pricing/time clarity; international and slow-completing customers; `app/KauriRideApp.tsx:428`, scheduled inputs, `lib/validation.ts`.
- **Expected → observed:** show the five-minute limit and usable recovery, label scheduled time as Pacific/Auckland and explain the advance window. Quote copy says it changes only if the journey changes; the server rejects expiry. There is no expiry countdown/requote action. Browser-local `toLocaleTimeString` has no fixed zone; F with Los Angeles timezone showed an evening hold time for an NZ afternoon session. Date/time inputs omit the 15-minute/90-day rule and local-time label.
- **Reproduce / evidence:** quote with a non-NZ browser timezone; expire a stored quote (I returns 409); see fixture quote text and `expired and unauthorised quotes` test.
- **Correction / acceptance:** explicit NZ pickup time/window, accurate hold wording, visible expiry and one-step requote preserving inputs. Server remains authoritative; test NZ DST gap/repeated-hour and past/window limits. Do not silently change a fare.
- **Confidence / dependencies:** high; date/DST validation itself passed I, including repeated-hour rejection.

### WA-13 — P2 — A runtime quote failure has no prefilled enquiry recovery

- **Category / users / reference:** reliability/recovery; customers with provider/address failures; `requestQuote` in KauriRideApp.
- **Expected → observed:** after a routing outage/no-fit/unsupported route, retain the journey and offer a clear contact/enquiry path. Enquiry handoff exists only when `onlinePricingAvailable` was false at render time. If configured routing later returns 503/422, the catch renders an error string without opening the existing enquiry or supplying a direct recovery action.
- **Reproduce / evidence:** I provider failures in [recovery-api-probes.json](output/website-audit/recovery-api-probes.json); source branch comparison. This is source-confirmed recovery design; no live provider failure was induced.
- **Correction / acceptance:** show Retry and Send journey to operations with preserved route/time/counts/requirements, plus phone/contact. Distinguish a transient outage from an unsupported journey. Test aborted/slow/non-JSON responses and successful retry without duplicate booking.
- **Confidence / dependencies:** high source confidence; full browser failure-state rerun required after implementation.

### WA-14 — P2 — Expired OTP has no resend or change-email path

- **Category / users / reference:** authentication recovery; all users; `app/sign-in/SignIn.tsx`.
- **Expected → observed:** after expiry/failed attempts, request a new code or correct the email without restarting the page. Once a challenge exists, email is disabled and only Verify remains. F expired an issued challenge, entered a code, received “Invalid or expired code”; no resend/change-email button existed.
- **Reproduce / evidence:** [targeted-fixture-retests.json](output/website-audit/targeted-fixture-retests.json); API attempt/expiry behavior passes I.
- **Correction / acceptance:** explicit resend/change-address controls, expiry guidance, understandable TOTP errors and preserved return destination; respect server rate limits. Test wrong email, five failed attempts, expired OTP, expired staff assurance and provider email delay.
- **Confidence / dependencies:** high in F/source; real mailbox delivery remains blocked.

### WA-15 — P2 — Several informative text styles fail contrast

- **Category / users / reference:** accessibility/visual clarity; low-vision/mobile users; `app/globals.css:164`, `.tour-assurance`, utility `.eyebrow`.
- **Expected → observed:** normal informative text at least 4.5:1, large text at least 3:1. Axe measured step labels **3.82:1** (`#7a8580` on white), tour assurance **1.58:1** on its light panel and Manage Booking eyebrow **1.62:1**. These are meaningful labels/copy, not just decorative numbering.
- **Reproduce / evidence:** L/P 390/1440 scan nodes in route JSON; manually inspected screenshots and computed tour styles. Ignore purely decorative numbers when triaging. Offscreen airport fade findings are treated separately in WA-19.
- **Correction / acceptance:** adjust foreground/background tokens for each actual surface; preserve brand colours where they already work. Recheck default, placeholder, selected, disabled and error states with manual contrast review. **WCAG 1.4.3**.
- **Confidence / dependencies:** high for named stable styles; no full-site conformance assertion from axe alone.

### WA-16 — P2 — Tour checkboxes have no visible keyboard focus

- **Category / users / reference:** keyboard accessibility; sighted keyboard users; `app/globals.css:655`, TourPlanner cards.
- **Expected → observed:** a keyboard-focused stop has a visible indicator distinct from selection. The checkbox is `opacity:0`; its outline is invisible, and the enclosing label has `outline-style:none` with no focus treatment. Space toggles correctly, but focus position cannot be seen.
- **Reproduce / evidence:** focus/tab to first tour checkbox → Space; [tour-keyboard-focus-390.png](output/website-audit/tour-keyboard-focus-390.png) and manual JSON computed styles. The selected checkmark is not an indicator for an unselected focused card.
- **Correction / acceptance:** visible label/card `:focus-within` or equivalent; keyboard-test all stop cards and related hidden-radio/card controls. Indicator persists, is distinguishable from selection and remains visible at zoom. **WCAG 2.4.7**, with non-text contrast checked under 1.4.11.
- **Confidence / dependencies:** high, source/computed styles/visual inspection; test with keyboard users later.

### WA-17 — P2 — Step transitions lose focus and pickup-time selection lacks programmatic state

- **Category / users / reference:** interaction accessibility; keyboard/screen-reader users; KauriRideApp step transitions and `.segmented` buttons.
- **Expected → observed:** a new step receives meaningful focus, and Now/Schedule exposes its selected value. Quote-results focus works, but Continue unmounts the focused control and leaves `document.activeElement` at BODY. Now/Schedule has CSS selection only: neither `aria-pressed` nor an equivalent radio state is present.
- **Reproduce / evidence:** F Continue with Van → details focus BODY; L Schedule click → selected class with null pressed/selected attributes in [manual-browser-checks.json](output/website-audit/manual-browser-checks.json).
- **Correction / acceptance:** move focus to the new heading/first relevant control after every forward/back transition; expose time-mode state and announce relevant errors/results. Keyboard focus order and screen-reader state must remain coherent. Relevant criteria: **2.4.3, 4.1.2**, and status-message review under **4.1.3**.
- **Confidence / dependencies:** high for DOM observations; actual announcements need NVDA/VoiceOver testing.

### WA-18 — P2 — Accessible-travel related Help link has no name

- **Category / users / reference:** navigation/accessibility; all users, particularly assistive technology; `app/ServiceDetails.tsx:18`, `lib/seo.ts` serviceTitles.
- **Expected → observed:** every related link has meaningful text. `serviceContent` includes `help`, but `serviceTitles['help']` is undefined. L renders an empty `<a href='/help'>` with no accessible name and zero visible box.
- **Reproduce / evidence:** `/accessible-travel` → More ways to travel; axe `link-name` at 390/1440 and manual link inventory.
- **Correction / acceptance:** provide a complete title lookup/fallback and validate all related slugs. Every link must have a visible, descriptive accessible name. **WCAG 2.4.4 / 4.1.2** as applicable.
- **Confidence / dependencies:** high, L only/new service component; not present in the older live template.

### WA-19 — P2 — Scroll fades remain active with reduced motion and reduce visible contrast

- **Category / users / reference:** motion/accessibility; reduced-motion/low-vision visitors; `app/globals.css:794–799`, reduced-motion overrides.
- **Expected → observed:** essential content is readable when it enters view, and reduced-motion mode disables the scroll animation. CSS `animation-timeline:view()` remains active on terminal cards/custom-stop cards; shortening duration does not disable its scroll-driven progress. At 390×844 with reduced motion, a visible terminal card at y≈638 had opacity **0.614** and paragraph contrast **2.78:1**. It reaches opacity 1 farther into view.
- **Reproduce / evidence:** [manual-browser-checks.json](output/website-audit/manual-browser-checks.json) visible samples and [airport-guide-visible-reduced-motion-390.png](output/website-audit/airport-guide-visible-reduced-motion-390.png). Initial whole-page scans exaggerated offscreen fading; they are not interpreted as permanent text colours.
- **Correction / acceptance:** remove essential-content fade or explicitly disable animation/timeline and set full opacity under reduced motion. Verify top/bottom entry, keyboard scrolling and tall cards in supported browsers. Visible text must meet **1.4.3** throughout ordinary reading states; reduced-motion handling is also a usability requirement, without mislabelling AAA 2.3.3 as AA.
- **Confidence / dependencies:** high for Chromium; Firefox/WebKit behavior remains untested.

### WA-20 — P2 — Operations does not clearly distinguish loading, stale data and recovery

- **Category / users / reference:** reliability/status; dispatch/admin/driver; OperationsConsole `empty`, `load`, polling/error state.
- **Expected → observed:** staff know whether zero bookings is real, loading, failed or stale. Initial state renders zero metrics/no bookings before the first fetch. `load()` catches an error without freshness metadata and does not clear a prior error on successful refresh. Previously loaded data remains after session/network failure; users must infer its age.
- **Reproduce / evidence:** source path and F initial/empty authorised views. No production outage was induced; stale/error branches are source-confirmed, not a measured operational incident.
- **Correction / acceptance:** explicit initial loading, last-successful-update time, stale/error banner, retry/re-auth path and safe action availability. Test offline, 403 expiry, 503 and recovery; recovery clears obsolete errors and counts reflect authorised current data.
- **Confidence / dependencies:** high source confidence; add controlled browser-network tests for the complete states.

### WA-21 — P2 — Important local fixes are still absent from production

- **Category / users / reference:** release/SEO/trust; public customers/applicants; deployment/route evidence.
- **Expected → observed:** advertised capabilities and approved local content are released consistently. P returns 404 for cruise, hourly hire and thank-you; sixteen aliases are duplicate 200 pages; prototype-like unknown slugs return 500; robots prefixes block public driver/partner applications. P has older title/content, no new structured data/phone/cookie UI. L fixes those items but is not the deployed revision.
- **Reproduce / evidence:** compare L/P route JSON and deployment SHA against initial working-tree inventory. P normal unknown routes do correctly return 404. The old live site was not observed loading GA, so absent consent UI is **not** evidence of unlawful tracking.
- **Correction / acceptance:** release a reviewed, versioned change set only after blockers are fixed; rerun canonical/alias/application crawling, new route, 404, contact, consent and thank-you checks on the exact hosted build. Canonicalise or restrict the indexable alternate Vercel host.
- **Confidence / dependencies:** high; deployment is a later implementation/release action, not authorised by this audit.

### WA-22 — P2 — Live mobile service heroes exceed the lab LCP target

- **Category / users / reference:** performance; mobile visitors; older deployed service image delivery.
- **Expected → observed:** target LCP ≤2.5 s; P airport measured **2.704–3.356 s**, tours **3.140–3.216 s** under the recorded lab conditions. Images render around 348 px but use 1,774/1,536 px originals, 182,830/256,132 bytes. L responsive images use 22,466/34,166 bytes and corresponding lab samples were below 2.5 s.
- **Reproduce / evidence:** [performance.json](output/website-audit/performance.json), three cold-context runs per route. This is **not** field p75 or proof of a production CWV failure; deployment/network/cache/host conditions differ.
- **Correction / acceptance:** preserve local responsive-image improvements through release, retest hosted pages under the same lab conditions and collect suitable field LCP/INP/CLS. Investigate remaining critical-path resources if targets are missed. No invented Lighthouse score or field INP.
- **Confidence / dependencies:** high for recorded measurements; impact on real traffic requires field data.

### WA-23 — P2 — Offline help overpromises availability and omits the useful phone channel

- **Category / users / reference:** support/trust; disconnected travellers; `public/offline.html`.
- **Expected → observed:** offline support reflects confirmed booking hours and offers a usable phone link. The page says “Operations is available 24/7” and offers only email; the authoritative source says **Bookings open 24/7** and supplies a phone. Offline email may not send until connectivity returns.
- **Reproduce / evidence:** visit online, allow service-worker installation, set browser offline, navigate to Manage Booking. [offline-390.png](output/website-audit/offline-390.png) and manual JSON. Cache itself correctly contains only offline page/icons.
- **Correction / acceptance:** use verified phone/email and booking-hour language; keep the truthful no-offline-actions notice and emergency guidance. Confirm click-to-call, reconnect/retry, service-worker update and no sensitive caching on a device.
- **Confidence / dependencies:** high; owner must separately approve actual support response commitments.

### WA-24 — P2 — Staff sign-in loses the workspace destination

- **Category / users / reference:** information architecture/authentication; staff; StaffAccessDenied and SignIn.
- **Expected → observed:** a driver/dispatcher signing in from their protected workspace returns there. The denial component links to bare `/sign-in`; successful SignIn defaults to `/account`. Customer account has no role-workspace navigation. Driver-offer email text asks the driver to sign in but does not provide the actual workspace URL.
- **Reproduce / evidence:** open protected `/driver` without session → Sign in; inspect destination and source default. I verifies staff sessions can be issued, but a real hosted staff login was unavailable.
- **Correction / acceptance:** preserve validated internal `next` routes, provide appropriate role destinations and deep links in authorised staff notifications. Test all four roles and expired assurance without exposing extra permissions in the backend.
- **Confidence / dependencies:** high source/entry-link confidence; end-to-end hosted staff login required.

### WA-25 — P1 launch gate — Recovery execution, monitoring and restore readiness are unverified

- **Category / users / reference:** production readiness; customers/operations/owner; `vercel.json`, jobs/notifications, deployment/runbooks.
- **Expected → observed:** a monitored scheduler executes recovery; failed deliveries/refunds/at-risk trips have owners; backups restore. Source has no Vercel cron schedule in `vercel.json`. A supplied external scheduler may exist, but was not available to inspect. Vercel drain inspection returned **404/not_found**, so it proves neither active monitoring nor its absence. No restore rehearsal, retention schedule or incident/access-removal exercise was supplied. Current risk alerts cover awaiting-dispatch/offered work, not every overdue review/payment state.
- **Reproduce / evidence:** source and [readiness-limitations.json](output/website-audit/readiness-limitations.json). I job execution proves logic in the test process, not a production invocation.
- **Correction / acceptance:** record scheduler mechanism/frequency and recent successful authenticated runs; demonstrate retry/offer expiry/failure alert ownership; define overdue review/payment handling; restore a backup into an isolated DB and check private-file recovery/retention. Use approved staffing/response policies rather than invented deadlines.
- **Confidence / dependencies:** partial verification. This is a release evidence gate; named dependencies are scheduler/monitoring access, backup evidence and owner operational sign-off.

### WA-26 — P2 — The required lint check currently fails

- **Category / users / reference:** engineering/release; maintainers; `.local/catalog-project-images.mjs:45`, `eslint.config.mjs`.
- **Expected → observed:** `pnpm lint` exits 0 on the intended repository scope. It exits 1 for unused `thumbnail` in an existing ignored local image-catalog script. This existed before the audit; no application lint failure was demonstrated by this output. Git ignore does not automatically define ESLint scope.
- **Reproduce / evidence:** [lint.log](output/website-audit/lint.log). Other required checks/build outcomes are recorded below.
- **Correction / acceptance:** fix that local script or deliberately define/exclude generated/local tooling scope without weakening application accessibility/hooks rules. Rerun exact lint command; preserve unrelated user artifacts.
- **Confidence / dependencies:** high, reproducible local failure. Remote CI results not inspected.

### WA-27 — P3 — Launch runbooks still contain superseded activation instructions

- **Category / users / reference:** documentation/operations; deployer/owner; README, ARCHITECTURE, LAUNCH-CHECKLIST, DEPLOYMENT-AUDIT, CHANGE-REPORT.
- **Expected → observed:** the current launch procedure consistently identifies Vercel/Turso/private Blob, correct sender domain/phone and pay-after-driver lifecycle. Several historical documents still direct Cloudflare provisioning, `.dev.vars`, old sender-domain statements, unpublished status or missing phone. README points to Vercel but its development paragraph remains Cloudflare-oriented.
- **Reproduce / evidence:** contradictions table in A; compare with `lib/business.ts`, config/adapters and Vercel evidence. These reports should remain historical records rather than silently being treated as active runbooks.
- **Correction / acceptance:** publish one current dated activation/recovery runbook, link archival reports as history, document Next environment loading and actual scheduler/migration/restore steps. A new operator should complete the release rehearsal from it without selecting the wrong hosting path.
- **Confidence / dependencies:** high; owner/operator review needed for the operational facts.

### WA-28 — P3 — Customer status and vehicle labels expose internal identifiers

- **Category / users / reference:** content/polish; returning customers; `app/ManageBooking.tsx:11`.
- **Expected → observed:** customer text uses service names and meaningful status explanations. B rendered “Audit Passenger · **xl** · $151.77” and a standalone “review”. Other nearby explanatory copy is helpful, so this is not a task blocker.
- **Reproduce / evidence:** [manage-production-ui.json](output/website-audit/manage-production-ui.json), [manage-authorised-390.png](output/website-audit/manage-authorised-390.png).
- **Correction / acceptance:** use a shared customer-facing label map (Van, Checking requirements, Waiting for a driver, etc.), retain precise internal enums in storage, and test all lifecycle states for consistent wording.
- **Confidence / dependencies:** high; consolidate with journey/status-copy improvements.

## D. Design, UX, accessibility and reliability assessment

### Clarity and visual design

The established identity is suitable for a transport service. Large headings, restrained colour blocks, a recognisable logo and consistent filled-green actions create a coherent hierarchy. The desktop booking form is prominent; mobile uses a shorter hero and a visible booking link. The more compact help/policy/application templates avoid repeating a scenic hero everywhere. These patterns should remain.

Public baseline layouts, landscape/text-spacing samples, media ratios and rendered images were sound within the tested scope. No public-page browser exceptions were captured in the L route sweep. Page length is considerable on service pages, but the contents are useful decision support, not a reason to add decorative sections. Avoid a wholesale redesign; prioritise contrast, complete summaries, reliable focus and recovery.

The principal visual defects are **state-related**: low-contrast secondary information, a selected/focused distinction missing in tour cards, fading content during scrolling and authenticated layouts that the anonymous site view does not reveal. Screenshot examples and viewport measurements are attached to those findings. Aesthetic choices such as exact radius or scenic illustration style are preferences, not release defects. The images do not establish actual fleet makes or service history; obtain authorised genuine fleet/pickup photos if the owner wants those claims.

### Information architecture and content

The eight service intents are distinguishable locally: transfer, touring, accessible review, corporate enquiry, cruise itinerary and retained hourly van hire have different next steps. Public navigation groups the main travel/help destinations well, with related links and footer access to support/policies. A partner applicant currently relies more on sitemap/direct discovery than a visible public entry; add a sensible partnership link if recruitment is an objective.

Remaining ambiguity concentrates around **final quote versus guide versus reviewed request**. Hourly guide conditions are explicit and separate from the transfer engine. Transfer review copy and quote hold wording need correction. The rate transition just above 95 km is substantial: one isolated same-duration comparison changed the Van fare from NZ$403.97 at 95 km to NZ$583.91 at 95.1 km. The formula and public long-distance factor explain the calculation; this is an **owner pricing-policy question**, not proof of a wrong charge. Confirm the intended threshold, rounding, fee coverage, GST basis and how changes are agreed.

NZ language/currency and server-side Pacific/Auckland scheduling are present. Server DST handling rejects invalid/repeated wall-clock times rather than silently selecting an offset. Customer scheduling instructions, quote-zone display and some ISO/raw labels remain weaker. Bookings open 24/7 must not become a guarantee of immediate staffed response, instant availability or continuous tracking.

### Accessibility assessment

Baseline: [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/). Automated results are a set of findings, not a conformance certificate. [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) were assessed with actual rendered styles and keyboard inspection.

| Area | Evidence / assessment |
| --- | --- |
| Language/headings/landmarks/labels | `en-NZ`, main/header/footer and one H1 per inspected normal page. Labels and native details are used. Protected denial screens differ from authorised templates. Axe incomplete/manual-review items are retained in JSON. |
| Keyboard | Home skip link receives first Tab visibly; autocomplete arrows/Enter/manual fallback and Escape work in the sampled case. Native cookie dialog focuses Close and Escape dismisses. Tour focus, step transitions and selected-mode semantics fail as described. |
| Errors/status | Alerts/status regions exist in address results/forms, and quote results receive focus. Not every status/focus change was tested with a screen reader. Current shared error summaries should gain field association/clear recovery during implementation. |
| Contrast/non-colour | Stable informative text failures and scroll-opacity failures recorded. Do not count decorative ordinals as critical contrast defects. Vehicle/rating selections include text/shape as well as colour, but keyboard focus still needs its own visible state. |
| Reflow/text | All 27 anonymous L candidates fit six widths. Twenty representative text-spacing/landscape cases fit, including 320 CSS px reflow. All four authorised staff roles fail narrow widths. Browser UI 200%/400% zoom and OS text enlargement remain untested. |
| Touch targets | Main buttons/form controls are generously sized and labels extend checkbox targets. No complete manual target-spacing certification was performed; tour remove controls, dense footer/navigation and real touch behavior require device checks. |
| Motion | Essential content was mostly made immediately visible, but nested scroll-timeline animations survive reduced-motion settings. Source/samples recorded; no animation-related conformance claim. |
| Images/maps | Decorative panorama has empty alt; informative route/tour imagery has descriptive alt. Booking can be entered without a visual map; location link is optional. Actual chart/map interpretation with assistive technology was not tested. |
| Authentication | OTP supports paste/one-time-code input; no CAPTCHA/puzzle observed. Expiry/recovery and role return paths are incomplete. Real screen-reader authentication testing remains blocked. |
| Assistive technology | **BLOCKED:** no NVDA/JAWS/VoiceOver/TalkBack session supplied/tested. Test real announcements, focus, reading order and modal/autocomplete behavior before AA sign-off. |

### Performance and network reliability

Targets are LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1, with suitable field assessment at the 75th percentile by device class. [Google's Web Vitals guidance](https://web.dev/articles/vitals) distinguishes field assessment from lab diagnosis. No field dataset was obtained; **INP and field p75 remain unverified**. Long tasks are recorded as diagnostics, not substituted for INP.

Lab conditions: headless Edge, fresh context per URL/run, 390×844, DPR1, 4× CPU slowdown, 150 ms artificial latency, 1.6 Mbps download/750 kbps upload; three runs per route/environment. Other audit tasks shared the host. Initial-load samples exclude a complete customer session.

| Page | L LCP range, seconds | P LCP range, seconds | CLS in these samples |
| --- | --- | --- | --- |
| Home | 1.976–2.380 | 1.652–1.956 | 0 |
| Airport | 1.716–1.824 | 2.704–3.356 | 0 |
| Tours | 1.888–2.088 | 3.140–3.216 | 0 |
| Manage booking | 1.692–1.792 | 1.264–1.340 | 0 |

A zero sampled CLS does not establish whole-session stability. Service image sizes and JS resource/long-task evidence are saved in performance JSON. Font delivery uses the site's system stack in inspected CSS; no unnecessary remote font requirement was observed. Local responsive-image optimisation is measurable; real-world improvements after release must be measured on that deployed build.

Provider timeouts exist for routing, payments and email. Source/API tests show safe generic 503/502 responses and preserved canonical records on selected retry paths. Runtime booking UI needs stronger quote error recovery; operations needs explicit stale state. No custom application error boundary was found, so unexpected render failures fall back to framework behavior. A controlled failure of a hosted database/page render and its support recovery remains a required staging test.

### Security, SEO, privacy and operational boundaries

- **Observed protections:** no-store/noindex on customer/private surfaces; matching-email/token guest access; HttpOnly/Secure/SameSite session issuance; recent staff assurance and roles; same-origin mutation checks; bounded request bodies; rate-limit logic; private upload access/type/signature/size checks; CSP, no-referrer, frame/content-type/permissions headers. Production includes HSTS. These are bounded observations, not a penetration-test result.
- **Location/log/storage privacy:** fragment tokens avoid server query strings and are moved into session storage in normal operation. Manage Booking's storage operations are less guarded than thank-you; storage-denial/private-mode behavior needs an explicit test. Booking references are not authentication; no passenger details were deliberately placed in analytics. The cross-trip location leak is a concrete exception to the intended access boundary.
- **Caching:** service worker cache contains only offline HTML/icons; private API/customer/staff data was not found in that cache. Full authenticated production CDN testing is blocked by access. Public static home configuration is build-sensitive; rebuild after relevant environment changes.
- **Consent:** rerun suite used the real Google tag with collection endpoints intercepted. It passed pre-consent silence, remembered decline, withdrawal/cookie cleanup, essential-cookie preservation, cleaned public page URLs and private-route exclusion. Actual GA4 account processing/retention/sharing settings are unverified. There is no verified-payment conversion event; a thank-you load must not be counted as a purchase.
- **SEO:** L has descriptive unique titles/canonicals, public sitemap and matching JSON-LD without invented address/ratings. P is older; production differences are in WA-21. Search Console ownership, Google-selected canonicals, actual indexing, rich-result/schema validators and social-platform fetches remain unverified. No ranking gain is claimed.
- **Operations:** no full business continuity/restore exercise, production load test or real mailbox/payment/compliance-provider cycle was completed. Failed notifications have outbox state and retries but need monitored ownership/replay procedures. There is no reason to infer settlement, payroll, automatic airport monitoring or staff service commitments from UI copy.

### Repository check outcomes

| Exact check | Outcome | Evidence / interpretation |
| --- | --- | --- |
| `pnpm test` | **PASS, 53 tests, 0 failed/skipped** | [test.log](output/website-audit/test.log). Real handlers/local or in-memory adapters; mocked providers. |
| `pnpm typecheck` | **PASS**, repeated after restoring generated declarations | [typecheck.log](output/website-audit/typecheck.log), [typecheck-final.log](output/website-audit/typecheck-final.log). |
| `pnpm lint` | **FAIL, exit 1**, one unused variable in existing `.local/catalog-project-images.mjs:45:84` | WA-26. No audit application edit caused it. |
| `pnpm build` inside sandbox | **FAIL** | CSS/Turbopack worker startup failed under Windows sandbox. |
| `node node_modules/next/dist/bin/next build` inside sandbox | **FAIL**, same class | Not counted as an application regression. |
| Direct Webpack build inside sandbox | **FAIL**, EPERM creating `.next/server/app/api` | Filesystem/process environment restriction. |
| `node node_modules/next/dist/bin/next build --webpack` outside sandbox | **PASS** | [build-webpack-unsandboxed.log](output/website-audit/build-webpack-unsandboxed.log). This is the build used for L browser evidence. |
| **Exact `pnpm build` outside sandbox** | **PASS**, production Turbopack build | [build-unsandboxed.log](output/website-audit/build-unsandboxed.log). Confirmed after browser checks; original build failures are environment-specific. |
| `git diff --check` | **PASS** | [diff-check.log](output/website-audit/diff-check.log). |
| Additional API probes | 8 scenario groups; location failure, pricing question, six bounded passes | [additional-api-probes.json](output/website-audit/additional-api-probes.json). |
| Recovery probes | 5 scenario groups **PASS** | [recovery-api-probes.json](output/website-audit/recovery-api-probes.json); separate failed-refund-object probe **FAIL**. |
| Queue-window probe | **FAIL reproduced** | One active record hidden by 200 newer closed fixtures. |
| Thank-you/review browser rerun | **PASS** at 320/390/1440 | [thank-you/verification.json](output/website-audit/thank-you/verification.json); synthetic API responses, not a provider transaction. |
| Consent/real-tag browser rerun | **PASS** at 320/390/1440 | [consent/verification.json](output/website-audit/consent/verification.json); measurement requests intercepted. |

Runtime was Node **24.16.0**, available pnpm **11.25.0**; repository packageManager/CI pins **11.16.0**. No dependency install/update was made. `.github/workflows/verify.yml` exists and runs frozen install, tests, typecheck, lint and build on push/PR using Node 24/pnpm 11.16.0. Remote run results and whether deployment is gated on them were not inspected; a successful Vercel build alone does not establish CI or operational acceptance.

## E. Actionable completion plan

Effort is a rough engineering estimate for implementation plus focused local regression testing: **S** about 0.5–1 day, **M** 1–3 days, **L** 3–5 days. Provider/business approvals and device scheduling are elapsed dependencies, not included. Shared work is consolidated; do not add every estimate as independent work or treat it as a commitment.

### Release blockers

| Work package / findings | Acceptance criteria | Dependencies / effort |
| --- | --- | --- |
| **Privacy/authentication repair — WA-01/02** | Assignment-scoped location with completed-token regression; real logout from every surface revokes session/assurance and old-cookie replay fails | Review data-access contract and all roles; **M** |
| **Refund exception lifecycle — WA-03** | Persist provider refund state/ID; handle immediate and later failure; reconcile overdue pending states; visible finance exception/alert; idempotent retry and duplicate/out-of-order events | Stripe test account/webhook plan, owner refund policy; **M–L** |
| **Operational journey integrity and queue — WA-06/07** | Shared full journey/requirements summary for review/acceptance; active older work survives >200 newer records; server search/totals/pagination and complete/scoped exports | Dispatcher review and representative data; **L** |
| **Activate a separated staging environment — WA-04/05** | Verified DB/migrations, private Blob round trip, named staff roles/TOTP/provider scope, test Google/Resend/Stripe; all wrong-role/access tests pass | Owner/platform/provider access; **M** setup plus external lead time |
| **Operational recovery and business sign-off — WA-25/05** | Authenticated scheduler run evidence; notification/refund/overdue work ownership and alerts; backup restored into separate DB; current operator/policies/permissions and actual fleet approved | Owner, qualified legal/transport advisers, scheduler/monitoring/storage; **L** rehearsal plus external approvals |
| **Release gate and exact build — WA-26/21** | Exact lint/test/typecheck/build green in intended CI; review/version user changes; deploy a tested preview, run provider-backed acceptance, then approve production release and verify public differences | Blockers above; **S–M** engineering plus owner release decision |

Do not “fix” activation by granting broad staff roles, disabling MFA, permitting live test transactions or declaring manual enquiries confirmed. Keep truthful request/contact behavior until the entire agreed service chain has evidence.

### Important improvements

| Work package / findings | Acceptance criteria | Dependencies / effort |
| --- | --- | --- |
| **Booking review and canonical requirements — WA-09/10/11/12/28** | Complete editable final review; true review reason; terminal persists correctly; NZ time/window/expiry/requote copy; friendly customer status/vehicle labels | Shared summary with operations work; approved fare/requirement language; **M** |
| **Failure and authentication recovery — WA-13/14/24** | Prefilled enquiry/retry after configured-provider failure; resend/change-email without reload; correct staff return/deep links; no lost inputs or duplicate requests | Rate limits, provider mocks, staff roles; **M** |
| **Accessibility states and tokens — WA-15/16/17/18/19** | Named links; contrasting meaningful text; visible focus on hidden inputs/cards; focus follows steps; programmatic selected state; no reduced-motion scroll fade; axe plus manual/AT rerun | Include all responsive/role templates; **M–L** plus AT participant scheduling |
| **Authenticated responsive and stale states — WA-08/20** | All role screens reflow at six widths/long labels; initial loading, last updated, retry/re-auth and stale action behavior verified | Representative roles/fixtures; **M** |
| **Hosted SEO/performance verification — WA-21/22** | New routes/aliases/404s/robots/phone/schema/consent match exact release; mobile hero variants delivered; lab targets rerun; field collection reviewed | Tested deployment, Search Console/GA4 access; **S–M**, field observation ongoing |
| **Offline support truthfulness — WA-23** | Verified telephone link, booking hours, reconnection and no sensitive cache; physical device test | Confirmed business contact, update service-worker version as appropriate; **S** |

### Further polish

| Work package | Acceptance criteria | Dependencies / effort |
| --- | --- | --- |
| **Current runbook — WA-27** | One dated Vercel/Turso/Blob launch/recovery document; historical reports labelled; correct environment/migration/sender/phone/lifecycle instructions | Engineering + owner sign-off; **S–M** |
| **Public partner discovery** | If recruitment is desired, a meaningful fleet-partnership link is reachable from relevant public content/footer | Owner recruitment goal; **S** |
| **Saved-place reuse** | If retained as a customer feature, offer saved addresses at booking without implying geocoding/availability guarantees | Signed-in booking design; **M**, optional product improvement |
| **Price publishing confidence** | Human-readable rate labels/units, a sample-fare preview and clear confirmation/reversion process; retain reason/version/audit trail | Owner pricing governance; **M**, workflow improvement |
| **Evidence-based content refinement** | Owner-approved genuine fleet/pickup imagery; user research on fare/review/payment understanding; revise only from observed problems | Permissions and real participant recruitment; variable |

## F. Verification and launch checklist

### Engineering acceptance reruns

- [ ] Record an exact versioned revision including the existing local changes; preserve the original changes and review the resulting diff. Audit artifacts must not be mistaken for production fixtures.
- [ ] Run `pnpm install --frozen-lockfile` in clean CI with pinned Node/pnpm; rerun exact test/typecheck/lint/build. Confirm CI results gate the intended release, rather than assuming Vercel's successful build does so.
- [ ] Add meaningful regressions for WA-01/02/03/06/07/11 and recovery states, then rerun existing 53 tests and the isolated probes. Confirm fresh schema and upgrade path, atomic batches and remote-database contention.
- [ ] Verify quote recalculation/expiry, no-fit/capacity, three stops/removal/empty stops, actual ambiguous addresses, manual corrections, route failures and unsupported geography. Confirm final price/guide/manual-review language against owner rules.
- [ ] Repeat immediate/scheduled bookings across NZ DST gap/repeated-hour cases, foreign browser timezone, 15-minute minimum/90-day maximum, browser back/forward/reload, form autofill and blocked storage. Confirm private fragments/session storage do not leak into logs/analytics.
- [ ] Verify repeated/concurrent booking clicks, delayed responses, retry after network loss, idempotency scope and changed-payload rejection. No duplicate booking/payment/outbox side effects.
- [ ] Test every role's loading/empty/error/expired/overdue/rejected states, concurrent staff edits and stale-action conflict recovery. Include >200 newer records, long names/addresses and scoped exports.
- [ ] Exercise compliance admin-only upload/download, size/type/signature boundaries, missing file/bucket, correct private permissions, retention and malware-scanning decision. A code adapter alone is not private-store activation.
- [ ] Induce a safe staging page/database failure and verify error boundary/support recovery. Repeat private-route no-store/noindex and authenticated CDN behavior; inspect cache/storage after signout.

### Provider-backed tests — currently blocked

- [ ] **Google:** actual NZ predictions/place resolution/ambiguous locations, Auckland and North Island road metrics, supported areas, quota/denial/timeouts. Use separate restricted test keys; no production quote records from this audit.
- [ ] **Resend/mail:** verified sender/domain, customer request and secure link, passenger/coordinator ownership, staff OTP, driver offers, payment/cancel updates, failed-delivery retry/dead-letter/replay and inbox delivery. Never use a real customer as a test recipient.
- [ ] **Stripe test mode:** hosted success/cancellation/decline/expired session, delayed/duplicate/out-of-order/tampered webhooks, canonical amount/currency, receipt, cancellation before/during payment, HTTP refund failure, later refund failure, full-refund reconciliation. Verify persisted state and provider objects, not a success page. No real charge or refund.
- [ ] **Turso/Blob:** real preview migrations/schema, multi-request contention, private document round trip and isolated restore; verify backup/file retention and secret scope.
- [ ] **Operations:** named real test staff/customer/provider accounts with least privilege, real authenticator assurance/expiry/recovery, approved test fleet/capabilities and a simulated assignment explicitly separated from live work.
- [ ] **Scheduler/monitoring:** successful authenticated invocation history and alert delivery/replay/ownership; confirm recovery is active on the chosen Vercel plan/external scheduler. Drain API access was inconclusive, not a zero-monitoring result.

### Devices, accessibility and field evidence — currently incomplete

- [ ] Chromium, Firefox and WebKit/Safari against the exact hosted build; install/provide missing test engines. Treat engine emulation separately from physical devices.
- [ ] Physical iPhone/iPad/Android portrait/landscape; native date/time controls, autofill, touch, on-screen keyboard, sticky header/actions, dialog containment and back gestures. Include staff screens, not only public/denial pages.
- [ ] Browser 200%/400% zoom, OS larger text, 320 CSS px reflow, text-spacing overrides, reduced motion, long content/missing media, keyboard focus around sticky header and cookie banner, and all financial/error states.
- [ ] NVDA with Chromium/Firefox and VoiceOver with Safari (plus TalkBack if supported): announcements, labels, OTP/TOTP, autocomplete, review, quote errors, route steps, payment handoff and cookie dialog. Test with real disabled users; do not convert expert simulations into user research.
- [ ] Repeat comparable lab timings after deployment and inspect suitable CrUX/Search Console or consent-aware RUM field LCP/INP/CLS at p75 by device. No field INP target is verified by this report.
- [ ] Search Console ownership/canonicals/indexing, schema validator, social previews, alternate-host redirect/index controls, GA4 Realtime/Tag Assistant and account retention/sharing. Retain welcome-all-ratings review behavior; do not infer a paid conversion from thank-you visits.

### Owner decisions and operational sign-off — blocked pending evidence

- [ ] Confirm operator legal identity, tax/GST presentation, licences/endorsements/insurance, actual vehicles/equipment and authorised airport/port pickup instructions with qualified advisers. This technical audit provides no legal approval.
- [ ] Approve fares/thresholds/allowances, waiting/delay/cancellation/refund terms, hourly-guide economics, extended/return itinerary handling and what requires review. Define coordinator/passenger communications and service-animal/equipment handling without inventing capabilities.
- [ ] Confirm **booking hours versus staffed support hours**, urgent escalation, missed-driver/overdue-review/unpaid-accepted-trip procedures and who owns every exception. No response-time guarantee was supplied or assumed.
- [ ] Approve privacy retention/deletion/export/identity verification, location lifetime, incident/breach response, staff access removal and private-document malware handling; demonstrate the required operations.
- [ ] Review and approve the concrete tested release only after the above evidence is available. No deployment or promotion was performed in this audit.

### Requirement closure ledger

| Request section | Disposition |
| --- | --- |
| 1. Source of truth | **Verified inspection**, with live/local architecture and revision split established; provider/business/operational facts explicitly **blocked** where not supplied. |
| 2. Complete coverage inventory | **Verified discovery/inspection:** 27 page candidates, 16 aliases, 13 API routes, analytics/metadata/assets/errors; matrices above account for each. Authenticated hosted states remain **blocked**. |
| 3. Complete customer journeys | **Partially verified:** real rendered steps, isolated persistence and API/payment lifecycle tests; named provider/device/user-research dependencies remain. |
| 4. Visual/interaction quality | **Partially verified**, objective defects documented with viewports/screenshots; no aesthetic redesign requirement invented. |
| 5. IA/content/business consistency | **Verified inspection** with failures and historical contradictions; qualified legal/operational approval **blocked**. |
| 6. Booking/pricing/payments | **Partially verified** through F/B/I/S; actual provider-backed hosted lifecycle **blocked**; no real charges/refunds/assignments/messages. |
| 7. Accounts/workspaces | **Partially verified** through seeded roles, scoped APIs and responsive staff UI; real production accounts/provider uploads **blocked**. |
| 8. Accessibility | **Partially verified with failures**; axe/manual keyboard/contrast/reflow/motion combined. Real screen reader/full AA conformance **blocked**, not claimed. |
| 9. Responsive/cross-browser | Six widths plus representative landscape/text-spacing and authenticated layouts **verified within Chromium**; physical devices, browser zoom and other engines **blocked**. |
| 10. Performance/reliability/checks | Exact repository checks and 24 lab page runs recorded; lint **verified failure**; field p75/INP, load/recovery rehearsal **blocked**. |
| 11. SEO/trust/privacy/release | **Partially verified**, including live/local headers/SEO, consent and storage; external account settings, monitoring/backup/business sign-off **blocked**. |
| 12. Report/completion plan | **Delivered:** A–F, prioritised evidence, acceptance conditions, consolidated effort/dependencies and required reruns. |
| 13. Strict completion | **Applied:** no claim of complete accessibility or production readiness. Implementation, production writes, real transactions, legal approval, penetration testing and formal user research are **out of scope** for this review. |

**Recommended order:** repair privacy/logout/refund handling; make dispatch data and queues dependable; activate and prove isolated provider/staff/storage/recovery workflows; resolve booking/accessibility/mobile issues; rerun checks and hosted acceptance; obtain owner approvals; release the tested version and verify its public SEO/performance/consent behavior.
