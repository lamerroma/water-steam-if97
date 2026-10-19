const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fixture=require('../tests/fixtures/inverse-boundary-reference.json');
const {chooseModel}=require('./browser-tools.cjs');
const browserName=process.env.BROWSER_NAME||'chromium',url=process.env.CALCULATOR_URL||'http://localhost:8080/';
const pairs={th:['T','h'],pv:['P','v'],hs:['h','s'],ph:['P','h'],ps:['P','s'],us:['u','s']};
const units={P:'MPa',T:'K',h:'kJkg',u:'kJkg',s:'kJkgK',v:'m3kg'};
(async()=>{
 const browser=await playwright[browserName].launch(browserName==='chromium'?{...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']}:{});
 try{
  const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const finish=()=>page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const run=async(name,model,mode)=>{
   const q=fixture.records.find(q=>q.name===name&&q.model===model).expected;
   await chooseModel(page,model);if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',mode);
   const keys=pairs[mode];for(const [i,key] of keys.entries()){const suffix=i===0?'a':'b';await page.selectOption('#unit-'+suffix,units[key]);await page.fill('#input-'+suffix,String(q[key]));}
   await page.click('#calculate');await finish();assert.equal(await page.locator('#error').isHidden(),true,name+' '+mode);
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history[0]);
   assert.ok(Math.abs(saved.p-q.P)<Math.max(1e-8,q.P*2e-6),JSON.stringify(saved));assert.ok(Math.abs(saved.h-q.h)<2e-5,JSON.stringify(saved));
   assert.equal(await page.locator('#copy-result-json').isDisabled(),false);console.log(`${browserName}: ${model} ${name} ${mode} PASS`);
  };
  await page.goto(url);await finish();
  for(const [name,model,mode]of [['critical-label','IF97','th'],['B23','IF97','pv'],['region5-maxP','IF97','th'],['endpoint-0.1-1','IF97','pv'],['region25','IF97','hs'],['triple-0.5','IF97','us'],['critical-T-highP','IAPWS-95','ph'],['upper-T','IAPWS-95','ps'],['upper-P','IAPWS-95','hs']])await run(name,model,mode);
  await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a','22.064');await page.fill('#input-b','647.096');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length);
  await page.click('#calculate');await finish();assert.match(await page.locator('#error').textContent(),/критична точка.*сингулярні/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length),before);assert.equal(await page.locator('#copy-result-json').isDisabled(),true);
  console.log(`${browserName}: exact critical IAPWS-95 error preserves history PASS`);
  await require('./browser-tools.cjs').openOfflineApp(page);await finish();const requests=[];page.on('request',r=>requests.push(r.url()));await context.setOffline(true);
  await run('critical-label','IF97','th');await run('critical-T-highP','IAPWS-95','ph');assert.ok(requests.every(u=>new URL(u).origin===new URL(url).origin));assert.ok(page.workers().some(w=>w.url().includes('assets/calculator-worker.js?v=')));assert.deepEqual(errors,[]);
  console.log(`${browserName}: independent boundary inputs in offline PWA worker PASS`);await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
