const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const currentVersion=require('../package.json').version;const parts=currentVersion.split('.').map(Number);parts[2]++;const nextVersion=parts.join('.');
 let release=1,fail=false,corrupt=false;const requests=[];
 const server=http.createServer(async(req,res)=>{
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
 const launch=()=>chromium.launchPersistentContext(dir,{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox'],viewport:{width:390,height:844}});
 try{
 ctx=await launch();let p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('готова')||document.querySelector('#pwa-status').textContent.includes('ready offline'));
 await p.goto('http://127.0.0.1:8091/water-steam-if97/');await ready();await p.waitForFunction(()=>navigator.serviceWorker.controller);
 assert.ok(requests.some(u=>u.startsWith('/water-steam-if97/assets/coolprop.wasm')));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.screenshot({path:path.join(os.tmpdir(),'pwa-mobile.png')});const cdp=await ctx.newCDPSession(p);const manifest=await cdp.send('Page.getAppManifest');assert.deepEqual(manifest.errors,[]);assert.equal(JSON.parse(manifest.data).scope,'./');
 await p.setViewportSize({width:1440,height:1000});await p.locator('.menubar details').first().locator('summary').click();await p.locator('#project-title').fill('Offline project');await p.locator('.menubar details').first().locator('summary').click();await p.locator('#input-a').fill('3');await p.locator('#input-b').fill('100');await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await p.selectOption('#language-select','en');await p.locator('#pwa-panel summary').click();assert.match(await p.locator('#pwa-status').textContent(),/ready offline/);console.log('Full cache, scope, mobile and English PASS');
 await ctx.close();ctx=await launch();await ctx.setOffline(true);p=await ctx.newPage();await p.setViewportSize({width:1440,height:1000});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8091/water-steam-if97/');await ready();await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#project-title').inputValue(),'Offline project');
 await p.locator('input[name=formulation][value="IAPWS-95"]').check();await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await p.locator('#error').isHidden(),true);
 // Exercise CoolProp-backed scientific gas panel while network is disabled.
 await p.locator('[data-action=gases]').first().click();await p.waitForFunction(()=>!!document.querySelector('#learn-form'));await p.waitForFunction(()=>!document.querySelector('#learn-form button[type=submit]').disabled);await p.locator('#learn-form').evaluate(e=>e.requestSubmit());await p.waitForFunction(()=>document.querySelector('#learn-output').textContent.length>0);assert.equal(await p.locator('#learn-error').isHidden(),true);
 assert.ok(await p.evaluate(async()=>{const c=await caches.open((await caches.keys())[0]);const key=(await c.keys()).find(r=>r.url.includes('coolprop.wasm'));const r=await c.match(key);return r.ok&&(await r.arrayBuffer()).byteLength>9000000;}));
 await p.locator('[data-action=general]').first().click();await p.locator('input[name=formulation][value=IF97]').check();await p.click('[data-tool-group=processes]');await p.locator('.tabs [data-action=ts]').click();await p.waitForFunction(()=>!!document.querySelector('#steam-diagram'));for(const id of ['diagram-save','diagram-png','diagram-csv','diagram-report']){const [download]=await Promise.all([p.waitForEvent('download'),p.click('#'+id)]);assert.ok((await fs.readFile(await download.path())).length>100);}console.log('Browser restart, project, IAPWS-95, WASM, diagram and exports offline PASS');
 const other=await ctx.newPage();await other.goto('http://127.0.0.1:8091/water-steam-if97/');await other.waitForFunction(()=>!document.querySelector('#calculate').disabled);const previousScript=await other.locator('script[src]').getAttribute('src');
 await ctx.setOffline(false);release=2;await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await p.waitForFunction(()=>!document.querySelector('#pwa-update').hidden);assert.equal(await p.locator('#app-version-value').textContent(),currentVersion);
 await p.locator('#pwa-panel').evaluate(e=>e.open=true);await p.click('#pwa-update');await p.waitForFunction(version=>document.querySelector('#app-version-value').textContent===version,nextVersion);await ready();assert.equal(await p.locator('#project-title').inputValue(),'Offline project');console.log('Controlled release update preserves project PASS');await ctx.setOffline(true);assert.equal(await other.locator('#app-version-value').textContent(),currentVersion);assert.ok((await other.evaluate(async(src)=>(await fetch(src)).text(),previousScript)).includes('"version":"'+currentVersion+'"'));await other.close();await ctx.setOffline(false);console.log('Older open tab retains release assets PASS');
 // A clean install with an interrupted WASM request must fail and delete partial cache.
 const bad=await ctx.browser().newContext();const q=await bad.newPage();fail=true;await q.goto('http://127.0.0.1:8091/water-steam-if97/');await q.waitForFunction(()=>!document.querySelector('#pwa-retry').hidden);assert.equal(await q.evaluate(async()=> (await caches.keys()).length),0);fail=false;await q.locator('#pwa-panel summary').click();await q.click('#pwa-retry');await q.waitForFunction(()=>document.querySelector('#pwa-status').textContent.includes('готова'));await bad.close();console.log('Interrupted installation, atomic cache and retry PASS');
 const damaged=await ctx.browser().newContext();const z=await damaged.newPage();corrupt=true;await z.goto('http://127.0.0.1:8091/water-steam-if97/');await z.waitForFunction(()=>!document.querySelector('#pwa-retry').hidden);assert.equal(await z.evaluate(async()=> (await caches.keys()).length),0);corrupt=false;await damaged.close();console.log('Corrupt resource is rejected PASS');
 await p.evaluate(async()=>{for(const key of await caches.keys())await caches.delete(key);});await p.reload();assert.ok((await p.content()).includes('Offline files unavailable'));await p.getByRole('button',{name:'Відновити / Restore'}).click();await ready();assert.equal(await p.locator('#project-title').inputValue(),'Offline project');console.log('Evicted cache recovery preserves project PASS');
 assert.deepEqual(errors,[]);
 }finally{await ctx?.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
