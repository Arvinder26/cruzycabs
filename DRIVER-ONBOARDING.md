# Driver onboarding update — 28 October 2026

The existing Vercel cruzycabs production site received the driver onboarding update. Source was isolated in `.local/driver-release` from the previously deployed 141-file release package, with only driver-onboarding changes added. The working tree also contains concurrent request-acceptance work; that work was preserved locally and excluded from these deployments.

## Behaviour

- Onboarding stores the optional phone in an additive `app_driver_contacts` table and shows contact and vehicle capacity on driver cards.
- Vehicle records accept up to 16 passengers and 20 bags, independently of the public quote limits.
- Provider may be omitted (defaults to cruzycabs); compliance expiry may be omitted without fabricating a date. Missing expiry keeps dispatch unavailable. Existing dispatch/availability checks remain in force.
- An exact repeat submission returns success for the existing driver and vehicle without creating another record or approval audit. Conflicting email/registration details return a clear 409. A unique-constraint race also returns a clear conflict.
- A successful submission clears the form, opens Drivers, and shows a saved/already-saved confirmation.

## Production evidence

Initial deployment `dpl_Bcd4NqXnMiqdxfnqzx2cgZJ3bcau` was READY and aliased to cruzycabs.co.nz. The owner submitted the filled form after computer use was stopped. The admin driver card subsequently showed the requested driver and KAM247 with contact details and White Toyota Hiace. Approval audit time was 2026-10-28T04:00:13.869Z. Later POST failures were duplicate submissions against the saved record; the same generic 503 was reproduced locally before the duplicate-save fix.

Follow-up deployment: `dpl_BSP33s83LD3nGVK9k7UpaxVR45UP` was READY and aliased to cruzycabs.co.nz; the duplicate-save fix is live.

Verification for the isolated release: 66 tests passed, TypeScript and changed-file ESLint passed, Next.js 16.3.8 Webpack production build passed. Regressions cover the 10/10 vehicle, normalized phone, blank expiry and unavailable dispatch, exact retry with a single record/audit, and conflicting details returning 409.

The user subsequently instructed that the computer screen must not be inspected or controlled. That preference applies to further work. No driver sign-in permissions/authenticator, assignment, notification, charge, or booking activation was added by this update.

## Admin compliance and availability update — 28 October 2026, about 6:54 pm NZDT

Deployment `dpl_2xdwjfN3hcBLXxbyx9ouweZgWDno` was READY and aliased to cruzycabs.co.nz and www. It was staged in `output/deploy-driver-compliance-20261028/source` from the working tree that matched the 6:28 pm production deployment `dpl_3Y5H9ucBCWKLfwMGnpzX18JwcAkx`, plus this change only. Health returned 200; anonymous operations writes return 403.

- Admins can record a driver's compliance expiry (licence / P endorsement) and the vehicle's compliance expiry (earliest of CoF, registration, insurance) separately on the Drivers card. Both must be valid future dates and a document-check confirmation is required. Each save writes a `compliance.updated` audit event.
- Admins can set a driver available, on break or offline. Available is refused until both expiries are recorded and in the future. Changes write `availability.changed` with `setBy: admin`. Dispatch-only staff cannot use either action.
- The owner reported verifying Kulwant Singh's documents; his P endorsement expires 15 June 2031. The vehicle expiry must be entered by the owner from the vehicle documents; no date was recorded by the agent.

Verification: 74/74 tests (new regression for blank/past dates, confirmation, role restriction and availability), TypeScript, changed-file ESLint and Next.js production build passed. No booking gate, assignment, notification or charge was changed.
