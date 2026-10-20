// Local diagnostics, not a cross-device performance promise.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const root=path.resolve(process.env.STARTUP_ROOT||'dist'),runs=Number(process.env.STARTUP_RUNS||7),samples=[];
 if(!Number.isInteger(runs)||runs<1||runs>50)throw Error('STARTUP_RUNS must be an integer from 1 to 50.');
 const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://local').pathname.slice(1)||'index.html',file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await pw.chromium.launch({headless:true});
  for(let i=0;i<runs;i++){
   const context=await browser.newContext(),page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
   await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
   const timing=await page.evaluate(()=>({ready:performance.now(),domContentLoaded:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,sheetjsExecuted:!!globalThis.XLSX,appVersion:document.querySelector('#app-version-value').textContent,build:document.querySelector('#app-build-value').textContent}));
   const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));samples.push({...timing,scriptDurationMs:metrics.ScriptDuration*1000,jsHeapUsedBytes:metrics.JSHeapUsedSize});await context.close();
  }
  const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[Math.floor(samples.length/2)];
  const report={date:new Date().toISOString(),machine:{platform:process.platform,architecture:process.arch,node:process.version,cpu:os.cpus()[0]?.model},browser:browser.version(),root,runs,appBytes:(await fs.stat(path.join(root,'assets/app.js'))).size,median:{readyMs:median('ready'),domContentLoadedMs:median('domContentLoaded'),scriptDurationMs:median('scriptDurationMs'),jsHeapUsedBytes:median('jsHeapUsedBytes')},samples,scope:'Fresh browser contexts on loopback, no CPU/network throttling. Timing includes scheduling and local PWA activity; no universal speedup inferred.'};
  if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({appBytes:report.appBytes,median:report.median,sheetjsExecuted:samples.map(s=>s.sheetjsExecuted)}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
