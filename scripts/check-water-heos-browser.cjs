// Actual bundled Worker, subpath hosting, export and a cold offline restart.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),name=process.env.BROWSER_NAME||'chromium',prefix='/water-steam-if97/';
 const evidence=path.join(root,'.release/water-heos',name);await fs.mkdir(evidence,{recursive:true});
 const report={browser:name,status:'running',checks:[],cases:[],workflows:[],errors:[],externalRequests:[]};
 let context,disconnected=false;
 const server=http.createServer(async(req,res)=>{
  try{
   if(disconnected){res.writeHead(503);res.end();return;}
   const pathname=new URL(req.url,'http://local').pathname;if(!pathname.startsWith(prefix))throw Error('outside scope');
   const file=decodeURIComponent(pathname.slice(prefix.length))||'index.html',target=path.resolve(root,file);
   if(!target.startsWith(root+path.sep))throw Error('outside root');
   const bytes=await fs.readFile(target);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+prefix;
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'thermo-heos-'));
 const launch=()=>pw[name].launchPersistentContext(path.join(folder,'profile'),{headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},...(name==='chromium'?{args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})}:{})});
 const listen=ctx=>{ctx.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));ctx.on('request',req=>{if(new URL(req.url()).origin!==new URL(url).origin)report.externalRequests.push(req.url());});};
 const ready=page=>page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&!document.querySelector('#calculate')?.disabled,null,{timeout:120000});
 const mark=text=>report.checks.push(text);
 const exportDisplayed=async page=>{
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#heos-export')]);
  const result=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(result.module,'water-heos');assert.equal(result.reply.model,'HEOS::Water');
  const displayed=await page.locator('#heos-result tbody tr').evaluateAll(rows=>rows.map(row=>({key:row.dataset.quantity,value:row.children[1].textContent,unit:row.children[2].textContent})));
  assert.equal(displayed.length,Object.keys(result.reply.quantities).filter(key=>!key.startsWith('alternatives.')).length);
  for(const row of displayed){const q=result.reply.quantities[row.key];assert.ok(q,row.key);assert.equal(row.unit,q.unit,row.key);
   if(q.value===null)assert.equal(row.value,'—',row.key);else assert.ok(Math.abs(Number(row.value)-q.value)<=1e-11*Math.max(1,Math.abs(q.value)),row.key+': displayed '+row.value+' versus '+q.value);
  }
  report.displayedQuantities=(report.displayedQuantities||0)+displayed.length;
  report.cases.push(result);return result.reply;
 };
 const invoke=async(page,mode,a,b)=>{
  await page.selectOption('#heos-mode',mode);await page.fill('#heos-a',String(a));if(b!==undefined)await page.fill('#heos-b',String(b));
  await page.click('#heos-run');await page.waitForFunction(()=>document.querySelector('#heos-cancel')?.hidden===true,null,{timeout:90000});
  assert.equal(await page.locator('#heos-error').isHidden(),true,await page.locator('#heos-error').textContent());
  return exportDisplayed(page);
 };
 const near=(actual,expected,tolerance)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${actual} versus ${expected}`);
 try{
  context=await launch();listen(context);let page=await context.newPage();await page.goto(url);await ready(page);
  report.browserVersion=context.browser().version();await openTool(page,'libraries');await page.waitForSelector('#heos-form');
  assert.equal(page.workers().some(w=>w.url().includes('python-worker')),false);
  assert.equal((await page.evaluate(()=>caches.keys())).some(k=>k.startsWith('thermocalc-python:')),false);
  await page.evaluate(()=>{document.querySelector('#heos-form').requestSubmit();document.querySelector('#heos-cancel').click();});
  assert.equal(await page.locator('#heos-run').isDisabled(),false);assert.match(await page.locator('#heos-status').textContent(),/скасовано/);mark('Cold initialization cancelled and retry enabled');
  await page.evaluate(()=>{window.heosTicks=0;window.heosTimer=setInterval(()=>window.heosTicks++,20);});
  let reply=await invoke(page,'pt',1,500);
  const ticks=await page.evaluate(()=>{clearInterval(window.heosTimer);return window.heosTicks;});assert.ok(ticks>2);report.responsiveTicks=ticks;
  near(reply.result.state.h,2891.218298958905,1e-7);mark('Actual bundled HEOS Worker, responsive UI and exact JSON export');
  const references=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/water-heos-regressions.json'),'utf8')).states;
  for(const q of references){
   reply=await invoke(page,'pt',q.p,q.T);near(reply.result.state.rho,q.rho,1e-7);near(reply.result.state.h,q.h,1e-7);near(reply.result.state.s,q.s,1e-9);
   reply=await invoke(page,'ph',q.p,q.h);near(reply.result.state.T,q.T,2e-6);
   reply=await invoke(page,'ps',q.p,q.s);near(reply.result.state.T,q.T,2e-6);
  }
  mark('All six audit states in P-T, P-h and P-s against independent reference');
  for(const [mode,a,b] of [['pu',1,2670.5794922041465],['satp',.101325],['satt',373.12429584766636],['px',.101325,.3],['tx',373.12429584766636,.3]]){
   reply=await invoke(page,mode,a,b);
   if(mode==='pu')near(reply.result.state.T,500,1e-6);
   if(['px','tx'].includes(mode)){assert.equal(reply.quantities['state.cp'].status,'unavailable');assert.equal(reply.result.state.cp,null);assert.ok(reply.result.saturation.liquid.cp>0);}
  }
  const sat=reply.result.saturation;reply=await invoke(page,'pt',sat.p,sat.T);assert.equal(reply.result.ambiguous,true);assert.equal(reply.result.state,undefined);
  const matrix=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/water-heos-matrix.json'),'utf8'));
  const sample=matrix.records.find(c=>c.id==='single-05').expected;
  const extended={pv:['p','v'],th:['T','h'],ts:['T','s'],tv:['T','v'],tu:['T','u'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],prho:['p','rho'],trho:['T','rho']};
  for(const [mode,keys]of Object.entries(extended)){
   reply=await invoke(page,mode,...keys.map(key=>sample[key]));
   assert.ok([reply.result.state,...(reply.result.alternatives||[])].some(q=>Math.abs(q.T-sample.T)<1e-4&&Math.abs(q.p-sample.p)<1e-7));
  }
  mark('All twenty modes, independent extended inversions and two-phase unavailable outputs');
  for(const c of matrix.records.filter(c=>c.kind==='multiple')){
   const mode=c.modes[0],keys=extended[mode];reply=await invoke(page,mode,...keys.map(key=>c.expected[key]));assert.equal(reply.result.alternatives.length,1);assert.equal(await page.locator('#heos-root-field').isHidden(),false);
   for(const expected of c.roots)assert.ok([reply.result.state,...reply.result.alternatives].some(q=>Math.abs(q.p-expected.p)<Math.max(1e-7,expected.p*3e-6)&&Math.abs(q.T-expected.T)<3e-4));
   await page.selectOption('#heos-root','1');reply=await exportDisplayed(page);assert.equal(reply.result.diagnostics.selection,'manual');assert.equal(report.cases.at(-1).selection.index,1);
  }
  await page.check('#heos-rounding');reply=await invoke(page,'ps','1.0000','6.824994379140872');assert.equal(reply.result.diagnostics.roundingScenario.inputs[0].enteredText,'1.0000');assert.equal(reply.result.state.inputSensitivity.status,'local');await page.uncheck('#heos-rounding');mark('Independent multiple roots, manual selection, typed rounding and exported metadata');
  await page.selectOption('#heos-mode','pt');await page.fill('#heos-a','.1');await page.fill('#heos-b','260');await page.click('#heos-run');await page.waitForFunction(()=>!document.querySelector('#heos-error').hidden);assert.equal(await page.locator('#heos-export').isDisabled(),true);mark('Ice input produces visible error and disables stale export');
  await page.selectOption('#language-select','en');assert.match(await page.locator('#water-heos h2').textContent(),/Water/);
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
  await invoke(page,'pt',1,500);await page.screenshot({path:path.join(evidence,'online.png'),fullPage:true});mark('English labels and mobile width');
  await page.selectOption('#heos-mode','tu');await page.fill('#heos-a','500.000');await page.fill('#heos-b',String(sample.u));
  await context.close();disconnected=true;context=await launch();listen(context);await context.setOffline(true);page=await context.newPage();await page.goto(url);await ready(page);await openTool(page,'libraries');
  assert.equal(await page.locator('#heos-mode').inputValue(),'tu');assert.equal(await page.locator('#heos-a').inputValue(),'500.000');assert.equal(await page.locator('#heos-export').isDisabled(),true);
  reply=await invoke(page,'tu',500,sample.u);near(reply.result.state.p,sample.p,1e-7);
  reply=await invoke(page,'pt',1,500);near(reply.result.state.h,2891.218298958905,1e-7);
  reply=await invoke(page,'px',.101325,.3);assert.equal(reply.result.state.cp,null);
  assert.equal((await page.evaluate(()=>caches.keys())).some(k=>k.startsWith('thermocalc-python:')),false);
  await page.screenshot({path:path.join(evidence,'offline.png'),fullPage:true});mark('Profile restarted, server disconnected, fresh Worker initializes offline without Python');
  const app=await fs.readFile(path.join(root,'assets/app.js'),'utf8'),workerPath=JSON.parse(app.match(/const HEOS_WORKER_URL = ("[^"\n]+");/)[1]),revision=JSON.parse(app.match(/const CALCULATION_IMPLEMENTATION_REVISION = ("[^"\n]+");/)[1]);
  const reference=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/rankine-library-reference.json'),'utf8')).records.find(c=>c.model==='IAPWS-95'&&c.name==='dry-saturated-inlet');
  const workflow=await page.evaluate(({workerPath,revision,input})=>new Promise((resolve,reject)=>{
   const worker=new Worker(new URL(workerPath,location.href)),timer=setTimeout(()=>{worker.terminate();reject(Error('Workflow timeout'));},90000);
   worker.onmessage=({data})=>{if(data.status==='progress')return;clearTimeout(timer);worker.terminate();resolve(data);};worker.onerror=event=>{event.preventDefault();clearTimeout(timer);worker.terminate();reject(Error(event.message));};
   worker.postMessage({protocolVersion:1,id:1,moduleId:'workflows',engineVersion:'1.0.0',implementationRevision:revision,methodId:'library-cycle',inputUnits:{},payload:{input:{...input,model:'HEOS::Water'}}});
  }),{workerPath,revision,input:reference.input});
  assert.equal(workflow.status,'ok',JSON.stringify(workflow.error));near(workflow.result.result.efficiency,reference.metrics.efficiency,2e-5);report.workflows.push(workflow);mark('Cold offline HEOS Rankine workflow through shared engine and Worker protocol');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.status='passed';console.log(name+': HEOS '+report.checks.length+' acceptance groups PASS');
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await context?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
