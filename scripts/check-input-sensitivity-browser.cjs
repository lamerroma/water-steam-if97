// Real form -> worker -> display/clipboard/export, including offline artifacts.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool,chooseModel,openUnits,closeUnits}=require('./browser-tools.cjs');
(async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),name=process.env.BROWSER_NAME||'chromium',browser=await pw[name].launch(name==='chromium'?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true}),folder=process.env.SENSITIVITY_BROWSER_DIR||'.release/input-sensitivity/'+name;
 await fs.mkdir(folder,{recursive:true});const report={browser:name,status:'running',checks:[],errors:[]};let page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 const inverse=JSON.parse(await fs.readFile('tests/fixtures/inverse-precision-reference.json')),reference=JSON.parse(await fs.readFile('tests/fixtures/input-sensitivity-reference.json'));
 async function check(title,action){await action();report.checks.push({name:title,status:'passed'});console.log(name,title,'passed');}
 async function capture(kind='json'){
  await page.evaluate(()=>{window.sensitivityCopy=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.sensitivityCopy=text}});});await page.click(kind==='json'?'#copy-result-json':'#copy-result-table');await page.waitForFunction(()=>window.sensitivityCopy!==null);const content=await page.evaluate(()=>window.sensitivityCopy);return kind==='json'?JSON.parse(content).result:content;
 }
 async function run(mode,texts,units,model='IF97'){
  await openTool(page,'general');await chooseModel(page,model);if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',mode);
  for(const [i,side] of ['a','b'].entries()){await page.selectOption('#unit-'+side,units[i]);await page.fill('#input-'+side,texts[i]);}
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});assert.equal(await page.locator('#error').isVisible(),false,await page.locator('#error').textContent());return capture();
 }
 async function ready(){await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});}
 async function downloadCSV(){const pending=page.waitForEvent('download');await page.click('#export-csv');const download=await pending;return fs.readFile(await download.path(),'utf8');}
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();report.build=await page.locator('#app-build-value').textContent();let original;
  await check('Canonical steps, independent state and compact default',async()=>{
   original=await run('pt',['3.000','400.00'],['MPa','K']);const ref=reference.records.find(c=>c.model==='IF97'&&c.expected.p===3).expected;
   assert.ok(Math.abs(original.state.h-ref.h)<1e-7);assert.equal(original.diagnostics.roundingScenario.inputs[0].halfWidth,.0005);assert.equal(original.diagnostics.roundingScenario.inputs[1].halfWidth,.005);assert.equal(original.state.inputSensitivity.status,'local');assert.equal(await page.locator('#input-sensitivity').evaluate(e=>e.open),false);assert.ok((await page.locator('#input-sensitivity').boundingBox()).height<60);
  });
  await check('Optional digits, property copy, Markdown and raw JSON/CSV',async()=>{
   const value=page.locator('.property-table').first().locator('[data-property=h] td').nth(4),before=await value.textContent();await page.locator('#input-sensitivity summary').click();await page.check('#rounding-display');const after=await value.textContent();assert.notEqual(after,before);
   const result=await capture();assert.equal(result.state.h,original.state.h);assert.deepEqual(result.diagnostics.roundingScenario,original.diagnostics.roundingScenario);
   await page.evaluate(()=>window.sensitivityCopy=null);await page.locator('.property-table').first().locator('[data-copy=h]').click();await page.waitForFunction(()=>!!window.sensitivityCopy);const copied=await page.evaluate(()=>window.sensitivityCopy);assert.ok(copied.startsWith(after.trim().replaceAll('\u00a0','').replaceAll('\u202f','')));
   const markdown=await capture('table');assert.ok(markdown.includes('Сценарій:'));assert.ok(markdown.includes('Похибка приладів'));const csv=await downloadCSV();assert.ok(csv.includes(String(original.state.h)));assert.ok(csv.includes('rounding_response_p'));assert.ok(csv.includes('input_half_step_p'));
  });
  await check('Language switch preserves values and translated scenario',async()=>{
   await page.selectOption('#language-select','en');assert.ok((await page.locator('#input-sensitivity summary').textContent()).includes('Sensitivity to input rounding'));assert.equal((await capture()).state.h,original.state.h);await page.selectOption('#language-select','uk');
  });
  await check('Fahrenheit and bar increments exclude gauge offset',async()=>{
   let r=await run('pt',['30.000','260.330'],['bar','F']);assert.ok(Math.abs(r.state.T-400)<1e-10);assert.ok(Math.abs(r.diagnostics.roundingScenario.inputs[0].halfWidth-.00005)<1e-15);assert.ok(Math.abs(r.diagnostics.roundingScenario.inputs[1].halfWidth-.0005/1.8)<1e-15);
   await openUnits(page);await page.selectOption('#pressure-basis','gauge');await page.click('#pressure-apply');await closeUnits(page);r=await run('pt',['28.98675','400.00'],['bar','K']);assert.ok(Math.abs(r.state.p-3)<1e-12);assert.ok(Math.abs(r.diagnostics.roundingScenario.inputs[0].halfWidth-.0000005)<1e-16);
   await openUnits(page);await page.selectOption('#pressure-basis','absolute');await page.click('#pressure-apply');await closeUnits(page);
  });
  await check('Coarse input scenario is marked limited',async()=>{const r=await run('pt',['3','400'],['MPa','K']);assert.equal(r.state.inputSensitivity.status,'limited');assert.equal(await page.locator('#rounding-display').count(),0);});
  await check('Scientific cold liquid duplicates collapse',async()=>{
   const c=inverse.records.find(c=>c.id==='IAPWS-95-2066'),r=await run('us',[String(c.expected.u),String(c.expected.s)],['kJkg','kJkgK'],c.model);assert.equal(r.diagnostics.roots,1);assert.ok(r.diagnostics.merged>=20);assert.equal(await page.locator('[data-use-alternative]').count(),0);assert.ok(r.state.inputSensitivity.response.p>0);
  });
  await check('Physical alternatives keep original pair and scenario when selected',async()=>{
   const c=inverse.records.find(c=>c.id==='IF97-0042'),r=await run('pv',['40.000000',String(c.expected.v)],['MPa','m3kg']);assert.equal(r.diagnostics.roots,2);const target=r.alternatives[0];await page.locator('[data-use-alternative="0"]').click();const selected=await capture();assert.equal(await page.locator('#mode').inputValue(),'pv');assert.equal(selected.state.T,target.T);assert.equal(selected.diagnostics.selection,'manual');assert.deepEqual(selected.diagnostics.roundingScenario,r.diagnostics.roundingScenario);assert.equal(selected.alternatives.length,1);assert.deepEqual(selected.state.source,{mode:'pv',a:40,b:c.expected.v});await page.reload();await ready();await page.waitForFunction(()=>!document.querySelector('#copy-result-json').disabled);const restored=await capture();assert.equal(restored.state.T,target.T);assert.equal(restored.diagnostics.selection,'manual');
  });
  await check('Saturation reference states show their own pressure after a root selection',async()=>{
   const c=inverse.records.find(c=>c.id==='IF97-0172'),r=await run('ts',[String(c.expected.T),String(c.expected.s)],['K','kJkgK']);assert.ok([r.state,...r.alternatives].some(q=>Math.abs(q.p-r.saturation.p)>1));const pressure=new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:8}).format(r.saturation.p);assert.ok((await page.locator('[data-saturation-reference]').textContent()).includes(pressure));await page.locator('[data-use-alternative]').last().click();const selected=await capture();assert.ok((await page.locator('[data-saturation-reference]').textContent()).includes(pressure));assert.equal(selected.saturation.p,r.saturation.p);
  });
  await check('Mixture does not invent single-phase sensitivity or digits',async()=>{
   const q=inverse.records.find(c=>c.model==='IF97'&&c.group==='mixture'&&c.expected.p===1&&c.x===.5),r=await run('ph',['1.000000',String(q.expected.h)],['MPa','kJkg']);assert.equal(r.state.inputSensitivity.status,'unavailable');assert.equal(r.state.inputSensitivity.response,null);assert.equal(await page.locator('#rounding-display').count(),0);
  });
  await check('Reload reconstructs scenario from saved input spelling',async()=>{
   const r=await run('pt',['3.000','400.00'],['MPa','K']);await page.reload();await ready();await page.waitForFunction(()=>!document.querySelector('#copy-result-json').disabled);const restored=await capture();assert.deepEqual(restored.diagnostics.roundingScenario,r.diagnostics.roundingScenario);assert.equal(restored.state.h,r.state.h);
  });
  await check('Mobile details stay within viewport',async()=>{
   await page.setViewportSize({width:390,height:844});await page.locator('#input-sensitivity summary').click();const box=await page.locator('#input-sensitivity').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391,JSON.stringify(box));await page.screenshot({path:folder+'/mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
  });
  await check('Loaded offline warm worker retains diagnostics',async()=>{await run('pt',['3.000','400.00'],['MPa','K']);await context.setOffline(true);const r=await run('pt',['3.000','400.00'],['MPa','K']);assert.equal(r.state.inputSensitivity.status,'local');await context.setOffline(false);});
  await check('Standalone artifact works offline with embedded worker',async()=>{
   try{await page.goto('file://'+process.cwd()+'/dist/standalone.html');report.standalone='file';}catch(e){report.fileNavigation={status:'blocked',message:e.message};await page.close();page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(new URL('standalone.html',process.env.CALCULATOR_URL||'http://127.0.0.1:8080/').href);report.standalone='loopback-then-offline';}
   await ready();await context.setOffline(true);const r=await run('pt',['3.000','400.00'],['MPa','K']);assert.equal(r.state.inputSensitivity.status,'local');assert.equal(r.diagnostics.roundingScenario.inputs[1].halfWidth,.005);await page.screenshot({path:folder+'/standalone.png',fullPage:true});
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{await browser.close();await fs.writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
