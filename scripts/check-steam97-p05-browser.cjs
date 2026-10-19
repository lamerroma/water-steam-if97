const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool,chooseModel,openUnits,closeUnits}=require('./browser-tools.cjs');
(async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),name=process.env.BROWSER_NAME||'chromium';
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true});
 const dir=process.env.P05_BROWSER_DIR||'.release/steam97-p05/'+name;await fs.mkdir(dir,{recursive:true});
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/steam97-p05-reference.json'));
 const report={browser:name,status:'running',records:[],checks:[],errors:[]};let page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});
 const point=(p,T)=>fixture.records.find(c=>c.expected.p===p&&c.expected.T===T);
 async function capture(){await page.evaluate(()=>{window.p05Copy=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.p05Copy=text}});});await page.click('#copy-result-json');await page.waitForFunction(()=>!!window.p05Copy);return page.evaluate(()=>JSON.parse(window.p05Copy).result);}
 async function run(c,mode='pt',english=false,surface='worker'){
  await openTool(page,'general');await chooseModel(page,'IAPWS-95');await openUnits(page);await page.selectOption('#output-system',english?'english':'si');await closeUnits(page);
  if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',mode);
  const units={p:english?'psi':'MPa',t:english?'F':'K',h:english?'Btulb':'kJkg',s:english?'BtulbR':'kJkgK',u:english?'Btulb':'kJkg',v:english?'ft3lb':'m3kg'};
  const convert=(key,x)=>!english?x:key==='p'?x*1e6/6894.757293168:key==='t'?(x-273.15)*1.8+32:key==='v'?x*.45359237/.3048**3:x*1000*.45359237/1055.05585262/(key==='s'?1.8:1);
  for(const [i,side]of ['a','b'].entries()){const k=mode[i];await page.selectOption('#unit-'+side,units[k]);await page.fill('#input-'+side,String(convert(k,c.expected[k==='t'?'T':k])));}
  await page.click('#calculate');await ready();assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());
  const r=await capture(),q=r.state,e=c.expected;
  assert.ok(Math.abs(q.p-e.p)<fixture.policy.inverse_pressure_absolute);assert.ok(Math.abs(q.T-e.T)<fixture.policy.inverse_temperature_absolute);
  for(const key of ['h','rho','mu','lambda','dc']){
   if(c.available[key]===false){assert.equal(q[key],null);assert.match(await page.locator(`[data-property="${key}"] .unavailable-reason`).first().textContent(),/IAPWS-95|873/);}
   else assert.ok(Math.abs(q[key]-e[key])<=Math.max(fixture.policy.forward_absolute[key],Math.abs(e[key])*fixture.policy.forward_relative),key);
  }
  assert.equal(q.Pr!=null,c.available.Pr);report.records.push({id:c.id,mode,english,surface,p:q.p,T:q.T,mu:q.mu,lambda:q.lambda,Pr:q.Pr});return r;
 }
 async function check(label,action){await action();report.checks.push({label,status:'passed'});console.log(name,label,'passed');}
 async function download(action){const [d]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await d.path(),'utf8');}
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();report.build=await page.locator('#app-build-value').textContent();report.version=await page.locator('#app-version-value').textContent();
  await check('Cold stable liquid: forward/inverses, SI and English',async()=>{
   for(const english of [false,true])for(const mode of ['pt','ph','ps','pv','hs'])await run(point(200,260),mode,english);
   assert.ok(page.workers().length>0);
  });
  await check('Independent transport availability and CSV reasons',async()=>{
   for(const [p,T]of [[200,400],[400,500],[700,380],[300,900],[1000,348]]){
    const c=point(p,T);await run(c);const csv=await download(()=>page.click('#export-csv'));
    for(const key of ['mu','lambda'])if(c.available[key]===false){assert.ok(csv.includes(`"${key}","","`));assert.ok(csv.includes(`"${key}_unavailable_reason"`));}
   }
  });
  await check('Cold input survives JSON import, reload and offline recalculation',async()=>{
   const c=point(200,260);await run(c);
   const saved=JSON.parse(await download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(e=>e.click())));
   assert.equal(saved.form.a,'200');assert.equal(saved.form.b,'260');assert.equal(saved.form.model,'IAPWS-95');
   await page.fill('#input-b','400');await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'p05.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
   await page.waitForFunction(()=>document.querySelector('#result-status').textContent.includes('Проєкт імпортовано'));await page.reload();await ready();await page.waitForFunction(()=>!document.querySelector('#copy-result-json').disabled);assert.ok(Math.abs((await capture()).state.T-260)<2e-6);
   // A restored result was computed by the project reader, not the calculator
   // worker. Start the latter online before testing its offline reuse. Full
   // cold-start offline support is checked separately with the installed PWA.
   await run(c);assert.ok(page.workers().length>=2);
   await context.setOffline(true);await run(c,'ph',false,'loaded-offline');await context.setOffline(false);
   const legacy={format:'water-steam-if97',version:1,history:[{p:.005173683148148375,h:38.63730268853567,model:'IAPWS-95',source:{mode:'us',a:38.63212828313412,b:.1391036658359701}}],form:{mode:'us',model:'IAPWS-95',a:'38.63212828313412',b:'.1391036658359701',ua:'kJkg',ub:'kJkgK',calculated:true,selectedRoot:{p:.005173683148148375,T:282.3426492768052}}};
   await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
   await page.waitForFunction(()=>document.querySelector('#result-status').textContent.includes('Проєкт імпортовано'));const restored=await capture();assert.equal(restored.diagnostics.selection,'manual');assert.ok(Math.abs(restored.state.u-38.63212828313412)<1e-10);
  });
  await check('Ice input fails without adding history; English property explanation',async()=>{
   await run(point(200,260));await page.fill('#input-a','1');await page.fill('#input-b','260');
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length);await page.click('#calculate');await ready();assert.ok(await page.locator('#input-error-b').isVisible());
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length),before);
   await run(point(400,500));await page.selectOption('#language-select','en');await page.waitForFunction(()=>document.documentElement.lang==='en');assert.match(await page.locator('[data-property="mu"] .unavailable-reason').first().textContent(),/Outside.*433.15/);await page.selectOption('#language-select','uk');
  });
  await check('PWA cached Worker calculates cold liquid offline',async()=>{
   await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
   await ready();await context.setOffline(true);await run(point(200,260),'pt',false,'pwa-offline');await run(point(400,500),'pt',false,'pwa-offline');assert.ok(page.workers().some(w=>w.url().includes('assets/calculator-worker.js?v=')));await page.screenshot({path:dir+'/pwa-offline.png',fullPage:true});
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{await browser.close();await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
