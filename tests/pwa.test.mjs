import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
test('install metadata works at root or GitHub Pages subpath; standalone stays self-contained',async()=>{
 const manifest=JSON.parse((await read('manifest.webmanifest')).toString());
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 const page=(await read('index.html')).toString(),standalone=(await read('standalone.html')).toString();
 assert.match(page,/worker-src 'self'; manifest-src 'self'/);assert.match(page,/rel="manifest"/);assert.doesNotMatch(standalone,/rel="manifest"/);
 assert.match(standalone,/if\(location.protocol==='file:'\)/);
});
