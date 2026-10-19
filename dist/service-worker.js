const BUILD={"version":"1.35.11","id":"37d045d705ac"};const RESOURCES=["index.html","assets/app.js?v=fa8af0f3ce1cbc5f","assets/styles.css?v=a6588a0e50245cf7","assets/coolprop.wasm?v=37d045d705ac","manifest.webmanifest","assets/icon-192.png","assets/icon-512.png","assets/calculator-worker.js?v=1f9b9b74048be28b"];const DIGESTS={"index.html":"f4541a10e494b627d1caa35b99c707f38cb514a9f62c832de54e946e3d20c285","assets/app.js?v=fa8af0f3ce1cbc5f":"fa8af0f3ce1cbc5f10c451ea4b1f27933d96864bb983cbe63f750682090cdd16","assets/styles.css?v=a6588a0e50245cf7":"a6588a0e50245cf79327284ec3e9acf5a454c4a71d12d3d0ad94c5e5f28e0427","assets/coolprop.wasm?v=37d045d705ac":"28a83d839ab69c7e6ea480298955ce223b6507dc6ffb83349dd31f1540867307","manifest.webmanifest":"63130e8f1083e12602ca499f9de40ad3d97d64b457c005ce570215966f783056","assets/calculator-worker.js?v=1f9b9b74048be28b":"1f9b9b74048be28bd559e3950be13cfb25696688538850204f1c564d4aac3d29","assets/icon-192.png":"50dd8b5abc44230597dddc0391c9bc50237ac356a824b7a52139e0b4364b0689","assets/icon-512.png":"8f42bcec7ab744311e58bac643f0473846582e36193fc162f328e3640204a88a"};
const cachePrefix='water-steam:'+new URL(self.registration.scope).pathname+'|';
const cacheName=cachePrefix+BUILD.id+new URL(self.location.href).search;
const url=path=>new URL(path,self.registration.scope).href;
async function broadcast(message){for(const client of await self.clients.matchAll({includeUncontrolled:true,type:'window'}))if(client.url.startsWith(self.registration.scope))client.postMessage({...message,build:BUILD});}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{
  const cache=await caches.open(cacheName);let done=0;
  for(const path of RESOURCES){
   const response=await fetch(url(path),{cache:'no-store'});
   if(!response.ok)throw Error('Download failed: '+path);
   const bytes=await response.clone().arrayBuffer();
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==DIGESTS[path])throw Error('Release changed during download: '+path);
   await cache.put(url(path),response);
   await broadcast({type:'PWA_PROGRESS',done:++done,total:RESOURCES.length});
  }
  await broadcast({type:'PWA_COMPLETE'});
 }catch(error){await caches.delete(cacheName);await broadcast({type:'PWA_ERROR'});throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 // Claim uncontrolled pages on first installation. Older release caches and
 // versioned WASM URLs preserve existing tabs when an update is activated.
 const keys=await caches.keys();
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 if(!windows.some(client=>client.url.startsWith(self.registration.scope)))for(const key of keys)if(key.startsWith(cachePrefix)&&key!==cacheName)await caches.delete(key);
 if(!keys.some(key=>key.startsWith(cachePrefix)&&key!==cacheName))await self.clients.claim();
 await broadcast({type:'PWA_ACTIVE'});
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='PWA_ACTIVATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='PWA_STATUS')event.waitUntil((async()=>{
  const cache=await caches.open(cacheName);
  const ready=(await Promise.all(RESOURCES.map(path=>cache.match(url(path))))).every(Boolean);
  event.source?.postMessage({type:ready?'PWA_READY':'PWA_MISSING',build:BUILD});
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,u=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||u.origin!==scope.origin||!u.pathname.startsWith(scope.pathname))return;
 const navigation=request.mode==='navigate'&&(u.pathname===scope.pathname||u.pathname===scope.pathname+'index.html');
 if(!navigation&&!RESOURCES.some(path=>url(path)===u.href)&&!['assets/app.js','assets/styles.css','assets/coolprop.wasm','assets/calculator-worker.js'].some(path=>u.pathname===scope.pathname+path))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheName);let response=await cache.match(navigation?url('index.html'):request);
  if(!response&&!navigation)for(const key of await caches.keys()){if(key.startsWith(cachePrefix)){response=await (await caches.open(key)).match(request);if(response)break;}}
  // Never mix release assets after eviction. An explicit retry prepares a full set.
  if(!response&&navigation)return new Response(`<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline recovery</title><h1>Офлайн-файли недоступні / Offline files unavailable</h1><p>Підключіться до інтернету та відновіть програму. JSON-проєкти й локальні дані не видаляються.</p><p>Connect to the internet and restore the application. Project data will be kept.</p><button id="restore-offline">Відновити / Restore</button><p id="restore-status" role="status"></p>
<script>
document.getElementById('restore-offline').onclick=async function(){
 const button=this,status=document.getElementById('restore-status');
 button.disabled=true;status.textContent='Завантаження… / Downloading…';
 try{
  // Re-registering identical worker bytes can reuse an evicted cache without
  // running install. A fresh URL forces a complete, checksum-verified download.
  const registration=await navigator.serviceWorker.register('service-worker.js?repair='+Date.now(),{updateViaCache:'none'});
  const worker=registration.installing||registration.waiting;
  if(!worker)throw Error('No repair worker');
  await new Promise((resolve,reject)=>{
   const check=()=>{
    if(worker.state==='installed')worker.postMessage({type:'PWA_ACTIVATE'});
    if(worker.state==='activated'){worker.removeEventListener('statechange',check);resolve();}
    if(worker.state==='redundant'){worker.removeEventListener('statechange',check);reject(Error('Download failed'));}
   };
   worker.addEventListener('statechange',check);check();
  });
  location.reload();
 }catch{
  button.disabled=false;status.textContent='Не вдалося відновити. Перевірте підключення та повторіть. / Restore failed. Check your connection and retry.';
 }
};
</script></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
  return response||new Response('Offline resources are missing. Reconnect and prepare offline again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 })());
});
