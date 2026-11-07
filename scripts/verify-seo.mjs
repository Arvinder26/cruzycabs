import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { publicSlugs, pageAliases } from '../lib/public-routes.ts';

const base = process.argv[2] || 'http://localhost:3101';
const origin = process.env.SITE_URL || 'https://cruzycabs.co.nz';
const results = [];
const titles = new Set();
const descriptions = new Set();
const pages = new Map();
for (const path of ['/', ...publicSlugs.map(slug => `/${slug}`)]) {
  const response = await fetch(base + path, { headers: { 'User-Agent': 'Googlebot' } });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  pages.set(path, html);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  assert.ok(title && description, `Missing metadata: ${path}`);
  assert.ok(!titles.has(title), `Duplicate title: ${path}`);
  assert.ok(!descriptions.has(description), `Duplicate description: ${path}`);
  titles.add(title); descriptions.add(description);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `H1: ${path}`);
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonical && new URL(canonical).href, new URL(origin + path).href, `Canonical: ${path}`);
  assert.ok(html.includes('property="og:title"') && html.includes('name="twitter:card"'), `Social: ${path}`);
  assert.ok(!html.includes('name="robots" content="noindex'), `Public page noindex: ${path}`);
  const graphs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(match => JSON.parse(match[1]));
  assert.equal(graphs.length, 1, `JSON-LD: ${path}`);
  if (path !== '/') {
    const breadcrumb = graphs[0]['@graph'].find(node => node['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement.at(-1).item, origin + path);
    assert.ok(html.includes('aria-label="Breadcrumb"'), `Visible breadcrumb: ${path}`);
  }
  assert.ok(!html.includes('tel:+64272661398'), `Personal phone removed: ${path}`);
  assert.ok(html.includes('mailto:operations@cruzycabs.co.nz'), `Email: ${path}`);
  results.push({ path, status: response.status, title, jsonLd: 'valid JSON' });
}
// Crawl links without submitting forms or following private booking actions.
for (const [path, html] of pages) {
  for (const match of html.matchAll(/href="(\/(?!\/)[^"?]*)"/g)) {
    const url = new URL(match[1], base);
    if (url.pathname.startsWith('/_next/') || /\.[a-z]+$/i.test(url.pathname)) continue;
    const target = pages.get(url.pathname);
    if (target && url.hash) assert.ok(target.includes(`id="${url.hash.slice(1)}"`), `Missing anchor: ${path} → ${match[1]}`);
    if (!target) assert.ok(['/account', '/sign-in', '/manage-booking'].includes(url.pathname), `Unexpected internal link: ${path} → ${match[1]}`);
  }
}
for (const [from, to] of Object.entries(pageAliases)) {
  const response = await fetch(`${base}/${from}?utm_source=seo-check`, { redirect: 'manual' });
  assert.equal(response.status, 308, `Redirect: ${from}`);
  assert.equal(new URL(response.headers.get('location'), base).pathname, `/${to}`);
  assert.equal(new URL(response.headers.get('location'), base).searchParams.get('utm_source'), 'seo-check');
}
for (const path of ['/not-a-real-page', '/constructor', '/__proto__']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 404, `Not found: ${path}`);
}
for (const path of ['/manage-booking', '/thank-you', '/sign-in', '/admin', '/dispatch', '/driver', '/partner', '/account']) {
  const response = await fetch(base + path, { redirect: 'manual' });
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.match(response.headers.get('cache-control'), /no-store/);
}
const campaign = await (await fetch(base + '/airport-transfers?utm_source=seo-check')).text();
assert.ok(campaign.includes(`rel="canonical" href="${origin}/airport-transfers"`));
const sitemap = await (await fetch(base + '/sitemap.xml')).text();
assert.equal((sitemap.match(/<loc>/g) || []).length, pages.size);
for (const path of pages.keys()) assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`));
const robots = await (await fetch(base + '/robots.txt')).text();
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(!robots.includes('Disallow: /driver'));
await mkdir('output/seo', { recursive: true });
await writeFile('output/seo/route-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), base, publicPages: results, redirects: Object.keys(pageAliases).length, checks: ['unique metadata', 'canonical', 'social', 'JSON-LD', 'visible breadcrumbs', 'internal links and anchors', 'phone links', '308 aliases preserve campaign parameters', '404 unknown and prototype paths', 'private noindex and no-store', 'query canonical', 'sitemap', 'robots'] }, null, 2));
console.log(`Verified ${pages.size} public pages, ${Object.keys(pageAliases).length} redirects, private headers, 404s, sitemap, robots and internal links.`);
