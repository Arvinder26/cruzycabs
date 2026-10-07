# UI and booking experience update — 4 October 2026

## What changed

- Made booking the main navigation action. Header, service and footer booking links go directly to the journey form.
- Shortened the mobile hero and removed decorative route/proof blocks from that viewport. Added a visible Start my booking link.
- Reduced airport shortcut clutter with expandable terminal choices; selected terminals still populate address and flight fields.
- Standardised type hierarchy, readable line lengths, green/neutral colours, rounded cards, spacing, field sizes, touch targets and focus states.
- Rewrote customer copy across service, pricing, support, terms and privacy pages. Removed technical implementation language from the primary page descriptions.
- Gave support/policy/application pages compact text-first heroes instead of repeated decorative travel images.
- Rebuilt Help with distinct booking management, contact and lost-property actions plus keyboard-operable FAQs. Fixed the previous Manage booking link which opened the enquiry form.
- Improved enquiry form labels/placeholders, error/success presentation, privacy guidance and the submitted confirmation state.
- Added required passenger fields and changed the payment CTA to Continue to secure payment. Kept the distinction between a request and confirmed travel.
- Refined booking management/account form styling, tour/service layouts and staff panel controls.
- Removed entrance animations that delayed the visibility of essential controls and page content.

## Verification

19 public/customer routes returned HTTP 200. TypeScript, lint, production build and the existing 21 API/domain tests passed. Browser checks covered desktop Help, FAQ expansion, mobile homepage, direct booking navigation, airport selection, private tours and booking management. Saved screenshots are in outputs/.

Live online quoting/payment remains dependent on configured provider credentials. Conversion improvement has not been measured. The next evidence after launch should be completed booking rate, abandonment by step, device split, form validation failures and route/provider failures; no fabricated reviews or booking claims were added.
