import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__testEnv = {};
const { publicOrigin, pageMetadata, siteIndexable } = await import('../lib/seo.ts');
const { publicSlugs, pageAliases } = await import('../lib/public-routes.ts');
const { default: sitemap } = await import('../app/sitemap.ts');
const { default: robots } = await import('../app/robots.ts');
const { StructuredData } = await import('../app/StructuredData.tsx');
const { hourlyVanHire } = await import('../lib/business.ts');

test('SEO origin rejects insecure or credential-bearing production URLs', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com']) {
    globalThis.__testEnv.SITE_URL = value;
    assert.throws(() => publicOrigin());
  }
  globalThis.__testEnv.SITE_URL = 'https://cruzycabs.co.nz/path?campaign=test';
  assert.equal(publicOrigin(), 'https://cruzycabs.co.nz');
  delete globalThis.__testEnv.SITE_URL;
});

test('campaign parameters cannot change canonical and social URLs', () => {
  const metadata = pageMetadata('Airport transfers', 'Description', '/airport-transfers');
  assert.equal(metadata.alternates.canonical, 'https://cruzycabs.co.nz/airport-transfers');
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
});

test('sitemap contains unique public canonical routes and no private routes or aliases', () => {
  const urls = sitemap().map(item => new URL(item.url).pathname);
  assert.equal(urls.length, new Set(urls).size);
  assert.deepEqual(urls, ['/', ...publicSlugs.map(slug => `/${slug}`)]);
  for (const alias of Object.keys(pageAliases)) assert.ok(!urls.includes(`/${alias}`));
  for (const privatePath of ['/account', '/admin', '/manage-booking', '/sign-in']) assert.ok(!urls.includes(privatePath));
});

test('preview indexing opt-out removes sitemap URLs and blocks crawling', () => {
  globalThis.__testEnv.VERCEL_ENV = 'preview';
  assert.equal(siteIndexable(), false);
  assert.deepEqual(sitemap(), []);
  assert.equal(robots().rules.disallow, '/');
  delete globalThis.__testEnv.VERCEL_ENV;
  globalThis.__testEnv.SITE_INDEXABLE = 'false';
  assert.equal(siteIndexable(), false);
  delete globalThis.__testEnv.SITE_INDEXABLE;
  assert.equal(siteIndexable(), true);
  assert.equal(robots().rules.disallow, '/api/');
});

test('JSON-LD remains valid while preventing script closing tag injection', () => {
  const value = { name: '</script><script>alert(1)</script>' };
  const script = StructuredData({ data: value }).props.dangerouslySetInnerHTML.__html;
  assert.ok(!script.includes('<'));
  assert.deepEqual(JSON.parse(script), value);
});

test('hourly guide has an explicit minimum and distance allowance, separate from transfer rates', () => {
  assert.equal(hourlyVanHire.rateNZD * hourlyVanHire.minimumHours, 360);
  assert.equal(hourlyVanHire.includedKmPerHour * hourlyVanHire.minimumHours, 90);
});
