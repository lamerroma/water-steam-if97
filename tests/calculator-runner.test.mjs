import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCalculationRunner} from '../src/calculator-runner.js';
import {calculationReplyIdentity} from '../src/calculation-protocol.js';
function harness(timeout=1000){
 const workers=[];
 const runner=createCalculationRunner(()=>{const w={terminated:false,postMessage(message){this.request=message;},terminate(){this.terminated=true;}};workers.push(w);return w;},timeout);
 return {runner,workers,answer:(w,result)=>w.onmessage({data:{...calculationReplyIdentity(w.request),status:'ok',result}})};
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
 workers[0].onmessage({data:{...calculationReplyIdentity(workers[0].request),status:'error',error:{code:'calculation',message:'Invalid pressure',details:{}}}});await rejected;
 const next=runner.calculate('pt',1,300,'IF97');assert.equal(workers.length,1);answer(workers[0],'valid');assert.equal(await next,'valid');
 let attempts=0;const startup=createCalculationRunner(()=>{attempts++;throw Error('Blocked');});for(let i=0;i<2;i++)await assert.rejects(startup.calculate('pt',1,300,'IF97'),{code:'unavailable'});assert.equal(attempts,2);
});

test('Generic module calls return metadata; AbortSignal terminates computation and is detached after completion',async()=>{
 const {runner,workers}=harness(),controller=new AbortController();
 const pending=runner.run('water','calculate',{mode:'pt',a:30,b:100,model:'IF97'},{inputUnits:{a:'bar',b:'C'},signal:controller.signal});
 assert.equal(workers[0].request.moduleId,'water');assert.deepEqual(workers[0].request.inputUnits,{a:'bar',b:'C'});
 const rejected=assert.rejects(pending,{code:'cancelled'});controller.abort();await rejected;assert.equal(workers[0].terminated,true);
 const completed=new AbortController(),next=runner.run('water','calculate',{mode:'pt',a:3,b:373.15},{signal:completed.signal});
 const reply={...calculationReplyIdentity(workers[1].request),status:'ok',result:{state:{h:421}},quantities:{'state.h':{value:421,unit:'kJ/kg'}},warnings:[]};workers[1].onmessage({data:reply});assert.deepEqual(await next,reply);
 const following=runner.calculate('pt',3,400);completed.abort();assert.equal(runner.busy,true);assert.equal(workers[1].terminated,false);
 workers[1].onmessage({data:{...calculationReplyIdentity(workers[1].request),status:'ok',result:{state:'following'}}});assert.deepEqual(await following,{state:'following'});
});

test('Invalid units and already-aborted requests do not start workers; mismatched response versions are rejected',async()=>{
 const {runner,workers}=harness();
 await assert.rejects(runner.run('water','calculate',{mode:'pt',a:3,b:300},{inputUnits:{a:'K',b:'MPa'}}),{code:'invalid-units'});assert.equal(workers.length,0);
 await assert.rejects(runner.run('water','calculate',{mode:'pt',a:3,b:300},{signal:{}}),{code:'invalid-input'});assert.equal(runner.busy,false);assert.equal(workers.length,0);
 const abort=new AbortController();abort.abort();await assert.rejects(runner.run('water','calculate',{mode:'pt',a:3,b:300},{signal:abort.signal}),{code:'cancelled'});assert.equal(workers.length,0);
 const bad=runner.calculate('pt',3,300),rejected=assert.rejects(bad,{code:'protocol'});
 workers[0].onmessage({data:{...calculationReplyIdentity(workers[0].request),engineVersion:'different',status:'ok',result:{}}});await rejected;assert.equal(workers[0].terminated,true);
});

test('Nontransferable arguments release the runner and permit a fresh worker',async()=>{
 const workers=[];const runner=createCalculationRunner(()=>{const worker={postMessage(){throw new DOMException('Cannot clone','DataCloneError');},terminate(){this.terminated=true;}};workers.push(worker);return worker;});
 for(let i=0;i<2;i++){await assert.rejects(runner.run('workflows','project',{text:'project',extra:()=>{}}),{code:'invalid-input'});assert.equal(runner.busy,false);assert.equal(workers[i].terminated,true);}
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
