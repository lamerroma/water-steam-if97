// Observe the actual UI and unmodified assets; no WASM/engine instrumentation.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {openUnits}=require('./browser-tools.cjs');
(async()=>{
 const root=path.resolve(process.env.HEOS_SELECTION_ROOT||'dist'),name=process.env.BROWSER_NAME||'chromium',output=path.resolve(process.argv[2]||'.release/development-r01/selection-'+name+'.json');
 await fs.mkdir(path.dirname(output),{recursive:true});
 const report={date:new Date().toISOString(),browser:name,status:'running',scope:'Actual formulation selection in unmodified app/worker/WASM assets, fresh context, headless desktop on loopback; service workers blocked. 20 ms timer gaps observe UI responsiveness, not user-device performance guarantees.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}});
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
  report.build=await page.locator('#app-build-value').textContent();await openUnits(page);
  await page.evaluate(()=>{window.selectionProbe={start:performance.now(),last:performance.now(),gaps:[]};window.selectionTimer=setInterval(()=>{const now=performance.now();window.selectionProbe.gaps.push(now-window.selectionProbe.last);window.selectionProbe.last=now;},20);});
  await page.locator('input[name=formulation][value="HEOS::Water"]').click();
  await page.waitForFunction(()=>document.querySelector('input[name=formulation]:checked')?.value==='HEOS::Water',null,{timeout:120000});
  await page.waitForTimeout(60);
  report.observed=await page.evaluate(()=>{clearInterval(window.selectionTimer);return {selectionMs:performance.now()-window.selectionProbe.start,heartbeatMaxGapMs:Math.max(0,...window.selectionProbe.gaps),heartbeatTicks:window.selectionProbe.gaps.length};});
  await page.evaluate(()=>{window.selectionProbe={start:performance.now(),last:performance.now(),gaps:[]};window.selectionTimer=setInterval(()=>{const now=performance.now();window.selectionProbe.gaps.push(now-window.selectionProbe.last);window.selectionProbe.last=now;},20);});
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:120000});await page.waitForTimeout(60);
  report.firstCalculation=await page.evaluate(()=>{clearInterval(window.selectionTimer);return {elapsedMs:performance.now()-window.selectionProbe.start,heartbeatMaxGapMs:Math.max(0,...window.selectionProbe.gaps),heartbeatTicks:window.selectionProbe.gaps.length};});
  assert.equal(await page.locator('#error').isHidden(),true);
  report.proposedBudget={heartbeatMaxGapMs:1000,met:Math.max(report.observed.heartbeatMaxGapMs,report.firstCalculation.heartbeatMaxGapMs)<=1000};
  assert.equal(await page.locator('#error').isHidden(),true);report.status='measured';console.log(JSON.stringify(report));
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
