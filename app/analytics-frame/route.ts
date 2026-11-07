import { GA_MEASUREMENT_ID, GOOGLE_ADS_ID, GOOGLE_ADS_LABEL, analyticsReferrer, isAnalyticsPage } from "../../lib/analytics";
import { analyticsEnabled } from "../../lib/analytics-config";
import { CONSENT_MAX_AGE, readConsent } from "../../lib/cookie-consent";
import { analyticsContentSecurityPolicy } from "../../lib/content-security-policy";
import { setting } from "../../lib/config";
import { publicOrigin, serviceTitles } from "../../lib/seo";

export const dynamic = "force-dynamic";

function googleAds() {
  const id = setting("GOOGLE_ADS_ID", "").trim();
  const label = setting("GOOGLE_ADS_BOOKING_LABEL", "").trim();
  return GOOGLE_ADS_ID.test(id) ? { id, label: GOOGLE_ADS_LABEL.test(label) ? label : "" } : null;
}

export function GET(request: Request) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "Content-Security-Policy": analyticsContentSecurityPolicy, "X-Frame-Options": "SAMEORIGIN" };
  if (readConsent(request.headers.get("cookie") || "") !== "granted" || !analyticsEnabled()) {
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  const query = url.searchParams;
  const ads = googleAds();
  const origin = publicOrigin();
  const cookieFlags = url.protocol === "https:" ? "SameSite=Lax;Secure" : "SameSite=Lax";
  const consent = `gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('consent','update',{analytics_storage:'granted',ad_storage:'${ads ? "granted" : "denied"}',ad_user_data:'${ads ? "granted" : "denied"}',ad_personalization:'denied'});
${ads ? "" : "gtag('set','ads_data_redaction',true);"}gtag('set','url_passthrough',false);`;
  const adsConfig = ads ? `gtag('config','${ads.id}',${JSON.stringify({ send_page_view: false, cookie_expires: CONSENT_MAX_AGE, cookie_update: false, cookie_flags: cookieFlags, allow_ad_personalization_signals: false })});` : "";

  // Booking-request conversion. Sent from the thank-you page with only the quoted value.
  if (query.get("conversion") === "booking") {
    if (!ads?.label) return new Response(null, { status: 204, headers });
    const value = Number(query.get("value"));
    const event = JSON.stringify({ send_to: `${ads.id}/${ads.label}`, value: Number.isFinite(value) && value > 0 && value < 100000 ? value : 0, currency: "NZD" });
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Website analytics</title><script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
${consent}
gtag('js',new Date());${adsConfig}
gtag('event','conversion',${event});
</script><script async src="https://www.googletagmanager.com/gtag/js?id=${ads.id}"></script></head><body></body></html>`;
    return new Response(html, { headers });
  }

  const page = query.get("page") || "";
  if (!isAnalyticsPage(page)) return new Response(null, { status: 404, headers });
  const measurementId = setting("GA_MEASUREMENT_ID", GA_MEASUREMENT_ID);
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return new Response(null, { status: 204, headers });
  // Ad click IDs (gclid/gbraid/wbraid) are read by Google's conversion linker from this
  // document's own URL; adClickParams has already restricted them to plain tokens.
  const config = JSON.stringify({
    send_page_view: false,
    page_location: `${origin}${page}`,
    page_referrer: analyticsReferrer(query.get("referrer") || "", origin),
    page_title: page === "/" ? "cruzycabs | Auckland rides" : `${serviceTitles[page.slice(1)] || page.slice(1).replaceAll("-", " ")} | cruzycabs`,
    cookie_expires: CONSENT_MAX_AGE,
    cookie_update: false,
    cookie_path: "/",
    cookie_flags: cookieFlags,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  }).replace(/</g, "\\u003c");
  // Separate document: automatic history/form measurement cannot see the booking UI.
  // This document has no forms, input values, private URLs, or client-side routing.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Website analytics</title><script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
${consent}
gtag('js',new Date());gtag('config','${measurementId}',${config});${adsConfig}
gtag('event','page_view',{send_to:'${measurementId}'});
</script><script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script><style>html{overflow:hidden}body{margin:0;min-height:10000px}</style></head><body></body></html>`;
  return new Response(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
