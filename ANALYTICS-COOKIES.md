# Google Analytics and cookie choices

Added 27 October 2026 for the owner's Google Analytics 4 measurement ID **G-1RCJ5G2SKB**. **Deployed and verified live on 28 October 2026**; see [RELEASE-2026-10-28.md](RELEASE-2026-10-28.md).

The release also corrects first-acceptance failures caused by small browser/server clock differences. Explicit consent tolerates at most five minutes of clock skew; materially future-dated or expired choices still fail closed. Analytics responses declare inline HTML. Live browser checks with the browser clock two seconds ahead passed with zero download events, no pre-consent requests and successful withdrawal/private-page exclusion. All 65 source/API tests passed; the older validation below records the original 27 October baseline.

## Visitor experience

- The first visit shows **Accept analytics**, **Decline** and **Customise cookies**. Accept and Decline have equal visual prominence. Continuing to browse is not treated as consent.
- Essential sign-in, booking access and cookie preferences work regardless of analytics consent.
- Cookie settings in the footer opens an accessible native dialog. Analytics is optional and initially off. Escape/Close dismisses settings without saving a new choice.
- Accept and decline are remembered in the first-party `cc_cookie_consent` cookie for up to 180 days (version and timestamp; no passenger details). It uses Path=/, SameSite=Lax and Secure over HTTPS.
- Declining after accepting removes the analytics document, stops future tracking and clears accessible `_ga`, `_ga_*`, `_gid` and `_gat*` cookies at host/parent-domain scope. It preserves the secure sign-in cookie and guest booking storage. It cannot undo measurements already sent during consent.
- Choice changes notify other open tabs through BroadcastChannel where supported. If browser storage is blocked, the choice can last only for the current page session; the server still requires a consent cookie before serving any Google code.
- `/privacy#cookies` describes cookies/storage, purposes, expiry and how to change preferences.

## Tracking and privacy

The Google library is completely blocked before acceptance and after decline: no tag preload, Google script or consent-only ping is sent. This follows [Google's basic consent-mode model](https://developers.google.com/tag-platform/security/concepts/consent-mode). The code sets default denied consent, then grants **analytics_storage only**; advertising storage, advertising user data and personalisation remain denied. Google Signals and advertising personalisation are disabled in the tag configuration.

To keep automatic form/history measurement away from passenger input, Google runs inside a separate, minimal first-party document at `/analytics-frame`. It contains no forms or passenger data and has no client-side history changes. It is visually hidden, inaccessible to keyboard/screen-reader navigation and removed on private routes or withdrawal. Its layout avoids artificial automatic scroll events. One manual `page_view` is sent per public route/document; the config's default page view is disabled. Public client-side navigation creates the next minimal document, using the same first-party Analytics cookie.

Only exact known public paths are allowed. The server verifies consent again before returning Google code. Unknown/private paths fail closed. Booking, thank-you, account, sign-in, API and staff routes never load the tag. Full query strings and URL fragments are not forwarded. Referring URLs are reduced to an external origin, never a private path/search term. Page titles are derived from fixed public metadata, not customer input. Parent booking forms, reviews, references, contacts, journey addresses and guest tokens are not included in analytics payloads.

Cookie expiry is configured to 180 days without rolling extension. Browser/device metadata and cookie identifiers are still part of ordinary GA4 measurements after consent; this is not an anonymous or cookie-free product. Google may process that data internationally. Google account data retention and sharing are separate settings.

This feature measures public page visits. It does **not** turn thank-you-page loads into purchases or add an Ads conversion. The supplied `G-…` ID is a GA4 measurement ID. Paid-booking conversion tracking needs a separately agreed, deduplicated event based on verified payment; the thank-you page can also represent an unpaid booking request.

## Security and settings

- Main pages retain their restrictive script/network policy. They permit only the same-origin measurement frame; Google hosts are allowed only by that frame's specialised CSP.
- The measurement document is no-store/noindex, has no-referrer, is excluded from the sitemap and permits embedding only by the same origin. Next.js and the legacy Worker apply equivalent policies.
- `GA_MEASUREMENT_ID` defaults to the owner-supplied public ID and supports a valid `G-…` override. `ANALYTICS_ENABLED=false` disables collection. Development and Vercel previews/non-indexable hosts do not collect. Set build-time settings before building; rebuild when they change.
- No new analytics SDK or competing analytics provider was installed. Vercel Marketplace discovery was attempted per integration guidance, but its read-only CLI requests failed to fetch; the already-provisioned Google property explicitly supplied by the owner is used directly.

## Validation and owner checks

All **53 automated tests passed**, including choice parsing/expiry, essential-cookie preservation, public-path allowlisting, sanitised referrers, server-side consent enforcement, preview opt-out and safe tag configuration. Production build, TypeScript and lint passed. Browser verification at 320/390/1440 px passed for the banner, dialog, keyboard dismissal, remembered decline, acceptance, withdrawal, cookie cleanup, private-page exclusion and booking actions while declined. The thank-you/review browser suite also passed with analytics declined. The existing 19-public-page SEO route check passed.

The real Google tag is used in browser tests, with Google Analytics measurement endpoints intercepted so test visits do not pollute the owner's property. Tests inspect the measurement ID, clean page location, denied advertising state and one page view per public navigation. Screenshots and the final browser report are in `output/cookie-consent/`. This verifies browser requests, not processing inside the owner's Google account.

After deployment:

1. Open the site in a fresh browser profile. Before consent, confirm no Google Analytics cookies or tag requests. Decline, reload and confirm the choice is remembered.
2. Use footer Cookie settings, accept analytics, and test the connection with Tag Assistant. Consent must be granted during this test. Confirm the measurement ID is G-1RCJ5G2SKB and public page views appear in GA4 Realtime.
3. Verify that withdrawing consent clears `_ga` cookies and booking/sign-in still work. Check private booking URLs produce no Google requests.
4. Review GA4 account access, data retention and data-sharing preferences. Because collection deliberately uses controlled page views, disable unneeded Enhanced Measurement events in the stream, particularly form interactions and automatic browser-history page changes. The implementation isolates these from the booking UI, but the property should reflect the intended page-view-only scope.
5. Link GA4 to Google Ads and import a correctly defined booking/payment key event only when that separate conversion implementation is ready. No purchase event was added here.

References: [Google consent setup](https://developers.google.com/tag-platform/security/guides/consent), [manual page views and Enhanced Measurement](https://developers.google.com/analytics/devguides/collection/ga4/views), [Analytics cookie/configuration fields](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [Google tag CSP requirements](https://developers.google.com/tag-platform/security/guides/csp).
