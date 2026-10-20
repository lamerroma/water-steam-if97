// Execute a same-origin, versioned asset only when its feature needs it.
// The service worker prepares its bytes independently for offline use.
export function createScriptAssetLoader(url,readExport,{document=globalThis.document,timeoutMs=45000}={}){
 let pending;
 return ()=>{
  const present=readExport();if(present)return Promise.resolve(present);
  if(pending)return pending;
  pending=new Promise((resolve,reject)=>{
   if(!document?.head||!url){reject(Error('Local script loading is unavailable.'));return;}
   const script=document.createElement('script');script.src=url;script.async=true;
   const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){script.remove();reject(error);}else resolve(readExport());};
   const timer=setTimeout(()=>finish(Error('Local library loading timed out. Please retry.')),timeoutMs);
   script.onload=()=>finish(readExport()?null:Error('Local library did not initialize.'));
   script.onerror=()=>finish(Error('Local library could not load. Prepare offline resources and retry.'));
   try{document.head.append(script);}catch(error){finish(error);}
  }).catch(error=>{pending=null;throw error;});
  return pending;
 };
}
