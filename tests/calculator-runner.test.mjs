import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCalculationRunner} from '../src/calculator-runner.js';
function harness(timeout=1000){
 const workers=[];
 const runner=createCalculationRunner(()=>{const w={terminated:false,postMessage(message){this.request=message;},terminate(){this.terminated=true;}};workers.push(w);return w;},timeout);
 return {runner,workers,answer:(w,result)=>w.onmessage({data:{id:w.request.id,result}})};
}
test('Cancellation terminates the search, ignores late replies, and permits another calculation',async()=>{
 const {runner,workers,answer}=harness();const first=runner.calculate('hv',3000,.1,'IAPWS-95'),cancelled=assert.rejects(first,{code:'cancelled'});
 assert.equal(runner.cancel(),true);await cancelled;assert.equal(workers[0].terminated,true);assert.equal(runner.busy,false);
 const second=runner.calculate('pt',3,400,'IF97');answer(workers[0],{state:'stale'});assert.equal(runner.busy,true);
 answer(workers[1],{state:'current'});assert.deepEqual(await second,{state:'current'});assert.equal(runner.cancel(),false);
});
test('Only the matching request completes; repeated submissions do not create a second operation',async()=>{
 const {runner,workers,answer}=harness();const result=runner.calculate('pt',3,400,'IF97');
 await assert.rejects(runner.calculate('pt',4,500,'IF97'),{code:'busy'});assert.equal(workers.length,1);
 workers[0].onmessage({data:{id:99,result:'wrong'}});assert.equal(runner.busy,true);answer(workers[0],42);assert.equal(await result,42);
 const next=runner.readProject('project');assert.equal(workers[0].request.type,'project');assert.equal(workers[0].request.payload.text,'project');answer(workers[0],43);assert.equal(await next,43);
});
test('Timeout and worker failure terminate the operation and allow a fresh executor',async()=>{
 const {runner,workers,answer}=harness(10);await assert.rejects(runner.calculate('hv',1,1,'IF97'),{code:'timeout'});assert.equal(workers[0].terminated,true);
 const failed=runner.calculate('pt',1,1,'IF97'),rejected=assert.rejects(failed,{code:'unavailable'});workers[1].onerror({preventDefault(){}});await rejected;assert.equal(workers[1].terminated,true);
 const retry=runner.calculate('pt',1,1,'IF97');answer(workers[2],'ready');assert.equal(await retry,'ready');
});
test('A numerical error preserves the warm worker; a startup exception remains retryable',async()=>{
 const {runner,workers,answer}=harness();const result=runner.calculate('pt',-1,0,'IF97'),rejected=assert.rejects(result,{code:'calculation',message:'Invalid pressure'});
 workers[0].onmessage({data:{id:workers[0].request.id,error:'Invalid pressure'}});await rejected;
 const next=runner.calculate('pt',1,300,'IF97');assert.equal(workers.length,1);answer(workers[0],'valid');assert.equal(await next,'valid');
 let attempts=0;const startup=createCalculationRunner(()=>{attempts++;throw Error('Blocked');});for(let i=0;i<2;i++)await assert.rejects(startup.calculate('pt',1,300,'IF97'),{code:'unavailable'});assert.equal(attempts,2);
});
test('Input spelling and canonical rounding increments reach the background executor unchanged',async()=>{
 const {runner,workers,answer}=harness(),options={inputRounding:[{text:'3.000',unit:'MPa',halfWidth:.0005},{text:'100.0',unit:'C',halfWidth:.05}]};
 const pending=runner.calculate('pt',3,373.15,'IF97',options);assert.deepEqual(workers[0].request.payload.options,options);answer(workers[0],{diagnostics:{roundingScenario:options}});assert.deepEqual((await pending).diagnostics.roundingScenario,options);
});
test('BSW2003 composition and basis reach the worker; cancellation permits an immediate retry',async()=>{
 const {runner,workers,answer}=harness(),fractions={N2:.8,O2:.2};
 const first=runner.gasTable('ph',1,200,fractions,'mass'),cancelled=assert.rejects(first,{code:'cancelled'});
 assert.deepEqual(workers[0].request.payload,{mode:'ph',p:1,value:200,fractions,basis:'mass'});assert.equal(workers[0].request.type,'gas-bsw2003');runner.cancel();await cancelled;
 const next=runner.gasTable('pt',.1,300,fractions,'mole');answer(workers[0],{stale:true});answer(workers[1],{T:300});assert.deepEqual(await next,{T:300});
});
