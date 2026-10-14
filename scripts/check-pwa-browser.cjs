const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browserName=process.env.BROWSER_NAME||'chromium';
const browserType=playwright[browserName];
if(!['chromium','firefox'].includes(browserName))throw Error('Unsupported browser: '+browserName);
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const currentVersion=require('../package.json').version;const parts=currentVersion.split('.').map(Number);parts[2]++;const nextVersion=parts.join('.');
 let release=1,fail=false,corrupt=false,disconnected=false;const requests=[];
 const server=http.createServer(async(req,res)=>{
  if(disconnected){res.destroy();return;}
  const u=new URL(req.url,'http://localhost'),file=u.pathname.replace(/^\/water-steam-if97\//,'')||'index.html';requests.push(req.url);
  if(fail&&file==='assets/coolprop.wasm'){res.writeHead(503);res.end();return;}
  try{let data=await fs.readFile(path.join(__dirname,'../dist',file));if(release===2&&['index.html','service-worker.js','assets/app.js'].includes(file))data=Buffer.from(data.toString().replaceAll(currentVersion,nextVersion).replaceAll(/(assets\/app\.js\?v=[a-f0-9]+)/g,'$1-next').replaceAll(/const BUILD=\{"version":"[^"]+","id":"[^"]+"\}/g,'const BUILD='+JSON.stringify({version:nextVersion,id:'pwa-test-next'})));
   if(corrupt&&file==='assets/coolprop.wasm')data=Buffer.from('Corrupt response');
   if(release===2&&file==='service-worker.js'){
    const crypto=require('node:crypto');let worker=data.toString();for(const changed of ['index.html','assets/app.js']){
     const old=await fs.readFile(path.join(__dirname,'../dist',changed));const next=Buffer.from(old.toString().replaceAll(currentVersion,nextVersion).replaceAll(/(assets\/app\.js\?v=[a-f0-9]+)/g,'$1-next'));
     worker=worker.replaceAll(crypto.createHash('sha256').update(old).digest('hex'),crypto.createHash('sha256').update(next).digest('hex'));
    }data=Buffer.from(worker);
   }
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);
  }catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(8091,'127.0.0.1',r));
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'thermo-pwa-'));let ctx;
 const launch=()=>browserType.launchPersistentContext(dir,{headless:true,...(browserName==='chromium'&&process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),...(browserName==='chromium'?{args:['--no-sandbox']}:{}),viewport:{width:390,height:844}});
 try{
 ctx=await launch();let p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>{const status=document.querySelector('#pwa-status')?.textContent;return !document.querySelector('#calculate')?.disabled&&(status?.includes('готова')||status?.includes('ready offline'));});
 await p.goto('http://127.0.0.1:8091/water-steam-if97/');await ready();await p.waitForFunction(()=>navigator.serviceWorker.controller);
 assert.ok(requests.some(u=>u.startsWith('/water-steam-if97/assets/coolprop.wasm')));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.screenshot({path:path.join(os.tmpdir(),'pwa-mobile.png')});if(browserName==='chromium'){const cdp=await ctx.newCDPSession(p);const manifest=await cdp.send('Page.getAppManifest');assert.deepEqual(manifest.errors,[]);assert.equal(JSON.parse(manifest.data).scope,'./');}else{const manifest=await p.evaluate(async()=>{const response=await fetch(document.querySelector('link[rel=manifest]').href);return {type:response.headers.get('content-type'),data:await response.json()};});assert.match(manifest.type,/manifest\+json/);assert.equal(manifest.data.scope,'./');}
 await p.setViewportSize({width:1440,height:1000});await p.locator('.menubar details').first().locator('summary').click();await p.locator('#project-title').fill('Offline project');await p.locator('.menubar details').first().locator('summary').click();await p.locator('#input-a').fill('3');await p.locator('#input-b').fill('100');await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await p.selectOption('#language-select','en');await p.locator('#pwa-panel summary').click();assert.match(await p.locator('#pwa-status').textContent(),/ready offline/);console.log('Full cache, scope, mobile and English PASS');
 await ctx.close();ctx=await launch();await ctx.setOffline(true);p=await ctx.newPage();await p.setViewportSize({width:1440,height:1000});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8091/water-steam-if97/');await ready();await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#project-title').inputValue(),'Offline project');
 await require('./browser-tools.cjs').chooseModel(p,'IAPWS-95');await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#error').isHidden(),true);
 // Exercise CoolProp-backed scientific gas panel while network is disabled.
 await p.locator('[data-action=gases]').first().click();await p.waitForFunction(()=>!!document.querySelector('#learn-form'));await p.waitForFunction(()=>!document.querySelector('#learn-form button[type=submit]').disabled);await p.locator('#learn-form').evaluate(e=>e.requestSubmit());await p.waitForFunction(()=>document.querySelector('#learn-output').textContent.length>0);assert.equal(await p.locator('#learn-error').isHidden(),true);
 assert.ok(await p.evaluate(async()=>{const c=await caches.open((await caches.keys())[0]);const key=(await c.keys()).find(r=>r.url.includes('coolprop.wasm'));const r=await c.match(key);return r.ok&&(await r.arrayBuffer()).byteLength>9000000;}));
 await p.locator('[data-action=general]').first().click();await require('./browser-tools.cjs').chooseModel(p,'IF97');await p.click('[data-tool-group=processes]');await p.locator('.tabs [data-action=ts]').click();await p.waitForFunction(()=>!!document.querySelector('#steam-diagram'));for(const id of ['diagram-save','diagram-png','diagram-csv','diagram-report']){const [download]=await Promise.all([p.waitForEvent('download'),p.click('#'+id)]);assert.ok((await fs.readFile(await download.path())).length>100);}console.log('Browser restart, project, IAPWS-95, WASM, diagram and exports offline PASS');
 const other=await ctx.newPage();await other.goto('http://127.0.0.1:8091/water-steam-if97/');await other.waitForFunction(()=>!document.querySelector('#calculate').disabled);const previousScript=await other.locator('script[src]').getAttribute('src');
 await ctx.setOffline(false);release=2;await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await p.waitForFunction(()=>!document.querySelector('#pwa-update').hidden);assert.equal(await p.locator('#app-version-value').textContent(),currentVersion);
 await p.locator('#pwa-panel').evaluate(e=>e.open=true);
 // Refuse activation if the current project cannot be saved.
 await p.evaluate(()=>{window.pwaOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='water-steam-if97-project-v1')throw new DOMException('Quota','QuotaExceededError');return window.pwaOriginalSetItem.call(this,key,value);};});
 await p.locator('.menubar details').first().locator('summary').click();await p.fill('#project-title','Unsaved update project');await p.locator('.menubar details').first().locator('summary').click();await p.click('#pwa-update');
 await p.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('save')||document.querySelector('#pwa-status').textContent.includes('зберег'));assert.equal(await p.locator('#app-version-value').textContent(),currentVersion);
 await p.evaluate(()=>{Storage.prototype.setItem=window.pwaOriginalSetItem;delete window.pwaOriginalSetItem;});
 await p.click('#pwa-update');await p.waitForFunction(version=>document.querySelector('#app-version-value').textContent===version,nextVersion);await ready();assert.equal(await p.locator('#project-title').inputValue(),'Unsaved update project');assert.equal(await p.locator('#language-select').inputValue(),'en');console.log('Blocked unsaved update and controlled release update preserve project and language PASS');await ctx.setOffline(true);assert.equal(await other.locator('#app-version-value').textContent(),currentVersion);assert.ok((await other.evaluate(async(src)=>(await fetch(src)).text(),previousScript)).includes('"version":"'+currentVersion+'"'));await other.close();await ctx.setOffline(false);console.log('Older open tab retains release assets PASS');
 // A clean install with an interrupted WASM request must fail and delete partial cache.
 const bad=await ctx.browser().newContext();const q=await bad.newPage();fail=true;await q.goto('http://127.0.0.1:8091/water-steam-if97/');await q.waitForFunction(()=>!document.querySelector('#pwa-retry').hidden);assert.equal(await q.evaluate(async()=> (await caches.keys()).length),0);fail=false;await q.locator('#pwa-panel summary').click();await q.click('#pwa-retry');await q.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('готова'));await bad.close();console.log('Interrupted installation, atomic cache and retry PASS');
 const damaged=await ctx.browser().newContext();const z=await damaged.newPage();corrupt=true;await z.goto('http://127.0.0.1:8091/water-steam-if97/');await z.waitForFunction(()=>!document.querySelector('#pwa-retry').hidden);assert.equal(await z.evaluate(async()=> (await caches.keys()).length),0);corrupt=false;await damaged.close();console.log('Corrupt resource is rejected PASS');
 await p.evaluate(async()=>{for(const key of await caches.keys())await caches.delete(key);});await p.reload();assert.ok((await p.content()).includes('Offline files unavailable'));
 // Recovery must remain retryable without a connection and leave project data intact.
 const savedProject=await p.evaluate(()=>localStorage.getItem('water-steam-if97-project-v1'));
 assert.ok(savedProject);
 // Firefox may keep service-worker fetches online despite context.setOffline.
 disconnected=true;await ctx.setOffline(true);await p.getByRole('button',{name:'Відновити / Restore'}).click();await p.waitForFunction(()=>document.querySelector('#restore-status').textContent.includes('Restore failed'));
 assert.equal(await p.getByRole('button',{name:'Відновити / Restore'}).isEnabled(),true);assert.equal(await p.evaluate(()=>localStorage.getItem('water-steam-if97-project-v1')),savedProject);
 disconnected=false;await ctx.setOffline(false);await p.getByRole('button',{name:'Відновити / Restore'}).click();await ready();await p.waitForFunction(()=>navigator.serviceWorker.controller&&!document.querySelector('#calculate').disabled);
 assert.equal(await p.locator('#project-title').inputValue(),'Unsaved update project');assert.equal(await p.locator('#language-select').inputValue(),'en');
 await ctx.setOffline(true);await p.reload();await ready();await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);await require('./browser-tools.cjs').openTool(p,'general');await p.click('#calculate');await p.waitForFunction(()=>document.querySelectorAll('#calculator-result-summary button').length===6);assert.equal(await p.locator('#error').isHidden(),true);
 console.log('Evicted cache recovery retries without a connection, preserves project and language, and restores offline calculations PASS');
 assert.deepEqual(errors,[]);
 }finally{await ctx?.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
