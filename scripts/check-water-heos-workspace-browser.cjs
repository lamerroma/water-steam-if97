// Actual bundled Worker, subpath hosting, export and a cold offline restart.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),name=process.env.BROWSER_NAME||'chromium',prefix='/water-steam-if97/';
 const evidence=path.resolve(process.env.HEOS_WORKSPACE_EVIDENCE||path.join(root,'.release/water-heos-workspace',name));await fs.mkdir(evidence,{recursive:true});
 const report={browser:name,status:'running',checks:[],cases:[],workflows:[],errors:[],externalRequests:[]};
 let context,page,disconnected=false;
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
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'thermo-heos-workspace-'));
 const launch=()=>pw[name].launchPersistentContext(path.join(folder,'profile'),{headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},...(name==='chromium'?{args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})}:{})});
 const listen=ctx=>{ctx.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));ctx.on('request',req=>{if(new URL(req.url()).origin!==new URL(url).origin)report.externalRequests.push(req.url());});};
 const ready=page=>page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&!document.querySelector('#calculate')?.disabled,null,{timeout:120000});
 const {openUnits,closeUnits}=require('./browser-tools.cjs'),HEOS='HEOS::Water',KEY='water-steam-if97-project-v1';
 const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} versus ${b}`);
 const installClipboard=ctx=>ctx.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.testCopied=text;}}});
  const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.moduleId==='workflows'&&data.methodId==='project')window.testProjectReply={status:data.status,error:data.error};});}};
 });
 const snapshot=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 const selectModel=async(page,model)=>{await openUnits(page);await page.locator('input[name=formulation][value="'+model+'"]').click();await page.waitForFunction(model=>document.querySelector('input[name=formulation]:checked')?.value===model,model,{timeout:120000});await closeUnits(page);};
 const copy=async page=>{await page.waitForFunction(()=>{const button=document.querySelector('#copy-result-json');return button&&!button.disabled&&button.getClientRects().length>0;},null,{timeout:120000});await page.locator('#copy-result-json').click();await page.waitForFunction(()=>window.testCopied);const r=await page.evaluate(()=>{const q=JSON.parse(window.testCopied);delete window.testCopied;return q;});report.cases.push(r);return r.result;};
 const calculate=async(page,mode,a,b,ua='MPa',ub='K')=>{
  await openTool(page,'general');if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');
  await page.selectOption('#mode',mode);await page.selectOption('#unit-a',ua);if(!mode.startsWith('sat'))await page.selectOption('#unit-b',ub);
  await page.fill('#input-a',String(a));if(!mode.startsWith('sat'))await page.fill('#input-b',String(b));await page.click('#calculate');
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:120000});assert.equal(await page.locator('#error').isHidden(),true,await page.locator('#error').textContent());return copy(page);
 };
 const importProject=async(page,data)=>{
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'mixed.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value==='',null,{timeout:120000});
  assert.equal(await page.locator('#error').isHidden(),true,await page.locator('#error').textContent());
 };
 const mark=text=>{report.checks.push(text);console.log('PASS '+text);};
 try{
  context=await launch();listen(context);await installClipboard(context);report.browserVersion=context.browser().version();
  page=await context.newPage();page.on('worker',worker=>{(report.workerURLs??=[]).push(worker.url());});await page.goto(url);await ready(page);
  await selectModel(page,HEOS);let result=await calculate(page,'pt','10.0000','226.8500','bar','C');
  assert.equal(result.state.model,HEOS);near(result.state.T,500);near(result.state.h,2891.218298958905);assert.ok(Number.isFinite(result.state.ex));
  let saved=await snapshot(page);assert.equal(saved.form.model,HEOS);assert.equal(saved.history[0].model,HEOS);assert.deepEqual(saved.history[0].source,{mode:'pt',a:1,b:500});
  mark('Main calculator: explicit HEOS selection, canonical model identity, typed units, exergy and input-only history');
  await selectModel(page,'IF97');result=await calculate(page,'pt',3,300);assert.equal(result.state.model||'IF97','IF97');
  await selectModel(page,'IAPWS-95');result=await calculate(page,'pt',1,500);assert.equal(result.state.model,'IAPWS-95');
  await selectModel(page,HEOS);result=await calculate(page,'pt',1,500);assert.equal(result.state.model,HEOS);
  saved=await snapshot(page);assert.deepEqual([...new Set(saved.history.map(q=>q.model))].sort(),[HEOS,'IAPWS-95','IF97'].sort());
  assert.ok(report.workerURLs.filter(u=>u.includes('/heos-calculator-worker.js')).length>=2);assert.ok(report.workerURLs.some(u=>u.includes('/calculator-worker.js')));
  mark('Switching HEOS/IF97/IAPWS-95 selects separate Workers and preserves mixed-model history');
  saved.workspace={active:'general',panels:{}};for(const q of saved.history){q.rho=-999;q.cp=999;}
  await importProject(page,saved);result=await copy(page);near(result.state.h,2891.218298958905);assert.ok(result.state.rho>0);assert.notEqual(result.state.cp,999);
  const before=await snapshot(page),forged=structuredClone(before);forged.history[0].h+=10;
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
  await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value==='');assert.equal(await page.locator('#error').isHidden(),false);
  assert.deepEqual((await snapshot(page)).history,before.history);await importProject(page,before);
  mark('Mixed project imports recompute results, ignore forged properties and reject incompatible history fingerprints');
  await openTool(page,'batch');await page.fill('#batch-text','mode;a;b;unit_a;unit_b;name\npt;10;226.85;bar;C;steam\npx;0.1;0.5;MPa;fraction;wet\npt;1;250;MPa;K;ice');
  await page.click('#batch-import');await page.waitForSelector('#batch-history');assert.equal(await page.locator('#batch-results tbody tr').count(),3);
  assert.match(await page.locator('#batch-results').textContent(),/успішних: 2/);await page.click('#batch-history');saved=await snapshot(page);assert.equal(saved.history[0].model,HEOS);assert.equal(saved.history[1].model,HEOS);
  const count=saved.history.length;await page.fill('#batch-text','mode;a;b;unit_a;unit_b;name\nhv;3231.6862979808975;0.09937913680874447;kJkg;m3kg;slow');
  await page.evaluate(()=>{document.querySelector('#batch-import').click();const input=document.querySelector('#batch-text');input.value+='\n';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForTimeout(300);assert.equal(await page.locator('#batch-results tbody tr').count(),0);assert.equal((await snapshot(page)).history.length,count);assert.equal(await page.locator('#batch-cancel').isHidden(),true);
  mark('Batch Worker returns success/error rows; edits terminate pending work and prevent stale history');
  saved=await snapshot(page);const indexes=saved.history.map((q,i)=>q.model===HEOS?i:-1).filter(i=>i>=0).slice(0,2);
  saved.form={model:HEOS,mode:'pt',a:'1',b:'500',ua:'MPa',ub:'K',calculated:true,inputStyle:'advanced'};saved.workspace={active:'general',panels:{}};
  saved.diagram={views:{[HEOS+':ts']:{range:{xmin:0,xmax:11,ymin:0,ymax:800}}},pointSets:{[HEOS]:indexes.map((historyIndex,i)=>({historyIndex,label:'H'+i}))},series:[{model:HEOS,name:'HEOS curve',kind:'line',points:indexes}]};
  await importProject(page,saved);await openTool(page,'ts');await page.waitForSelector('#steam-diagram');assert.match(await page.locator('.diagram-heading').textContent(),/HEOS::Water/);assert.match(await page.locator('#diagram-series-legend').textContent(),/HEOS curve/);
  mark('HEOS diagram view keys and named series restore with model-separated history points');
  const matrix=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/water-heos-matrix.json'),'utf8')),multiple=matrix.records.find(c=>c.id==='density-two-roots');
  result=await calculate(page,'prho',.1,multiple.expected.rho,'MPa','kgm3');assert.equal(result.alternatives.length,1);await page.click('[data-use-alternative="0"]');result=await copy(page);near(result.state.T,multiple.roots[1].T,1e-6);
  saved=await snapshot(page);assert.ok(saved.form.selectedRoot);await page.reload();await ready(page);result=await copy(page);near(result.state.T,multiple.roots[1].T,1e-6);
  mark('Manual inverse branch persists through the general project and a full reload');
  await openTool(page,'water-process');await page.selectOption('#wp-model',HEOS);await page.click('#wp-calculate');await page.waitForFunction(()=>document.querySelector('#wp-form').getAttribute('aria-busy')!=='true',null,{timeout:120000});assert.equal(await page.locator('#wp-error').isHidden(),true,await page.locator('#wp-error').textContent());assert.ok((await page.locator('#wp-results').textContent()).length>100);
  await openTool(page,'custom-cycle');await page.locator('#cc-library').evaluate(details=>details.open=true);await page.selectOption('#cl-kind','rankine');await page.selectOption('#cl-model',HEOS);await page.click('#cl-build');await page.waitForFunction(()=>document.querySelector('#cc-library').getAttribute('aria-busy')!=='true',null,{timeout:120000});assert.equal(await page.locator('#cl-error').isHidden(),true,await page.locator('#cl-error').textContent());await page.waitForSelector('#cc-report');
  report.workflows.push({waterProcess:'HEOS form completed',rankine:await page.locator('#cc-results').textContent(),input:JSON.parse(await page.locator('#cc-data').inputValue())});assert.equal(report.workflows[0].input.model,HEOS);await openTool(page,'general');
  mark('HEOS water-process and Rankine forms execute and persist their explicit model');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#file-project-export').evaluate(button=>button.click())]);
  await fs.copyFile(await download.path(),path.join(evidence,'project.json'));await page.screenshot({path:path.join(evidence,'online.png'),fullPage:true});
  await context.close();context=null;disconnected=true;
  context=await launch();listen(context);await installClipboard(context);await context.setOffline(true);page=await context.newPage();await page.goto(url);await ready(page);
  result=await copy(page);assert.equal(result.state.model,HEOS);near(result.state.T,multiple.roots[1].T,1e-6);result=await calculate(page,'pt',1,500);near(result.state.h,2891.218298958905);
  await openTool(page,'custom-cycle');await page.waitForSelector('#cc-report',{timeout:120000});assert.equal(JSON.parse(await page.locator('#cc-data').inputValue()).model,HEOS);await openTool(page,'general');
  await selectModel(page,'IF97');await calculate(page,'pt',3,300);await selectModel(page,HEOS);result=await calculate(page,'pt',1,500);assert.equal(result.state.model,HEOS);
  await page.selectOption('#language-select','en');await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.screenshot({path:path.join(evidence,'offline.png'),fullPage:true});mark('Closed profile and disconnected server: mixed history, selected root and fresh HEOS/default Workers restore offline; English/mobile layout');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);report.build=JSON.parse((await fs.readFile(path.join(root,'assets/app.js'),'utf8')).match(/const APP_BUILD = ([^\n]+);/)[1]);report.status='passed';
  console.log(name+': HEOS main workspace '+report.checks.length+' groups PASS');
 }catch(error){report.status='failed';report.error=error.stack;if(page&&!page.isClosed()){report.pageState=await page.evaluate(key=>({status:document.querySelector('#result-status')?.textContent,error:document.querySelector('#error')?.textContent,active:document.querySelector('[role=tab][aria-selected=true]')?.dataset.action,projectReply:window.testProjectReply,project:localStorage.getItem(key)}),KEY).catch(()=>null);await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});}throw error;}
 finally{await context?.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
