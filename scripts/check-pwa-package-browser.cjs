// Verify the shipped ZIP and its Python launcher, then stop that server and
// restart a persistent browser profile with network access disabled.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),name=process.env.BROWSER_NAME||'chromium';
 const python=process.env.REACTOR_PYTHON||(process.platform==='win32'?'python':'python3');
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'thermo-pwa-zip-')),site=path.join(folder,'site');
 const evidence=path.join(root,'.release/pwa-package',name);await fs.mkdir(evidence,{recursive:true});
 const report={browser:name,status:'running',checks:[],errors:[],externalRequests:[]};let server,context;
 const launch=()=>pw[name].launchPersistentContext(path.join(folder,'profile'),{headless:true,viewport:{width:1366,height:900},...(name==='chromium'?{args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})}:{})});
 const ready=page=>page.waitForFunction(()=>!!navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')&&document.querySelector('#calculate')?.disabled===false,null,{timeout:120000});
 const calculate=async page=>{await page.click('#calculate');await page.waitForFunction(()=>document.querySelector('#copy-result-json')?.disabled===false);assert.equal(await page.locator('#error').isHidden(),true);};
 try{
  const packed=spawnSync(process.execPath,['scripts/package-release.mjs'],{cwd:root,encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
  const zip=path.join(root,'dist/water-steam-calculator.zip');report.zipSha256=createHash('sha256').update(await fs.readFile(zip)).digest('hex');
  const unpacked=spawnSync(python,['-c','import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,site],{encoding:'utf8'});assert.equal(unpacked.status,0,unpacked.stderr);
  server=spawn(python,['-u',path.join(site,'serve.py'),'--port','0'],{stdio:['ignore','pipe','pipe']});
  const url=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Packaged launcher did not start')),15000);let output='';
   server.stdout.on('data',data=>{output+=data;const match=output.match(/PWA: (http:\/\/localhost:\d+\/)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
   server.on('error',error=>{clearTimeout(timeout);reject(error);});server.on('exit',code=>{clearTimeout(timeout);reject(Error('Launcher exited: '+code));});
  });
  context=await launch();report.browserVersion=context.browser().version();
  // No external connectivity is allowed even during this first installation.
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===new URL(url).origin)return route.continue();report.externalRequests.push(route.request().url());return route.abort();});
  let page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await ready(page);
  const response=await page.request.get(url+'assets/coolprop.wasm');assert.match(response.headers()['content-type'],/application\/wasm/);
  const manifest=await page.request.get(url+'manifest.webmanifest');assert.match(manifest.headers()['content-type'],/application\/manifest\+json/);
  await calculate(page);report.build=await page.locator('#app-build-value').textContent();
  const before=await page.locator('[data-property="h"]').first().textContent();assert.ok(before.length>0);
  report.checks.push('Complete ZIP first launch through shipped serve.py; no external requests; correct WASM/manifest MIME; calculation');
  await context.close();context=null;
  await new Promise(resolve=>{server.once('exit',resolve);server.kill();});server=null;
  context=await launch();await context.setOffline(true);page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url);await ready(page);await calculate(page);
  assert.equal(await page.locator('[data-property="h"]').first().textContent(),before);
  assert.ok(page.workers().some(worker=>worker.url().includes('assets/calculator-worker.js?v=')));
  await page.screenshot({path:path.join(evidence,'offline.png'),fullPage:true});
  report.checks.push('Server stopped, browser profile restarted offline; project restored; newly created calculation Worker and matching result');
  assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.errors,[]);report.status='passed';
  console.log(`${name}: shipped PWA ZIP, first local install without internet, stopped server and offline browser restart PASS`);
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{if(context)await context.close();if(server)server.kill();await fs.writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
