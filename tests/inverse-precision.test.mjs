import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {assess} from '../scripts/inverse-precision-common.mjs';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const fixture=JSON.parse(await readFile(new URL('fixtures/inverse-precision-reference.json',import.meta.url)));
// Independent points catch missing branches, including a genuine second
// region-5 solution where region 2 also satisfies the supplied inputs.
for(const c of fixture.records.filter(c=>['region-2-5','B23','region-1-3'].includes(c.group)))
test(`Boundary inverse ${c.id}: ${c.expected.p} MPa, ${c.expected.T} K`,()=>{
 for(const mode of ['pv','prho','tv','trho']){
  const keys=fixture.modes[mode],r=calculate(mode,c.expected[keys[0]],c.expected[keys[1]],c.model);
  const verdict=assess(r,c,keys);assert.equal(verdict.status,'passed',JSON.stringify({mode,...verdict}));
 }
});
test('Inverse search keeps the closed IF97 temperature/pressure domains',()=>{
 const top=calculate('pt',75,1073.15).state;
 assert.throws(()=>calculate('pv',75,top.v*1.01));
 for(const mode of ['th','ts','tv','trho'])assert.throws(()=>calculate(mode,2273.15001,1));
});
for(const id of ['IF97-0128','IF97-0129','IAPWS-95-1870'])test(`Independent sensitive h-s inverse ${id}`,()=>{
 const c=fixture.records.find(c=>c.id===id),keys=fixture.modes.hs;
 const verdict=assess(calculate('hs',c.expected.h,c.expected.s,c.model),c,keys);
 assert.equal(verdict.status,'passed',JSON.stringify(verdict));
});
for(const id of ['IAPWS-95-0187','IAPWS-95-0188'])test(`MP critical pressure inverses ${id}`,()=>{
 const c=fixture.records.find(c=>c.id===id);
 for(const mode of ['ph','ps','pu','hs']){
  const keys=fixture.modes[mode],r=calculate(mode,...keys.map(k=>c.expected[k]),c.model);
  assert.equal(assess(r,c,keys).status,'passed',mode);
 }
});
test('IAPWS-95 low-pressure coexistence keeps supplied pressure and both inputs',()=>{
 for(const p of [.001,.1]){
  const sat=calculate('satp',p,undefined,'IAPWS-95').saturation;
  assert.equal(sat.p,p);assert.equal(sat.liquid.p,p);assert.equal(sat.vapor.p,p);
  for(const c of fixture.records.filter(c=>c.model==='IAPWS-95'&&c.group==='mixture'&&c.expected.p===p))for(const mode of ['pv','vs']){
   const keys=fixture.modes[mode],r=calculate(mode,...keys.map(k=>c.expected[k]),c.model);
   assert.equal(assess(r,c,keys).status,'passed');
  }
 }
});
