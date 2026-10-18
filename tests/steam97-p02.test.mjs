import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {resolvedSinglePhaseBracket} from '../src/inverse-phase-bracket.js';
import {assess,assessAllRoots} from '../scripts/inverse-precision-common.mjs';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const pilot=JSON.parse(await readFile(new URL('../docs/steam97-p01/pilot-reference.json',import.meta.url)));
const dense=JSON.parse(await readFile(new URL('fixtures/steam97-p02-reference.json',import.meta.url)));
// Independent references exercise the pressure immediately below Pc as well
// as a decimal input; the cold state confirms the other stable branch too.
for(const c of pilot.cases.filter(c=>c.group.startsWith('below-pc-')))
 test(`P02 independent near-Pc inverses ${c.id}`,()=>{
  for(const mode of ['ph','ps','pu']){
   const keys=[...mode],r=calculate(mode,...keys.map(k=>c.expected[k]),c.model);
   assert.equal(assess(r,c,keys).status,'passed',mode);
   assert(assessAllRoots(r,keys.map(k=>c.expected[k]),keys).every(r=>r.valid));
   assert.equal(r.state.x,null);
  }
 });
for(const c of dense.records.filter(c=>c.p===22.063999999999997&&[646.996,647.09599].includes(c.T)))
 test(`P02 independent cold branch ${c.model} / ${c.T} K`,()=>{
  for(const mode of ['ph','ps','pu']){
   const keys=[...mode],r=calculate(mode,...keys.map(k=>c.expected[k]),c.model);
   assert.equal(assess(r,c,keys).status,'passed',mode);assert.equal(r.state.x,null);
  }
 });
test('P02 IF97 h-s keeps a validated root when optional saturation is unresolved',()=>{
 const c=pilot.cases.find(c=>c.id==='IF97-near-critical'),r=calculate('hs',c.expected.h,c.expected.s,c.model);
 assert.equal(assess(r,c,['h','s']).status,'passed');assert(assessAllRoots(r,[c.expected.h,c.expected.s],['h','s']).every(r=>r.valid));
});
for(const model of ['IF97','IAPWS-95'])test(`P02 unresolved coexistence stays unavailable (${model})`,()=>{
 const p=22.063999999999997,forward=(p,T)=>calculate('pt',p,T,model);
 const hot=resolvedSinglePhaseBracket(p,3000,'h',647.096,322,forward);
 // Requesting the boundary forces refinement up to the actual phase-resolution
 // limit. A midpoint of coarse initial search probes may be a valid cold state.
 assert.equal(resolvedSinglePhaseBracket(p,hot.L.h,'h',647.096,322,forward),null);
 const cold=resolvedSinglePhaseBracket(p,1000,'h',647.096,322,forward);
 assert(hot?.L&&cold?.H);
 const unresolved=(hot.L.h+cold.H.h)/2;
 assert.equal(resolvedSinglePhaseBracket(p,unresolved,'h',647.096,322,forward),null);
 assert.throws(()=>calculate('ph',p,unresolved,model));
 assert.throws(()=>calculate('px',p,.5,model));
 assert.throws(()=>calculate('px',22.064,.5,model));
 for(const x of [0,.5,1]){
  const reference=pilot.cases.find(c=>c.model===model&&c.x===x),r=calculate('ph',1,reference.expected.h,model);
  assert(Math.abs(r.state.x-x)<2e-12);assert.equal(r.state.cp==null,x===.5);
 }
});
