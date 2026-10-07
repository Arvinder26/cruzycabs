# cruzycabs architecture

Vinext/React routes run on a Cloudflare Worker with D1 persistence and private R2 compliance storage. Public pages, guest management, customer accounts and protected driver/dispatch/admin/partner workspaces share canonical stored booking records.

## Booking and payments

Google supplies road distance and duration. Validated journey data and integer NZD-cent fares are stored with an expiring quote and hashed access token. Booking consumes the stored quote rather than trusting client prices or route edits. Duplicate requests return the same booking and Stripe Checkout session. Review requests require operations approval before payment.

Stripe Checkout collects card details outside this application. Raw-body signed webhooks are checked for freshness, matched to canonical PaymentIntent amount/currency and applied idempotently. Paid requests await dispatch; driver acceptance confirms travel. Cancellation uses idempotent refunds, with recoverable pending states and scheduled retries. Guest management uses a signed opaque token in the URL fragment, moved into session storage; email/reference alone cannot grant access.

## Identity and operations

Email OTP creates hashed, HttpOnly cookie sessions. Staff additionally need configured role bindings and TOTP assurance. Provider bindings scope partner records; drivers can change only their own assignments. Fleet onboarding records verification and compliance expiry. Assignment uniqueness and conditional state transitions guard concurrent updates. Admins can review audit records, change versioned rates and upload private compliance evidence.

## Reliability

D1 stores requests, pricing versions, rate limits, sessions, assignments and a leased email outbox. Resend deliveries use idempotency keys and bounded retries. Worker scheduled jobs recover cancellations, expire offers, clean temporary records and alert operations about unassigned trips. Migration files mirror runtime application tables. Offline caching contains only the static offline page and icons, never customer/API data.

## Boundaries

Provider credentials and production infrastructure are supplied through hosting secrets. Local preview bypasses staff sign-in only when explicitly enabled in development. The application does not supply licensing, provider business verification, live airport agreements, SMS, credit accounts or settlements. See LAUNCH-CHECKLIST.md for activation and operational gates.
