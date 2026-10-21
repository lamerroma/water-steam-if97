// Actual bundled UI. No engine instrumentation or substituted numerical results.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {openTool,openUnits,closeUnits}=require('./browser-tools.cjs');
const chooseModel=async(page,model)=>{await openUnits(page);await page.locator('input[name=formulation][value="'+model+'"]').click();await page.waitForFunction(model=>document.querySelector('input[name=formulation]:checked')?.value===model,model,{timeout:120000});await closeUnits(page);};
(async()=>{
 const root=path.resolve(process.env.AUXILIARY_ROOT||'dist'),browserName=process.env.BROWSER_NAME||'chromium';
 const baseline=process.argv.includes('--baseline'),offline=process.env.AUXILIARY_OFFLINE==='1';
 const output=path.resolve(process.env.AUXILIARY_EVIDENCE||`.release/development-r01/auxiliary-${browserName}-${baseline?'before':offline?'offline':'after'}`);await fs.mkdir(output,{recursive:true});
 const report={date:new Date().toISOString(),browser:browserName,status:'running',baseline,offline,measurements:[],checks:[],errors:[],workerRequests:[],scope:'Unmodified UI/Worker/WASM assets, headless desktop, fresh context per engineering kind and diagram; 20 ms timer; single-run measurement, not physical mobile acceptance.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}});
 let browser;
 const start=page=>page.evaluate(()=>{window.auxProbe={start:performance.now(),last:performance.now(),gaps:[]};window.auxTimer=setInterval(()=>{const now=performance.now();window.auxProbe.gaps.push(now-window.auxProbe.last);window.auxProbe.last=now;},20);});
 const stop=async(page,label)=>{await page.waitForTimeout(60);const timing=await page.evaluate(()=>{clearInterval(window.auxTimer);return {elapsedMs:performance.now()-window.auxProbe.start,heartbeatMaxGapMs:Math.max(0,...window.auxProbe.gaps),heartbeatTicks:window.auxProbe.gaps.length};});report.measurements.push({label,...timing});console.log(browserName+' '+label+': '+timing.heartbeatMaxGapMs+' ms');};
 const diagramReady=page=>page.waitForFunction(()=>{const button=document.querySelector('#diagram-save');return button&&!button.disabled&&Chart.getChart('steam-diagram')?.$detailStats;},null,{timeout:180000});
 const capture=page=>page.evaluate(()=>{const c=Chart.getChart('steam-diagram');return {stats:c.$detailStats,datasets:c.data.datasets.map(d=>({role:d.role,id:d.id,data:d.data,hidden:d.hidden}))};});
 const download=async(page,id,name)=>{const [file]=await Promise.all([page.waitForEvent('download'),page.click('#'+id)]);await fs.copyFile(await file.path(),path.join(output,name));};
 async function fresh(){
  const context=await browser.newContext({serviceWorkers:offline?'allow':'block',acceptDownloads:true,viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{const NativeWorker=window.Worker;window.auxRequests=[];window.Worker=class extends NativeWorker{postMessage(message,...args){window.auxRequests.push({module:message.moduleId,method:message.methodId,model:message.payload?.model});return super.postMessage(message,...args);}};});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
  if(offline){await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),null,{timeout:120000});await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);}
  report.build=await page.locator('#app-build-value').textContent();await chooseModel(page,'HEOS::Water');return {context,page};
 }
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[browserName].launch({headless:true});report.browserVersion=browser.version();
  for(const kind of ['compressor','pump','heat-exchanger']){
   const {context,page}=await fresh();await openTool(page,'engineering');await page.selectOption('#eng-mode',kind);
   const inputs=kind==='heat-exchanger'?{p1:1,t1:150,p2:1,flow:2,pc1:.1,tc1:20,pc2:.1,coldflow:3,power:200}:kind==='pump'?{p1:.1,t1:20,p2:10,eta:80,flow:2}:{p1:.1,t1:150,p2:1,eta:80,flow:2};
   for(const [key,value] of Object.entries(inputs))await page.fill('#eng-'+key,String(value));
   await start(page);await page.locator('#engineering-form button[type=submit],#engineering-form button:not([type])').first().click();await page.waitForSelector('#eng-export',{timeout:120000});await stop(page,kind);assert.equal(await page.locator('#eng-error').textContent(),'');
   if(!baseline)assert.match(await page.locator('#result-status').textContent(),/виконано|completed/i);
   await download(page,'eng-export',kind+'.csv');
   if(!baseline){
    assert.ok(await page.evaluate(()=>window.auxRequests.some(r=>r.method==='engineering'&&r.model==='HEOS::Water')));
    for(const action of ['cancel','edit','navigate']){
     await page.evaluate(action=>{document.querySelector('#engineering-form').requestSubmit();if(action==='cancel')document.querySelector('#eng-cancel').click();if(action==='edit'){const el=document.querySelector('#eng-flow');el.value='2.5';el.dispatchEvent(new Event('input',{bubbles:true}));}},action);
     if(action==='navigate')await openTool(page,'general');await page.waitForTimeout(100);assert.equal(await page.locator('#eng-export').count(),0);if(action==='navigate')await openTool(page,'engineering');report.checks.push(kind+': '+action+' prevents stale result');
    }
    await page.locator('#engineering-form button[type=submit],#engineering-form button:not([type])').first().click();await page.waitForSelector('#eng-export',{timeout:120000});await page.reload();await page.waitForSelector('#eng-export',{timeout:120000});report.checks.push(kind+': retry and project reload');
    await page.fill('#eng-flow','-1');await page.locator('#engineering-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#eng-error').textContent.length>0);assert.equal(await page.locator('#eng-export').count(),0);
    await page.fill('#eng-flow','2.5');await page.locator('#engineering-form button[type=submit]').click();await page.waitForSelector('#eng-export',{timeout:120000});report.checks.push(kind+': invalid input and retry');
    await page.selectOption('#language-select','en');await page.waitForSelector('#eng-export',{timeout:120000});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.setViewportSize({width:1440,height:1000});report.checks.push(kind+': English and 390 px viewport');
   }
   await page.screenshot({path:path.join(output,kind+'.png'),fullPage:true});report.workerRequests.push(...await page.evaluate(()=>window.auxRequests));await context.close();
  }
  const {context,page}=await fresh();await start(page);await openTool(page,'phdiagram');await diagramReady(page);await stop(page,'diagram-cold');
  await fs.writeFile(path.join(output,'diagram-base.json'),JSON.stringify(await capture(page),null,2));await download(page,'diagram-save','diagram-base.svg');
  await page.locator('.diagram-settings').evaluate(e=>e.open=true);await start(page);await page.check('#diagram-isotherms');await diagramReady(page);await stop(page,'diagram-isotherms');
  await fs.writeFile(path.join(output,'diagram-guides.json'),JSON.stringify(await capture(page),null,2));
  await start(page);await page.evaluate(()=>{document.querySelector('#diagram-isobars').click();for(let i=0;i<3;i++)document.querySelector('#diagram-in').click();});await diagramReady(page);await stop(page,'diagram-zoom');
  await fs.writeFile(path.join(output,'diagram-zoom.json'),JSON.stringify(await capture(page),null,2));await download(page,'diagram-save','diagram-zoom.svg');
  if(!baseline){
   for(const method of ['diagram-base','diagram-isotherm','diagram-refine'])assert.ok(await page.evaluate(method=>window.auxRequests.some(r=>r.method===method),method),method);
   await page.evaluate(()=>{for(let i=0;i<5;i++)document.querySelector('#diagram-in').click();document.querySelector('#diagram-reset').click();});await diagramReady(page);report.checks.push('Diagram: rapid viewport changes settle and exports re-enable');
   await openTool(page,'general');assert.equal(await page.evaluate(()=>Object.keys(Chart.instances).length),0);
   await openTool(page,'ts');await diagramReady(page);await openTool(page,'hsdiagram');await diagramReady(page);report.checks.push('Diagram: three coordinate systems and chart disposal');
   await page.reload();await diagramReady(page);report.checks.push('Diagram: project reload recomputes guides');
   // Start a cold model's base grid and leave in the same JS turn.
   await openTool(page,'general');await chooseModel(page,'IAPWS-95');await page.evaluate(()=>{document.querySelector('[role=tab][data-action="ts"]').click();document.querySelector('[role=tab][data-action="general"]').click();});await page.waitForTimeout(250);
   assert.equal(await page.locator('#steam-diagram').count(),0);assert.equal(await page.evaluate(()=>Object.keys(Chart.instances).length),0);report.checks.push('Diagram: navigation cancels cold base before creating a chart');
  }
  if(!baseline){
   await openTool(page,'phdiagram');await diagramReady(page);await page.screenshot({path:path.join(output,'diagram.png'),fullPage:true});
  }else await page.screenshot({path:path.join(output,'diagram.png'),fullPage:true});
  report.workerRequests.push(...await page.evaluate(()=>window.auxRequests));await context.close();
  assert.deepEqual(report.errors,[]);report.proposedBudget={maxGapMs:1000,met:report.measurements.every(r=>r.heartbeatMaxGapMs<=1000)};report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
