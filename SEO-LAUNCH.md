# Search visibility launch checklist

Updated 27 October 2026. Full findings, keyword map, profile drafts, verification and 30/60/90-day plan: [SEO-AUDIT.md](SEO-AUDIT.md).

Owner confirmed **cruzycabs**, **https://cruzycabs.co.nz**, **027 266 1398**, **24/7 booking hours**, cruise transfers and **van-only hourly hire**. The eight commercial pages now have practical server-rendered details, questions, related links and booking actions. No vehicle availability or immediate staff-response guarantee is implied.

Hourly guide: **NZ$120/hour including GST**, three-hour minimum, 30 km per booked hour, NZ$2.50 per extra km. Extensions and additional charges need agreement. Full conditions on `/hourly-van-hire`; operations reviews every itinerary. Check driver/vehicle/fuel/insurance costs before accepting hire at the guide price.

## Production checks

1. Review service content, hourly guide/conditions, actual vehicle/luggage fit, wheelchair equipment/dimensions, child-seat provision, coverage, lead times and waiting/delay policy. Supply real fleet/pickup photos and authorised airport/port instructions; no home address. Complete the existing legal operator, terms/privacy and operational activation requirements in the project launch/deployment guides.
2. Deploy to the existing `cruzycabs` project with production `SITE_URL=https://cruzycabs.co.nz`, `SITE_INDEXABLE=true` and `SUPPORT_PHONE=0272661398`. Configure settings **before building**; static metadata changes require rebuilding. Use `SITE_INDEXABLE=false` on test hosts and keep previews protected. Vercel preview/development opts out automatically.
3. Confirm public HTTPS access without login/share links. Permanently redirect HTTP/www/alternate hosts to the HTTPS apex, preserving paths and query strings. No hosting or DNS changes were made here.
4. Run `node scripts/verify-seo.mjs https://cruzycabs.co.nz` after deployment. Verify a real configured enquiry and full booking/driver/payment flow using test-mode procedures before opening live sales; SEO checks do not require real charges. Live production still has old robot prefix blocks until deployment.
5. Verify a Search Console Domain property using Google's supplied DNS TXT record, or an HTTPS URL-prefix property with the supplied `GOOGLE_SITE_VERIFICATION` HTML token and rebuild. Submit `https://cruzycabs.co.nz/sitemap.xml`; inspect home/eight service pages and record Google-selected canonical/indexing reasons. Request indexing as appropriate without promising dates.
6. Test deployed schema in [Schema.org Validator](https://validator.schema.org/) and [Google Rich Results Test](https://search.google.com/test/rich-results). Service has no dedicated Google rich-result feature; supported Organization/Breadcrumb enhancements are not guaranteed. No invented address, rating, review or subsidy data.
7. Check deployed mobile PageSpeed Insights and Search Console/CrUX field data. Local image savings and timings are lab diagnostics; low-volume pages may have no field data.

## Local discovery and trust

- Find and claim the legitimate existing Google Business Profile before creating another. Use cruzycabs and 027 266 1398 consistently; do not add keywords to the name.
- Confirm eligibility/address policy. If customers are not received at a staffed business location, use the correct service-area setup and hide the private address. No fake offices, virtual-office locations or duplicate suburb profiles.
- Choose actual available NZ categories matching operations; transport service is a candidate primary category. Add confirmed service entries from the audit only. Specify genuine service areas, booking hours and holiday/special hours accurately.
- Website: `https://cruzycabs.co.nz/`; booking link: `https://cruzycabs.co.nz/#journey-form`. Keep name/phone/domain consistent across legitimate listings.
- Upload real current fleet, accessible-equipment and pickup photos with permission. Review the description/service drafts in the audit before publishing.
- Request honest reviews through the normal authorised customer process; welcome all ratings, use no incentives/gating, and respond without revealing journey details.
- Build relevant Auckland accommodation, cruise visitor, business and tourism partnerships. No purchased ranking links, bulk directory submissions or unauthorised outreach.

## Content priorities

Maintain one page per intent using the audit map. Add verified operational guidance and real photos before expanding location coverage. Create destination pages only with actual service evidence and useful distinct content; avoid repetitive suburbs and unsupported cheapest/best claims.

## Measurement

Search Console account data was unavailable. Export last 28 days/previous 28 days for Web search, NZ, query/page/device; separate brand/non-brand and record actual dates. Connected Vercel Web Analytics returned **404 “Web Analytics not found”**, even with verified team scope. These baselines are unavailable, not zero.

The owner has now selected **Google Analytics G-1RCJ5G2SKB**. The repository includes consent-gated public-page measurement, accept/decline controls, remembered cookie preferences and a footer settings dialog. See [ANALYTICS-COOKIES.md](ANALYTICS-COOKIES.md) for deployment/account checks. It is not live until deployed. No purchase event is added merely by visiting the thank-you page. Define persisted enquiries, booking requests, payment success and completed journeys separately with deduplication; phone clicks remain proxies. Private pages, tokens, query strings and passenger/journey details are excluded from the new page-view tracking.

Review relevant clicks, qualified organic enquiries and completed bookings monthly; follow the evidence-based 30/60/90-day plan in the audit. No rankings or indexing timeline are guaranteed. Production pages were read through Vercel, but deployment, external profiles, DNS, Search Console submissions and messages remain owner actions.
