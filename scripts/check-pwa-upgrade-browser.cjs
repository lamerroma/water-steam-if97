// Upgrade a verified old static release at the SAME origin/scope, then restart offline.
// Baseline extraction is separate; this test never downloads reference releases.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {openTool,chooseModel}=require('./browser-tools.cjs');
(async()=>{
 assert.ok(process.env.PWA_BASELINE_ROOT,'PWA_BASELINE_ROOT must name a verified previous-release static directory.');
 const baseline=path.resolve(process.env.PWA_BASELINE_ROOT),current=path.resolve('dist'),name=process.env.BROWSER_NAME||'chromium',scope='/water-steam-if97/';
 const output=path.resolve(process.env.PWA_UPGRADE_EVIDENCE||`.release/development-r02/upgrade-${name}`);await fs.mkdir(output,{recursive:true});
 const readBuild=async root=>JSON.parse((await fs.readFile(path.join(root,'assets/app.js'),'utf8')).match(/const APP_BUILD = ([^\n]+);/)[1]);
 const oldBuild=await readBuild(baseline),newBuild=await readBuild(current);assert.notEqual(oldBuild.id,newBuild.id);
 const report={date:new Date().toISOString(),browser:name,status:'running',oldBuild,newBuild,checks:[],errors:[],scope:'Actual old/new release files on local subpath, persistent disposable profile, prepared optional Python package, same origin. No live-site/deployment claim.'};
 let release=baseline,disconnected=false,context;
 const server=http.createServer(async(req,res)=>{try{
  if(disconnected){res.writeHead(503);res.end();return;}const uri=new URL(req.url,'http://local').pathname;assert.ok(uri.startsWith(scope));const file=path.resolve(release,decodeURIComponent(uri.slice(scope.length))||'index.html');assert.ok(file.startsWith(release+path.sep));
  res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
 }catch{res.writeHead(404);res.end();}});
 const mark=text=>{report.checks.push(text);console.log(name+' PASS '+text);};
 const ready=page=>page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&!document.querySelector('#calculate')?.disabled,null,{timeout:180000});
 const snapshot=page=>page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('water-steam-if97-project-v1'));return {project:p,language:document.querySelector('#language-select').value,version:document.querySelector('#app-version-value').textContent,build:document.querySelector('#app-build-value').textContent};});
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+scope;
  const launch=()=>pw[name].launchPersistentContext(path.join(output,'profile'),{headless:true,acceptDownloads:true,viewport:{width:1440,height:1000}});
  context=await launch();report.browserVersion=context.browser().version();let page=context.pages()[0]||await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await ready(page);assert.equal(await page.locator('#app-build-value').textContent(),oldBuild.id);
  await page.locator('.menubar details').first().locator('summary').click();await page.fill('#project-title','Upgrade 1.39 project');await page.locator('.menubar details').first().locator('summary').click();
  if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode','pt');await page.selectOption('#unit-a','bar');await page.selectOption('#unit-b','C');await page.fill('#input-a','10');await page.fill('#input-b','226.85');await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await page.locator('#error').isHidden(),true);await page.selectOption('#language-select','en');
  await openTool(page,'libraries');await page.click('#py-install');await page.waitForFunction(()=>document.querySelector('#py-install')?.disabled&&!document.querySelector('#py-run')?.disabled,null,{timeout:180000});assert.equal(await page.locator('#py-error').isHidden(),true);
  await openTool(page,'general');report.before=await snapshot(page);await page.screenshot({path:path.join(output,'before.png'),fullPage:true});mark('Published-build baseline installed; typed-unit project, language and optional Python package prepared');
  release=current;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await page.waitForFunction(()=>!document.querySelector('#pwa-update').hidden,null,{timeout:180000});
  await page.locator('#pwa-panel').evaluate(el=>el.open=true);await page.click('#pwa-update');await page.waitForFunction(id=>document.querySelector('#app-build-value')?.textContent===id,newBuild.id,{timeout:180000});await ready(page);
  report.after=await snapshot(page);assert.equal(report.after.project.title,report.before.project.title);assert.equal(report.after.language,'en');
  for(const key of ['model','mode','a','b','ua','ub'])assert.equal(report.after.project.form[key],report.before.project.form[key],key);
  assert.ok(Math.abs(report.after.project.history[0].h-report.before.project.history[0].h)<1e-7);mark('Real release update preserves project title, IF97 inputs, canonical history and English');
  await openTool(page,'libraries');await page.waitForFunction(()=>!document.querySelector('#py-run')?.disabled,null,{timeout:180000});assert.equal(await page.locator('#py-install').isDisabled(),true);mark('Prepared optional package survives the core release update');
  await openTool(page,'general');await chooseModel(page,'HEOS::Water');await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:180000});assert.equal(await page.locator('#error').isHidden(),true);let data=await snapshot(page);assert.equal(data.project.history[0].model,'HEOS::Water');assert.ok(Math.abs(data.project.history[0].h-2891.218298958905)<1e-7);mark('Updated core supplies the new HEOS Worker and gives the independent Water control');
  await page.screenshot({path:path.join(output,'after.png'),fullPage:true});await context.close();context=null;disconnected=true;
  context=await launch();await context.setOffline(true);page=context.pages()[0]||await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await ready(page);report.offline=await snapshot(page);
  assert.equal(report.offline.build,newBuild.id);assert.equal(report.offline.language,'en');assert.equal(report.offline.project.title,report.before.project.title);assert.equal(report.offline.project.form.model,'HEOS::Water');
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:180000});assert.equal(await page.locator('#error').isHidden(),true);data=await snapshot(page);assert.ok(Math.abs(data.project.history[0].h-2891.218298958905)<1e-7);
  await openTool(page,'libraries');await page.waitForFunction(()=>!document.querySelector('#py-run')?.disabled,null,{timeout:180000});await page.selectOption('#py-package','ht');await page.fill('#py-request','{"target":"ht.LMTD","args":[100,60,30,40]}');await page.click('#py-run');await page.waitForFunction(()=>document.querySelector('#py-result')?.textContent.length>0||!document.querySelector('#py-error')?.hidden,null,{timeout:180000});assert.equal(await page.locator('#py-error').isHidden(),true);assert.match(await page.locator('#py-result').textContent(),/43\.280851/);
  mark('Closed-profile restart with disconnected server restores HEOS and calls cached ht.LMTD offline');await page.screenshot({path:path.join(output,'offline.png'),fullPage:true});
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await context?.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
