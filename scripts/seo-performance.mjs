// Local diagnostic, not Lighthouse or real-user Core Web Vitals.
// Usage: node scripts/seo-performance.mjs http://localhost:3100 baseline
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = process.env.CODEX_NODE_MODULES ? createRequire(process.env.CODEX_NODE_MODULES + '/package.json') : createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const results = [];
try {
  for (const path of ['/', '/airport-transfers', '/private-tours']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__seoVitals = { lcp: 0, cls: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__seoVitals.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__seoVitals.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(new URL(path, process.argv[2]).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    results.push(await page.evaluate(() => ({
      path: location.pathname, ...window.__seoVitals,
      documentBytes: performance.getEntriesByType('navigation')[0].encodedBodySize,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      images: [...document.images].filter(img => img.currentSrc).map(img => ({ src: img.currentSrc.replace(location.origin, ''), renderedWidth: img.clientWidth, naturalWidth: img.naturalWidth, bytes: performance.getEntriesByName(img.currentSrc)[0]?.encodedBodySize || 0 })),
    })));
    await context.close();
  }
  await mkdir('output/seo', { recursive: true });
  await writeFile(`output/seo/performance-${process.argv[3] || 'current'}.json`, JSON.stringify({ measuredAt: new Date().toISOString(), viewport: '390x844, DPR1, unthrottled local browser, cold context per URL', results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
