// Confirmed water contract: real form -> Worker -> phases/alternatives ->
// project/export/restore, both input systems and offline PWA.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool,chooseModel,openUnits,closeUnits}=require('./browser-tools.cjs');
(async()=>{
 const {assess,assessAllRoots}=await import('./inverse-precision-common.mjs');
 const pilot=JSON.parse(await fs.readFile('docs/steam97-p01/pilot-reference.json'));
 const inverse=JSON.parse(await fs.readFile('tests/fixtures/inverse-precision-reference.json'));
 const dense=JSON.parse(await fs.readFile('tests/fixtures/steam97-p02-reference.json'));
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),name=process.env.BROWSER_NAME||'chromium';
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true});
 const dir=process.env.P02_BROWSER_DIR||'.release/steam97-p02/'+name;await fs.mkdir(dir,{recursive:true});
 const report={browser:name,status:'running',records:[],checks:[],errors:[]};let page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});
 const units={SI:{p:'MPa',t:'K',h:'kJkg',s:'kJkgK',u:'kJkg',v:'m3kg',x:'fraction'},English:{p:'psi',t:'F',h:'Btulb',s:'BtulbR',u:'Btulb',v:'ft3lb',x:'percent'}};
 const lb=.45359237,ft=.3048,btu=1055.05585262,psi=lb*9.80665/(ft/12)**2;
 const value=(k,v,system)=>system==='SI'?v:({p:x=>x*1e6/psi,t:x=>(x-273.15)*1.8+32,h:x=>x*1000*lb/btu,u:x=>x*1000*lb/btu,s:x=>x*1000*lb/(btu*1.8),v:x=>x*lb/ft**3,x:x=>x*100}[k])(v);
 async function capture(){
  await page.evaluate(()=>{window.p02Copy=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.p02Copy=text}});});
  await page.click('#copy-result-json');await page.waitForFunction(()=>!!window.p02Copy);return page.evaluate(()=>JSON.parse(window.p02Copy).result);
 }
 async function run(c,mode,system='SI',surface='worker'){
  await openTool(page,'general');await chooseModel(page,c.model);
  await openUnits(page);await page.selectOption('#output-system',system==='SI'?'si':'english');await closeUnits(page);
  if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',mode);
  const keys=[...mode].map(k=>k==='t'?'T':k),texts=keys.map((key,i)=>String(value(mode[i],c.expected[key],system)));
  for(const [i,side] of ['a','b'].entries()){await page.selectOption('#unit-'+side,units[system][mode[i]]);await page.fill('#input-'+side,texts[i]);}
  const started=Date.now();await page.click('#calculate');await ready();const calculateMs=Date.now()-started;assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
  const r=await capture();let verification;
  if(mode.includes('x')){
   assert.ok(Math.abs(r.state.x-c.x)<2e-9);assert.ok(Math.abs(r.state.T-c.expected.T)<2e-5);assert(r.saturation?.liquid&&r.saturation?.vapor);
   assert.equal(await page.locator('.sat-table').count(),1);assert.equal(r.state.cp==null,c.x>0&&c.x<1);verification={phaseColumns:true,x:r.state.x};
  }else{
   verification=assess(r,c,keys);assert.equal(verification.status,'passed',JSON.stringify({mode,...verification}));
   assert(assessAllRoots(r,keys.map(k=>c.expected[k]),keys).every(q=>q.valid));
  }
  report.records.push({id:c.id,model:c.model,mode,system,surface,calculateMs,verification});return r;
 }
 async function check(name,action){await action();report.checks.push({name,status:'passed'});console.log(report.browser,name,'passed');}
 async function download(action){const [d]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await d.path(),'utf8');}
 const projectExport=()=>download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(e=>e.click()));
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();report.build=await page.locator('#app-build-value').textContent();
  await check('All 16 IF97 / 11 IAPWS-95 pairs in SI and English',async()=>{
   for(const [model,modes] of Object.entries(pilot.required_modes))for(const system of ['SI','English'])for(const mode of modes){
    const c=pilot.cases.find(c=>c.model===model&&(mode.includes('x')?c.x===.5:c.group==='vapor'));await run(c,mode,system);
   }
  });
  await check('Saturated liquid/vapor endpoints and mixture phase columns',async()=>{
   for(const model of ['IF97','IAPWS-95'])for(const x of [0,1])for(const mode of ['px','tx'])await run(pilot.cases.find(c=>c.model===model&&c.x===x),mode);
  });
  await check('Every P01 failed inverse and a cold near-Pc branch through Worker',async()=>{
   for(const c of pilot.cases.filter(c=>c.group==='below-pc-one-ulp'||c.id==='IF97-below-pc-decimal'))for(const mode of ['ph','ps','pu'])await run(c,mode);
   for(const model of ['IF97','IAPWS-95'])await run(dense.records.find(c=>c.model===model&&c.p===22.063999999999997&&c.T<647.096),'ph');
   assert.ok(page.workers().length>0);
  });
  await check('Both models: exact near-Pc input, CSV and JSON project import/reload',async()=>{
   for(const model of ['IF97','IAPWS-95']){
    const c=pilot.cases.find(c=>c.model===model&&c.group==='below-pc-one-ulp'),r=await run(c,'ph');
    const csv=await download(()=>page.click('#export-csv'));assert(csv.includes(String(r.state.h)));assert(csv.includes(String(r.state.p)));assert(csv.includes(model));assert(csv.includes('"MPa"'));
    const original=JSON.parse(await projectExport());assert.equal(original.form.a,String(c.expected.p));assert.equal(original.form.model,model);assert.equal(original.form.mode,'ph');
    await page.fill('#input-a','3');await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'p02.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});
    await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value==='');await ready();assert.equal(await page.locator('#input-a').inputValue(),original.form.a);
    await page.reload();await ready();await page.waitForFunction(()=>!document.querySelector('#copy-result-json').disabled);const restored=await capture();assert.equal(assess(restored,c,['p','h']).status,'passed');assert.equal(restored.state.source.a,c.expected.p);
   }
  });
  await check('Multiple physical roots retain original inputs after selection and save',async()=>{
   const c=inverse.records.find(c=>c.id==='IF97-0042'),r=await run(c,'pv');assert.equal(r.diagnostics.roots,2);
   const target=r.alternatives[0];await page.locator('[data-use-alternative="0"]').click();let selected=await capture();assert.equal(selected.state.T,target.T);assert.equal(selected.diagnostics.selection,'manual');
   assert.deepEqual(selected.state.source,{mode:'pv',a:c.expected.p,b:c.expected.v});const saved=JSON.parse(await projectExport());assert.equal(saved.form.mode,'pv');
   await page.reload();await ready();await page.waitForFunction(()=>!document.querySelector('#copy-result-json').disabled);selected=await capture();assert.equal(selected.state.T,target.T);assert.equal(selected.diagnostics.selection,'manual');
   const csv=await download(()=>page.click('#export-csv'));assert(csv.includes('alternative_1'));assert(csv.includes(String(selected.state.h)));
  });
  await check('Exact IAPWS-95 critical state remains an error without new history',async()=>{
   await chooseModel(page,'IAPWS-95');await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a','22.064');await page.fill('#input-b','647.096');
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length);await page.click('#calculate');await ready();assert.match(await page.locator('#error').textContent(),/критична точка.*сингулярні/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length),before);
  });
  await check('Loaded offline Worker and PWA cached Worker',async()=>{
   const c=pilot.cases.find(c=>c.id==='IAPWS-95-below-pc-one-ulp');await run(c,'ph');await context.setOffline(true);await run(c,'pu','SI','loaded-offline');await context.setOffline(false);
   await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
   await ready();await context.setOffline(true);for(const model of ['IF97','IAPWS-95'])await run(pilot.cases.find(c=>c.model===model&&c.group==='below-pc-one-ulp'),'ph','SI','pwa-offline');
   assert.ok(page.workers().some(w=>w.url().includes('assets/calculator-worker.js?v=')));await page.screenshot({path:dir+'/pwa-offline.png',fullPage:true});
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{await browser.close();await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
