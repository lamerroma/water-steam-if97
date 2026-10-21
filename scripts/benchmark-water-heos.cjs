// Desktop diagnostic, not a physical-mobile or universal performance guarantee.
// Test-only observation hooks preserve calculation code, but bypass SW hashing.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const observer=()=>{
 const memories=[];globalThis.__benchMemory=()=>memories.map(m=>m.buffer.byteLength);
 // Only the named memory export is needed; do not enumerate unrelated exports.
 // Both pinned modules use this exact name.
 const record=result=>{const instance=result.instance||result,memory=instance.exports?.memory;if(memory instanceof WebAssembly.Memory&&!memories.includes(memory))memories.push(memory);return result;};
 const instantiate=WebAssembly.instantiate;WebAssembly.instantiate=async(...args)=>record(await Reflect.apply(instantiate,WebAssembly,args));
 const Instance=WebAssembly.Instance;WebAssembly.Instance=new Proxy(Instance,{construct(target,args){return record(Reflect.construct(target,args));}});
};
(async()=>{
 const root=path.resolve('dist'),name=process.env.BROWSER_NAME||'chromium',cycles=Number(process.env.HEOS_BENCH_CYCLES||30);
 assert.ok(Number.isInteger(cycles)&&cycles>=1&&cycles<=100);
 const output=path.resolve(process.argv[2]||'.release/development-r01/performance-'+name+'.json');await fs.mkdir(path.dirname(output),{recursive:true});
 const bounded=async(task,label,ms=30000)=>{let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+' ms')),ms);})]);}finally{clearTimeout(timer);}};
 const report={date:new Date().toISOString(),status:'running',browser:name,machine:{node:process.version,platform:process.platform,cpu:os.cpus()[0]?.model},cycles,observationMethod:'Direct named memory export; no enumeration of WASM functions.',measurementDefinitions:{mainHeosInitialization:'Module initialization PLUS a direct first native Water property query; this is not the formulation-selector latency. Actual UI uses benchmark-heos-selection.cjs.',coldWorker:'Worker initialization plus first Water property query.'},measurements:{},memory:[],pageErrors:[],scope:'Single desktop, headless, loopback, no CPU/network throttling. Observed WASM memory is allocated linear-memory capacity, not live allocations. JS heap is main-frame only; Windows private bytes are process commit, not physical RAM. Sampled values are not an exhaustive peak. Test hooks only; SW blocked, no offline acceptance here.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();
  let data=await fs.readFile(file);
  if(file===path.join(root,'assets/app.js')){
   const source=data.toString(),end=source.lastIndexOf('\n})();');assert.ok(end>0);
   data=Buffer.from(source.slice(0,end)+'\nwindow.__heosBenchmark={runner:createAppCalculationRunner(),initializeMain:async()=>{await ensureWaterModel("HEOS::Water");return calculateWaterHeos("pt",1,500);}};\n'+source.slice(end));
  }else if(file.endsWith('-worker.js'))data=Buffer.from('('+observer.toString()+')();\n'+data.toString());
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}});
 let browser,context,cdp,system;const workers=new Set();
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(observer);
  const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  const evaluate=(fn,...args)=>bounded(page.evaluate(fn,...args),'Page benchmark evaluation');
  page.on('worker',w=>{workers.add(w);w.on('close',()=>workers.delete(w));});
  if(name==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');system=await browser.newBrowserCDPSession();}
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
  report.build=await page.locator('#app-build-value').textContent();report.measurements.freshAppReadyMs=await evaluate(()=>performance.now());
  const sample=async label=>{
   if(cdp)await cdp.send('HeapProfiler.collectGarbage');
   const entry={label,mainWasmBytes:await evaluate(()=>window.__benchMemory()),workers:[]};
   for(const worker of workers)try{entry.workers.push({url:worker.url(),wasmBytes:await bounded(worker.evaluate(()=>globalThis.__benchMemory?.()||[]),'Worker memory probe',5000)});}catch(error){entry.workers.push({url:worker.url(),probeError:error.message});}
   if(cdp){const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));entry.mainJsHeapUsedBytes=metrics.JSHeapUsedSize;}
   if(system&&process.platform==='win32'){
    const {processInfo}=await system.send('SystemInfo.getProcessInfo'),ids=processInfo.map(p=>p.id).filter(n=>Number.isInteger(n)&&n>0);
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','@(Get-Process -Id '+ids.join(',')+' -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64,WorkingSet64) | ConvertTo-Json -Compress'],{encoding:'utf8',windowsHide:true});
    if(result.status===0){const raw=JSON.parse(result.stdout),rows=Array.isArray(raw)?raw:[raw];entry.processes=rows;entry.processPrivateBytesSum=rows.reduce((sum,p)=>sum+p.PrivateMemorySize64,0);}
   }
   report.memory.push(entry);await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log('SAMPLE '+label);return entry;
  };
  await sample('before HEOS');
  report.measurements.mainHeosInitialization=await evaluate(async()=>{
   const gaps=[];let last=performance.now();const timer=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;},20),start=performance.now();
   try{const q=await window.__heosBenchmark.initializeMain();const ms=performance.now()-start;await new Promise(r=>setTimeout(r,40));return {ms,h:q.state.h,heartbeatMaxGapMs:Math.max(0,...gaps),heartbeatTicks:gaps.length};}finally{clearInterval(timer);}
  });
  assert.ok(Math.abs(report.measurements.mainHeosInitialization.h-2891.218298958905)<1e-7);await sample('main HEOS before Worker');
  report.measurements.coldWorker=await evaluate(async()=>{const start=performance.now(),q=await window.__heosBenchmark.runner.calculate('pt',1,500,'HEOS::Water');return {ms:performance.now()-start,h:q.state.h};});
  assert.ok(Math.abs(report.measurements.coldWorker.h-2891.218298958905)<1e-7);
  report.measurements.warmWorker=await evaluate(async()=>{const samples=[];for(let i=0;i<10;i++){const start=performance.now();await window.__heosBenchmark.runner.calculate('pt',1,500,'HEOS::Water');samples.push(performance.now()-start);}return samples;});
  await sample('warm HEOS');
  for(const count of [100,500]){
   report.measurements['batch'+count]=await evaluate(async count=>{
    const rows=Array.from({length:count},(_,i)=>({mode:'pt',a:1,b:500+i*.1,ua:'MPa',ub:'K'})),gaps=[];let last=performance.now();
    const tick=setInterval(()=>{const now=performance.now();gaps.push(now-last);last=now;},20),start=performance.now();
    try{const q=await window.__heosBenchmark.runner.batch(rows,'HEOS::Water');return {ms:performance.now()-start,ok:q.filter(r=>!r.error).length,rows:q.length,heartbeatMaxGapMs:Math.max(0,...gaps),heartbeatTicks:gaps.length};}finally{clearInterval(tick);}
   },count);
   assert.equal(report.measurements['batch'+count].rows,count);assert.equal(report.measurements['batch'+count].ok,count);await sample('after batch '+count);
  }
  report.measurements.cancel=[];
  for(let i=0;i<cycles;i++){
   const result=await evaluate(async()=>{
    const runner=window.__heosBenchmark.runner;
    await runner.calculate('pt',1,500,'HEOS::Water');
    const rows=Array.from({length:500},()=>({mode:'hv',a:3231.6862979808975,b:.09937913680874447,ua:'kJkg',ub:'m3kg'}));
    const pending=runner.batch(rows,'HEOS::Water').then(()=>({completed:true}),error=>({code:error.code}));
    await new Promise(r=>setTimeout(r,50));const start=performance.now(),cancelled=runner.cancel(),reply=await pending;
    const cancelMs=performance.now()-start,restoreStart=performance.now(),q=await runner.calculate('pt',1,500,'HEOS::Water');
    return {cancelled,reply,cancelMs,recreateMs:performance.now()-restoreStart,h:q.state.h};
   });
   assert.equal(result.cancelled,true);assert.equal(result.reply.code,'cancelled');assert.ok(Math.abs(result.h-2891.218298958905)<1e-7);
   report.measurements.cancel.push(result);
   if((i+1)%5===0||i+1===cycles)await sample('cancel/recreate '+(i+1));
  }
  const heaps=report.memory.map(q=>q.mainJsHeapUsedBytes).filter(Number.isFinite),privateBytes=report.memory.map(q=>q.processPrivateBytesSum).filter(Number.isFinite);
  report.maxima={cancelMs:Math.max(...report.measurements.cancel.map(q=>q.cancelMs)),observedMainJsHeapUsedBytes:heaps.length?Math.max(...heaps):null,observedProcessPrivateBytesSum:privateBytes.length?Math.max(...privateBytes):null};
  report.proposedBudget={appliesTo:'Direct synchronous API stress scenario, not the complete production UI path',mainThreadMaxGapMs:1000,met:report.measurements.mainHeosInitialization.heartbeatMaxGapMs<=1000};
  assert.deepEqual(report.pageErrors,[]);report.functionalChecks='passed';report.status='completed';console.log(JSON.stringify({status:report.status,build:report.build,browser:name,measurements:report.measurements,maxima:report.maxima,proposedBudget:report.proposedBudget}));
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
