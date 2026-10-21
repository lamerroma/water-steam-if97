// Real UI/Worker assets. Baseline mode measures the previous synchronous forms.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {openUnits,closeUnits,openTool}=require('./browser-tools.cjs');
(async()=>{
 const root=path.resolve(process.env.STEAM_PROCESS_ROOT||'dist'),name=process.env.BROWSER_NAME||'chromium',baseline=process.argv.includes('--baseline'),measureOnly=process.argv.includes('--measure-only'),offline=process.env.STEAM_PROCESS_OFFLINE==='1';
 const output=path.resolve(process.env.STEAM_PROCESS_EVIDENCE||'.release/development-r01/steam-process-'+name+(baseline?'-before':offline?'-offline':'-after'));
 await fs.mkdir(output,{recursive:true});
 const reference=JSON.parse(await fs.readFile(path.join(__dirname,'../tests/fixtures/steam-process-reference.json'),'utf8'));
 const report={date:new Date().toISOString(),browser:name,status:'running',baseline,measureOnly,offline,cases:[],checks:[],errors:[],scope:'Fresh desktop context per tool, actual unmodified assets, loopback; '+(offline?'Verified SW cache, offline reload before HEOS selection.':'SW blocked.')+' 20 ms timer, single run; not a device or statistical guarantee.'};
 const server=http.createServer(async(req,res)=>{try{
  const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html');if(!file.startsWith(root+path.sep))throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}});
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  for(const kind of ['turbine','flash']){
   const context=await browser.newContext({serviceWorkers:offline?'allow':'block',acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),workers=[];
   page.on('pageerror',e=>report.errors.push(e.message));page.on('worker',w=>workers.push(w.url()));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);
   if(offline){await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),null,{timeout:120000});await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate')?.disabled);}
   report.build=await page.locator('#app-build-value').textContent();await openUnits(page);await page.locator('input[name=formulation][value="HEOS::Water"]').click();
   await page.waitForFunction(()=>document.querySelector('input[name=formulation]:checked')?.value==='HEOS::Water',null,{timeout:120000});await closeUnits(page);await openTool(page,kind);
   for(const mode of kind==='turbine'?['power','flow','efficiency']:['condensate','saturated','subcooled']){
    await page.selectOption('#process-mode',mode);
    await page.evaluate(()=>{window.processProbe={start:performance.now(),last:performance.now(),gaps:[]};window.processTimer=setInterval(()=>{const now=performance.now();window.processProbe.gaps.push(now-window.processProbe.last);window.processProbe.last=now;},20);});
    await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-csv',{timeout:120000});await page.waitForTimeout(60);
    const timing=await page.evaluate(()=>{clearInterval(window.processTimer);return {elapsedMs:performance.now()-window.processProbe.start,heartbeatMaxGapMs:Math.max(0,...window.processProbe.gaps),heartbeatTicks:window.processProbe.gaps.length};});
    assert.equal(await page.locator('#process-error').textContent(),'');
    const [csv]=await Promise.all([page.waitForEvent('download'),page.click('#process-csv')]);const csvText=await fs.readFile(await csv.path(),'utf8');
    await fs.writeFile(path.join(output,kind+'-'+mode+'.csv'),csvText);
    const rows=csvText.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.split(';'));
    const expected=reference.records.find(r=>r.input.kind===kind&&r.input.mode===mode).expected;
    const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${kind}/${mode}: ${a} versus ${b}`);
    for(const key of ['inlet','ideal','outlet'])if(expected[key]){
     const row=rows.find(r=>r[0]===kind&&r[1]===(key==='ideal'?'isentropic_outlet':key));assert.ok(row);
     for(const [k,column,tol] of [['P',2,1e-8],['T',3,3e-6],['h',4,1e-5],['s',5,3e-8]])near(Number(row[column]),expected[key][k],tol);
     assert.ok(row.includes('"HEOS::Water"'));
    }
    for(const key of ['work','power','flow','eta','vaporFlow','liquidFlow'])if(key in expected){const row=rows.find(r=>r[0]===(key==='eta'?'efficiency':key));assert.ok(row);near(Number(row[1]),expected[key],3e-6);}
    report.cases.push({kind,mode,timing,summary:await page.locator('#process-result').textContent(),workers:[...workers]});
    if(!baseline)assert.ok(workers.some(w=>w.includes('heos-calculator-worker.js')),'HEOS process must execute in its own Worker');
    console.log(name+' '+kind+'/'+mode+' gap='+timing.heartbeatMaxGapMs+' ms');
   }
   if(!baseline&&!measureOnly){
    for(const action of ['cancel','edit','navigate']){
     await page.evaluate(action=>{const form=document.querySelector('#process-form');form.requestSubmit();if(action==='cancel')document.querySelector('#process-cancel').click();else if(action==='edit'){const input=document.querySelector('#process-p2');input.value='0.2';input.dispatchEvent(new Event('input',{bubbles:true}));}},action);
     if(action==='navigate')await openTool(page,'general');
     await page.waitForTimeout(150);assert.equal(await page.locator('#process-csv').count(),0,'No stale process result after '+action);
     if(action==='navigate')await openTool(page,kind);
     assert.equal(await page.locator('#process-form button[type=submit]').isEnabled(),true);assert.equal(await page.locator('#process-cancel').isHidden(),true);
     report.checks.push(kind+': '+action+' prevents stale result');
    }
    // Recreate the Worker after cancellations, then restore inputs/results.
    await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-csv',{timeout:120000});
    assert.equal(await page.locator('#process-error').textContent(),'');await page.reload();await page.waitForSelector('#process-csv',{timeout:120000});
    assert.equal(await page.locator('#process-error').textContent(),'');report.checks.push(kind+': retry and project reload recompute successfully');
    await page.selectOption('#process-mode',kind==='turbine'?'power':'condensate');
    await page.selectOption('#process-pressure','bar');await page.selectOption('#process-temperature','F');await page.selectOption('#process-mass','kgh');
    await page.fill('#process-p1','30');await page.fill('#process-p2','1');await page.fill('#process-t1',kind==='turbine'?'752':'392');await page.fill('#process-flow','3600');
    await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-csv',{timeout:120000});
    const [converted]=await Promise.all([page.waitForEvent('download'),page.click('#process-csv')]);const convertedCSV=await fs.readFile(await converted.path(),'utf8');
    const inlet=convertedCSV.replace(/^\uFEFF/,'').split(/\r?\n/).map(r=>r.split(';')).find(r=>r[1]==='inlet');
    assert.equal(Number(inlet[2]),3);assert.ok(Math.abs(Number(inlet[3])-(kind==='turbine'?673.15:473.15))<1e-7);
    assert.equal(Number(convertedCSV.split(/\r?\n/).find(r=>r.startsWith('flow;')).split(';')[1]),1);
    await fs.writeFile(path.join(output,kind+'-converted.csv'),convertedCSV);report.checks.push(kind+': bar, Fahrenheit and kg/h convert to canonical input');
    await page.fill('#process-p2','40');await page.locator('#process-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#process-error').textContent.length>0);
    assert.equal(await page.locator('#process-csv').count(),0);await page.fill('#process-p2','1');await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-csv',{timeout:120000});report.checks.push(kind+': invalid pressure returns a numerical error and retry succeeds');
    await page.selectOption('#language-select','en');await page.waitForSelector('#process-csv',{timeout:120000});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);report.checks.push(kind+': English form and 390 px viewport');
   }
   await page.screenshot({path:path.join(output,kind+'.png'),fullPage:true});await context.close();
  }
  assert.deepEqual(report.errors,[]);report.proposedBudget={maxGapMs:1000,met:report.cases.every(c=>c.timing.heartbeatMaxGapMs<=1000)};report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
