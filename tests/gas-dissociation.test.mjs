import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bswGasState,bswComposition} from '../src/gas-bsw2003.js';
import {GAS_DISSOCIATION_MODEL,gasDissociationMolar,dissociatedGasState,calculateGasTable} from '../src/gas-dissociation.js';
import {gasTableRows} from '../src/gas-table-rows.js';
import {gasTabular} from '../src/tabular-data.js';
import {learningCSV} from '../src/learning-export.js';
import {readCalculation} from '../src/workspace.js';
import {createCalculationRunner} from '../src/calculator-runner.js';
const mixture={N2:.73,CO2:.1,H2O:.12,O2:.05},options={dissociation:true,combustion:'complete-air',excessAirLambda:1.2};
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Dissociation is opt-in and preserves every old frozen-state property',()=>{
 assert.deepEqual(calculateGasTable('pt',1,1600,mixture),bswGasState(1,1600,mixture));
 assert.deepEqual(calculateGasTable('pt',1,1600,mixture,'mole',{dissociation:false}),bswGasState(1,1600,mixture));
 assert.throws(()=>calculateGasTable('pt',1,1600,mixture,'mole',{dissociation:'on'}));
});
test('Correction has caloric units, explicit initial composition and no invented equilibrium outputs',()=>{
 const q=dissociatedGasState(.101325,2000,mixture,'mole',options),f=bswGasState(.101325,2000,mixture),m=gasDissociationMolar(.101325,2000,mixture,options);
 assert.equal(q.modelId,GAS_DISSOCIATION_MODEL);assert.ok(q.dissociationApplied&&q.dissociation.experimental);
 for(const [key,delta]of [['h',m.h],['s',m.s],['cp',m.cp]])near(q[key]-f[key],delta/q.M);
 near(q.cp-q.cv,q.R);near(q.h-q.u,q.R*q.T);near(q.dissociationDeltaH/q.T,q.dissociationDeltaS);
 assert.deepEqual(q.composition,f.composition);assert.equal(q.rho,f.rho);assert.equal(q.w,null);assert.equal(q.isentropic,null);
 assert.equal(q.dissociation.equilibriumCompositionComputed,false);assert.equal(q.dissociation.indexIsDissociatedFraction,false);assert.equal(q.dissociation.Steam97WebParityVerified,false);
 assert.ok(q.dissociation.reactionIndices.CO>0);assert.ok(q.cp>f.cp&&q.h>f.h&&q.s>f.s);
});
test('Strict lambda, local pressure/temperature limits, oxygen and combustion domain are enforced',()=>{
 for(const T of [1199.999,2000.001,NaN,Infinity])assert.throws(()=>dissociatedGasState(1,T,mixture,'mole',options));
 for(const p of [.009999,5.000001,0,NaN,Infinity])assert.throws(()=>dissociatedGasState(p,1600,mixture,'mole',options));
 for(const excessAirLambda of [1,1.049999,1.05,NaN,Infinity])assert.throws(()=>dissociatedGasState(1,1600,mixture,'mole',{...options,excessAirLambda}));
 for(const combustion of ['unspecified','oxyfuel',null])assert.throws(()=>dissociatedGasState(1,1600,mixture,'mole',{...options,combustion}));
 for(const fractions of [{N2:.98,O2:.009,H2O:.011},{CO2:.8,O2:.2},{N2:.7,O2:.05,CO:.01,CO2:.24}])assert.throws(()=>dissociatedGasState(1,1600,fractions,'mole',options));
 for(const T of [1200,2000])for(const p of [.01,5])assert.ok(dissociatedGasState(p,T,{N2:.79,CO2:.2,O2:.01},'mole',{...options,excessAirLambda:1.050001}).cp>0);
 assert.throws(()=>gasDissociationMolar(1,1600,{N2:1,O2:-1},options));
});
test('Missing water/carbon branches stay zero; pressures affect reactions with correct powers',()=>{
 const dry={N2:.75,CO2:.2,O2:.05},wet={N2:.8,H2O:.15,O2:.05};
 const q=gasDissociationMolar(.1,2000,dry,options),high=gasDissociationMolar(1,2000,dry,options);
 for(const key of ['H2','OH','H'])assert.equal(q.reactionIndices[key],0);
 near(high.reactionIndices.CO/q.reactionIndices.CO,Math.sqrt(.1));near(high.reactionIndices.NO,q.reactionIndices.NO);
 assert.equal(gasDissociationMolar(1,2000,wet,options).reactionIndices.CO,0);
 const a=gasDissociationMolar(.1,2000,mixture,options),b=gasDissociationMolar(1,2000,mixture,options);
 near(b.reactionIndices.H/a.reactionIndices.H,10**(-.75));near(b.reactionIndices.OH/a.reactionIndices.OH,10**(-.25));
});
test('Mass/mole inputs and both inverse pairs agree across the closed local domain',()=>{
 const mass=bswComposition(mixture).mass;
 for(const T of [1200,1200.00001,1600,1999.99999,2000])for(const p of [.01,.101325,5]){
  const q=dissociatedGasState(p,T,mixture,'mole',options),other=dissociatedGasState(p,T,mass,'mass',options);
  for(const key of ['cp','cv','h','s','rho','dissociationDeltaH'])near(q[key],other[key]);
  for(const mode of ['ph','ps'])near(calculateGasTable(mode,p,q[mode==='ph'?'h':'s'],mixture,'mole',options).T,T,1e-12);
 }
 assert.throws(()=>calculateGasTable('ph',1,-1e8,mixture,'mole',options));assert.throws(()=>calculateGasTable('ps',1,1e8,mixture,'mole',options));
});
test('Project and exports retain the explicit correction, initial composition and unavailable acoustics',()=>{
 const q=dissociatedGasState(1,1600,mixture,'mole',options),inputs={'gas-model':'bsw2003','gas-dissociation':'vdi4670','gas-combustion':'complete-air','gas-excess-air':'1.2'};
 const doc=gasTabular(q,inputs),meta=Object.fromEntries(doc.sheets[0].rows.slice(1));
 assert.equal(meta.dissociation_applied,true);assert.equal(meta.excess_air_lambda,1.2);assert.equal(meta.composition_meaning,'initial-frozen');
 for(const system of ['si','english']){const rows=gasTableRows(q,system);assert.equal(rows.find(r=>r[0]==='w')[1],null);assert.equal(rows.find(r=>r[0]==='isentropic')[1],null);assert.ok(rows.find(r=>r[0]==='dissociationDeltaH')[1]>0);}
 assert.match(learningCSV(q,Object.entries(inputs),gasTableRows(q)),/dissociation_applied;true/);
 assert.equal(readCalculation(JSON.stringify({module:'gases',inputs})).record.inputs['gas-dissociation'],'vdi4670');
 assert.throws(()=>readCalculation(JSON.stringify({module:'gases',inputs:{...inputs,'gas-dissociation':'equilibrium'}})));
});
test('Worker payload retains correction assumptions and cancellation invalidates stale replies',async()=>{
 const workers=[],runner=createCalculationRunner(()=>{const w={postMessage(m){this.request=m;},terminate(){this.stopped=true;}};workers.push(w);return w;});
 const task=runner.gasTable('pt',1,1600,mixture,'mole',options),reject=assert.rejects(task,{code:'cancelled'});
 assert.deepEqual(workers[0].request.payload.options,options);runner.cancel();await reject;assert.ok(workers[0].stopped);
 const retry=runner.gasTable('pt',1,1600,mixture,'mole',options);workers[0].onmessage({data:{id:workers[0].request.id,result:{stale:true}}});assert.ok(runner.busy);
 workers[1].onmessage({data:{id:workers[1].request.id,result:{fresh:true}}});assert.deepEqual(await retry,{fresh:true});
});
