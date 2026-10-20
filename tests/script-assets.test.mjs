import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScriptAssetLoader} from '../src/script-assets.js';
function harness(){
 const scripts=[];let backend;
 const document={createElement(){return {remove(){this.removed=true;}};},head:{append(script){scripts.push(script);}}};
 const load=createScriptAssetLoader('/assets/backend.js?v=pinned',()=>backend,{document});
 return {load,scripts,ready(value){backend=value;}};
}
test('A lazy asset has no startup effect; simultaneous requests share one script and initialized exports',async()=>{
 const h=harness();assert.equal(h.scripts.length,0);const first=h.load(),second=h.load();assert.equal(first,second);assert.equal(h.scripts.length,1);
 assert.equal(h.scripts[0].src,'/assets/backend.js?v=pinned');const backend={version:'pinned'};h.ready(backend);h.scripts[0].onload();assert.equal(await first,backend);assert.equal(await h.load(),backend);assert.equal(h.scripts.length,1);
});
test('A missing offline asset or missing export clears the failed request and permits retry',async()=>{
 const h=harness();const first=h.load(),rejected=assert.rejects(first,/could not load/);h.scripts[0].onerror();await rejected;assert.equal(h.scripts[0].removed,true);
 const second=h.load(),invalid=assert.rejects(second,/did not initialize/);h.scripts[1].onload();await invalid;
 const third=h.load();h.ready({ok:true});h.scripts[2].onload();assert.equal((await third).ok,true);
});
test('Unavailable DOM and script insertion errors reject without retaining a pending operation',async()=>{
 const absent=createScriptAssetLoader('/asset.js',()=>null,{document:null});await assert.rejects(absent(),/unavailable/);
 let attempts=0;const blocked=createScriptAssetLoader('/asset.js',()=>null,{document:{createElement(){return {remove(){}};},head:{append(){attempts++;throw Error('blocked');}}}});
 for(let i=0;i<2;i++)await assert.rejects(blocked(),/blocked/);assert.equal(attempts,2);
});
