import { CookieSettingsButton } from "./CookieSettingsButton";

export function CookiePolicy() {
  return <section className="policy-details section-pad" id="cookies" aria-labelledby="cookies-heading">
    <h2 id="cookies-heading">Cookies and your choices</h2>
    <p>Essential cookies and browser storage support secure sign-in, your private booking access and your cookie preference. These continue to work when you decline optional analytics and ads measurement.</p>
    <h3>Optional Google Analytics and Google Ads measurement</h3>
    <p>If you accept analytics, Google Analytics measures visits to our public pages and basic device information to help us improve the website. The Google tag loads only after you agree. If you decline, we do not load it or send analytics measurements.</p>
    <p>We exclude private booking, thank-you, account and staff pages. Page URLs sent for measurement omit query strings and fragments; referring websites are reduced to their origin. Passenger details, addresses entered in forms, booking references and private access tokens are not passed to analytics.</p>
    <p>The same choice lets Google Ads measure which of our ads lead to booking requests. If you arrive from one of our Google ads, Google’s ad click identifier is stored in a first-party cookie. When you submit a booking request, we tell Google Ads that a booking request happened and its quoted NZD value — never your name, contact details, addresses or booking reference. Advertising personalisation stays off.</p>
    <div className="cookie-policy-table"><table><caption>Browser storage used by this website</caption><thead><tr><th scope="col">Storage</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead><tbody>
      <tr><th scope="row">cc_cookie_consent</th><td>Remembers accept or decline; essential.</td><td>Up to 180 days.</td></tr>
      <tr><th scope="row">cc_session</th><td>Secure signed-in session; essential and inaccessible to page scripts.</td><td>Up to 7 days. Admin browsers stay signed in until sign-out, with a cookie renewed for up to 400 days while using operations. Clearing cookies also ends browser access.</td></tr>
      <tr><th scope="row">Private booking session storage</th><td>Keeps your private booking access in the current browser tab.</td><td>For the current tab session.</td></tr>
      <tr><th scope="row">_ga and _ga_…</th><td>Google Analytics identifiers, only after acceptance.</td><td>Configured for up to 180 days.</td></tr>
      <tr><th scope="row">_gcl_…</th><td>Google Ads click identifier for conversion measurement, only after acceptance.</td><td>Configured for up to 180 days.</td></tr>
    </tbody></table></div>
    <h3>Change your choice</h3><p>Use Cookie settings below or in the footer to accept or decline analytics and ads measurement at any time. Declining stops future measurement and removes our accessible analytics and ads cookies. It does not undo information already sent while you had accepted. You can also manage cookies in your browser.</p>
    <CookieSettingsButton />
    <p>Google may process analytics and ads measurement information outside New Zealand. Read <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s privacy policy</a> for its handling of that information. Analytics account retention is managed separately from browser-cookie expiry. Contact operations@cruzycabs.co.nz with a privacy question.</p>
  </section>;
}
