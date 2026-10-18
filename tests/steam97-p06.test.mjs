import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import * as api from '../src/processes.js';
import {processCSV,readProject} from '../src/project.js';
import {readWorkspace} from '../src/workspace.js';
import {englishProperty} from '../src/units.js';
import {uiConvertQuantity} from '../src/ui-quantities.js';
import {runP06,assessP06} from '../scripts/steam97-p06-common.mjs';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const ref=JSON.parse(fs.readFileSync(new URL('fixtures/steam97-p06-reference.json',import.meta.url)));
for(const c of ref.records)for(const mode of c.modes)test(`P06 independent ${c.id} ${mode}`,()=>{
 const assessment=assessP06(runP06(c,mode,api),c,ref.policy);assert.equal(assessment.passed,true,JSON.stringify(assessment.checks.filter(c=>!c.passed)));
});
test('P06 English consumption is per kWh; superheat is a temperature difference',()=>{
 assert.deepEqual(englishProperty('consumption',.45359237),[1,'lb/(kW·h)']);
 assert.deepEqual(englishProperty('dT',10),[18,'°F']);
 assert.equal(uiConvertQuantity(10,'temperatureDifference','dK','dF'),18);
 for(const unit of ['kW','MW','Btuh'])assert.ok(Math.abs(uiConvertQuantity(uiConvertQuantity(7867.5,'power','kW',unit),'power',unit,'kW')-7867.5)<1e-8);
 const r=api.turbine(1,973.15,.8,.75,5),csv=processCSV('turbine',r,'english');
 assert.ok(csv.includes('lb/(kW·h)'));assert.ok(csv.includes('outletSuperheat;'+r.outletSuperheat*1.8+';°F'));assert.ok(csv.includes('powerMW;'+r.power/1000+';MW'));
});
test('P06 unavailable saturation is null with a reason; wet exhaust has zero superheat',()=>{
 const high=api.turbine(30,900,25,.85,2);assert.equal(high.inletTsat,null);assert.equal(high.outletSuperheat,null);
 assert.ok(processCSV('turbine',high).includes('inletTsat_unavailable_reason;'));assert.ok(processCSV('turbine',high).includes('outletSuperheat_unavailable_reason;'));
 const wet=api.turbine(6,773.15,.1,.85,10);assert(wet.outlet.x>0&&wet.outlet.x<1);assert.equal(wet.outletSuperheat,0);
});
test('P06 condensate mode rejects vapor and supercritical fluid; legacy throttle remains supported',()=>{
 for(const model of ['IF97','IAPWS-95']){
  assert.throws(()=>api.flash(3,673.15,.1,1,2,model),/конденсату/);
  assert.throws(()=>api.flash(25,700,.1,1,2,model),/конденсату/);
  assert.equal(api.flash(3,673.15,.1,1,0,model).vaporFlow,null);
  assert.throws(()=>api.flash(3,0,NaN,1,1,model));
  for(const eta of [0,-1,1.001,Infinity,NaN,Number.MIN_VALUE])assert.throws(()=>api.turbine(3,673.15,.1,eta,1,model));
  assert.throws(()=>api.turbine(3,673.15,.1,.85,Number.MAX_VALUE,model),/числові/);
  const ideal=api.turbine(3,673.15,.1,1,2,model);assert.ok(Math.abs(api.turbineInverse('efficiency',3,673.15,.1,ideal.power,2,model).eta-1)<1e-14);
 }
});
test('P06 MW and strict condensate projects restore; legacy four/five flash args still work',()=>{
 const project={format:'water-steam-if97',version:1,history:[],form:{mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C'},process:{type:'flash',model:'IAPWS-95',args:[3,450,.1,4,2]},workspace:{active:'turbine',panels:{turbine:{model:'IAPWS-95',calculated:true,inputs:{'process-mode':'flow','process-power-unit':'MW','process-power':'1'}}}}};
 const r=readProject(JSON.stringify(project));assert.equal(r.process.result.inletMode,'condensate');assert.equal(r.workspace.panels.turbine.inputs['process-power-unit'],'MW');
 for(const args of [[3,450,.1,4],[3,450,.1,4,0],[3,0,.1,4,1]])assert.ok(readProject(JSON.stringify({...project,process:{type:'flash',args}})).process.result.outlet);
 assert.equal(readWorkspace({active:'flash',panels:{flash:{inputs:{'process-mode':'condensate'},calculated:false}}}).panels.flash.inputs['process-mode'],'condensate');
});
test('P06 saved inlet/outlet history is recomputed, including saturated inlet',()=>{
 const q=api.flash(3,0,.1,2,1);const p={format:'water-steam-if97',version:1,form:{mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C'},history:[q.inlet,q.outlet].map(s=>({p:s.p,h:s.h,source:{mode:'ph',a:s.p,b:s.h},model:s.model}))};
 const r=readProject(JSON.stringify(p));assert.equal(r.states[0].x,0);assert.ok(Math.abs(r.states[1].x-q.outlet.x)<1e-10);
});
