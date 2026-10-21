import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeWaterHeos,calculateWaterHeos} from '../src/water-heos.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createCalculationRequest,calculationQuantities} from '../src/calculation-protocol.js';
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const reference=await json('fixtures/independent-iapws95.json');
const regressions=await json('fixtures/water-heos-regressions.json');
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const near=(actual,expected,absolute,relative=0)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(absolute,Math.abs(expected)*relative),`${actual} versus ${expected}`);

for(const q of reference.states)test(`HEOS water against independent IAPWS95: ${q.p} MPa, ${q.T} K`,()=>{
 const state=calculateWaterHeos('pt',q.p,q.T).state;
 for(const key of ['rho','h','s','cp','cv','w'])near(state[key],q[key],1e-7,2e-8);
 for(const [mode,key] of [['ph','h'],['ps','s'],['pu','u']]){
  const inverse=calculateWaterHeos(mode,q.p,key==='u'?state.u:q[key]).state;
  near(inverse.T,q.T,3e-5);near(inverse.rho,q.rho,2e-5,2e-6);
 }
});
for(const q of regressions.states)test(`HEOS audit regression: ${q.p} MPa, ${q.T} K`,()=>{
 const state=calculateWaterHeos('pt',q.p,q.T).state;
 near(state.rho,q.rho,1e-7);near(state.h,q.h,1e-7);near(state.s,q.s,1e-9);
 near(calculateWaterHeos('ph',q.p,q.h).state.T,q.T,2e-6);
 near(calculateWaterHeos('ps',q.p,q.s).state.T,q.T,2e-6);
});
test('HEOS transport matches native CoolProp controls and masks out-of-range properties',async()=>{
 const controls=(await json('fixtures/coolprop.json')).states.filter(q=>q.model==='IAPWS-95');
 for(const q of controls){const state=calculateWaterHeos('pt',q.p,q.T).state;
  for(const key of ['mu','lambda'])if(state[key]!==null)near(state[key],q[key],1e-12,2e-7);
 }
 const hot=calculateWaterHeos('pt',1,1200).state;
 for(const key of ['mu','lambda','nu','diffusivity','Pr','dc'])assert.equal(hot[key],null,key);
 const dense=calculateWaterHeos('pt',700,500).state;
 for(const key of ['mu','lambda','Pr'])assert.equal(dense[key],null,key);
});
test('HEOS derivatives preserve MPa units and thermodynamic identities',()=>{
 const q=calculateWaterHeos('pt',1,500).state;
 near(q.u,q.h-1000*q.p*q.v,1e-8);near(q.A,q.u-q.T*q.s,1e-8);near(q.G,q.h-q.T*q.s,1e-8);
 const dp=1e-4,dt=.001;
 near((calculateWaterHeos('pt',1+dp,500).state.v-calculateWaterHeos('pt',1-dp,500).state.v)/(2*dp),q.dvdp,1e-8);
 near((calculateWaterHeos('pt',1,500+dt).state.v-calculateWaterHeos('pt',1,500-dt).state.v)/(2*dt),q.dvdt,1e-10);
 near(q.isentropic,q.rho*q.w*q.w/(q.p*1e6),1e-12);
});
test('HEOS saturation, mixtures and inverse dome use common quality without invented cp',()=>{
 const sat=calculateWaterHeos('satp',.101325).saturation;
 near(sat.T,373.12429584766636,1e-8);
 near(sat.liquid.h,419.0577330939922,1e-6);near(sat.vapor.h,2675.52932550072,1e-6);
 const ambiguous=calculateWaterHeos('pt',sat.p,sat.T);assert.equal(ambiguous.ambiguous,true);assert.equal(ambiguous.state,undefined);
 for(const x of [0,.3,1]){
  const result=calculateWaterHeos('px',.101325,x),q=result.state;
  near(calculateWaterHeos('tx',sat.T,x).state.h,q.h,1e-6);
  for(const [mode,key] of [['ph','h'],['ps','s'],['pu','u']])near(calculateWaterHeos(mode,.101325,q[key]).state.x,x,1e-8);
  if(x===.3){for(const key of ['cp','cv','w','gamma','isentropic','alpha','kappa','mu','lambda','Pr'])assert.equal(q[key],null,key);
   assert.equal(calculationQuantities(result,'water-state')['state.cp'].status,'unavailable');
  }else assert.ok(q.cp>0);
 }
 near(calculateWaterHeos('satt',373.12429584766636).saturation.p,.101325,1e-10);
});
test('HEOS protocol converts units and records fixed model, upstream and pilot restrictions',async()=>{
 const request=createCalculationRequest({id:81,moduleId:'water-heos',methodId:'calculate',payload:{mode:'pt',a:10,b:226.85},inputUnits:{a:'bar',b:'C'}});
 const reply=await dispatchCalculation(request);assert.equal(reply.status,'ok',JSON.stringify(reply.error));
 assert.equal(reply.model,'HEOS::Water');assert.equal(reply.validity.experimental,true);assert.equal(reply.validity.steam97WebParityVerified,false);
 assert.equal(reply.units.pressureBasis,'absolute');assert.deepEqual(reply.units.inputs,{a:'MPa',b:'K'});
 near(reply.result.state.T,500,1e-8);assert.equal(reply.quantities['state.h'].unit,'kJ/kg');
 const invalid=await dispatchCalculation({...request,payload:{...request.payload,model:'IF97'}});assert.equal(invalid.error.code,'unsupported-model');
 assert.throws(()=>createCalculationRequest({id:82,moduleId:'water-heos',methodId:'calculate',payload:{mode:'unknown',a:500,b:3000}}),{code:'unsupported-method'});
});
test('HEOS rejects ice, critical, invalid quality and extrapolation in forward and inverse modes',()=>{
 for(const [mode,a,b] of [['pt',0,300],['pt',1001,300],['pt',1,1273.01],['pt',.1,260],['pt',.0001,273.15],['pt',22.064,647.096],['satp',22.064],['satt',273.15],['satt',647.096],['px',.1,-.1],['tx',400,1.01],['ph',.1,-500],['pt',NaN,300],['pt',1,Infinity]]){
  assert.throws(()=>calculateWaterHeos(mode,a,b),undefined,JSON.stringify([mode,a,b]));
 }
 assert.throws(()=>calculateWaterHeos('unknown',500,3000),{code:'unsupported-method'});
});
