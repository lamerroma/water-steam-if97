import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SMART_PAIRS,SMART_PROPERTIES,smartPartners,resolveSmartPair,validateCalculatorInput} from '../src/smart-input.js';
import {initialize,calculate,PMIN_SAT,PC} from '../src/engine.js';import {readProject} from '../src/project.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const input=(overrides={})=>({mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C',...overrides});
test('All twenty supported modes resolve in both property orders without accepting dependent pairs',()=>{
 assert.equal(Object.keys(SMART_PAIRS).length,20);
 for(const [mode,[a,b]] of Object.entries(SMART_PAIRS)){assert.deepEqual(resolveSmartPair(a,b),{mode,reversed:false});if(b!=='sat')assert.deepEqual(resolveSmartPair(b,a),{mode,reversed:true});assert.ok(smartPartners(a).includes(b));}
 for(const pair of [['p','p'],['rho','v'],['s','x'],['sat','p']])assert.throws(()=>resolveSmartPair(...pair));
 for(const p of SMART_PROPERTIES)assert.ok(smartPartners(p).length>0);
});
test('Per-field parsing handles commas, exponents, unit conversion and empty or malicious values',()=>{
 const r=validateCalculatorInput(input({a:'30',ua:'bar',b:'212',ub:'F'}));assert.deepEqual(r.errors,{});assert.equal(r.values.a,3);assert.equal(r.values.b,373.15);
 for(const raw of ['', ' ', '<script>', '1,234.56','Infinity','1e999']){const r=validateCalculatorInput(input({a:raw}));assert.ok(r.errors.a);assert.equal(r.errors.b,undefined);}
 assert.deepEqual(validateCalculatorInput(input({a:'3e0',b:'100,5'})).errors,{});
});
test('Pressure bounds are expressed in the selected units and account for gauge pressure',()=>{
 const r=validateCalculatorInput(input({a:'-2',ua:'bar',pressure:{basis:'gauge',atmosphere:.101325}}));assert.ok(r.errors.a);assert.ok(Math.abs(r.errors.a.params.min+1.01325)<1e-10);assert.ok(Math.abs(r.errors.a.params.max-998.98675)<1e-8);
 assert.deepEqual(validateCalculatorInput(input({a:'0',ua:'bar',pressure:{basis:'gauge',atmosphere:.101325}})).errors,{});
 assert.ok(validateCalculatorInput(input({a:'101'})).errors.a);assert.deepEqual(validateCalculatorInput(input({model:'IAPWS-95',a:'101'})).errors,{});
});
test('Model, saturation, quality and positive density/volume limits map to the right field',()=>{
 assert.ok(validateCalculatorInput(input({b:'2001'})).errors.b);assert.ok(validateCalculatorInput(input({model:'IAPWS-95',b:'-30'})).errors.b);
 const coupled=validateCalculatorInput(input({a:'60',b:'900'}));assert.ok(coupled.errors.a);assert.ok(coupled.errors.b);
 assert.deepEqual(validateCalculatorInput(input({mode:'satp',a:String(PMIN_SAT),b:'',ub:'C'})).errors,{});
 assert.ok(validateCalculatorInput(input({mode:'satp',a:String(PC+1)})).errors.a);
 assert.deepEqual(validateCalculatorInput(input({mode:'px',b:'91',ub:'percent'})).errors,{});assert.ok(validateCalculatorInput(input({mode:'px',b:'101',ub:'percent'})).errors.b);
 assert.ok(validateCalculatorInput(input({mode:'pv',b:'0',ub:'m3kg'})).errors.b);assert.ok(validateCalculatorInput(input({mode:'trho',a:'100',ua:'C',b:'-1',ub:'kgm3'})).errors.b);
 // Enthalpy and entropy can be negative depending on reference state. No invented bounds.
 assert.deepEqual(validateCalculatorInput(input({mode:'hs',a:'-1',ua:'kJkg',b:'-0.1',ub:'kJkgK'})).errors,{});
});
test('Input presentation metadata remains backward compatible and cannot alter canonical calculations',()=>{
 const p={format:'water-steam-if97',version:1,history:[],form:{mode:'pt',a:'30',b:'212',ua:'bar',ub:'F',calculated:true,inputOrder:'reverse',inputStyle:'smart'}};
 const r=readProject(JSON.stringify(p));assert.equal(r.result.state.p,3);assert.equal(r.result.state.T,373.15);delete p.form.inputOrder;delete p.form.inputStyle;assert.equal(readProject(JSON.stringify(p)).result.state.h,r.result.state.h);
 for(const [key,value] of [['inputStyle','bad'],['inputOrder','bad']])assert.throws(()=>readProject(JSON.stringify({...p,form:{...p.form,[key]:value}})));
});
test('P–T saturation remains ambiguous; validation never invents the mixture composition',()=>{
 const q=calculate('satp',.1).saturation,r=validateCalculatorInput(input({a:'.1',b:String(q.T),ub:'K'}));assert.deepEqual(r.errors,{});const state=calculate('pt',r.values.a,r.values.b);assert.equal(state.ambiguous,true);assert.equal(state.state,undefined);assert.ok(state.saturation);
});
