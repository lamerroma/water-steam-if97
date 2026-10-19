import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url));
test('offline resource list contains the entire release and verifies every byte',async()=>{
 const source=(await read('service-worker.js')).toString();
 const resources=JSON.parse(source.match(/const RESOURCES=(\[[^;]+\]);/)[1]);
 const hashes=JSON.parse(source.match(/const DIGESTS=(\{[^;]+\});/)[1]);
 assert.ok(resources.some(path=>path.startsWith('assets/coolprop.wasm?v=')));
 const html=(await read('index.html')).toString();
 for(const path of resources){const file=path.split('?')[0],data=await read(file);assert.equal(createHash('sha256').update(data).digest('hex'),hashes[path],path);assert.deepEqual(data,await read('dist/'+file));}
 for(const match of html.matchAll(/(?:src|href)="(assets\/[^" ]+)"/g))assert.ok(resources.includes(match[1]),match[1]);
});
test('PWA install metadata works at root or GitHub Pages subpath',async()=>{
 const manifest=JSON.parse((await read('manifest.webmanifest')).toString());
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 const page=(await read('index.html')).toString();
 assert.match(page,/worker-src 'self'; manifest-src 'self'/);assert.match(page,/rel="manifest"/);
});
test('older release caches are removed only when the single open window runs the current release',async()=>{
 const source=(await read('service-worker.js')).toString(),build=source.match(/const BUILD=\{"version":"[^"]+","id":"([^"]+)"\}/)[1];
 const resources=JSON.parse(source.match(/const RESOURCES=(\[[^;]+\]);/)[1]),scope='https://example.test/app/',prefix='water-steam:/app/|';
 const run=async({windows,build:reported,waiting=null})=>{
  const store=new Map([[prefix+'older',new Map()],[prefix+build,new Map(resources.map(path=>[new URL(path,scope).href,{}]))],[prefix+'newer',new Map()]]),listeners={};
  const caches={open:async name=>{if(!store.has(name))store.set(name,new Map());const c=store.get(name);return {match:async key=>c.get(typeof key==='string'?key:key.url)};},keys:async()=>[...store.keys()],delete:async name=>store.delete(name)};
  const self={registration:{scope,installing:null,waiting},location:{href:scope+'service-worker.js'},clients:{matchAll:async()=>windows},addEventListener:(type,listener)=>{listeners[type]=listener;}};
  vm.runInNewContext(source,{self,caches,URL,Response});
  let done;listeners.message({data:{type:'PWA_STATUS',build:reported},source:windows[0],waitUntil:promise=>{done=promise;}});await done;return [...store.keys()];
 };
 const tab=id=>({id,url:scope,postMessage(){}});
 assert.deepEqual(await run({windows:[tab('a')],build}),[prefix+build]);
 assert.equal((await run({windows:[tab('a'),tab('b')],build})).length,3,'another open tab may still use an older release');
 assert.equal((await run({windows:[tab('a')],build:'older-page'})).length,3,'a page of another release never removes caches');
 assert.equal((await run({windows:[tab('a')],build,waiting:{}})).length,3,'a waiting newer release keeps its cache');
});
