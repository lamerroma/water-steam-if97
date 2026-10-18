import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {readProject,processCSV} from '../src/project.js';
import {turbine} from '../src/processes.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const base=()=>({format:'water-steam-if97',version:1,history:[{p:3,h:calculate('pt',3,300).state.h}],form:{mode:'pt',a:'3',b:'26.85',ua:'MPa',ub:'C'},process:{type:'turbine',args:[3,673.15,.1,.85,2]}});
test('project recalculates states and process from inputs',()=>{const r=readProject(JSON.stringify(base()));assert.equal(r.states.length,1);assert.ok(Math.abs(r.states[0].T-300)<1e-6);assert.equal(r.process.result.flow,2);});
test('invalid imported projects reject before applying',()=>{for(const change of [p=>p.version=99,p=>p.history=[{p:-1,h:500}],p=>p.form.ua='K',p=>p.process.args[3]=2,p=>p.history=Array(501).fill({p:3,h:500})]){const p=base();change(p);assert.throws(()=>readProject(JSON.stringify(p)));}assert.throws(()=>readProject('x'));});
test('process CSV includes energy, SI units and ideal outlet',()=>{const csv=processCSV('turbine',turbine(3,673.15,.1,.85,2));assert.ok(csv.includes('isentropic_outlet'));assert.ok(csv.includes('kW'));assert.ok(csv.includes('power;'));});
test('project names and state labels persist without trusting extra state properties',()=>{const p=base();p.title='Котельня';p.history[0].name='Вхід';p.history[0].T=999;const q=readProject(JSON.stringify(p));assert.equal(q.title,'Котельня');assert.equal(q.states[0].name,'Вхід');assert.ok(Math.abs(q.states[0].T-300)<1e-6);p.history[0].name='x'.repeat(81);assert.throws(()=>readProject(JSON.stringify(p)));});
test('hints (glossary) flag defaults to on and round-trips explicit off',()=>{assert.equal(readProject(JSON.stringify(base())).hints,true);const p=base();p.hints=false;assert.equal(readProject(JSON.stringify(p)).hints,false);const q=base();q.hints=true;assert.equal(readProject(JSON.stringify(q)).hints,true);});

test('project save and export metadata survive parsing without changing schema compatibility',()=>{const p=base(),m={appVersion:'1.14.0',buildId:'old-build',method:'project / multiple methods',model:'per result'};p.savedWith=m;p.exportedWith={...m,appVersion:'1.16.5'};p.importedFrom=m;const r=readProject(JSON.stringify(p));assert.deepEqual(r.savedWith,m);assert.deepEqual(r.importedFrom,m);assert.equal(r.exportedWith.appVersion,'1.16.5');assert.equal(readProject(JSON.stringify(base())).savedWith,null);p.savedWith={...m,buildId:'x'.repeat(1000)};assert.throws(()=>readProject(JSON.stringify(p)));});
test('Manual physical branch and typed rounding survive project reload; untrusted root values are checked',()=>{
 const state=calculate('pt',40,1073.14999).state,result=calculate('pv',40,state.v),other=result.alternatives[0];
 const p=base();p.history=[];p.process=null;p.form={calculated:true,mode:'pv',model:'IF97',a:'40.000000',b:String(state.v),ua:'MPa',ub:'m3kg',roundingDisplay:true,selectedRoot:{p:other.p,T:other.T}};
 const restored=readProject(JSON.stringify(p));assert.equal(restored.result.state.T,other.T);assert.equal(restored.result.diagnostics.selection,'manual');assert.equal(restored.result.diagnostics.roundingScenario.inputs[0].halfWidth,.0000005);assert.equal(restored.form.roundingDisplay,true);assert.deepEqual(restored.result.state.source,{mode:'pv',a:40,b:state.v});
 for(const change of [q=>q.form.selectedRoot.T=100,q=>q.form.selectedRoot.p='40',q=>q.form.roundingDisplay='yes',q=>q.form.calculated=false]){const bad=structuredClone(p);change(bad);assert.throws(()=>readProject(JSON.stringify(bad)));}
});
test('Old cold-liquid u-s history may record another member of the computational root cluster',()=>{
 const p=base();p.process=null;p.history=[{p:.005173683148148375,h:38.63730268853567,model:'IAPWS-95',source:{mode:'us',a:38.63212828313412,b:.1391036658359701}}];
 const result=readProject(JSON.stringify(p));assert.equal(result.states.length,1);assert.equal(result.states[0].model,'IAPWS-95');assert.ok(Math.abs(result.states[0].h-p.history[0].h)<4e-6);assert.ok(Math.abs(result.states[0].u-p.history[0].source.a)<1e-10);assert.ok(Math.abs(result.states[0].s-p.history[0].source.b)<1e-12);
 p.form={mode:'us',model:'IAPWS-95',a:String(p.history[0].source.a),b:String(p.history[0].source.b),ua:'kJkg',ub:'kJkgK',calculated:true,selectedRoot:{p:p.history[0].p,T:282.3426492768052}};
 const selected=readProject(JSON.stringify(p));assert.equal(selected.result.diagnostics.selection,'manual');
 const forged=structuredClone(p);forged.form.selectedRoot.p=.01;assert.throws(()=>readProject(JSON.stringify(forged)));
 p.history[0].p=.01;assert.throws(()=>readProject(JSON.stringify(p)));
});
