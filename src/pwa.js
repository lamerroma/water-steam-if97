// Kept inside the application bundle; standalone never registers a worker.
(()=>{
 const panel=document.getElementById('pwa-panel');if(!panel)return;
 const status=document.getElementById('pwa-status'),progress=document.getElementById('pwa-progress'),retry=document.getElementById('pwa-retry'),update=document.getElementById('pwa-update'),install=document.getElementById('pwa-install');
 let registration,prompt,state='preparing',params={},updating=false;
 const render=()=>{status.textContent=uiTranslator.t('pwa.'+state,params);document.getElementById('pwa-summary-status').textContent=uiTranslator.t(registration?.waiting?'pwa.available':'pwa.'+state,params);};
 const set=(key,values={})=>{state=key;params=values;render();};
 document.addEventListener('languagechange',render);
 if(location.protocol==='file:'){set('standalone');return;}
 if(!('serviceWorker' in navigator)||!isSecureContext){set('unsupported');return;}
 const check=()=>{registration?.active?.postMessage({type:'PWA_STATUS'});update.hidden=!registration?.waiting;render();};
 const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){progress.hidden=true;check();}if(worker.state==='redundant'){progress.hidden=true;retry.hidden=false;set('failed');}});};
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
  try{registration=await navigator.serviceWorker.register('service-worker.js',{updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);check();}
  catch{set('failed');retry.hidden=false;progress.hidden=true;}
 }
 retry.onclick=async()=>{
  // A same-version worker may not reinstall after eviction. Repair its complete
  // cache through a fresh worker URL; existing complete releases stay available.
  if(registration){set('preparing');try{registration=await navigator.serviceWorker.register('service-worker.js?repair='+Date.now(),{updateViaCache:'none'});registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);check();}catch{set('failed');retry.hidden=false;}}
  else await register();
 };
 update.onclick=()=>{saveProject();if(unsavedProject){set('saveFailed');return;}if(registration?.waiting){updating=true;registration.waiting.postMessage({type:'PWA_ACTIVATE'});}};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
 install.onclick=async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;}};
 window.addEventListener('appinstalled',()=>{install.hidden=true;});
 window.addEventListener('online',check);window.addEventListener('offline',check);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){check();registration?.update().catch(()=>{});}});
 register();
})();
