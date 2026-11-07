# cruzycabs search and booking audit

27 October 2026 (Pacific/Auckland). Scope: repository implementation, local production build, sampled Auckland search results and read-only production checks through Vercel. Existing uncommitted SEO work was reviewed and retained. No deployment, profile update or third-party message was published.

Subsequent implementation: the owner supplied GA4 ID G-1RCJ5G2SKB, and consent-gated analytics has now been added to the repository. See `ANALYTICS-COOKIES.md`. The original baseline findings below describe the pre-integration audit; actual account reports and production measurement still need deployment/account verification.

## Prioritised findings

| Priority | Evidence before this work | Action/status |
| --- | --- | --- |
| P1 | Live robots disallowed `/driver` and `/partner`, also matching public `/driver-application` and `/partner-fleet-application` in the sitemap. | Public pages now crawlable. Private pages retain authentication, noindex and no-store; crawling permits discovery of noindex. Deploy to fix production. |
| P1 | Live home title was “Book an Auckland ride”; airport title/H1 was “Your airport journey, made easier”. Neither returned JSON-LD. Existing working-tree improvements were undeployed. | Preserved those improvements; added intent-specific descriptions, absolute canonicals, descriptive home H1, visible breadcrumbs and matching schema graphs. |
| P1 | Public pricing listed Car/Executive, but booking rules only offer Van/Accessible. Home said “4 + wheelchair” while accessible quotes cap at 4 passengers. | Removed unavailable pricing factors; corrected capacity wording with actual fit subject to review. |
| P1 | Thin service pages omitted practical timing, luggage, equipment, pricing and inclusion information. | Added original server-rendered details, questions, related links and booking actions to eight commercial pages. |
| P1 | Owner confirmed cruise transfers and van-only hourly hire with no dedicated pages. | Added two distinct service pages, prefilled existing `journey` enquiries, phone/email fallback, home cards and footer links. |
| P1 | Next.js production validation rejected `runJobs` exported from an API route. | Moved the unchanged helper to `lib/jobs.ts`; route handlers and legacy Worker import it. Production build passes. |
| P2 | Mobile service heroes downloaded original 1,774/1,536 px images at about 348 px display width. | Responsive Next Image sizing reduced measured airport/tour image payloads by about 88%/87%. |
| P2 | Public phone absent; 24/7 copy implied general staff availability. | Centralised owner-confirmed number and **booking** hours; added telephone links and schema phone. No guarantee of immediate staff response or vehicle availability. |
| P2 | Search Console token support undocumented in env example; no analytics tag/SDK found. | Documented verification/preview indexing controls. Vercel Analytics query returned “Web Analytics not found”, not zero traffic. No duplicate tracking added. |
| P2 | Lint scanned unrelated generated advertisement scripts in `output/`. | Excluded generated output consistently with existing build exclusions; application/scripts/tests remain linted. |

## Business facts and pricing

Owner confirmed **cruzycabs**, **https://cruzycabs.co.nz**, **027 266 1398** (+64 27 266 1398), booking hours **24/7**, cruise transfers and van-only hourly hire. Repository contact: operations@cruzycabs.co.nz. Existing copy/forms/pricing substantiate airport, local, accessible, corporate, North Island transfer and private tour requests. Online limits are 7 passengers/6 bags for a van and 4 passengers/2 bags for accessible transport; actual chair/vehicle fit needs review.

No address, fleet make, wheelchair dimensions, airport permit/meeting zone, free waiting period, automatic flight tracking, subsidy acceptance, rating, review or licence number was invented. Illustrative travel images do not establish actual fleet or completed journeys.

The owner authorised a reasonable hourly price. Implemented guide: **NZ$120 per van/hour including GST**, **3-hour minimum (NZ$360)**; driver, fuel, booked waiting and **30 km per booked hour** included; extra distance **NZ$2.50/km including GST**. Time begins at agreed pickup; agreed extensions use 30-minute blocks. Applicable parking, tolls, airport/port fees and attraction tickets are additional and itemised. Out-of-area travel, special equipment and travel-to-pickup costs need a specific quote. Every itinerary requires agreement; this is separate from the point-to-point fare engine and does not take automatic payment.

Pricing references: [NZ Intercity Cabs](https://intercitycabs.co.nz/international-visitors) lists an Auckland small van at $120/hour with a three-hour minimum and a different distance allowance; [Corporate Cabs' terms](https://www.corporatecabs.co.nz/wp-content/uploads/2025/07/ccl-terms-and-conditions.pdf) list van hire at $125/hour. Conditions differ. These references support a market guide, not profitability; owner should check driver, fuel, vehicle and insurance costs before accepting an itinerary.

## Keyword-to-page map

Priorities reflect commercial relevance, not invented volumes/difficulty. Research sampled search-engine results and primary operator pages; it was not controlled Auckland Google rank tracking. Rankings vary by location, date and personalisation.

| Priority | Candidate search intent | Canonical page | Boundary |
| --- | --- | --- | --- |
| 1 | Auckland airport transfers; private airport transfer; Airport pickup/drop-off; airport to hotel | `/airport-transfers` | Domestic/international, pickup, luggage, quote. Hotel-airport intent stays here. |
| 1 | Auckland cruise terminal transfers; port to airport/hotel | `/cruise-transfers` | Ship, berth, disembarkation and onward deadlines; no unverified access instructions. |
| 1 | Auckland private driver; hourly van and driver; chauffeur van hire | `/hourly-van-hire` | Van-only retained driver, hourly conditions and enquiry. No sedan/luxury claims. |
| 1 | Auckland corporate/business transfers; staff/client transport | `/business-travel` | Coordinators, recurring travel, separately agreed billing. |
| 1 | Auckland family/group transport; hotel transfers; local rides | `/auckland-rides` | Local point-to-point and actual capacity; no duplicate family/suburb pages. |
| 1 | Accessible/wheelchair transport Auckland; accessible airport transfer | `/accessible-travel` | Equipment/boarding review; no subsidy promises. |
| 2 | Auckland private tours; sightseeing/day trips; North Island private tours | `/private-tours` | Itinerary, pace and inclusions, not a duplicate hourly-hire page. |
| 2 | North Island transfers from Auckland; long-distance private transfers | `/north-island-transfers` | Travel between places, return planning and reviewed quotes. |
| 2 | Auckland transfer prices; fare estimate; van hire price | `/pricing` | Fare factors and a link to hourly conditions. |
| 3 | cruzycabs; cruzycabs Auckland | `/` | Brand and service overview. |
| Support | Changes, cancellation, lost property | `/help`, `/terms`, `/lost-property` | Support existing customers, without competing sales pages. |

No new destination/suburb pages until real operations and distinct useful content justify them. Existing destination examples remain itinerary requests subject to review.

### Competitive observations

- [Prioritylane cruise transfers](https://prioritylane.co.nz/cruise-ship-transfers/) emphasises private port travel and flat pricing. Its sampled main copy gives limited berth/disembarkation detail. Our page asks for both and avoids promising ship-side access.
- [NZ Limo Tours](https://nzlimotours.co.nz/tours) separates Auckland, Rotorua and multi-day touring. Our page addresses private planning with explicit inclusion limits, without copying luxury/destination claims.
- [HappyMobility](https://happymobility.nz/travel-explore/) describes accessible outings and inclusions. Our opportunity is clearer equipment/passenger/bag review before payment; its qualifications and vehicle specifications cannot be inferred for cruzycabs.

These are observations from a sample, not a comprehensive competitor audit or measured ranking gap.

## Technical decisions and eligibility

Absolute canonicals ignore campaign parameters without stripping normal navigation parameters. Sixteen duplicate aliases redirect with HTTP 308 before rendering and preserve query strings. Existing useful URLs remain. Sitemap contains home plus 18 public canonical pages, including both application pages and two new services; no private routes, aliases or artificial modification dates.

Robots permits public content and disallows APIs. Private pages retain noindex/no-store headers, metadata, token/session authentication and no-referrer protection. Robots is not a security mechanism. SEO `SITE_URL` must be credential-free HTTPS. `SITE_INDEXABLE=false` or Vercel preview/development emits noindex, disallow-all robots and an empty sitemap. Configure before **building**, and rebuild static metadata routes after changes; protect previews at the hosting layer too.

Homepage has Organization/WebSite; other pages have Organization and matching visible BreadcrumbList; commercial services have Service with provider and area references. Phone/email are visible. No address, staffing openingHours, reviews, ratings, FAQ markup or invented offers. Organization remains appropriate while a publishable address is unavailable; [Google LocalBusiness requirements](https://developers.google.com/search/docs/appearance/structured-data/local-business) must not be satisfied using a home address or fabricated data. [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization) and [breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) guidance informed the implementation. Service has no dedicated Google rich-result feature. Valid markup does not guarantee supported enhancements will appear. External Google/Schema.org validators remain deployment checks.

Important service details render without JavaScript. Questions use native HTML disclosures; navigation uses real links; images keep dimensions/alt text. Logo preload uses the installed Next.js API. No new fonts/tracking scripts. Policies retain existing professional-review requirements. Implementation follows [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [spam policies](https://developers.google.com/search/docs/essentials/spam-policies); no repetitive doorway content, keyword stuffing, purchased links or ranking/indexing guarantees.

## Measurement and privacy

| Baseline | Actual result | Next step |
| --- | --- | --- |
| Organic impressions/clicks/queries | No connected Search Console data | Verify property; export last 28 days and previous 28, Web search, NZ country, query/page/device splits; separate brand/non-brand. |
| Google indexing/canonical selection | Account data unavailable | Submit sitemap and inspect home/eight commercial pages; record last crawl, selected canonical and indexing reason. HTTP 200 alone does not prove indexing. |
| Google-referred pageviews | Vercel query for 29 September–26 October 2026 returned 404 “Web Analytics not found”, including verified team scope | Owner select/enable one analytics system after checking existing dashboards/tags. This result is unavailable data, not zero traffic. |
| Organic enquiries/completed bookings | No acquisition attribution found | Add privacy-reviewed attribution and conversions after choosing the destination; no invented/backfilled baseline. |
| Real-user CWV | No CrUX/Search Console field dataset obtained | Check deployed PageSpeed Insights and field reports; low-volume URLs may have no field data. |

Proposed event contract: `booking_cta` (service slug), `enquiry_submitted` (after persistence), `booking_requested` (after persistence), `booking_completed` (once after server-confirmed completed journey). Payment success is a separate state. Phone clicks are proxies, not bookings. Deduplicate with the chosen provider's mechanism.

Allow only public paths, enumerated channel/service values and aggregate counts. Exclude names, contacts, addresses/routes, flight/ship details, assistance/medical notes, passenger details, booking references, tokens, query strings and private-page URLs. Disable automatic form capture, session replay and private-page views. Agree consent/attribution policy before implementation; retain operational records in the protected booking system. No tracker was added in this audit.

## Local SEO drafts

Review-only Business Profile description:

> cruzycabs arranges private Auckland airport and cruise-terminal transfers, local rides, business travel and van hire with a driver. Plan family and group travel, request wheelchair-accessible transport, or enquire about private North Island transfers and tours departing Auckland. Share passenger, luggage and assistance needs so the team can review a suitable vehicle. Booking requests are open 24/7. Availability, journey details and the full price are agreed before travel. Call 027 266 1398 or book through our website.

Suggested service entries: airport transfers, cruise transfers, hotel/local transport, corporate travel, family/group vans, accessible transport subject to equipment review, hourly van/driver hire, private tours, North Island transfers. Choose actual NZ editor categories matching operations; transport service is a candidate primary category, not a verified available category. Follow [Google business representation rules](https://support.google.com/business/answer/3038177) and [local ranking guidance](https://support.google.com/business/answer/7091). A verified service-area profile can hide an ineligible customer-facing/home address; do not create fake offices or suburb profiles.

Review-request draft for the owner's existing authorised customer-contact process:

> Thank you for travelling with cruzycabs. If you would like to share your experience, you can leave an honest Google review at [verified profile review link]. Feedback of any rating is welcome. Please avoid including personal journey or passenger details.

No incentives, gating or prewritten positive reviews. Build genuine accommodation, cruise visitor, Auckland business and tourism relationships; earn relevant links through actual partnerships and useful information. No bulk submissions or third-party contact were made. Detailed profile checklist: `SEO-LAUNCH.md`.

## 30 / 60 / 90-day plan

| Window | Priorities | Progress evidence |
| --- | --- | --- |
| First 30 days | Deploy; fix live crawl blocks; complete operator/legal readiness; confirm fleet/equipment and authorised pickup facts; verify GBP/Search Console; establish one privacy-safe analytics system. | Production checks and Google inspection recorded; business facts signed off; profile/address policy correct; actual search/conversion baseline exported. |
| Days 31–60 | Review indexing/query-page data; adjust low-CTR titles where intent matches; add real pickup/fleet photos and guidance; investigate mobile field performance and booking friction; develop relevant partnerships. | Compare dated 28-day periods with seasonality; track qualified enquiries and completed journeys, not only traffic. |
| Days 61–90 | Improve pages with impressions but weak enquiries; review hire margins; add destination content only with operational evidence and distinct demand; request honest reviews through normal customer process. | Report canonical coverage, relevant non-brand clicks and organic bookings where attribution exists. Avoid short-sample causal claims. |

## Verification and files

43 tests passed, including existing pricing, booking, assignment, payment/refund, guest authentication and enquiry flows plus six SEO regressions. Direct Node production builds (standard and clean webpack), TypeScript and full-repository lint passed. Lint excludes generated output. The environment's package-script launcher failed during Turbopack worker startup; direct Node build worked after the route-export repair. Final visual checks use the clean build to avoid stale CSS observed during the first run. `git diff --check` passed.

Route script: 19 public HTTP-200 pages, unique metadata, one H1 each, canonical/social tags, valid JSON-LD, breadcrumbs, phone links, internal links/anchors, 16 HTTP-308 aliases preserving campaign parameters, proper 404s including prototype-like slugs, private noindex/no-store, query canonicalisation, sitemap/robots. Browser script: 15 layouts at 320/390/1440 px, CTA/phone links, navigation, tour/enquiry contact fallback and service content without JavaScript. Evidence/screenshots: `output/seo/`.

Mobile image bytes: airport **182,830 → 22,466**; tours **256,132 → 34,166**. Baseline is unthrottled local **development**; after-run is **production**, 390×844/DPR1. Byte savings substantiate responsive optimisation. LCP values across these modes are not comparable or field CWV. Short initial-load samples observed no overflow/layout shifts; they do not establish whole-session stability or INP. No Lighthouse score or measured ranking gain is claimed.

Content: `lib/service-content.ts`, `lib/business.ts`, `app/ServiceDetails.tsx`, `app/[slug]/page.tsx`, home/help/enquiry/footer components, `lib/customer-page-copy.ts`, `app/globals.css`. Technical: `lib/seo.ts`, `lib/public-routes.ts`, page/layout metadata, robots/sitemap, `next.config.ts`, logo/airport guide, env example, lint config. Build repair: `lib/jobs.ts`, `app/api/jobs/route.ts`, `worker/index.ts`. Tests/tools: `tests/seo.test.mjs`, three `scripts/*seo*.mjs` scripts. Existing uncommitted `app/StructuredData.tsx` and SEO foundations were preserved.

Remaining: deployment; public reachability without share access; HTTP/www redirects; real configured quote/email/payment delivery; Google indexing/selected canonical; external schema tests; GBP state; field CWV. Local API tests use mocked providers/in-memory records. Browser checks use unconfigured contact fallback; they do not send emails, book real trips or charge cards. Production data was not modified.
