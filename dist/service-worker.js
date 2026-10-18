const BUILD={"version":"1.35.5","id":"1bb5f891f873"};const RESOURCES=["index.html","assets/app.js?v=5c6bdc75980b3ac1","assets/styles.css?v=c77c47d879b7395b","assets/coolprop.wasm?v=1bb5f891f873","manifest.webmanifest","assets/icon-192.png","assets/icon-512.png","assets/calculator-worker.js?v=fdc5a0ea08bc60c6"];const DIGESTS={"index.html":"75b75131f15c4bfde8affdb0f73354d3cf564abd70b33dfb93b572b5defbe695","assets/app.js?v=5c6bdc75980b3ac1":"5c6bdc75980b3ac1e9677a73cf8c1608f1e20c8fe60f279a39aaa6f8ee971b09","assets/styles.css?v=c77c47d879b7395b":"c77c47d879b7395bc7ba157c838cd325d06509517c4a80984776480c17a25e34","assets/coolprop.wasm?v=1bb5f891f873":"28a83d839ab69c7e6ea480298955ce223b6507dc6ffb83349dd31f1540867307","manifest.webmanifest":"63130e8f1083e12602ca499f9de40ad3d97d64b457c005ce570215966f783056","assets/calculator-worker.js?v=fdc5a0ea08bc60c6":"fdc5a0ea08bc60c62928b23f2f394f2d2cc692945c9d8467979513dad236137d","assets/icon-192.png":"50dd8b5abc44230597dddc0391c9bc50237ac356a824b7a52139e0b4364b0689","assets/icon-512.png":"8f42bcec7ab744311e58bac643f0473846582e36193fc162f328e3640204a88a"};
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
