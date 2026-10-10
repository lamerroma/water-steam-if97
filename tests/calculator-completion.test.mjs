import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate,PC,TC} from '../src/engine.js';
import {readProject} from '../src/project.js';
import {readWorkspace,readCalculation} from '../src/workspace.js';
import {printableReport} from '../src/print-report.js';
import {INPUT_GUIDANCE} from '../src/input-guidance.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const project=()=>({format:'water-steam-if97',version:1,history:[],form:{mode:'pt',model:'IF97',a:'1',b:'400',ua:'bar',ub:'K',calculated:true}});
test('main successful result is restored from its original inputs and units',()=>{
 const r=readProject(JSON.stringify(project()));assert.equal(r.result.state.p,.1);assert.equal(r.result.state.T,400);assert.deepEqual(r.workspace,{active:'general',panels:{}});
 const p=project();p.form={mode:'satp',a:'10',b:'not used',ua:'bar',ub:'C',calculated:true};const q=readProject(JSON.stringify(p));assert.equal(q.result.state,undefined);assert.ok(q.result.saturation.liquid);assert.ok(q.result.saturation.vapor);
 p.form.calculated=false;p.form.a='unfinished';assert.equal(readProject(JSON.stringify(p)).result,null);
});
test('history restores original branch and critical state without forcing ph inversion',()=>{
 for(const [mode,a,b] of [['pt',PC,TC],['pt',100,623.16],['px',.2,.91]]){
  const q=calculate(mode,a,b).state,p=project();p.history=[{p:q.p,h:q.h,source:{mode,a,b},name:'Контроль'}];const restored=readProject(JSON.stringify(p)).states[0];assert.ok(Math.abs(restored.T-q.T)<1e-6);assert.equal(restored.name,'Контроль');assert.deepEqual(restored.source,{mode,a,b});
  p.history[0].h+=100;assert.throws(()=>readProject(JSON.stringify(p)),/не відповідає/);
 }
});
test('unified workspace supports dynamic modes, numeric drafts and batch CSV',()=>{
 const w={active:'boundaries',panels:{boundaries:{inputs:{'phase-substance':'D2O','phase-kind':'melt','phase-ice':'III','phase-value':'256','phase-s':'35'},calculated:true},cycles:{inputs:{'cycle-kind':'rankine-reheat','cycle-tmid':'unfinished'},calculated:false,model:'IAPWS-95'},batch:{inputs:{'batch-mode':'px','batch-ua':'bar','batch-ub':'percent','batch-text':'mode,a,b,unit_a,unit_b\npx,2,91,bar,percent'},calculated:true,source:'csv'}}};
 const r=readWorkspace(w);assert.equal(r.panels.cycles.inputs['cycle-tmid'],'unfinished');assert.equal(r.panels.batch.source,'csv');assert.equal(r.panels.boundaries.calculated,true);
 for(const edit of [x=>x.active='unknown',x=>x.panels.cycles.inputs['cycle-kind']='bad',x=>x.panels.batch.inputs['batch-ua']='C',x=>x.panels.boundaries.inputs['phase-ice']='VII',x=>x.panels.cycles.inputs['unknown']='x',x=>x.panels.cycles.inputs['cycle-tmid']=42]){const p=structuredClone(w);edit(p);assert.throws(()=>readWorkspace(p));}
});
test('calculation import ignores untrusted computed results and accepts previous learning files',()=>{
 const p={module:'ice',inputs:{'ice-t':'-20','ice-p':'.1'},result:{rho:-99,html:'<script>'}};const r=readCalculation(JSON.stringify(p));assert.equal(r.module,'ice');assert.equal(r.record.calculated,true);assert.equal(r.record.result,undefined);
 assert.throws(()=>readCalculation(JSON.stringify({...p,format:'other'})));assert.throws(()=>readCalculation(JSON.stringify({...p,version:99})));assert.throws(()=>readCalculation(JSON.stringify({...p,inputs:{'ice-t':'x'.repeat(81)}})));
});
test('teacher boiling water and wet steam examples agree with numerical states',()=>{
 const q=calculate('px',1,0).state;assert.ok(Math.abs(q.T-273.15-179.88)<.01);assert.ok(Math.abs(q.h-762.7)<.03);
 const wet=calculate('px',.2,.91).state;assert.ok(Math.abs(wet.v-.80611435588)<1e-10);assert.equal(wet.x,.91);
 assert.ok(Math.abs(wet.h-wet.u-1000*wet.p*wet.v)<1e-9);assert.ok(Math.abs(wet.rho*wet.v-1)<1e-12);
});
test('five-point laboratory cycle is solved with matching process constraints',()=>{
 const state=(m,a,b)=>calculate(m,a,b).state;
 const one=state('pt',.1,433.15),five=state('tv',623.15,one.v),four=state('ps',.4,five.s),three=state('pv',.4,one.v/3.33),two=state('ts',one.T,three.s);
 assert.ok(Math.abs(five.v-one.v)<1e-10);assert.ok(Math.abs(four.s-five.s)<1e-10);assert.equal(four.p,three.p);assert.ok(Math.abs(two.s-three.s)<1e-10);assert.equal(two.T,one.T);assert.ok(Math.abs(one.h-2796.4206837)<1e-7);
});
test('report includes current saturation, mixture interpretation, u and escaped notes',()=>{
 const result=calculate('px',.2,.5);result.state.notes.push('<script>example</script>');const html=printableReport('Навчальна робота',[result.state],'si','J',{result,ambient:{p:.101325,T:298.15}});
 assert.ok(html.includes('u [J/kg]'));assert.ok(html.includes('Для рівноважної суміші'));assert.ok(html.includes('P₀'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 const sat=printableReport('Насичення',[],'si','kJ',{result:calculate('satp',1)});assert.ok(sat.includes('Насичена рідина'));assert.ok(sat.includes('Насичена пара'));
 assert.equal(Object.keys(INPUT_GUIDANCE).length,20);
});
