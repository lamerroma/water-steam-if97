import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize} from '../src/engine.js';
import {initializeWaterHeos} from '../src/water-heos.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createCalculationRequest} from '../src/calculation-protocol.js';
import {waterCalculationRuntime} from '../src/water-models.js';
const reference=JSON.parse(await readFile(new URL('fixtures/steam-process-reference.json',import.meta.url),'utf8'));
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const near=(a,b,t=3e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} versus ${b}`);
for(const model of ['IF97','IAPWS-95','HEOS::Water'])test(`Steam process Worker contract: six modes, independent controls and balances / ${model}`,async()=>{
 for(const {input,expected} of reference.records){
  const request=createCalculationRequest({id:1,moduleId:'workflows',methodId:'steam-process',payload:{input,model}});
  assert.equal(waterCalculationRuntime(request),model==='HEOS::Water'?'heos':'default');
  const reply=await dispatchCalculation(request);assert.equal(reply.status,'ok',JSON.stringify(reply.error));const r=reply.result;
  for(const key of ['inlet','ideal','outlet'])if(expected[key]){
   assert.equal(r[key].model||'IF97',model);
   // Python's saturation solve differs by ~3e-6 kJ/kg at 3 MPa.
   // Keep tight property-specific bounds; do not change kernel tolerances.
   if(model!=='IF97')for(const [k,v] of Object.entries(expected[key]))near(r[key][k==='P'?'p':k],v,k==='h'?1e-5:k==='s'?3e-8:k==='P'?1e-8:3e-6);
  }
  for(const key of ['work','power','flow','eta','vaporFlow','liquidFlow'])if(key in expected&&model!=='IF97')near(r[key],expected[key]);
  if(input.kind==='turbine'){
   near(r.power,r.flow*(r.inlet.h-r.outlet.h),1e-7);near(r.ideal.s,r.inlet.s,1e-8);
   near(r.eta,(r.inlet.h-r.outlet.h)/(r.inlet.h-r.ideal.h),1e-8);
  }else{near(r.inlet.h,r.outlet.h,1e-7);near(r.flow,r.vaporFlow+r.liquidFlow,1e-12);}
  assert.deepEqual(structuredClone(reply),reply);
 }
});
test('Steam process dispatch rejects invalid modes, pressures and efficiency without model substitution',async()=>{
 for(const mutation of [{kind:'unknown'},{mode:'unknown'},{p2:4},{eta:1.1}]){
  const request=createCalculationRequest({id:2,moduleId:'workflows',methodId:'steam-process',payload:{model:'HEOS::Water',input:{...reference.records[0].input,...mutation}}});
  const reply=await dispatchCalculation(request);assert.equal(reply.status,'error');assert.equal(reply.error.code,'calculation');
 }
});
