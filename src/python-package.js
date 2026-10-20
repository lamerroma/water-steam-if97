// Optional package cache is independent of core PWA releases. Completion is
// published only after every byte has been checked; project storage is untouched.
export function pythonPackageCacheName(config,baseURL){return 'thermocalc-python:'+new URL(baseURL).pathname+'|'+config.revision;}
export function createPythonPackageManager(config,baseURL,{storage=globalThis.caches,fetchResource=globalThis.fetch,locks=globalThis.navigator?.locks}={}){
 const base=new URL(baseURL),name=pythonPackageCacheName(config,base),marker=new URL('assets/python/'+config.revision+'/complete',base).href;
 const status=async()=>{
  if(!storage||!(await storage.keys()).includes(name))return {ready:false,bytes:config.bytes};
  const cache=await storage.open(name),complete=await cache.match(marker);if(!complete||(await complete.text())!==config.revision)return {ready:false,bytes:config.bytes};
  for(const file of config.files)if(!await cache.match(new URL(file.url,base).href))return {ready:false,bytes:config.bytes};
  return {ready:true,bytes:config.bytes};
 };
 let installing=null;
 const install=({signal,onProgress}={})=>{
  if(installing)return installing;
  const prepare=async()=>{
   if((await status()).ready)return status();
   const cache=await storage.open(name);let bytes=0;
   try{
    for(const [index,file] of config.files.entries()){
     signal?.throwIfAborted();const url=new URL(file.url,base).href;
     const response=await fetchResource(url,{cache:'no-store',signal});if(!response.ok)throw Error('Download failed: '+file.url);
     const data=await response.arrayBuffer();
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
     if(data.byteLength!==file.bytes||hash!==file.sha256)throw Error('Package integrity check failed: '+file.url);
     const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
     await cache.put(url,new Response(data,{headers}));bytes+=data.byteLength;
     onProgress?.({done:index+1,total:config.files.length,bytes,totalBytes:config.bytes});
    }
    signal?.throwIfAborted();await cache.put(marker,new Response(config.revision));return {ready:true,bytes:config.bytes};
   }catch(error){await storage.delete(name);throw error;}
  };
  installing=(locks?.request?locks.request(name,{signal},prepare):Promise.reject(Error('This browser does not support coordinated package downloads.'))).finally(()=>{installing=null;});return installing;
 };
 return {status,install,async remove(){if(installing)throw Error('Cancel the package download first.');const remove=()=>storage.delete(name);if(locks?.request)await locks.request(name,remove);else await remove();}};
}
