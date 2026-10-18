import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {lowerFluidTemperature95,transportTemperatureLimit} from '../src/water-validity.js';
import {meltingPressure} from '../src/phase-boundaries.js';
import {validateCalculatorInput} from '../src/smart-input.js';
import {propertyUnavailableReason} from '../src/ux-display.js';
import {exportCSV} from '../src/export.js';
const ref=JSON.parse(fs.readFileSync(new URL('fixtures/steam97-p05-reference.json',import.meta.url)));
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
for(const c of ref.records)test(`P05 independent fluid and transport ${c.id} P=${c.expected.p} T=${c.expected.T}`,()=>{
 const q=calculate('pt',c.expected.p,c.expected.T,c.model).state;
 for(const key of ['h','s','u','rho','v','cp','cv','w','mu','lambda','dc']){
  if(c.available[key]===false){assert.equal(q[key],null,key);continue;}
  const wanted=c.expected[key];assert.ok(Number.isFinite(q[key]),key);
  assert.ok(Math.abs(q[key]-wanted)<=Math.max(ref.policy.forward_absolute[key],Math.abs(wanted)*ref.policy.forward_relative),`${key}: ${q[key]} != ${wanted}`);
 }
 for(const [key,available] of Object.entries(c.available))assert.equal(q[key]!=null,available,key);
 const e=c.expected,derived={nu:e.mu/e.rho,diffusivity:e.lambda/(1000*e.rho*e.cp),Pr:e.mu*e.cp*1000/e.lambda};
 for(const [key,wanted] of Object.entries(derived))if(c.available[key])assert.ok(Math.abs(q[key]/wanted-1)<=ref.policy.forward_relative,key);
});
for(const c of ref.domain_probes)test(`P05 domain ${c.p} MPa ${c.T} K accepted=${c.accepted}`,()=>{
 if(c.accepted)assert.ok(calculate('pt',c.p,c.T,'IAPWS-95').state);
 else assert.throws(()=>calculate('pt',c.p,c.T,'IAPWS-95'));
 if(c.p>0&&c.p<.000611657&&c.T<273.16)assert.throws(()=>calculate('pt',c.p,c.T,'IAPWS-95'),/екстраполяції/);
});
test('P05 both melting boundaries are excluded; inverses start on the fluid side',()=>{
 for(const [T,phase] of [[260,'Ih'],[254,'III'],[265,'V'],[280,'VI']]){
  const p=meltingPressure(T,phase);assert.throws(()=>calculate('pt',p,T,'IAPWS-95'),/тверд/);
  const floor=lowerFluidTemperature95(p);assert.ok(calculate('pt',p,floor,'IAPWS-95').state);
 }
});
test('P05 scientific transport has independent availability and pressure-specific explanations',()=>{
 for(const [p,T,mu,lambda] of [[200,400,true,true],[400,500,false,true],[300,900,true,false],[700,380,false,true]]){
  const q=calculate('pt',p,T,'IAPWS-95').state;
  assert.equal(q.mu!=null,mu);assert.equal(q.lambda!=null,lambda);assert.equal(q.Pr!=null,mu&&lambda);
  if(!mu)assert.match(propertyUnavailableReason('mu',q),new RegExp(String(transportTemperatureLimit('mu',p))));
  const csv=exportCSV({state:q});
  if(!mu){assert.ok(csv.includes('"state","mu","","Па·с"'));assert.ok(csv.includes('"mu_unavailable_reason"'));}
 }
 const wet=calculate('tx',400,.5,'IAPWS-95').state;
 for(const key of ['mu','nu','lambda','Pr','diffusivity','dc'])assert.equal(wet[key],null);
 assert.throws(()=>calculate('pt',22.064,647.096,'IAPWS-95'),/критична/);
 assert.throws(()=>calculate('tx',260,0,'IAPWS-95'),/Насичення/);
});
test('P05 form validation accepts stable cold liquid and preserves the saturation floor',()=>{
 const base={mode:'pt',a:'200',b:'260',ua:'MPa',ub:'K',model:'IAPWS-95'};
 assert.deepEqual(validateCalculatorInput(base).errors,{});
 assert.ok(validateCalculatorInput({...base,a:'1'}).errors.b);
 assert.ok(validateCalculatorInput({...base,mode:'tx',a:'260',b:'0',ua:'K',ub:'fraction'}).errors.a);
 assert.deepEqual(validateCalculatorInput({...base,a:'3',b:'0',ub:'C'}).errors,{});
});
for(const [p,T] of [[200,260],[1,273.15],[300,256]])test(`P05 cold liquid round trips P=${p}, T=${T}`,()=>{
 const c=ref.records.find(c=>c.expected.p===p&&c.expected.T===T),q=c?.expected??calculate('pt',p,T,'IAPWS-95').state;
 for(const mode of ['ph','ps','pu','hs','pv','prho','th','ts','tu','tv','trho','us','vs','hv','uv']){
  const keys={prho:['p','rho'],trho:['T','rho']}[mode]??[...mode].map(k=>k==='t'?'T':k);
  const result=calculate(mode,...keys.map(k=>q[k]),'IAPWS-95');
  const roots=[result.state,...(result.alternatives||[])];
  assert.ok(roots.some(r=>Math.abs(r.p-p)<ref.policy.inverse_pressure_absolute&&Math.abs(r.T-T)<ref.policy.inverse_temperature_absolute),mode);
 }
});
