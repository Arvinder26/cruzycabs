# Booking thank-you and customer reviews

Added 27 October 2026.

- After a successful booking request, customers open `/thank-you` with their booking reference and private access fragment. The page fetches the authorised booking status rather than assuming a driver or payment is confirmed.
- Successful Stripe Checkout sessions return to this page. Cancelled Checkout returns to Manage booking. A payment return is not proof of payment: the thank-you page checks the booking API and briefly refreshes while awaiting the signed webhook.
- Customers can open Manage booking, pay if the driver has accepted, view a receipt when available, book another ride or contact support. Manage booking also links back to the thank-you/review page, including after a completed journey.
- Public Google reviews open the exact owner-supplied link: https://g.page/r/CSZZqgBpxfztEAI/review. No rating filter or incentive. `GOOGLE_REVIEW_URL` can override the link; an empty/invalid setting hides the Google option.
- The on-site rating and optional comment are **private feedback**, stored as a `review` case in the existing operations Requests view. They are not automatically published as testimonials or sent to Google. Every score from 1–5 is accepted. The server identifies whether the experience concerns booking or a completed journey.
- A private booking token or the booking-email session is required to submit feedback. One review per booking, with safe retries, length/rating validation, rate limiting and same-origin checks. No new database migration is needed.
- Guest tokens remain in URL fragments/session storage and are removed from the visible URL after storage succeeds. The page is noindex/no-store with no-referrer, and stays out of the sitemap. Opening a bare page or unverified reference does not expose booking details.

Validation: all 49 tests passed, including request/payment/completion messages, token placement, Google URL safety, authenticated reviews, invalid scores, repeat/concurrent submissions and Checkout return destinations. Production build, lint, TypeScript and the existing 19-page SEO route check passed. Responsive browser checks exercise 320/390/1440 px with synthetic API responses, including delayed payment notification, one-star feedback, private access and reloads. Evidence/screenshots: `output/booking-thank-you/`. Production requires deployment of this version; no external reviews or live bookings were submitted by the agent.

Review requests welcome all ratings and follow [Google's review-request guidance](https://support.google.com/business/answer/3474122). Google account sign-in and the owner's Business Profile state are controlled by Google; the website does not post a Google review on the customer's behalf.
