// Installation, verified offline readiness, repair and controlled PWA updates.
(()=>{
 const panel=document.getElementById('pwa-panel');if(!panel)return;
 const status=document.getElementById('pwa-status'),progress=document.getElementById('pwa-progress'),retry=document.getElementById('pwa-retry'),update=document.getElementById('pwa-update'),install=document.getElementById('pwa-install'),checkUpdate=document.getElementById('pwa-check');
 let registration,prompt,state='preparing',params={},updating=false,applyWhenInstalled=false;
 const render=()=>{status.textContent=uiTranslator.t('pwa.'+state,params);document.getElementById('pwa-summary-status').textContent=uiTranslator.t(registration?.waiting?'pwa.available':'pwa.'+state,params);};
 const set=(key,values={})=>{state=key;params=values;render();};
 document.addEventListener('languagechange',render);
 if(location.protocol==='file:'||!('serviceWorker' in navigator)||!isSecureContext){checkUpdate.hidden=true;set('unsupported');return;}
 const check=()=>{registration?.active?.postMessage({type:'PWA_STATUS',build:APP_BUILD.id});update.hidden=!registration?.waiting;render();};
 const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){progress.hidden=true;check();if(applyWhenInstalled){applyWhenInstalled=false;applyUpdate();}}if(worker.state==='redundant'){applyWhenInstalled=false;checkUpdate.disabled=false;progress.hidden=true;retry.hidden=false;set('failed');}});};
 navigator.serviceWorker.addEventListener('message',event=>{
  const message=event.data||{};
  if(message.type==='PWA_PROGRESS'){progress.hidden=false;progress.max=message.total;progress.value=message.done;set('progress',{done:message.done,total:message.total});}
  if(message.type==='PWA_ERROR'){progress.hidden=true;retry.hidden=false;set('failed');}
  if(message.type==='PWA_COMPLETE'||message.type==='PWA_ACTIVE'){progress.hidden=true;check();}
  if(message.type==='PWA_READY'){retry.hidden=true;set('ready',{version:message.build.version});}
  if(message.type==='PWA_MISSING'){retry.hidden=false;set('missing');}
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();else check();});
 async function register(){
  retry.hidden=true;set('preparing');
  try{
   // Keep a repaired worker's URL on subsequent launches. Switching straight
   // back to the base URL starts another install that can fail when offline.
   const script=new URL('service-worker.js',location.href),existing=await navigator.serviceWorker.getRegistration();
   const active=existing?.active&&new URL(existing.active.scriptURL);
   if(active?.origin===script.origin&&active.pathname===script.pathname&&active.searchParams.has('repair'))script.search=active.search;
   registration=await navigator.serviceWorker.register(script.href,{updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);check();
  }
  catch{set('failed');retry.hidden=false;progress.hidden=true;}
 }
 retry.onclick=async()=>{
  // A same-version worker may not reinstall after eviction. Repair its complete
  // cache through a fresh worker URL; existing complete releases stay available.
  if(registration){set('preparing');try{registration=await navigator.serviceWorker.register('service-worker.js?repair='+Date.now(),{updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);check();}catch{set('failed');retry.hidden=false;}}
  else await register();
 };
 // Activation saves the project first; a waiting release reloads the page once it controls it.
 const applyUpdate=()=>{checkUpdate.disabled=false;saveProject();if(unsavedProject){set('saveFailed');return;}if(registration?.waiting){updating=true;registration.waiting.postMessage({type:'PWA_ACTIVATE'});}};
 update.onclick=applyUpdate;
 // Explicit check: ask the server for a newer worker now, then download and apply it.
 checkUpdate.onclick=async()=>{
  if(!registration)return;
  if(registration.waiting){applyUpdate();return;}
  if(!navigator.onLine){set('checkOffline');return;}
  checkUpdate.disabled=true;set('checking');
  try{await registration.update();}catch{checkUpdate.disabled=false;set('checkFailed');return;}
  if(registration.waiting)applyUpdate();
  else if(registration.installing)applyWhenInstalled=true;
  else{checkUpdate.disabled=false;set('latest',{version:APP_BUILD.version});}
 };
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
 install.onclick=async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;}};
 window.addEventListener('appinstalled',()=>{install.hidden=true;});
 window.addEventListener('online',check);window.addEventListener('offline',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){check();registration?.update().catch(()=>{});}});
 register();
})();
