import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__testEnv = {};
const { consentCookie, readConsent, CONSENT_MAX_AGE, CONSENT_CLOCK_SKEW_MS, isAnalyticsCookie } = await import('../lib/cookie-consent.ts');
const { analyticsFramePath, analyticsReferrer, isAnalyticsPage, adClickParams, bookingConversionFramePath } = await import('../lib/analytics.ts');
const { GET } = await import('../app/analytics-frame/route.ts');
const now = 1793059200000;

test('cookie choice is versioned, expires and distinguishes accept from decline', () => {
  for (const choice of ['granted', 'denied']) {
    const value = consentCookie(choice, true, now);
    assert.equal(readConsent(value, now + 1), choice);
    assert.match(value, /SameSite=Lax; Secure/);
    assert.match(value, /Path=\//);
    assert.equal(readConsent(value, now + CONSENT_MAX_AGE * 1000), null);
    assert.equal(readConsent(value, now - 1), choice);
    assert.equal(readConsent(value, now - CONSENT_CLOCK_SKEW_MS - 1), null);
  }
  for (const value of ['', 'cc_cookie_consent=granted', 'cc_cookie_consent=v1.granted.1793059200000', 'cc_cookie_consent=v2.anything.1793059200000']) assert.equal(readConsent(value, now), null);
});

test('fresh explicit consent survives browser/server clock skew without bypassing denial or expiry', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const request = choice => new Request('https://cruzycabs.co.nz/analytics-frame?page=/airport-transfers', {
      headers: { Cookie: consentCookie(choice, true, Date.now() + 2000).split(';')[0] },
    });
    assert.equal(GET(request('granted')).status, 200);
    assert.equal(GET(request('denied')).status, 204);
    const farFuture = consentCookie('granted', true, Date.now() + CONSENT_CLOCK_SKEW_MS + 60000).split(';')[0];
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/', { headers: { Cookie: farFuture } })).status, 204);
    assert.equal(readConsent(consentCookie('granted', true, now), now + CONSENT_MAX_AGE * 1000), null);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('only known public paths can be measured; referrers lose private paths and parameters', () => {
  for (const path of ['/thank-you', '/manage-booking', '/account', '/admin', '/api/bookings', '/driver', '/airport-transfers?ref=secret', '/not-real']) {
    assert.equal(isAnalyticsPage(path), false);
    assert.equal(analyticsFramePath(path, '', 'https://cruzycabs.co.nz'), null);
  }
  assert.equal(analyticsReferrer('https://www.google.com/search?q=secret#passenger', 'https://cruzycabs.co.nz'), 'https://www.google.com');
  assert.equal(analyticsReferrer('https://cruzycabs.co.nz/manage-booking?ref=secret', 'https://cruzycabs.co.nz'), '');
  assert.equal(analyticsReferrer('javascript:alert(1)', 'https://cruzycabs.co.nz'), '');
});

test('analytics cookie cleanup preserves the essential sign-in and preference cookies', () => {
  for (const name of ['_ga', '_ga_1RCJ5G2SKB', '_gid', '_gat_stream', '_gcl_au', '_gcl_aw']) assert.equal(isAnalyticsCookie(name), true);
  for (const name of ['cc_session', 'cc_cookie_consent', 'cc:CC-123', '_garden']) assert.equal(isAnalyticsCookie(name), false);
});

test('analytics document requires consent and excludes preview, disabled and private routes', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const withoutConsent = GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/'));
    assert.equal(withoutConsent.status, 204);
    assert.match(withoutConsent.headers.get('content-type'), /text\/html/);
    assert.equal(withoutConsent.headers.get('content-disposition'), 'inline');
    const headers = { Cookie: consentCookie('granted', true).split(';')[0] };
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/thank-you', { headers })).status, 404);
    globalThis.__testEnv.VERCEL_ENV = 'preview';
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/', { headers })).status, 204);
    delete globalThis.__testEnv.VERCEL_ENV;
    globalThis.__testEnv.ANALYTICS_ENABLED = 'false';
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/', { headers })).status, 204);
    delete globalThis.__testEnv.ANALYTICS_ENABLED;
    const response = GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/airport-transfers&referrer=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dprivate', { headers }));
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.ok(html.includes('G-1RCJ5G2SKB'));
    assert.ok(html.includes('"page_location":"https://cruzycabs.co.nz/airport-transfers"'));
    assert.ok(html.includes('"page_referrer":"https://www.google.com"'));
    assert.ok(!html.includes('q=private'));
    assert.ok(html.indexOf("gtag('consent','default'") < html.indexOf("gtag('config'"));
    assert.ok(html.includes("ad_user_data:'denied'"));
    assert.ok(html.includes('"allow_google_signals":false'));
    assert.ok(!html.includes('<form'));
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('ad click IDs pass to the analytics frame only as plain tokens; conversions carry only the value', () => {
  assert.equal(analyticsFramePath('/', '', 'https://cruzycabs.co.nz', '?gclid=Cj0KCQ_abc-123&ref=secret&wbraid=bad%20value'), '/analytics-frame?page=%2F&gclid=Cj0KCQ_abc-123');
  assert.equal(adClickParams('?gbraid=0AAA_x').get('gbraid'), '0AAA_x');
  assert.equal(bookingConversionFramePath(12345), '/analytics-frame?conversion=booking&value=123.45');
  assert.equal(bookingConversionFramePath(Number.NaN), '/analytics-frame?conversion=booking&value=0');
});

test('Google Ads conversion measurement is off unless configured and consented', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const headers = { Cookie: consentCookie('granted', true).split(';')[0] };
  try {
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?conversion=booking&value=80', { headers })).status, 204);
    const plain = await GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/&gclid=abc', { headers })).text();
    assert.ok(plain.includes("ad_storage:'denied'") && !plain.includes('AW-'));
    globalThis.__testEnv.GOOGLE_ADS_ID = 'AW-123456789';
    globalThis.__testEnv.GOOGLE_ADS_BOOKING_LABEL = 'AbCdEf123';
    assert.equal(GET(new Request('https://cruzycabs.co.nz/analytics-frame?conversion=booking&value=80')).status, 204);
    const page = await GET(new Request('https://cruzycabs.co.nz/analytics-frame?page=/&gclid=abc', { headers })).text();
    assert.ok(page.includes("ad_storage:'granted'") && page.includes("ad_personalization:'denied'") && page.includes("gtag('config','AW-123456789'"));
    const conversion = await GET(new Request('https://cruzycabs.co.nz/analytics-frame?conversion=booking&value=80.5', { headers })).text();
    assert.ok(conversion.includes('"send_to":"AW-123456789/AbCdEf123","value":80.5,"currency":"NZD"'));
    assert.ok(!conversion.includes('G-1RCJ5G2SKB'));
  } finally {
    delete globalThis.__testEnv.GOOGLE_ADS_ID; delete globalThis.__testEnv.GOOGLE_ADS_BOOKING_LABEL;
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});
