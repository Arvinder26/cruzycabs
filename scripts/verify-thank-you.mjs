// Browser checks use synthetic booking API responses; no live bookings or reviews.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = process.env.CODEX_NODE_MODULES ? createRequire(process.env.CODEX_NODE_MODULES + '/package.json') : createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({headless:true,channel:'msedge'});
const base = process.argv[2] || 'http://localhost:3101';
const reference = 'CC-DEMO123456', token = 'local-browser-test-token';
const google = 'https://g.page/r/CSZZqgBpxfztEAI/review';
const fixture = {reference,customer_name:'Test Customer',vehicle_id:'xl',status:'awaiting_dispatch',payment_state:'not_paid',canPay:false,reviewSubmitted:false,price_cents:15600,receipt_url:null,journey:{pickup:'Auckland Airport',destination:'Auckland hotel',when:'now'}};
const results=[];
await mkdir('output/booking-thank-you',{recursive:true});
try {
  for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let state={...fixture}, gets=0, reviewRequest=null, deny=false;
    await page.route('**/api/bookings?*',async route=>{
      gets++;
      if(deny)return route.fulfill({status:403,json:{error:'Use the secure booking link or sign in with the booking email.'}});
      assert.equal(route.request().headers().authorization,`Bearer ${token}`);
      await route.fulfill({json:state});
    });
    await page.route('**/api/bookings/review',async route=>{
      assert.equal(route.request().headers().authorization,`Bearer ${token}`);
      reviewRequest=route.request().postDataJSON();
      await route.fulfill({status:201,json:{reference:'CCQ-TEST'}});
    });
    const response=await page.goto(`${base}/thank-you?ref=${reference}#token=${token}`,{waitUntil:'networkidle'});
    const decline=page.getByRole('button',{name:'Decline',exact:true});
    if(await decline.count())await decline.click();
    assert.equal(response.status(),200);
    assert.match(response.headers()['x-robots-tag'],/noindex/);
    assert.match(response.headers()['cache-control'],/no-store/);
    await page.getByRole('heading',{name:'Thank you. Your request is received.'}).waitFor();
    assert.ok((await page.locator('body').innerText()).includes('No payment is due yet'));
    assert.ok(!page.url().includes('#token='));
    assert.equal(await page.evaluate(ref=>sessionStorage.getItem(`cc:${ref}`),reference),token);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const reviewLink=page.getByRole('link',{name:'Leave a Google review'});
    assert.equal(await reviewLink.getAttribute('href'),google);
    await page.getByRole('radio',{name:'1 star',exact:true}).check();
    const reviewField = page.locator('.thank-you-review textarea');
    const fieldWidth = await reviewField.evaluate(element => element.getBoundingClientRect().width);
    const formWidth = await page.locator('.thank-you-review form').evaluate(element => element.getBoundingClientRect().width);
    assert.ok(fieldWidth >= formWidth - 2, 'Review textarea fills the form width');
    await page.getByLabel('Your review', {exact:false}).fill('The booking process could be clearer.');
    assert.equal(await reviewLink.getAttribute('href'),google,'Google link remains available for a low rating');
    await page.getByRole('button',{name:'Send my review'}).click();
    await page.getByText('Thank you for your feedback.',{exact:true}).waitFor();
    assert.deepEqual(reviewRequest,{reference,rating:1,comment:'The booking process could be clearer.'});
    assert.equal(await reviewLink.getAttribute('href'),google,'Google link remains available after private feedback');
    await page.reload({waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Thank you. Your request is received.'}).waitFor();
    state={...fixture,status:'awaiting_payment',canPay:true};
    await page.getByRole('button',{name:'Refresh booking status'}).click();
    await page.getByRole('link',{name:'Open booking & pay securely'}).waitFor();
    assert.ok(!(await page.locator('body').innerText()).includes('Booking confirmed · paid'));
    state={...fixture,status:'accepted',payment_state:'paid',receipt_url:'https://pay.stripe.com/receipts/test'};
    await page.goto(`${base}/thank-you?ref=${reference}&payment=return`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:"You're booked. Thank you."}).waitFor();
    await page.getByRole('link',{name:'View payment receipt'}).waitFor();
    if(width===390)await page.screenshot({path:'output/booking-thank-you/paid-mobile.png',fullPage:true});
    if(width===1440)await page.screenshot({path:'output/booking-thank-you/paid-desktop.png',fullPage:true});
    state={...state,status:'completed',reviewSubmitted:true};
    await page.getByRole('button',{name:'Refresh booking status'}).click();
    await page.getByRole('heading',{name:'Thank you for riding with cruzycabs.'}).waitFor();
    // A reload also remembers the server-recorded feedback state.
    await page.reload({waitUntil:'networkidle'});
    await page.getByText('Thank you for your feedback.',{exact:true}).waitFor();
    deny=true;
    await page.goto(`${base}/thank-you?ref=${reference}#token=wrong`,{waitUntil:'networkidle'});
    await page.locator('.thank-you-summary [role="alert"]').waitFor();
    assert.ok(!(await page.locator('body').innerText()).includes('Auckland hotel'));
    assert.equal(await page.getByRole('button',{name:'Send my review'}).count(),0);
    assert.deepEqual(errors,[]);
    results.push({width,verified:['request status','noindex/no-store','fragment credentials and reload','one-star submission','ungated Google link','awaiting payment','paid receipt','completed journey','saved feedback','unauthorised privacy','no overflow or browser errors'],bookingReads:gets});
    await context.close();
  }
  // Payment return query alone cannot mark an unpaid request paid.
  const context=await browser.newContext();const page=await context.newPage();let reads=0;
  await page.route('**/api/bookings?*',route=>route.fulfill({json:++reads===1?{...fixture,status:'awaiting_payment',canPay:true}:{...fixture,status:'accepted',payment_state:'paid'}}));
  await page.goto(`${base}/thank-you?ref=${reference}&payment=return#token=${token}`);
  await page.getByRole('heading',{name:'Thank you. Your driver is confirmed.'}).waitFor();
  await page.getByRole('heading',{name:"You're booked. Thank you."}).waitFor();assert.equal(reads,2);
  await page.goto(base+'/thank-you',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Thank you for choosing cruzycabs.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Send my review'}).count(),0);
  await context.close();
  await writeFile('output/booking-thank-you/verification.json',JSON.stringify({checkedAt:new Date().toISOString(),mode:'synthetic API responses; no real provider actions',results,paymentWebhookDelay:'passed',barePagePrivacy:'passed'},null,2));
  console.log('Thank-you browser checks passed at 320, 390 and 1440 px, including review submission, reload, privacy and delayed payment status.');
} finally {await browser.close();}
