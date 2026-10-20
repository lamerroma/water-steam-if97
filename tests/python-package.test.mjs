import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPythonPackageManager} from '../src/python-package.js';

function harness(){
 const stores=new Map(),data=new TextEncoder().encode('local wheel');
 const config={revision:'0123456789abcdef',bytes:data.length,files:[{url:'assets/python/0123456789abcdef/wheel.whl',bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}]};
 const storage={async keys(){return [...stores.keys()];},async open(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {async match(url){return entries.get(url)?.clone();},async put(url,response){entries.set(url,response.clone());}};},async delete(name){return stores.delete(name);}};
 let fetches=0,corrupt=false;
 const locks={async request(name,options,callback){return (callback||options)();}};
 const manager=createPythonPackageManager(config,'https://local.example/sub/',{storage,locks,fetchResource:async()=>{fetches++;return new Response(corrupt?'damaged':data);}});
 return {manager,storage,stores,config,get fetches(){return fetches;},set corrupt(value){corrupt=value;}};
}

test('Missing optional package creates no cache; successful preparation and removal leave core alone',async()=>{
 const h=harness();assert.equal((await h.manager.status()).ready,false);assert.equal(h.stores.size,0);
 h.stores.set('core-release',new Map());const progress=[];
 assert.equal((await h.manager.install({onProgress:value=>progress.push(value)})).ready,true);
 assert.equal((await h.manager.status()).ready,true);assert.equal(progress.at(-1).bytes,h.config.bytes);
 await h.manager.install();assert.equal(h.fetches,1);
 await h.manager.remove();assert.equal((await h.manager.status()).ready,false);assert.deepEqual(await h.storage.keys(),['core-release']);
});

test('Corrupt or cancelled preparation cannot advertise readiness and can be retried',async()=>{
 const h=harness();h.corrupt=true;await assert.rejects(h.manager.install(),/integrity/);assert.equal(h.stores.size,0);
 h.corrupt=false;const controller=new AbortController();controller.abort();
 await assert.rejects(h.manager.install({signal:controller.signal}),{name:'AbortError'});assert.equal(h.stores.size,0);
 await h.manager.install();assert.equal((await h.manager.status()).ready,true);
});

test('Complete marker alone is insufficient after browser eviction of a package member',async()=>{
 const h=harness();await h.manager.install();const entries=[...h.stores.values()][0];
 entries.delete('https://local.example/sub/'+h.config.files[0].url);
 assert.equal((await h.manager.status()).ready,false);await h.manager.install();assert.equal((await h.manager.status()).ready,true);
});
