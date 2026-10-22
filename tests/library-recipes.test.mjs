import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLibraryRecipe,readLibraryRecipeDraft,exampleTankRecipe} from '../src/library-recipe.js';
import {runLibraryRecipe} from '../src/library-recipe-runner.js';
const config={revision:'71ea1664738eb516',packages:{ht:{version:'1.2.0'},fluids:{version:'1.3.1'}}};
const tank=()=>exampleTankRecipe(config);
const reply=(result,module='fluids')=>({status:'ok',engineVersion:config.packages[module].version,implementationRevision:'a'.repeat(64),result,units:{convention:'test metadata'},warnings:[]});
const object=handle=>({kind:'object',handle,scope:'worker-session',class:'fluids.geometry.TANK',members:['V_total']});

test('Recipe drafts preserve unfinished JSON without interpreting it; parsed scenarios require finite JSON',()=>{
 assert.equal(readLibraryRecipeDraft(null),'');assert.equal(readLibraryRecipeDraft('{unfinished'),'{unfinished');
 assert.throws(()=>readLibraryRecipeDraft('x'.repeat(100001)));assert.throws(()=>readLibraryRecipeDraft({}));
 const p=tank();p.steps[0].payload.kwargs.D=NaN;assert.throws(()=>readLibraryRecipe(p),/finite/);
 p.steps[0].payload.kwargs.D=undefined;assert.throws(()=>readLibraryRecipe(p),/JSON data/);
 p.steps[0].payload.kwargs.D=new Date();assert.throws(()=>readLibraryRecipe(p),/JSON data/);
 assert.throws(()=>readLibraryRecipe(JSON.stringify(tank()).replace('"D":1','"D":1e309')),/finite/);
});
test('Recipe graphs reject forward/self/unknown references, duplicate IDs and live Worker handles',()=>{
 for(const change of [p=>p.steps[1].payload.handle={$ref:'future'},p=>p.steps[0].payload.kwargs.D={$ref:'tank'},p=>p.steps[1].id='tank',p=>p.steps[1].payload.handle='object-1',p=>p.steps[0].payload.kwargs.x={$object:'object-1'}]){
  const p=tank();change(p);assert.throws(()=>readLibraryRecipe(p));
 }
 assert.deepEqual(readLibraryRecipe(tank()),tank());
});
test('Only supported public commands and pinned package dependencies are admitted',()=>{
 for(const change of [p=>p.steps[0].payload.target='fluids.__dict__',p=>p.steps[0].payload.target='ht.LMTD',p=>p.steps[0].payload.source='print(1)',p=>p.steps[0].method='eval',p=>p.steps[1].payload.member='__class__',p=>p.steps[0].payload.kwargs.f={$function:'os.system'},p=>p.steps[0].payload.kwargs.f={$function:'ht.LMTD'}]){
  const p=tank();change(p);assert.throws(()=>readLibraryRecipe(p));
 }
 const p=tank();p.steps[0].payload.kwargs.f={$function:'ht.LMTD'};p.packages.ht='1.2.0';assert.deepEqual(readLibraryRecipe(p),p);
});
test('Version/revision mismatch fails before creating a Worker',async()=>{
 let creates=0;for(const change of [p=>p.packageRevision='0'.repeat(16),p=>p.packages.fluids='9.0.0']){
  const p=tank();change(p);await assert.rejects(runLibraryRecipe(p,{config,createRunner:()=>{creates++;}}),{code:'recipe-version'});
 }assert.equal(creates,0);
});
test('A changed Worker implementation revision stops replay instead of mixing results',async()=>{
 let calls=0,reset=0;const r=await runLibraryRecipe(tank(),{config,createRunner:()=>({reset(){reset++;},async run(){calls++;return {...reply(calls===1?object('one'):1),implementationRevision:(calls===1?'a':'b').repeat(64)};}})});
 assert.equal(r.status,'error');assert.equal(r.error.code,'recipe-version');assert.equal(r.steps.length,1);assert.equal(calls,2);assert.equal(reset,1);
});
test('Repeated replay builds fresh objects, resolves operations sequentially and exports summaries without live handles',async()=>{
 let generation=0;
 for(let attempt=0;attempt<2;attempt++){
  const handle='session-'+(++generation),calls=[];let reset=0;
  const result=await runLibraryRecipe(tank(),{config,createRunner:()=>({reset(){reset++;},async run(module,method,p){calls.push(p);if(p.target)return reply(object(handle));assert.equal(p.handle,handle);return reply(p.member==='V_total'?Math.PI/2:p.member==='V_from_h'?Math.PI/8:.5);}})});
  assert.equal(result.status,'ok');assert.equal(calls.length,4);assert.equal(calls[3].kwargs.V,Math.PI/8);assert.equal(reset,1);
  assert.equal(result.steps[0].result.kind,'object-summary');assert.equal(Object.hasOwn(result.steps[0].result,'handle'),false);assert.equal(result.steps[3].result,.5);
  assert.deepEqual(result.recipe,tank());
 }
});
test('Object arguments and result paths use logical bindings, and inherited reference paths are inaccessible',async()=>{
 const p=tank();p.steps=[p.steps[0],{id:'data',module:'fluids',method:'call',payload:{target:'fluids.Reynolds',args:[{$object:{$ref:'tank'}}]}},{id:'value',module:'fluids',method:'call',payload:{target:'fluids.Reynolds',args:[{$ref:'data',path:[0,'n']}]}}];
 const calls=[];const runner={reset(){},async run(m,method,payload){calls.push(payload);return reply(calls.length===1?object('owned'):calls.length===2?[{n:7}]:7);}};
 assert.equal((await runLibraryRecipe(p,{config,createRunner:()=>runner})).status,'ok');assert.deepEqual(calls[1].args,[{$object:'owned'}]);assert.deepEqual(calls[2].args,[7]);
 calls.length=0;p.steps[2].payload.args=[{$ref:'data',path:['constructor']}];const r=await runLibraryRecipe(p,{config,createRunner:()=>runner});assert.equal(r.status,'error');assert.equal(r.failedStep,'value');assert.equal(r.error.code,'recipe-reference');
});
test('A mid-scenario library error stops later commands and retains exact diagnostic metadata',async()=>{
 let calls=0,reset=0;const result=await runLibraryRecipe(tank(),{config,createRunner:()=>({reset(){reset++;},async run(){if(++calls===1)return reply(object('new'));throw Object.assign(Error('ValueError: exact upstream failure'),{code:'library-error',details:{engineVersion:'1.3.1'}});}})});
 assert.equal(result.status,'error');assert.equal(result.failedStep,'volume');assert.equal(result.steps.length,1);assert.equal(calls,2);assert.equal(reset,1);assert.equal(result.error.message,'ValueError: exact upstream failure');assert.equal(result.error.details.engineVersion,'1.3.1');
});
test('Cancellation while a step is pending closes its Worker and prevents further commands',async()=>{
 const controller=new AbortController();let reset=0,calls=0,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const pending=runLibraryRecipe(tank(),{config,signal:controller.signal,createRunner:()=>({reset(){reset++;},run(m,method,p,{signal}){calls++;started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{code:'cancelled'})),{once:true}));}})});
 await ready;controller.abort();const result=await pending;assert.equal(result.status,'cancelled');assert.equal(result.steps.length,0);assert.equal(calls,1);assert.equal(reset,1);
});
test('Replay snapshots inputs and does not accept edits made while execution is pending',async()=>{
 const p=tank(),seen=[];const r=await runLibraryRecipe(p,{config,onProgress:()=>{p.steps[2].payload.kwargs.h=99;},createRunner:()=>({reset(){},async run(m,method,payload){seen.push(payload);return reply(payload.target?object('one'):1);}})});
 assert.equal(r.status,'ok');assert.equal(seen[2].kwargs.h,.5);assert.equal(r.recipe.steps[2].payload.kwargs.h,.5);
});
test('Oversized results fail explicitly without retaining the rejected value or executing later steps',async()=>{
 let reset=0,calls=0;const r=await runLibraryRecipe(tank(),{config,maxResultCharacters:100,createRunner:()=>({reset(){reset++;},async run(){calls++;return reply('x'.repeat(1000));}})});
 assert.equal(r.status,'error');assert.equal(r.error.code,'recipe-result-limit');assert.equal(r.steps.length,0);assert.equal(calls,1);assert.equal(reset,1);
});
