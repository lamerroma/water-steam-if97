import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{initialize,calculate}from'../src/engine.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const fixture=JSON.parse(await readFile(new URL('fixtures/accuracy-followup-reference.json',import.meta.url),'utf8'));
const floors={p:1e-12,T:2e-12,h:2e-8,s:2e-11,u:2e-8,v:1e-14,rho:1e-9,cp:1e-8,cv:1e-9,w:1e-7,alpha:1e-12,drhodp:1e-10};
for(const r of fixture.records)test(`Independent accuracy: ${r.id}`,()=>{
 const result=calculate(r.mode,r.a,r.b,r.model),q=r.phase===null?result.state:r.phase===0?result.saturation.liquid:result.saturation.vapor;assert.ok(q);
 for(const[key,expected]of Object.entries(r.expected)){
  const tolerance=key==='T'&&r.mode==='satp'&&r.a>22.0611?2e-12:Math.max(floors[key]||1e-12,Math.abs(expected)*2e-9);
  assert.ok(Number.isFinite(q[key])&&Math.abs(q[key]-expected)<=tolerance,`${key}: ${q[key]} vs ${expected}; tolerance ${tolerance}`);
 }
 if(r.mode==='satt')assert.equal(q.T,r.a,'Preserve the independent temperature input');
});
for(const r of fixture.limits)test(`Verified IF97 spinodal limit: ${r.mode} ${r.a}`,()=>{
 assert.match(r.error,/above region-3 vapor spinodal/);assert.throws(()=>calculate(r.mode,r.a,r.b,r.model),/стабільній гілці.*неузгодженими/);
});
test('Independent fixed-P saturated h/s endpoints retain the correct phase',()=>{
 let count=0;
 for(const r of fixture.records.filter(r=>r.mode==='satp'&&r.a>22.0611))for(const[mode,key]of[['ph','h'],['ps','s']]){
  const q=calculate(mode,r.a,r.expected[key],r.model).state;assert.ok(q);assert.ok(Math.abs(q.T-r.expected.T)<2e-10);assert.ok(Math.abs(q.rho/r.expected.rho-1)<2e-8);assert.equal(q.x,r.phase);count++;
 }
 assert.equal(count,40);
});
test('Nearby P-T states are not rounded into the declared singular point',()=>{
 for(const model of ['IF97','IAPWS-95'])for(const T of[647.095999999,647.096000001]){
  const q=calculate('pt',22.064,T,model).state;assert.equal(q.T,T);assert.ok(q.cp>0&&Number.isFinite(q.cp));assert.ok(!q.critical);
 }
 assert.equal(calculate('pt',22.064,647.096).state.cp,null);
 assert.throws(()=>calculate('pt',22.064,647.096,'IAPWS-95'),/критична точка/);
});
