const BUILD={"version":"1.30.0","id":"aa01b2635836"};const RESOURCES=["index.html","assets/app.js?v=bb5077f3119fb1de","assets/styles.css?v=dde999ea87af9268","assets/coolprop.wasm?v=aa01b2635836","manifest.webmanifest","assets/icon-192.png","assets/icon-512.png","assets/calculator-worker.js?v=c1d69365396c2c25"];const DIGESTS={"index.html":"330344d3092b48ece3ad20a2915ca9ae931193df94e145e1fd054a6f4e94db4e","assets/app.js?v=bb5077f3119fb1de":"bb5077f3119fb1dec8b7bbbfbd29b8cace0f0156a77ba0040102245fb15e6910","assets/styles.css?v=dde999ea87af9268":"dde999ea87af9268ac3a0fe33a4943ae47180b358fc3818d366b71a4f7df7944","assets/coolprop.wasm?v=aa01b2635836":"28a83d839ab69c7e6ea480298955ce223b6507dc6ffb83349dd31f1540867307","manifest.webmanifest":"63130e8f1083e12602ca499f9de40ad3d97d64b457c005ce570215966f783056","assets/calculator-worker.js?v=c1d69365396c2c25":"c1d69365396c2c25e035bd4ddf534413a824c65eea4d94743a59577f6f5e750b","assets/icon-192.png":"50dd8b5abc44230597dddc0391c9bc50237ac356a824b7a52139e0b4364b0689","assets/icon-512.png":"8f42bcec7ab744311e58bac643f0473846582e36193fc162f328e3640204a88a"};
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
