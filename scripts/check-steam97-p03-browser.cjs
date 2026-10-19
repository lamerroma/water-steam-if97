const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {openTool,openUnits,closeUnits}=require('./browser-tools.cjs');
(async()=>{
 const name=process.env.BROWSER_NAME||'chromium',pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const dir=path.resolve('.release/steam97-p03/'+name);await fs.mkdir(dir,{recursive:true});
 const controls=JSON.parse(await fs.readFile('.release/steam97-p03/controls.json'));
 const version=JSON.parse(await fs.readFile('package.json')).version;
 const report={version,browser:name,browserVersion:browser.version(),playwrightVersion:require(path.join(path.dirname(require.resolve(process.env.PLAYWRIGHT_MODULE_PATH||'playwright')),'package.json')).version,status:'running',files:[],groups:[],errors:[],numericalChecks:0};
 let context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow',viewport:{width:1440,height:1000}}),page=await context.newPage();
 const listen=()=>page.on('pageerror',e=>report.errors.push(e.message));listen();
 const ready=()=>page.waitForFunction(()=>document.querySelector('#calculate')?.disabled===false,{},{timeout:120000});
 const near=(a,b)=>{assert.ok(Math.abs(a-b)<=2e-11+3e-12*Math.abs(b),`${a} != ${b}`);report.numericalChecks++;};
 const expected=controls.find(r=>r.id==='8/1000/1').expected;
 async function calc(){await page.locator('#learn-form button[type=submit]').click();await page.waitForFunction(()=>!!document.querySelector('#gas-spreadsheet-save')||!document.querySelector('#learn-error')?.hidden);assert.equal(await page.locator('#learn-error').isHidden(),true,await page.locator('#learn-error').textContent());await page.waitForSelector('#gas-spreadsheet-save');}
 let serial=0;
 async function json(){const [d]=await Promise.all([page.waitForEvent('download'),page.click('#learn-json')]);const file=path.join(dir,`result-${serial++}.json`);await d.saveAs(file);const q=JSON.parse(await fs.readFile(file));assert.equal(q.exportedWith.model,'BSW2003 · technical ideal gas');assert.equal(q.exportedWith.appVersion,version);return q;}
 function check(q,e=expected){assert.equal(q.modelId,'BSW2003-technical');for(const [k,v]of Object.entries(e))near(q[k],v);assert.equal(q.dissociationApplied,false);}
 async function prepare(){await openTool(page,'gases');await page.selectOption('#gas-model','bsw2003');await page.selectOption('#gas-preset','air');await page.selectOption('#ui-unit-gas-p','MPa');await page.selectOption('#ui-unit-gas-b','K');await page.fill('#gas-p','1');await page.fill('#gas-b','1000');await calc();check((await json()).result);}
 function fileChecks(english=false,joules=false){const entries={...expected,p:1,T:1000-273.15};if(english){entries.p=1/.006894757293168361;entries.T=(1000-273.15)*1.8+32;for(const k of ['h','u'])entries[k]/=2.326;for(const k of ['s','cp','cv','R','mixingEntropy'])entries[k]/=4.1868;entries.rho*=.0624279605761;entries.v*=16.018463374;entries.w*=3.280839895;}
  if(joules)for(const k of ['h','u','s','cp','cv','R','mixingEntropy'])entries[k]*=1000;
  // English density/volume/speed follow the existing conversion contract, tested
  // independently elsewhere. P03 files use exact Decimal controls for calorics.
  const keys=english?['p','T','h','s','cp','cv','R','mixingEntropy','isentropic']:Object.keys(entries);
  return [...keys.map(k=>({sheet:'Properties',prefix:[k],column:1,value:entries[k],relative_tolerance:3e-12,absolute_tolerance:2e-11})),{sheet:'Composition',prefix:['Ne'],column:1,value:0},{sheet:'Composition',prefix:['N2'],column:1,value:78.084},{sheet:'Metadata',prefix:['T0_K'],column:1,value:273.15},{sheet:'Metadata',prefix:['p0_MPa'],column:1,value:.101325},{sheet:'Metadata',prefix:['model'],column:1,value:'BSW2003 · technical ideal gas'}];
 }
 async function download(tag,english=false,joules=false){for(const format of ['xlsx','ods','xls','csv']){await page.selectOption('#gas-spreadsheet-format',format);const [d]=await Promise.all([page.waitForEvent('download'),page.click('#gas-spreadsheet-save')]);const file=path.join(dir,tag+'.'+format);await d.saveAs(file);report.files.push({file,format,checks:fileChecks(english,joules)});if(name==='chromium')await page.waitForTimeout(120);}}
 try{
  // BSW2003 must remain usable when the optional real-fluid backend cannot load.
  await context.route('**/assets/coolprop.wasm*',r=>r.abort());
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();report.buildId=await page.locator('#app-build-value').textContent();await prepare();
  for(const id of ['Ar','CO','CO2','H2O','N2','Ne','O2','SO2']){await page.selectOption('#gas-preset',id);for(const T of [200,3300]){await page.fill('#gas-b',String(T));await calc();const control=controls.find(r=>r.T===T&&r.p===1&&r.fractions[id]===1);check((await json()).result,control.expected);}}await page.selectOption('#gas-preset','air');await page.fill('#gas-b','1000');await calc();report.groups.push('All eight pure components at both closed temperature endpoints in the actual worker/UI');
  assert.equal(await page.locator('#gas-fraction-scale').inputValue(),'percent');assert.equal(await page.locator('#gas-composition-result tbody tr').count(),8);assert.equal(await page.locator('#fraction-H2').isVisible(),false);
  await download('si');report.groups.push('BSW2003 works with unavailable CoolProp; eight-component result, typed four-format exports and independent Decimal controls');
  await page.selectOption('#gas-basis','mass');await calc();check((await json()).result);await page.selectOption('#gas-basis','mole');await page.selectOption('#gas-fraction-scale','fraction');await calc();check((await json()).result);
  const [saved]=await Promise.all([page.waitForEvent('download'),page.click('#learn-json')]);const savedFile=path.join(dir,'calculation.json');await saved.saveAs(savedFile);
  await page.reload();await ready();await page.waitForSelector('#gas-spreadsheet-save');assert.equal(await page.locator('#gas-fraction-scale').inputValue(),'fraction');near(Number(await page.locator('#fraction-N2').inputValue()),.78084);check((await json()).result);
  // Re-import ignores a deliberately forged stored result and computes inputs.
  const imported=JSON.parse(await fs.readFile(savedFile));imported.result.h=999999;
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'gas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.waitForSelector('#gas-spreadsheet-save');await page.waitForFunction(()=>document.querySelector('#result-status').textContent.includes('входів'));check((await json()).result);
  report.groups.push('Mass/mole and percent/fraction conversions; local reload and JSON import recompute inputs and retain composition units');
  for(const mode of ['ph','ps']){await page.selectOption('#gas-mode',mode);await page.waitForSelector('#ui-unit-gas-b');await page.selectOption('#ui-unit-gas-b',mode==='ph'?'kJkg':'kJkgK');await page.fill('#gas-b',String(expected[mode==='ph'?'h':'s']));await calc();near((await json()).result.T,1000);}
  await page.selectOption('#gas-mode','pt');await page.selectOption('#ui-unit-gas-b','F');await page.fill('#gas-b',String((1000-273.15)*1.8+32));await page.selectOption('#ui-unit-gas-p','bar');await page.fill('#gas-p','10');await calc();check((await json()).result);
  report.groups.push('P-h/P-s inversions and independent pressure/temperature input units');
  await page.fill('#gas-b','-200');await page.locator('#learn-form button[type=submit]').click();await page.waitForSelector('#learn-error:not([hidden])');assert.equal(await page.locator('#gas-spreadsheet-save').count(),0);
  await page.fill('#gas-b',String((1000-273.15)*1.8+32));await page.fill('#fraction-N2','.7');await page.locator('#learn-form button[type=submit]').click();await page.waitForSelector('#learn-error:not([hidden])');assert.ok((await page.locator('#learn-error').textContent()).includes('100'));
  await page.selectOption('#gas-preset','air');await calc();
  // Start and cancel synchronously in one browser task so the warmed worker cannot
  // complete before cancellation. No private numerical functions are invoked.
  await page.evaluate(()=>{document.querySelector('#learn-form').requestSubmit();document.querySelector('#gas-cancel').click();});await page.waitForFunction(()=>document.querySelector('#gas-cancel').hidden);await page.waitForTimeout(100);assert.equal(await page.locator('#learn-form').getAttribute('aria-busy'),null);await page.fill('#gas-b',String((1000-273.15)*1.8+32));await calc();check((await json()).result);
  await page.evaluate(()=>document.querySelector('#learn-form').requestSubmit());await openTool(page,'general');await openTool(page,'gases');await page.waitForSelector('#gas-spreadsheet-save');check((await json()).result);
  report.groups.push('Invalid totals/bounds clear results; cancellation, retry and navigation discard stale worker replies');
  await openUnits(page);await page.selectOption('#output-energy','J');await closeUnits(page);await download('joules',false,true);await openUnits(page);await page.selectOption('#output-system','english');await closeUnits(page);await download('english',true);
  await page.selectOption('#language-select','en');assert.equal(await page.locator('#gas-fraction-scale option[value=percent]').textContent(),'Percentages 0…100');assert.ok((await page.locator('#learn-output').textContent()).includes('Direct comparison'));await calc();await page.selectOption('#language-select','uk');assert.ok((await page.locator('#learn-output').textContent()).includes('Пряме зіставлення'));await page.selectOption('#language-select','en');assert.ok((await page.locator('#learn-output').textContent()).includes('Direct comparison'));
  for(const width of [320,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(dir,'gas-'+width+'.png'),fullPage:true});}
  report.groups.push('English results/preferences, translated controls and 320/390 px layout');
  // Old NASA projects with no scale field use the original 0..1 convention.
  const legacy={format:'water-steam-calculation',version:1,module:'gases',model:'IF97',inputs:{'gas-model':'ideal','gas-mode':'pt','gas-p':'.101325','gas-b':'1000','gas-basis':'mole','gas-preset':'air','fraction-N2':'.78084','fraction-O2':'.20946','fraction-Ar':'.00934','fraction-CO2':'.00036'}};
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'nasa.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await page.waitForFunction(()=>document.querySelector('#learn-form')?.dataset.calculated==='true'&&document.querySelector('#gas-model')?.value==='ideal');assert.equal(await page.locator('#gas-fraction-scale').inputValue(),'fraction');assert.ok((await page.locator('#learn-output').textContent()).includes('NASA7'));report.groups.push('Legacy NASA7 calculation import remains functional without a composition-scale field');
  await context.close();context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow'});page=await context.newPage();listen();
  await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
  await ready();await prepare();await download('pwa-offline');report.groups.push('PWA offline: worker, numerical results and all four exports');
  await context.close();context=await browser.newContext({acceptDownloads:true});page=await context.newPage();listen();await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();await page.waitForFunction(()=>/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),{},{timeout:120000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await ready();await prepare();await download('pwa-offline');report.groups.push('Installed PWA offline reload: full BSW2003 calculation and four exports');
  const manifest=path.join(dir,'manifest.json');await fs.writeFile(manifest,JSON.stringify(report,null,2));const readers=spawnSync(process.env.P03_PYTHON||'python3',['scripts/reference/spreadsheet_readers.py',manifest],{encoding:'utf8',timeout:120000});assert.equal(readers.status,0,readers.stderr);report.readers=JSON.parse(await fs.readFile(path.join(dir,'reader-report.json')));assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify({browser:name,status:report.status,groups:report.groups.length,numericalChecks:report.numericalChecks,files:report.files.length,readerChecks:report.readers.checks,offlineMode:report.offlineMode}));
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
