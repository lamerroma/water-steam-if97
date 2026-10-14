const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const {chooseModel,openTool}=require('./browser-tools.cjs');
const name=process.env.BROWSER_NAME||'chromium',url=process.env.CALCULATOR_URL||'http://localhost:8080/';
const KEY='water-steam-if97-project-v1';
(async()=>{
 const browser=await playwright[name].launch(name==='chromium'?{...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']}:{});
 try{
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1366,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const finish=()=>page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const count=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key))?.history.length||0,KEY);
  await page.fill('#input-a','3');await page.fill('#input-b','400');await page.click('#calculate');await finish();
  const original=await page.evaluate(key=>localStorage.getItem(key),KEY);assert.equal(await count(),1);
  await chooseModel(page,'IAPWS-95');if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode','hv');
  await page.fill('#input-a','3231.6862979808975');await page.fill('#input-b','0.09937913680874447');
  await page.evaluate(()=>{window.calcTicks=0;window.calcTick=setInterval(()=>window.calcTicks++,20);window.calcStarted=performance.now();document.querySelector('#calculator').requestSubmit();});
  await finish();const metrics=await page.evaluate(()=>{clearInterval(window.calcTick);return {ticks:window.calcTicks,ms:performance.now()-window.calcStarted};});
  assert.ok(metrics.ticks>=3,JSON.stringify(metrics));assert.equal(await page.locator('#error').isHidden(),true);assert.equal(await count(),2);
  console.log('Real IAPWS-95 h-v search keeps the event loop responsive PASS',JSON.stringify(metrics));
  await page.evaluate(()=>{document.querySelector('#calculator').requestSubmit();document.querySelector('#calculator').requestSubmit();});await finish();assert.equal(await count(),3);
  const before=await count();await page.evaluate(()=>{document.querySelector('#calculator').requestSubmit();document.querySelector('#calculator-cancel').click();});await finish();
  assert.match(await page.locator('#result-status').textContent(),/скасовано/);assert.equal(await count(),before);assert.equal(await page.locator('#copy-result-json').isDisabled(),true);assert.equal(await page.locator('#calculate').evaluate(el=>el===document.activeElement),true);
  await page.evaluate(()=>{document.querySelector('#calculator').requestSubmit();const input=document.querySelector('#input-a');input.value='3200';input.dispatchEvent(new Event('input',{bubbles:true}));});await finish();
  await page.waitForTimeout(1100);assert.equal(await count(),before);assert.equal(await page.locator('#input-a').inputValue(),'3200');assert.equal(await page.locator('#copy-result-json').isDisabled(),true);
  await page.evaluate(()=>{document.querySelector('#calculator').requestSubmit();const model=document.querySelector('input[name=formulation][value=IF97]');model.checked=true;model.dispatchEvent(new Event('change',{bubbles:true}));});await finish();assert.equal(await count(),before);
  console.log('Cancellation, duplicate submit, input edits and model changes preserve current data PASS');
  const file=page.locator('input[type=file][accept=".json,application/json"]');
  // Race import against the measured slow case, not the inputs left by model-change checks.
  await chooseModel(page,'IAPWS-95');await page.fill('#input-a','3231.6862979808975');
  await page.evaluate(()=>document.querySelector('#calculator').requestSubmit());
  assert.equal(await page.locator('#calculate').isDisabled(),true);
  await file.setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(original)});await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value==='');await finish();
  assert.equal(await count(),1);assert.equal(await page.locator('#input-b').inputValue(),'400');assert.equal(await page.locator('#copy-result-json:not([disabled])').count(),1);
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate').disabled&&document.querySelector('#copy-result-json')?.disabled===false);assert.equal(await count(),1);assert.equal(await page.locator('#input-b').inputValue(),'400');
  console.log('Import during computation and reload restore the saved state without stale history PASS');
  for(const width of [320,390,1366]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
  await page.setViewportSize({width:1366,height:900});await page.selectOption('#language-select','en');assert.equal(await page.locator('#calculator-cancel').textContent(),'Cancel calculation');
  await page.goto(new URL('standalone.html',url).href);await finish();const requests=[];page.on('request',r=>requests.push(r.url()));await ctx.setOffline(true);await page.click('#calculate');await finish();assert.equal(await page.locator('#error').isHidden(),true);assert.equal(await page.locator('#copy-result-json:not([disabled])').count(),1);assert.deepEqual(requests.filter(request=>/^https?:/.test(request)),[]);assert.ok(page.workers().some(w=>w.url().startsWith('blob:')));
  console.log('English, mobile layout and embedded offline worker in standalone HTML PASS');await ctx.close();
  const failure=await browser.newContext({serviceWorkers:'block'}),p=await failure.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route('**/assets/calculator-worker.js?*',route=>route.abort());await p.goto(url);await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#error').isVisible(),true);
  await p.unroute('**/assets/calculator-worker.js?*');await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#error').isHidden(),true);assert.equal(await p.locator('#copy-result-json:not([disabled])').count(),1);await failure.close();
  assert.deepEqual(errors,[]);console.log('Worker startup failure is reported and retry succeeds PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
