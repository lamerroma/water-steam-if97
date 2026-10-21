import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {initializeWaterHeos} from '../src/water-heos.js';
import {readProject} from '../src/project.js';
import {readWorkspace} from '../src/workspace.js';
import {compareHistoryStates} from '../src/state-comparison.js';
import {readDiagramWorkspace,diagramWorkspaceSnapshot} from '../src/diagram-workspace.js';
import {diagramAxes} from '../src/diagram-coordinates.js';
import {calculateBatch} from '../src/batch.js';
import {saturationGrid} from '../src/saturation-grid.js';
import {validateCalculatorInput} from '../src/smart-input.js';
import {defaultCycleBuilder,readCycleBuilderDraft} from '../src/cycle-library.js';
import {readCustomCycleDraft} from '../src/custom-cycle.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createLegacyCalculationRequest,calculationReplyIdentity} from '../src/calculation-protocol.js';
import {createCalculationRunner} from '../src/calculator-runner.js';
import {usesWaterHeos,waterCalculationRuntime} from '../src/water-models.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const HEOS='HEOS::Water';
const near=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} versus ${b}`);
const history=(model,p=1,T=500)=>{const q=calculate('pt',p,T,model).state;return {model,p:q.p,h:q.h,name:model,source:{mode:'pt',a:p,b:T},rho:-999};};
const project=()=>({format:'water-steam-if97',version:1,history:[history('IF97'),history(HEOS)],form:{model:HEOS,mode:'pt',a:'10',b:'226.85',ua:'bar',ub:'C',calculated:true}});

test('Mixed-model projects recalculate each history entry and the HEOS form without trusting outputs',()=>{
 const p=project(),r=readProject(JSON.stringify(p));assert.deepEqual(r.states.map(q=>q.model||'IF97'),['IF97',HEOS]);
 near(r.result.state.h,2891.218298958905);assert.ok(r.states.every(q=>q.rho>0));assert.deepEqual(r.states[1].source,p.history[1].source);
 p.history[1].h+=10;assert.throws(()=>readProject(JSON.stringify(p)));
});
test('HEOS manual inverse branch and typed rounding survive project import and reject a forged root',()=>{
 const q=calculate('pt',.1,275,HEOS).state,r=calculate('prho',.1,q.rho,HEOS),other=r.alternatives[0],p=project();
 p.form={model:HEOS,mode:'prho',a:'0.100000',b:String(q.rho),ua:'MPa',ub:'kgm3',calculated:true,roundingDisplay:true,selectedRoot:{p:other.p,T:other.T}};
 const imported=readProject(JSON.stringify(p));near(imported.result.state.T,other.T,1e-6);assert.equal(imported.result.diagnostics.selection,'manual');assert.equal(imported.form.roundingDisplay,true);
 p.form.selectedRoot.T=400;assert.throws(()=>readProject(JSON.stringify(p)));
});
test('Model-labelled comparisons recompute IF97 and HEOS independently',()=>{
 const states=project().history.map(q=>({...q,mode:q.source.mode,a:q.source.a,b:q.source.b}));const r=compareHistoryStates({states,reference:0});
 assert.deepEqual(r.states.map(q=>q.model),['IF97',HEOS]);assert.ok(r.rows.find(q=>q.key==='h').values[1].delta!==0);
});
test('HEOS diagram keys containing colons and model-separated point sets survive snapshots',()=>{
 const states=readProject(JSON.stringify(project())).states;
 const raw={views:{[HEOS+':ts']:{range:diagramAxes('ts').initial}},pointSets:{[HEOS]:[{historyIndex:1,label:'H'}]},series:[{model:HEOS,name:'HEOS',kind:'line',points:[1]}]};
 const r=readDiagramWorkspace(raw,states),snapshot=diagramWorkspaceSnapshot(r,states);assert.ok(snapshot.views[HEOS+':ts']);assert.equal(snapshot.series[0].model,HEOS);
 raw.pointSets[HEOS][0].historyIndex=0;assert.throws(()=>readDiagramWorkspace(raw,states));
});
test('HEOS batch, water-process and cycle inputs remain input-only project records',()=>{
 const draft={fluid:'water',model:HEOS,mass:'1',closed:true,points:[]};assert.equal(readCustomCycleDraft(draft).model,HEOS);
 assert.equal(readCycleBuilderDraft({...defaultCycleBuilder(),kind:'rankine',fluid:'water',model:HEOS}).model,HEOS);
 const r=readWorkspace({active:'batch',panels:{batch:{model:HEOS,calculated:true,inputs:{'batch-mode':'pt','batch-count':'3'}}}});assert.equal(r.panels.batch.model,HEOS);
 assert.equal(readWorkspace({active:'water-process',panels:{'water-process':{model:HEOS,calculated:false,inputs:{'wp-fluid':'water','wp-model':HEOS}}}}).panels['water-process'].model,HEOS);
 assert.throws(()=>readWorkspace({active:'water-process',panels:{'water-process':{model:HEOS,calculated:false,inputs:{'wp-fluid':'air','wp-model':HEOS}}}}));
});
test('HEOS series retain success/error rows and saturation limits without changing IF97 limits',()=>{
 const records=calculateBatch([{mode:'pt',a:10,b:226.85,ua:'bar',ub:'C',name:'steam'},{mode:'pt',a:1,b:250,ua:'MPa',ub:'K',name:'ice'}],HEOS);
 near(records[0].result.state.h,2891.218298958905);assert.equal(typeof records[1].error,'string');
 assert.equal(saturationGrid({basis:'temperature',unit:'K',start:300,end:310,step:10},HEOS).length,2);
 assert.throws(()=>saturationGrid({basis:'temperature',unit:'K',start:640,end:647.096,step:1},HEOS));
 const input={mode:'pt',a:'500',b:'1000',ua:'MPa',ub:'K'};assert.deepEqual(validateCalculatorInput({...input,model:HEOS}).errors,{});assert.ok(validateCalculatorInput({...input,model:'IF97'}).errors.a);
});
test('Runtime routing recognizes mixed projects, embedded cycle drafts and workflow variants',()=>{
 const p=project();p.form.model='IF97';assert.equal(waterCalculationRuntime(createLegacyCalculationRequest(1,'project',{text:JSON.stringify(p)})),'heos');
 assert.equal(usesWaterHeos({panels:{cycle:{inputs:{'cc-data':JSON.stringify({model:HEOS})}}}}),true);
 assert.equal(waterCalculationRuntime(createLegacyCalculationRequest(2,'project',{text:'bad json'})),'default');
 assert.equal(waterCalculationRuntime(createLegacyCalculationRequest(3,'calculate',{mode:'pt',a:1,b:500,model:'IF97'})),'default');
 assert.equal(createLegacyCalculationRequest(4,'calculate',{mode:'pt',a:1,b:500,model:HEOS}).moduleId,'water-heos');
 const cycle={};cycle.self=cycle;assert.equal(usesWaterHeos(cycle),false);
});
test('Worker protocol recalculates mixed projects and HEOS batches through the selected backend',async()=>{
 const reply=await dispatchCalculation(createLegacyCalculationRequest(1,'project',{text:JSON.stringify(project())}));assert.equal(reply.status,'ok');assert.equal(reply.result.states[1].model,HEOS);
 const batch=await dispatchCalculation(createLegacyCalculationRequest(2,'batch',{model:HEOS,inputs:[{mode:'pt',a:1,b:500,ua:'MPa',ub:'K'}]}));assert.equal(batch.status,'ok');near(batch.result[0].result.state.h,2891.218298958905);
});
test('Changing runtime discards idle Workers, reuses matching ones and ignores stale replies',async()=>{
 const workers=[],runner=createCalculationRunner((request,key)=>{const w={key,postMessage(request){this.request=request;},terminate(){this.terminated=true;}};workers.push(w);return w;},1000,waterCalculationRuntime);
 const answer=(w,value)=>w.onmessage({data:{...calculationReplyIdentity(w.request),status:'ok',result:value}});
 const one=runner.calculate('pt',1,500,'IF97');answer(workers[0],1);assert.equal(await one,1);
 const two=runner.calculate('pt',1,500,HEOS);assert.equal(workers[0].terminated,true);assert.equal(workers[1].key,'heos');answer(workers[0],'stale');assert.equal(runner.busy,true);answer(workers[1],2);assert.equal(await two,2);
 const three=runner.calculate('ph',1,2800,HEOS);assert.equal(workers.length,2);answer(workers[1],3);await three;
 const four=runner.calculate('pt',1,500,'IF97');assert.equal(workers[1].terminated,true);assert.equal(workers[2].key,'default');answer(workers[2],4);await four;runner.reset();
});
