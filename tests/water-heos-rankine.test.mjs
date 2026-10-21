import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeWaterHeos} from '../src/water-heos.js';
import {buildLibraryCycle} from '../src/cycle-library.js';
import {rankineCycleDetails} from '../src/rankine-library.js';
import {regenerationConfig,noBleedDetails} from '../src/rankine-regeneration.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createCalculationRequest} from '../src/calculation-protocol.js';
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} versus ${b}, tolerance ${t}`);
const controls=[];
for(const file of ['rankine-library-reference','rankine-actual-reference','rankine-regeneration-reference']){
 const fixture=JSON.parse(await readFile(new URL('fixtures/'+file+'.json',import.meta.url),'utf8'));
 controls.push(...fixture.records.filter(q=>(q.model??q.input.model)==='IAPWS-95').map(q=>({...q,group:file})));
}
for(const c of controls)test(`HEOS existing Rankine workflow against independent ${c.group}/${c.name}`,()=>{
 const q=buildLibraryCycle({...c.input,model:'HEOS::Water'}).result,d=rankineCycleDetails(q);
 assert.equal(q.model,'HEOS::Water');assert.equal(q.converged,true);assert.ok(d);assert.equal(q.states.length,c.states.length);
 for(let i=0;i<c.states.length;i++){
  for(const [key,tolerance] of Object.entries({p:1e-7,T:1e-4,h:5e-4,s:2e-6,v:2e-6}))near(q.states[i][key],c.states[i][key],tolerance);
  if(c.states[i].x===null)assert.equal(q.states[i].x,null);else near(q.states[i].x,c.states[i].x,2e-6);
 }
 for(const [key,value]of Object.entries(c.metrics).filter(([key])=>!key.startsWith('baseline')))near(d[key],value,['y','efficiency','mixerEntropy'].includes(key)?2e-7:.003);
 near(q.efficiency,c.metrics.efficiency,2e-5);assert.ok(Math.abs(q.flowResidual)<=q.tolerance);
 if(q.regeneration){const baseline=buildLibraryCycle(regenerationConfig(q,false,true)).result,b=noBleedDetails(baseline);near(b.boiler,c.metrics.baselineHeat,.003);near(b.net,c.metrics.baselineWork,.003);near(baseline.efficiency,c.metrics.baselineEfficiency,2e-5);}
});
test('HEOS workflow adapter retains explicit input model and computes on the shared protocol',async()=>{
 const c=controls.find(q=>q.name==='dry-saturated-inlet'&&q.group==='rankine-library-reference');
 const request=createCalculationRequest({id:1,moduleId:'workflows',methodId:'library-cycle',payload:{input:{...c.input,model:'HEOS::Water'}}});
 const reply=await dispatchCalculation(request);assert.equal(reply.status,'ok',JSON.stringify(reply.error));assert.equal(reply.result.model,'HEOS::Water');near(reply.result.result.efficiency,c.metrics.efficiency,2e-5);
});
