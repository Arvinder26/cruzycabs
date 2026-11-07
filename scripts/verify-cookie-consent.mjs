// Loads the real Google library, but intercepts measurement endpoints so tests
// never add visits to the owner's Analytics property.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = process.env.CODEX_NODE_MODULES ? createRequire(process.env.CODEX_NODE_MODULES + '/package.json') : createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
const base = process.argv[2] || 'http://localhost:3101';
const measurementId = 'G-1RCJ5G2SKB';
const isGoogleTag = url => url.startsWith('https://www.googletagmanager.com/gtag/');
const layouts = [], events = [], tagRequests = [];
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check, label, timeout=15000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) { if(await check()) return; await pause(150); }
  throw new Error(`Timed out: ${label}`);
}
await mkdir('output/cookie-consent',{recursive:true});
try {
  for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();let googleRequests=0;
    context.on('request',request=>{if(/google(tagmanager|-analytics)\.com/.test(request.url()))googleRequests++;});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Your cookie choice'}).waitFor();
    assert.equal(googleRequests,0);
    assert.equal(await page.locator('[data-analytics-frame]').count(),0);
    const geometry=await page.locator('.cookie-banner').boundingBox();
    assert.ok(geometry.x>=0&&geometry.x+geometry.width<=width+1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`output/cookie-consent/banner-${width}.png`});
    await page.getByRole('button',{name:'Customise cookies'}).click();
    await page.getByRole('dialog',{name:'Cookie settings'}).waitFor();
    assert.equal(await page.getByRole('checkbox',{name:'Analytics cookies'}).isChecked(),false);
    await page.screenshot({path:`output/cookie-consent/settings-${width}.png`});
    await page.keyboard.press('Escape');
    await page.getByRole('heading',{name:'Your cookie choice'}).waitFor();
    await page.getByRole('button',{name:'Decline',exact:true}).click();
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('.cookie-banner').count(),0);
    assert.equal(googleRequests,0);
    layouts.push({width,noOverflow:true,initialGoogleRequests:googleRequests,declineRemembered:true,keyboardDismissal:true});
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const browserErrors=[],policyErrors=[],downloads=[],frames=[];
  // Reproduce a browser clock ahead of the hosted server on first acceptance.
  await page.addInitScript(()=>{const now=Date.now;Date.now=()=>now()+2000;});
  page.on('download',download=>downloads.push(download.suggestedFilename()));
  page.on('response',response=>{if(new URL(response.url()).pathname==='/analytics-frame')frames.push({status:response.status(),contentType:response.headers()['content-type'],disposition:response.headers()['content-disposition']});});
  page.on('pageerror',error=>browserErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|Refused to/.test(message.text()))policyErrors.push(message.text());});
  context.on('request',request=>{if(isGoogleTag(request.url()))tagRequests.push(request.url());});
  await context.route(/https:\/\/([a-z0-9-]+\.)*google-analytics\.com\//,async route=>{
    const request=route.request();const url=new URL(request.url());
    const data=new URLSearchParams(url.search);
    for(const [key,value] of new URLSearchParams(request.postData()||''))data.set(key,value);
    // Persist only non-identifying fields from intercepted test requests.
    events.push({event:data.get('en'),measurementId:data.get('tid'),location:data.get('dl'),referrer:data.get('dr'),consent:data.get('gcs'),personalisedAds:data.get('npa')});
    assert.ok(!decodeURIComponent(request.url()+(request.postData()||'')).includes('PRIVATE-EXAMPLE'));
    assert.ok(!decodeURIComponent(request.url()+(request.postData()||'')).includes('passenger@example.invalid'));
    await route.fulfill({status:204,body:''});
  });
  await page.goto(base+'/airport-transfers?ref=PRIVATE-EXAMPLE&email=passenger@example.invalid#token=PRIVATE-EXAMPLE',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Your cookie choice'}).waitFor();
  assert.equal(tagRequests.length,0);assert.equal(events.length,0);
  await page.getByRole('button',{name:'Decline',exact:true}).click();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(tagRequests.length,0);assert.equal(events.length,0);
  await context.addCookies([{name:'cc_session',value:'preserve-essential-session',url:base,httpOnly:true,sameSite:'Lax'}]);
  await page.locator('footer').getByRole('button',{name:'Cookie settings',exact:true}).click();
  await page.getByRole('checkbox',{name:'Analytics cookies'}).check();
  await page.getByRole('button',{name:'Save my choice'}).click();
  await waitFor(()=>events.some(event=>event.event==='page_view'),'real Google page view');
  assert.equal(tagRequests.filter(url=>url.includes(`/gtag/js?id=${measurementId}`)).length,1);
  const first=events.find(event=>event.event==='page_view');
  assert.equal(first.measurementId,measurementId);
  assert.equal(first.location,'https://cruzycabs.co.nz/airport-transfers');
  assert.equal(first.consent,'G101'); // Analytics granted; advertising storage denied.
  assert.equal(first.personalisedAds,'1');
  assert.ok((await context.cookies()).some(cookie=>cookie.name==='_ga'));
  await pause(5500);
  assert.equal(events.filter(event=>event.event==='scroll').length,0,'hidden analytics document must not fabricate scrolls');
  assert.equal(events.filter(event=>event.event==='page_view').length,1,'one view per public page');
  const viewsBefore=events.filter(event=>event.event==='page_view').length;
  await page.locator('.mobile-nav summary').click();
  await page.getByRole('navigation',{name:'Mobile navigation',exact:true}).getByRole('link',{name:'Tours',exact:true}).click();
  await waitFor(()=>events.filter(event=>event.event==='page_view').length===viewsBefore+1,'public SPA navigation');
  assert.equal(events.filter(event=>event.event==='page_view').at(-1).location,'https://cruzycabs.co.nz/private-tours');
  const tagsBeforePrivate=tagRequests.length;
  await page.goto(base+'/manage-booking?ref=PRIVATE-EXAMPLE#token=PRIVATE-EXAMPLE',{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-analytics-frame]').count(),0);
  assert.equal(tagRequests.length,tagsBeforePrivate);
  await page.locator('footer').getByRole('button',{name:'Cookie settings',exact:true}).click();
  await page.getByRole('button',{name:'Decline analytics',exact:true}).click();
  assert.ok(!(await context.cookies()).some(cookie=>/^_ga(?:_|$)/.test(cookie.name)));
  assert.ok((await context.cookies()).some(cookie=>cookie.name==='cc_session'&&cookie.value==='preserve-essential-session'));
  const countAfterDecline=tagRequests.length;
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Send a booking enquiry'}).click();
  await page.locator('#enquiry').waitFor({state:'visible'});
  assert.equal(tagRequests.length,countAfterDecline,'essential enquiry flow works without tracking');
  assert.deepEqual(browserErrors,[]);assert.deepEqual(policyErrors,[]);assert.deepEqual(downloads,[]);
  assert.ok(frames.length>=2);assert.ok(frames.every(frame=>frame.status===200&&frame.contentType?.includes('text/html')&&frame.disposition==='inline'));
  await context.close();
  await writeFile('output/cookie-consent/verification.json',JSON.stringify({checkedAt:new Date().toISOString(),measurementRequestsIntercepted:true,layouts,tagLoads:tagRequests.length,events,frames,downloads,checks:['nothing to Google before consent or after decline','choice persists','settings and withdrawal','GA cookies deleted, essential cookie retained','real Google library loads once per public page','query and token omitted','private routes excluded','no artificial scrolls','public SPA navigation','booking enquiry after decline','no CSP or page errors','first acceptance works with browser clock ahead','analytics HTML displays inline without downloads']},null,2));
  console.log('Cookie and real Google-tag checks passed: accept/decline, withdrawal, safe page URLs, private-page exclusion and 320/390/1440px layouts. Measurement requests were intercepted.');
} finally { await browser.close(); }
