import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const require = process.env.CODEX_NODE_MODULES ? createRequire(process.env.CODEX_NODE_MODULES + '/package.json') : createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];
await mkdir('output/seo', { recursive: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const paths = width === 390 ? ['/', '/airport-transfers', '/cruise-transfers', '/hourly-van-hire', '/private-tours', '/accessible-travel', '/business-travel', '/auckland-rides', '/north-island-transfers'] : ['/', '/airport-transfers', '/hourly-van-hire'];
    for (const path of paths) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      const decline=page.getByRole('button',{name:'Decline',exact:true});
      if(await decline.count())await decline.click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${path} overflows at ${width}`);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('a[href="tel:+64272661398"]').count(), 0);
      if (width === 390 && ['/', '/hourly-van-hire', '/cruise-transfers'].includes(path)) {
        await page.screenshot({ path: `output/seo/${path === '/' ? 'home' : path.slice(1)}-mobile.png`, fullPage: true });
      }
      if (path !== '/') {
        const action = page.locator('.content-hero .button');
        const href = await action.getAttribute('href');
        assert.ok(href);
        if (href.startsWith('#')) assert.equal(await page.locator(href).count(), 1);
      }
      results.push({ width, path, horizontalOverflow: overflow });
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base + '/hourly-van-hire', { waitUntil: 'networkidle' });
  const decline=page.getByRole('button',{name:'Decline',exact:true});
  if(await decline.count())await decline.click();
  await page.locator('.content-hero .button').click();
  await page.locator('#enquiry').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#enquiry').innerText()).includes('operations@cruzycabs.co.nz'));
  await page.goto(base + '/private-tours', { waitUntil: 'networkidle' });
  await page.locator('.content-hero .button').click();
  await page.locator('#tour-planner').waitFor({ state: 'visible' });
  await page.locator('.tour-stop input').first().check();
  await page.getByRole('button', { name: /Prepare my private tour brief/i }).click();
  assert.ok(await page.locator('#enquiry').count(), 'Tour planner opens enquiry fallback');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.locator('.mobile-nav summary').click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Airport', exact: true }).click();
  await page.waitForURL('**/airport-transfers');
  await page.locator('.header-actions').getByRole('link', { name: 'Book now' }).click();
  await page.waitForURL('**/#journey-form');
  await page.getByRole('button', { name: /Send a booking enquiry/ }).click();
  await page.locator('#enquiry').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#enquiry').innerText()).includes('operations@cruzycabs.co.nz'));
  await context.close();
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const plain = await noJs.newPage();
  await plain.goto(base + '/hourly-van-hire');
  assert.ok((await plain.locator('body').innerText()).includes('Guide price for local Auckland hire'));
  assert.equal(await plain.locator('details').count(), 5); // Mobile navigation + four questions.
  await noJs.close();
  await writeFile('output/seo/browser-verification.json', JSON.stringify({ checkedAt: new Date().toISOString(), results, extraChecks: ['no page errors', 'booking CTA targets', 'phone links', 'hourly enquiry contact fallback', 'tour planner enquiry fallback', 'mobile navigation', 'airport-to-booking navigation', 'home enquiry fallback', 'service content without JavaScript'] }, null, 2));
  console.log(`Verified ${results.length} mobile/desktop route layouts and booking entry points; no browser errors.`);
} finally { await browser.close(); }
