import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeWaterHeos,calculateWaterHeos,WATER_HEOS_MODES} from '../src/water-heos.js';
import {calculationQuantities} from '../src/calculation-protocol.js';
import {selectCalculatedAlternative} from '../src/inverse-diagnostics.js';
const fixture=JSON.parse(await readFile(new URL('fixtures/water-heos-matrix.json',import.meta.url),'utf8'));
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const selected=new Set(['single-01','single-05','single-10','single-13','single-20','upper-T','mixture-0.1','mixture-20','coexistence-band-vapor','coexistence-band-liquid']);
for(const c of fixture.records.filter(c=>selected.has(c.id)||c.kind==='multiple'))test(`HEOS extended inversions: independent ${c.id}`,()=>{
 const expected=c.expected,modes=c.modes??['pv','th','ts','tv','tu','hs','us','vs','hv','uv','prho','trho'];
 for(const mode of modes){
  const keys=WATER_HEOS_MODES[mode],r=calculateWaterHeos(mode,...keys.map(k=>expected[k])),roots=[r.state,...(r.alternatives||[])];
  for(const q of c.roots??[expected])assert.ok(roots.some(s=>Math.abs(s.p-q.p)<=Math.max(1e-7,q.p*3e-6)&&Math.abs(s.T-q.T)<3e-4),mode+': '+JSON.stringify(roots.map(s=>[s.p,s.T])));
  for(const s of roots)for(const key of keys)assert.ok(Math.abs(s[key]-expected[key])<=Math.max(['s','v'].includes(key)?2e-10:2e-7,Math.abs(expected[key])*2e-9),mode+' residual '+key);
  if(c.kind==='multiple'){
   assert.equal(roots.length,2,mode+' independent distinct branches');
   const manual=selectCalculatedAlternative(r,0);assert.equal(manual.state,r.alternatives[0]);assert.equal(manual.diagnostics.selection,'manual');
   assert.equal(calculationQuantities(r,'water-state')['alternatives.0.h'].unit,'kJ/kg');
  }
 }
});
test('HEOS input spelling produces local rounding diagnostics without changing solved numbers',()=>{
 const plain=calculateWaterHeos('ps',1,6.824994379140872),rounded=calculateWaterHeos('ps',1,6.824994379140872,{inputRounding:[{text:'1.0000',unit:'MPa',halfWidth:.00005},{text:'6.824994379140872',unit:'kJkgK',halfWidth:5e-16}]});
 assert.equal(plain.state.h,rounded.state.h);assert.equal(rounded.state.inputSensitivity.status,'local');assert.ok(rounded.state.inputSensitivity.response.T>0);
 assert.equal(rounded.diagnostics.roundingScenario.inputs[0].enteredText,'1.0000');
});
test('Invalid extended pairs do not extend the stable fluid domain or poison a retry',()=>{
 for(const args of [['th',1273.01,4000],['tu',250,1000],['prho',0,900],['pv',1,0],['trho',500,-1],['vs',0,7]])assert.throws(()=>calculateWaterHeos(...args),undefined,String(args));
 assert.ok(calculateWaterHeos('pt',1,500).state.cp>0);
});
