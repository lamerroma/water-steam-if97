// Actual C++ exception in the page's shared WASM; disposable browser context.
// Only this test server exposes closure hooks. Shipped assets remain unchanged.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {openUnits,closeUnits,openTool}=require('./browser-tools.cjs');
const chooseModel=async(page,model)=>{
 await openUnits(page);await page.locator('input[name=formulation][value="'+model+'"]').click();
 await page.waitForFunction(model=>document.querySelector('input[name=formulation]:checked')?.value===model,model,{timeout:120000});await closeUnits(page);
};
(async()=>{
 const root=path.resolve('dist'),name=process.env.BROWSER_NAME||'chromium';
 const output=path.resolve(process.env.HEOS_FAULT_EVIDENCE||'.release/development-r01/fault-'+name);await fs.mkdir(output,{recursive:true});
 const report={date:new Date().toISOString(),browser:name,status:'running',checks:[],pageErrors:[],scope:'Shared main-thread HEOS failure quarantine and reload recovery. Test-only closure hooks; service workers blocked; no offline or physical-device claim.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');
  if(!file.startsWith(root+path.sep))throw Error('outside root');
  let data=await fs.readFile(file);
  if(file===path.join(root,'assets/app.js')){
   const source=data.toString(),end=source.lastIndexOf('\n})();');assert.ok(end>0,'known application closure');
   data=Buffer.from(source.slice(0,end)+'\nwindow.__heosFaultTest={initializeWaterHeos,initializeHumidAir,getCoolPropBackend,calculateWaterHeos,humidAirScientific,realGasState};\n'+source.slice(end));
  }
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}});
 let browser;
 const mark=text=>{report.checks.push(text);console.log('PASS '+text);};
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',error=>report.pageErrors.push(error.message));
  await context.addInitScript(()=>{
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopied=text;}}});
   const NativeWorker=window.Worker;
   window.Worker=class extends NativeWorker{
    postMessage(message,...args){
     if(window.delayHeosAmbient&&message.moduleId==='water-heos'&&message.payload?.mode==='pt'&&message.payload.a>=.09&&message.payload.a<=.095){
      setTimeout(()=>{if(!this.probeTerminated)super.postMessage(message,...args);},300);return;
     }
     return super.postMessage(message,...args);
    }
    terminate(){this.probeTerminated=true;return super.terminate();}
   };
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
  report.build=await page.locator('#app-build-value').textContent();await chooseModel(page,'HEOS::Water');
  await page.evaluate(()=>window.__heosFaultTest.initializeWaterHeos());
  await page.evaluate(()=>{
   const cp=window.__heosFaultTest.getCoolPropBackend();window.mainNativeQueries=0;window.originalMainProps=cp.PropsSI;window.originalMainFactory=cp.factory;
   cp.PropsSI=cp.factory=()=>{window.mainNativeQueries++;throw Error('Main-thread native query during rendering');};
  });
  await openTool(page,'general');if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');
  await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a','1');await page.fill('#input-b','500');
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:120000});
  assert.equal(await page.locator('#error').isHidden(),true,await page.locator('#error').textContent());
  const controls=JSON.parse(await fs.readFile('tests/fixtures/heos-ambient-reference.json','utf8'));
  const current=async()=>{await page.click('#copy-result-json');await page.waitForFunction(()=>window.testCopied);return page.evaluate(()=>{const value=JSON.parse(window.testCopied).result.state;delete window.testCopied;return value;});};
  report.ambientWorker=[];
  let actual=await current();assert.ok(Math.abs(actual.ex-controls.records[0].exergy)<2e-7);report.ambientWorker.push(actual);
  // These hidden settings use the actual handler; only the native WASM is
  // instrumented to reject a main-thread property call, never the Worker.
  await page.evaluate(settings=>{document.querySelector('#ambient-p').value=String(settings.p);document.querySelector('#ambient-t').value=String(settings.T-273.15);document.querySelector('#ambient-apply').click();},controls.records[1].ambient);
  await page.waitForFunction(()=>!document.querySelector('#ambient-apply').disabled,null,{timeout:120000});
  actual=await current();assert.ok(Math.abs(actual.ex-controls.records[1].exergy)<2e-7);report.ambientWorker.push(actual);
  await page.evaluate(()=>{window.delayHeosAmbient=true;document.querySelector('#ambient-p').value='.09';document.querySelector('#ambient-t').value='42';document.querySelector('#ambient-apply').click();document.querySelector('#ambient-p').value='.095';});
  await page.waitForFunction(()=>!document.querySelector('#ambient-apply').disabled,null,{timeout:120000});
  assert.match(await page.locator('#ambient-status').textContent(),/змінено під час обчислення/);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).ambient),controls.records[1].ambient);
  assert.ok(Math.abs((await current()).ex-controls.records[1].exergy)<2e-7);
  mark('Editing ambient inputs while a reference is pending preserves the applied environment and exergy');
  await page.evaluate(()=>{document.querySelector('#ambient-p').value='.095';document.querySelector('#ambient-t').value='42';document.querySelector('#ambient-apply').click();});
  await page.click('#calculator-cancel');await page.waitForFunction(()=>!document.querySelector('#ambient-apply').disabled);
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).ambient),controls.records[1].ambient);
  assert.ok(Math.abs((await current()).ex-controls.records[1].exergy)<2e-7);
  await page.evaluate(settings=>{window.delayHeosAmbient=false;document.querySelector('#ambient-p').value=String(settings.p);document.querySelector('#ambient-t').value=String(settings.T-273.15);},controls.records[1].ambient);
  mark('Cancelling an ambient reference leaves no stale environment or exergy update');
  assert.equal(await page.evaluate(()=>window.mainNativeQueries),0);await page.evaluate(()=>{const cp=window.__heosFaultTest.getCoolPropBackend();cp.PropsSI=window.originalMainProps;cp.factory=window.originalMainFactory;delete window.originalMainProps;delete window.originalMainFactory;});
  mark('First HEOS result and changed ambient match independent exergy controls without a main-thread property query');
  report.before=await page.evaluate(()=>window.__heosFaultTest.calculateWaterHeos('pt',1,500).state.h);
  assert.ok(Math.abs(report.before-2891.218298958905)<1e-7);
  const historyBefore=await page.locator('#history-count').textContent();
  report.fault=await page.evaluate(async()=>{
   const api=window.__heosFaultTest,cp=api.getCoolPropBackend(),state=cp.factory('HEOS','Water');let faults=0,nativeFollowups=0;
   cp.PropsSI=()=>{faults++;state.update(cp.input_pairs.PT_INPUTS,-1,500);};
   let failure;try{api.calculateWaterHeos('pt',1,500);}catch(error){failure={code:error.code,message:error.message,details:error.details};}
   cp.PropsSI=cp.HAPropsSI=()=>{nativeFollowups++;throw Error('quarantined native access');};
   const consumers={};
   for(const [key,invoke] of Object.entries({water:()=>api.calculateWaterHeos('pt',1,500),humid:()=>api.humidAirScientific(.101325,300,.5),gas:()=>api.realGasState('N2',.1,300),backend:()=>api.getCoolPropBackend(),initWater:()=>api.initializeWaterHeos(),initHumid:()=>api.initializeHumidAir()})){
    try{await invoke();consumers[key]={rejected:false};}catch(error){consumers[key]={rejected:true,code:error.code,reloadPage:error.details?.reloadPage};}
   }
   return {failure,faults,nativeFollowups,consumers};
  });
  assert.equal(report.fault.faults,1);assert.equal(report.fault.nativeFollowups,0);assert.equal(report.fault.failure.code,'unavailable');assert.equal(report.fault.failure.details.reloadPage,true);
  for(const consumer of Object.values(report.fault.consumers)){assert.equal(consumer.rejected,true);assert.equal(consumer.code,'unavailable');assert.equal(consumer.reloadPage,true);}
  mark('Actual native exception quarantines water, humid air, real gases and initialization without further native calls');
  await openTool(page,'general');await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  await page.waitForFunction(()=>!document.querySelector('#error').hidden);assert.match(await page.locator('#error').textContent(),/Оновіть сторінку/);
  assert.equal(await page.locator('#history-count').textContent(),historyBefore);
  await page.screenshot({path:path.join(output,'quarantined.png'),fullPage:true});mark('Actual calculator shows the page-reload recovery instruction');
  await page.selectOption('#language-select','en');await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  assert.match(await page.locator('#error').textContent(),/Reload the page/);assert.equal(parseInt(await page.locator('#history-count').textContent()),parseInt(historyBefore));
  mark('Quarantined calculations preserve history and show the English recovery instruction');
  await chooseModel(page,'IF97');await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await page.locator('#error').isHidden(),true);
  mark('Independent IF97 calculator remains usable while shared CoolProp is quarantined');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);await chooseModel(page,'HEOS::Water');
  await page.evaluate(()=>window.__heosFaultTest.initializeWaterHeos());
  report.recovered=await page.evaluate(()=>window.__heosFaultTest.calculateWaterHeos('pt',1,500).state.h);assert.equal(report.recovered,report.before);
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await page.locator('#error').isHidden(),true);
  await page.screenshot({path:path.join(output,'recovered.png'),fullPage:true});mark('A new page/WASM restores the same HEOS result and the actual calculator');
  assert.deepEqual(report.pageErrors,[]);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
