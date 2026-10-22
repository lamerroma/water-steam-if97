import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCalculationRunner,retireCalculationWorkerSafely} from '../src/calculator-runner.js';
import {calculationReplyIdentity} from '../src/calculation-protocol.js';
function harness(options={}){
 const timers=new Map();let next=0;const worker=new EventTarget();worker.messages=[];worker.stops=0;worker.postMessage=request=>worker.messages.push(request);worker.terminate=()=>worker.stops++;
 retireCalculationWorkerSafely(worker,{cooperative:true,setTimer:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimer:id=>timers.delete(id),...options});
 const emit=data=>{const event=new Event('message');Object.defineProperty(event,'data',{value:data});worker.dispatchEvent(event);worker.onmessage?.({data});};
 const flush=ms=>{for(const[id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}};
 return {worker,emit,flush,timers};
}
test('Retirement waits for its terminal reply, ignores progress and other IDs, and closes once outside the event',()=>{
 const h=harness(),request={id:7,moduleId:'water',methodId:'calculate'};h.worker.postMessage(request);h.worker.terminate();h.worker.terminate();assert.equal(h.worker.stops,0);assert.equal(h.worker.messages.length,1);
 h.emit({id:7,status:'progress'});h.emit({id:8,status:'ok'});h.flush(0);assert.equal(h.worker.stops,0);
 h.emit({id:7,status:'ok'});assert.equal(h.worker.stops,0);h.flush(0);h.flush(120000);h.flush(0);assert.equal(h.worker.stops,1);assert.equal(h.timers.size,0);assert.throws(()=>h.worker.postMessage(request),/retired/);
});
test('Only refinements receive a cooperative abort and terminal cancellation releases the heap',()=>{
 const h=harness();h.worker.postMessage({id:1,moduleId:'workflows',methodId:'diagram-refine'});h.worker.terminate();assert.deepEqual(h.worker.messages[1],{type:'cancel-refinement',id:1});h.emit({id:1,status:'error'});h.flush(0);assert.equal(h.worker.stops,1);
 const heos=harness({cooperative:false});heos.worker.postMessage({id:1,moduleId:'workflows',methodId:'diagram-refine'});heos.worker.terminate();assert.equal(heos.worker.messages.length,1);heos.emit({id:1,status:'ok'});heos.flush(0);assert.equal(heos.worker.stops,1);
});
test('Idle, failed and unresponsive workers have bounded physical cleanup',()=>{
 const idle=harness();idle.worker.terminate();assert.equal(idle.worker.stops,0);idle.flush(0);assert.equal(idle.worker.stops,1);
 const failed=harness();failed.worker.postMessage({id:1});failed.worker.terminate();failed.worker.dispatchEvent(new Event('error'));failed.flush(0);assert.equal(failed.worker.stops,1);
 const stalled=harness();stalled.worker.postMessage({id:1});stalled.worker.terminate();stalled.flush(120000);assert.equal(stalled.worker.stops,0);stalled.flush(0);assert.equal(stalled.worker.stops,1);
});
test('Runner cancellation rejects immediately and retired late replies cannot replace a fresh request',async()=>{
 const heaps=[];const runner=createCalculationRunner(()=>{const h=harness();heaps.push(h);return h.worker;});const old=runner.calculate('pt',3,300,'IF97');const rejected=assert.rejects(old,{code:'cancelled'});runner.cancel();await rejected;assert.equal(heaps[0].worker.stops,0);
 const next=runner.calculate('pt',4,400,'IF97');const request=heaps[1].worker.messages[0];heaps[1].emit({...calculationReplyIdentity(request),status:'ok',result:{state:'fresh'}});assert.equal((await next).state,'fresh');const retired=heaps[0].worker.messages[0];heaps[0].emit({...calculationReplyIdentity(retired),status:'ok',result:{state:'stale'}});heaps[0].flush(0);assert.equal(heaps[0].worker.stops,1);runner.reset();heaps[1].flush(0);
});


test('Refinement cancellation returns no partial scene; yielding preserves completed numerical geometry',async()=>{
 const fs=await import('node:fs');const {initialize}=await import('../src/engine.js');await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
 const {diagramData}=await import('../src/processes.js'),{dispatchCalculation}=await import('../src/calculation-modules.js'),{createCalculationRequest,CalculationModuleError}=await import('../src/calculation-protocol.js');
 const request=createCalculationRequest({id:1,moduleId:'workflows',methodId:'diagram-refine',payload:{cache:diagramData('IF97'),isotherms:[],process:null,kind:'ts',range:{xmin:0,xmax:10,ymin:0,ymax:800},size:{width:800,height:600},model:'IF97',hidden:[],dryness:[]}});
 const controller=new AbortController();let frames=0;
 const cancelled=await dispatchCalculation(request,{signal:controller.signal,yieldFrame:async()=>{frames++;controller.abort();throw new CalculationModuleError('cancelled','Calculation cancelled.');}});
 assert.equal(frames,1);assert.equal(cancelled.status,'error');assert.equal(cancelled.error.code,'cancelled');assert.equal(Object.hasOwn(cancelled,'result'),false);
 const direct=await dispatchCalculation(request),yielded=await dispatchCalculation(request,{yieldFrame:async()=>{}});assert.equal(direct.status,'ok');assert.deepEqual(yielded.result,direct.result);
});
