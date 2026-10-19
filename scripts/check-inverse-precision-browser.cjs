// Exercise real form -> Worker -> JSON, plus cached PWA and loaded offline.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const{openTool,chooseModel}=require('./browser-tools.cjs');
(async()=>{
 const{assess}=await import('./inverse-precision-common.mjs'),fixture=JSON.parse(await fs.readFile('tests/fixtures/inverse-precision-reference.json'));
 const name=process.env.BROWSER_NAME||'chromium',pw=require(process.env.PLAYWRIGHT_MODULE_PATH||process.env.PLAYWRIGHT_MODULE||'playwright'),browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow'}),report={browser:name,records:[],errors:[]};let page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const units={p:'MPa',T:'K',h:'kJkg',s:'kJkgK',u:'kJkg',v:'m3kg',rho:'kgm3'};
 const ordinary=fixture.records.find(c=>c.model==='IF97'&&c.expected.p===1&&c.expected.T===1074);
 const requests=Object.keys(fixture.modes).map(mode=>({c:ordinary,mode}));
 for(const c of fixture.records.filter(c=>c.group==='B23'&&c.expected.p===25&&Math.abs(c.expected.T-676.8)<.1))requests.push({c,mode:'pv'});
 const scientific=fixture.records.find(c=>c.model==='IAPWS-95'&&c.group==='ordinary');for(const mode of ['ph','ps','pv','hs'])requests.push({c:scientific,mode});
 for(const id of ['IAPWS-95-0187','IAPWS-95-0188'])for(const mode of ['ph','ps'])requests.push({c:fixture.records.find(c=>c.id===id),mode});
 const mix=fixture.records.find(c=>c.model==='IAPWS-95'&&c.group==='mixture'&&c.expected.p===1&&c.x===.5);requests.push({c:mix,mode:'us'});
 async function run({c,mode},surface){
  await openTool(page,'general');await chooseModel(page,c.model);if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',mode);
  const keys=fixture.modes[mode];for(const[i,k]of keys.entries()){const side=i?'b':'a';await page.selectOption('#unit-'+side,units[k]);await page.fill('#input-'+side,String(c.expected[k]));}
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
  await page.evaluate(()=>{window.inverseCopy=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.inverseCopy=text}});});await page.click('#copy-result-json');await page.waitForFunction(()=>!!window.inverseCopy);const result=await page.evaluate(()=>JSON.parse(window.inverseCopy).result),verdict=assess(result,c,keys);assert.equal(verdict.status,'passed',JSON.stringify({mode,...verdict}));report.records.push({id:c.id,model:c.model,mode,surface,...verdict});console.log(name,surface,c.model,mode,'passed');
 }
 try{
  await page.goto('http://127.0.0.1:8080/');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);report.build=await page.locator('#app-build-value').textContent();
  for(const r of requests)await run(r,'worker');
  await context.setOffline(true);await run(requests.find(r=>r.mode==='pv'),'loaded-offline');await context.setOffline(false);
  const offlineSurface='pwa-offline-reload';
  await require('./browser-tools.cjs').openOfflineApp(page);
  for(const r of [requests.find(r=>r.mode==='pv'),requests.find(r=>r.mode==='hs'),{c:scientific,mode:'ps'}])await run(r,offlineSurface);
  assert.deepEqual(report.errors,[]);report.status='passed';
 }finally{await browser.close();const folder=process.env.INVERSE_BROWSER_DIR||'.release/inverse-precision/'+name;await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
