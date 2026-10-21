// Actual production controls; read-only memory observation in disposable contexts.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {openTool,chooseModel}=require('./browser-tools.cjs');
function memoryObserver(){
 const memories=[];globalThis.__uiMemory=()=>memories.map(m=>m.buffer.byteLength);
 const record=result=>{const memory=(result.instance||result).exports?.memory;if(memory instanceof WebAssembly.Memory&&!memories.includes(memory))memories.push(memory);return result;};
 const instantiate=WebAssembly.instantiate;WebAssembly.instantiate=async(...args)=>record(await Reflect.apply(instantiate,WebAssembly,args));
 const Instance=WebAssembly.Instance;WebAssembly.Instance=new Proxy(Instance,{construct(target,args){return record(Reflect.construct(target,args));}});
}
(async()=>{
 const root=path.resolve('dist'),name=process.env.BROWSER_NAME||'chromium',cycles=Number(process.env.UI_MEMORY_CYCLES||10),views=Number(process.env.UI_MEMORY_VIEWS||15);
 assert.ok(Number.isInteger(cycles)&&cycles>=2&&cycles<=30);assert.ok(Number.isInteger(views)&&views>=3&&views<=60);
 const output=path.resolve(process.argv[2]||`.release/development-r01/ui-memory-${name}.json`);await fs.mkdir(path.dirname(output),{recursive:true});
 const reference=JSON.parse(await fs.readFile(path.join(__dirname,'../tests/fixtures/engineering-reference.json'),'utf8')).records.find(r=>r.kind==='pump').expected;
 const report={date:new Date().toISOString(),status:'running',browser:name,cycles,views,machine:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model},measurements:[],samples:[],cancellations:[],workerEvents:[],errors:[],scope:'One headless desktop, actual UI. Read-only named WASM-memory hooks; SW blocked. Capacity is not live allocation; CDP main JS heap excludes Worker JS. Windows private bytes are commit, not physical RAM. Samples are not exhaustive peaks; bounded repetition does not prove absence of leaks.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();let bytes=await fs.readFile(file);
  if(file.endsWith('-worker.js'))bytes=Buffer.from('('+memoryObserver.toString()+')();\n'+bytes.toString());
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
 let browser,context,cdp,system;const workers=new Set();
 const persist=()=>fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1440,height:1000}});await context.addInitScript(memoryObserver);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('worker',w=>{workers.add(w);report.workerEvents.push({event:'create',url:w.url()});w.on('close',()=>{workers.delete(w);report.workerEvents.push({event:'close',url:w.url()});});});
  if(name==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');system=await browser.newBrowserCDPSession();}
  const sample=async label=>{
   if(cdp)await cdp.send('HeapProfiler.collectGarbage');
   const entry={label,mainWasmBytes:await page.evaluate(()=>globalThis.__uiMemory()),workers:[],mainJsHeapUsedBytes:null,processPrivateBytesSum:null};
   for(const w of workers)entry.workers.push({url:w.url(),wasmBytes:await w.evaluate(()=>globalThis.__uiMemory?.()||[])});
   entry.totalWasmCapacity=entry.mainWasmBytes.reduce((a,b)=>a+b,0)+entry.workers.flatMap(w=>w.wasmBytes).reduce((a,b)=>a+b,0);
   if(cdp)entry.mainJsHeapUsedBytes=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value])).JSHeapUsedSize;
   if(system&&process.platform==='win32'){
    const ids=(await system.send('SystemInfo.getProcessInfo')).processInfo.map(p=>p.id).filter(n=>Number.isInteger(n)&&n>0);
    const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process -Id '+ids.join(',')+' -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64) | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true});
    assert.equal(r.status,0,r.stderr);const raw=JSON.parse(r.stdout);entry.processes=Array.isArray(raw)?raw:[raw];entry.processPrivateBytesSum=entry.processes.reduce((a,b)=>a+b.PrivateMemorySize64,0);
   }
   report.samples.push(entry);await persist();console.log(name+' SAMPLE '+label+' / '+entry.workers.length+' workers / '+entry.totalWasmCapacity+' WASM bytes');
  };
  const measure=async(label,operation)=>{
   await page.evaluate(()=>{window.memoryProbe={start:performance.now(),last:performance.now(),gaps:[]};window.memoryTimer=setInterval(()=>{const now=performance.now();window.memoryProbe.gaps.push(now-window.memoryProbe.last);window.memoryProbe.last=now;},20);});
   try{await operation();await page.waitForTimeout(50);const result=await page.evaluate(()=>({elapsedMs:performance.now()-window.memoryProbe.start,heartbeatMaxGapMs:Math.max(0,...window.memoryProbe.gaps),ticks:window.memoryProbe.gaps.length}));report.measurements.push({label,...result});await persist();console.log(name+' MEASURE '+label+' '+result.elapsedMs+' ms / gap '+result.heartbeatMaxGapMs);return result;}
   finally{await page.evaluate(()=>clearInterval(window.memoryTimer));}
  };
  const diagramReady=()=>page.waitForFunction(()=>{const b=document.querySelector('#diagram-save');return b&&!b.disabled&&!!Chart.getChart('steam-diagram')?.$detailStats;},null,{timeout:180000});
  const pump=async label=>{
   await openTool(page,'engineering');await page.selectOption('#eng-mode','pump');
   for(const [key,value] of Object.entries({p1:.1,t1:20,p2:10,eta:80,flow:2}))await page.fill('#eng-'+key,String(value));
   await measure(label,async()=>{await page.locator('#engineering-form button[type=submit]').click();await page.locator('#eng-export').waitFor({timeout:120000});});
   const [file]=await Promise.all([page.waitForEvent('download'),page.click('#eng-export')]);const csv=await fs.readFile(await file.path(),'utf8');
   const row=csv.replace(/^\uFEFF/,'').split(/\r?\n/).map(r=>r.split(';')).find(r=>r[0]==='Вихід');assert.ok(row);assert.ok(Math.abs(Number(row[3])-reference.outlet.h)<2e-6);assert.ok(Math.abs(Number(row[4])-reference.outlet.s)<2e-8);
   assert.match(csv,/HEOS::Water/);await fs.writeFile(path.join(path.dirname(output),path.basename(output,'.json')+'-'+label+'.csv'),csv);
  };
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);report.build=await page.locator('#app-build-value').textContent();await sample('fresh page');
  await measure('select HEOS',()=>chooseModel(page,'HEOS::Water'));await sample('selected HEOS, no native main Water query');
  if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a','1');await page.fill('#input-b','500');
  await measure('first general result',async()=>{await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:120000});});
  const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history);assert.ok(Math.abs(history[0].h-2891.218298958905)<1e-7);await sample('general Worker warm');
  await pump('first auxiliary result');await sample('auxiliary Worker warm');
  await measure('first diagram',async()=>{await openTool(page,'phdiagram');await diagramReady();});await sample('diagram refined');
  for(let i=0;i<views;i++){
   await openTool(page,['ts','hsdiagram','phdiagram'][i%3]);await diagramReady();await page.click(i%2?'#diagram-out':'#diagram-in');await diagramReady();
   if((i+1)%5===0||i+1===views)await sample('settled view '+(i+1));
  }
  for(let i=0;i<cycles;i++){
   let result;
   if(i%2===0){
    await openTool(page,'engineering');await page.locator('#eng-export').waitFor({timeout:120000});
    result=await page.evaluate(()=>{document.querySelector('#engineering-form').requestSubmit();const busy=document.querySelector('#engineering-form').getAttribute('aria-busy')==='true',start=performance.now();document.querySelector('#eng-cancel').click();return {type:'pending engineering',wasBusy:busy,cancelMs:performance.now()-start,stillBusy:document.querySelector('#engineering-form').getAttribute('aria-busy')==='true',stale:!!document.querySelector('#eng-export')};});
   }else{
    await openTool(page,'general');await chooseModel(page,'IF97');await chooseModel(page,'HEOS::Water');
    await page.evaluate(()=>document.querySelector('[role=tab][data-action=phdiagram]').click());await page.locator('#diagram-loading').waitFor();await page.waitForTimeout(50);
    assert.equal(await page.locator('#diagram-loading').count(),1,'Base task must still be in flight before cancellation');
    result=await page.evaluate(()=>{const start=performance.now();document.querySelector('[role=tab][data-action=general]').click();return {type:'in-flight diagram base after 50 ms',wasBusy:true,cancelMs:performance.now()-start,stillBusy:false,stale:!!document.querySelector('#steam-diagram')};});
   }
   assert.equal(result.wasBusy,true);assert.equal(result.stillBusy,false);assert.equal(result.stale,false);report.cancellations.push(result);await persist();
   await pump('restore-'+(i+1));if((i+1)%5===0||i+1===cycles)await sample('cancel/restore '+(i+1));
  }
  await openTool(page,'general');assert.equal(await page.evaluate(()=>Object.keys(Chart.instances).length),0);await sample('leave auxiliaries');
  const max=key=>{const v=report.samples.map(s=>s[key]).filter(Number.isFinite);return v.length?Math.max(...v):null;};
  report.maxima={wasmCapacity:max('totalWasmCapacity'),mainJsHeapAfterGC:max('mainJsHeapUsedBytes'),privateCommit:max('processPrivateBytesSum'),settledWorkers:Math.max(...report.samples.map(s=>s.workers.length)),cancelMs:Math.max(...report.cancellations.map(r=>r.cancelMs)),heartbeatMaxGapMs:Math.max(...report.measurements.map(r=>r.heartbeatMaxGapMs))};
  const js=report.samples.map(s=>s.mainJsHeapUsedBytes).filter(Number.isFinite);report.postGcGrowthBytes=js.length?js.at(-1)-report.samples.find(s=>s.label==='diagram refined').mainJsHeapUsedBytes:null;
  const limits={heartbeatMaxGapMs:1000,coldGeneralMs:30000,coldAuxiliaryMs:30000,wasmCapacityBytes:256*1024**2,mainJsAfterGcBytes:64*1024**2,mainJsGrowthBytes:16*1024**2,privateCommitBytes:1024**3,settledWorkers:2,cancelMs:250};
  const findings={responsive:report.maxima.heartbeatMaxGapMs<=limits.heartbeatMaxGapMs,coldGeneral:report.measurements.find(r=>r.label==='first general result').elapsedMs<=limits.coldGeneralMs,coldAuxiliary:report.measurements.find(r=>r.label==='first auxiliary result').elapsedMs<=limits.coldAuxiliaryMs,wasm:report.maxima.wasmCapacity<=limits.wasmCapacityBytes,workers:report.maxima.settledWorkers<=limits.settledWorkers,cancel:report.maxima.cancelMs<=limits.cancelMs,mainJs:js.length?report.maxima.mainJsHeapAfterGC<=limits.mainJsAfterGcBytes:null,mainJsGrowth:js.length?report.postGcGrowthBytes<=limits.mainJsGrowthBytes:null,privateCommit:report.maxima.privateCommit===null?null:report.maxima.privateCommit<=limits.privateCommitBytes};
  report.proposedDesktopAcceptance={limits,findings,availableCriteriaMet:Object.values(findings).every(x=>x!==false),unavailable:Object.entries(findings).filter(([,v])=>v===null).map(([k])=>k),scope:'Qualified acceptance only for this desktop/runtime/workload; null criteria remain unavailable, not passed. Cold means fresh app/runtime with loopback assets, not a cold network/disk cache.'};
  assert.deepEqual(report.errors,[]);report.status='completed';await page.screenshot({path:output.replace(/\.json$/,'.png'),fullPage:true});console.log(name+' COMPLETED '+JSON.stringify(report.maxima));
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r));await persist();}
})().catch(e=>{console.error(e);process.exitCode=1;});
