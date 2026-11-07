# Launch acceptance checklist

Updated 27 October 2026. Follow [CURRENT-OPERATIONS.md](CURRENT-OPERATIONS.md), the authoritative Vercel/Turso/private Blob activation and recovery runbook. Historical Cloudflare reports are not current setup instructions. Use [WEBSITE-AUDIT.md](WEBSITE-AUDIT.md) for per-finding acceptance and recorded verification.

- [ ] Review/version the exact changes, preserve owner work and run clean pinned install, tests, typecheck, lint and production build in CI. Confirm CI gates release.
- [ ] Provision separated test/production Turso databases and private Blob storage. Back up, apply migrations 0000/0001/0002, verify upgrade and isolated restore, and record retention/ownership.
- [ ] Configure stable signing/jobs/cron secrets without printing them. LOCAL_PREVIEW=false on deployed hosts; correct HTTPS SITE_URL; preview SITE_INDEXABLE=false.
- [ ] Test actual Google Places/Routes success, ambiguous inputs, service bounds, NZ schedules/DST, capacity and provider failures.
- [ ] Verify Resend sender for cruzycabs.co.nz; test only authorised inboxes for request links, OTP, offers, payment/cancellation, exceptions and retries.
- [ ] Verify every staff role with individual TOTP and partner scope. Test wrong-role access, expiry/logout, approved test fleet/equipment and private compliance upload/download.
- [ ] Complete Stripe hosted test-mode success/cancel/decline, expiry, signed/duplicate/delayed events, canonical amounts, receipts and failed/pending/successful refund recovery. Register payment, Checkout, full-refund and refund-created/updated/failed events. No real transaction is an audit test.
- [ ] Demonstrate an authenticated minute scheduler and recorded successful jobs, missed-run/failed-notification/refund alerts and an assigned operational owner. No paid cron is enabled by this repository automatically.
- [ ] Owner/qualified advisers approve legal operator, GST/fare basis, licences/fleet/equipment/insurance, airport/port access, pickup instructions, terms/refunds/privacy, retention/incidents and support staffing. Confirm booking hours separately from response commitments.
- [ ] Explicitly enable BOOKINGS_ENABLED only after acceptance; rebuild. Live Stripe mode/keys/webhook require separate owner-approved provider/business activation. Do not infer activation from a key's presence.
- [ ] Test all role/customer journeys in hosted staging, at six widths and real mobile devices. Include keyboard, NVDA/VoiceOver, zoom, reduced motion, stale/offline/failure states and long content. Do not claim full accessibility from axe alone.
- [ ] Verify hosted new pages, aliases, genuine 404s, robots/sitemap/schema, canonical alternate-host handling, phone/cookie controls and accurate payment status. Test GA4 processing/account privacy separately; a thank-you visit is not a purchase.
- [ ] Record field and lab CWV separately; field INP/p75 and real provider/restore acceptance remain required evidence. Obtain approval before production deployment/promotion, then verify the exact release.

No final sign-off is implied by this checklist or successful local tests. Cash, subsidy integration, automatic credit/invoicing, flight monitoring, continuous background tracking, payroll and settlement remain unsupported; manual enquiries require explicit agreement.
