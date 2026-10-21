// Deployment acceptance through the public UI and a fresh disposable profile.
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {openTool,chooseModel}=require('./browser-tools.cjs');
(async()=>{
 const url=process.env.PUBLISHED_URL,build=process.env.PUBLISHED_BUILD,name=process.env.BROWSER_NAME||'chromium';
 assert.ok(url&&/^[a-f0-9]{12}$/.test(build||''),'PUBLISHED_URL and PUBLISHED_BUILD are required.');
 const output=path.resolve(process.env.PUBLISHED_HEOS_EVIDENCE||`.release/development-r02/published-${build}-${name}`);
 await fs.mkdir(output,{recursive:true});
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/water-heos-matrix.json','utf8'));
 const expected=fixture.records.find(c=>c.expected.p===.1&&c.expected.T===500).expected;
 const report={date:new Date().toISOString(),url,expectedBuild:build,browser:name,status:'running',checks:[],states:[],errors:[],scope:'Published/static-origin UI smoke and persistent-profile offline restart. Independent stored IAPWS-95 control; not full Steam97 parity or all-device acceptance.'};
 // Keep Chromium's deeply nested CacheStorage paths short on Windows.
 // Every run gets its own profile; preserve it for diagnostics, outside Git.
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'heos-publish-'));report.profile=profile;
 let context;
 const launch=offline=>pw[name].launchPersistentContext(profile,{headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},...(offline?{proxy:{server:'http://127.0.0.1:9'}}:{})});
 const listen=page=>page.on('pageerror',e=>report.errors.push(e.message));
 const ready=page=>page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&!document.querySelector('#calculate')?.disabled,null,{timeout:180000});
 const mark=text=>{report.checks.push(text);console.log(name+' PASS '+text);};
 const checkControl=async(page,label)=>{
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:180000});
  assert.equal(await page.locator('#error').isHidden(),true,await page.locator('#error').textContent());
  const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')));
  assert.equal(project.history[0].model,'HEOS::Water');
  const [download]=await Promise.all([page.waitForEvent('download'),page.click('#export-csv')]);
  const csv=await fs.readFile(await download.path(),'utf8');await fs.writeFile(path.join(output,label.replaceAll(' ','-')+'.csv'),csv);
  // These eight numeric rows contain no escaped text or embedded CSV delimiters.
  const rows=csv.split(/\r?\n/).map(line=>line.match(/^"state","([^"]+)","([^"]*)","([^"]*)"(?:,|$)/)).filter(Boolean);
  const q=Object.fromEntries(rows.map(row=>[row[1],row[2]===''?null:Number(row[2])])),units=Object.fromEntries(rows.map(row=>[row[1],row[3]]));
  assert.equal(rows.find(row=>row[1]==='model')[2],'HEOS::Water');assert.ok(csv.includes('"'+build+'"'));
  assert.equal(units.p,'MPa');assert.equal(units.T,'K');
  for(const k of ['p','T','rho','h','s','cp','cv','w']){const tolerance=k==='s'?2e-8:2e-6;assert.ok(Number.isFinite(q[k])&&Math.abs(q[k]-expected[k])<=tolerance,k+': '+q[k]+' vs '+expected[k]);}
  report.states.push({label,form:project.form,state:Object.fromEntries(Object.keys(expected).filter(k=>k in q).map(k=>[k,q[k]])),units});return project;
 };
 try{
  context=await launch(false);report.browserVersion=context.browser().version();let page=context.pages()[0]||await context.newPage();listen(page);report.phase='online navigation';await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await page.goto(url);await ready(page);console.log(name+' core ready');
  assert.equal(await page.locator('#app-build-value').textContent(),build);report.version=await page.locator('#app-version-value').textContent();
  await openTool(page,'general');await chooseModel(page,'HEOS::Water');if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');
  await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a',String(expected.p));await page.fill('#input-b','500');
  await checkControl(page,'online P-T');mark('Exact deployed build, real UI HEOS P-T, eight independent quantities');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#file-project-export').evaluate(e=>e.click())]);
  const raw=await fs.readFile(await download.path());const project=JSON.parse(raw);assert.equal(project.form.model,'HEOS::Water');await fs.writeFile(path.join(output,'project.json'),raw);
  await page.selectOption('#mode','ph');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','kJkg');await page.fill('#input-a',String(expected.p));await page.fill('#input-b',String(expected.h));await checkControl(page,'online P-h');mark('Inverse P-h and exact project JSON export');
  await page.screenshot({path:path.join(output,'online.png'),fullPage:true});await context.close();context=null;
  context=await launch(true);await context.setOffline(true);page=context.pages()[0]||await context.newPage();listen(page);await page.goto(url);await ready(page);assert.equal(await page.locator('#app-build-value').textContent(),build);
  const blocked=await page.evaluate(async()=>{try{await fetch(new URL('/__outside_pwa_network_probe_'+Date.now(),location.href));return false;}catch{return true;}});assert.equal(blocked,true);report.networkProbeBlocked=blocked;
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')));assert.equal(restored.form.model,'HEOS::Water');assert.equal(restored.form.mode,'ph');
  await checkControl(page,'offline P-h');await page.selectOption('#mode','pt');await page.selectOption('#unit-a','MPa');await page.selectOption('#unit-b','K');await page.fill('#input-a',String(expected.p));await page.fill('#input-b','500');await checkControl(page,'offline P-T');
  assert.equal((await page.evaluate(()=>caches.keys())).some(k=>k.startsWith('thermocalc-python:')),false);mark('Closed-profile restart, dead proxy plus offline network, cached HEOS Worker, P-h/P-T without Python');
  await page.screenshot({path:path.join(output,'offline.png'),fullPage:true});assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;report.pages=await Promise.all((context?.pages()||[]).map(page=>page.evaluate(()=>({url:location.href,status:document.querySelector('#pwa-status')?.textContent,controller:!!navigator.serviceWorker.controller,build:document.querySelector('#app-build-value')?.textContent,error:document.querySelector('#error')?.textContent})).catch(()=>null)));await context?.pages()[0]?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
 finally{await context?.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
