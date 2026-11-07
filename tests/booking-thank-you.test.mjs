import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__testEnv = {};
const { thankYouMessage } = await import('../lib/booking-thank-you.ts');
const { thankYouPath } = await import('../lib/booking-links.ts');
const { googleReviewUrl } = await import('../lib/review-link.ts');

test('thank-you copy distinguishes request, driver acceptance, payment and completed journey', () => {
  assert.equal(thankYouMessage({status:'awaiting_dispatch',payment_state:'not_paid',canPay:false}).label, 'Checking availability');
  assert.equal(thankYouMessage({status:'review',payment_state:'not_paid',canPay:false}).label, 'Checking availability');
  assert.equal(thankYouMessage({status:'awaiting_payment',payment_state:'not_paid',canPay:true}).label, 'Payment due before travel');
  assert.equal(thankYouMessage({status:'accepted',payment_state:'paid',canPay:false}).label, 'Booking confirmed · paid');
  assert.equal(thankYouMessage({status:'completed',payment_state:'paid',canPay:false}).label, 'Journey completed');
  assert.equal(thankYouMessage({status:'cancelled',payment_state:'refunded',canPay:false}).label, 'Cancellation');
});

test('thank-you booking links keep guest credentials out of the query string', () => {
  const url = new URL(thankYouPath('CC-TEST123456', 'private-token', true), 'https://cruzycabs.co.nz');
  assert.equal(url.pathname, '/thank-you');
  assert.equal(url.searchParams.get('ref'), 'CC-TEST123456');
  assert.equal(url.searchParams.get('payment'), 'return');
  assert.equal(url.searchParams.has('token'), false);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'private-token');
});

test('Google review link defaults to the owner-supplied URL and rejects unsafe overrides', () => {
  assert.equal(googleReviewUrl(), 'https://g.page/r/CSZZqgBpxfztEAI/review');
  for (const url of ['javascript:alert(1)', 'http://g.page/review', 'https://g.page.attacker.example/review', 'https://name:secret@g.page/review']) {
    globalThis.__testEnv.GOOGLE_REVIEW_URL = url;
    assert.equal(googleReviewUrl(), null);
  }
  globalThis.__testEnv.GOOGLE_REVIEW_URL = '';
  assert.equal(googleReviewUrl(), null);
  delete globalThis.__testEnv.GOOGLE_REVIEW_URL;
});
