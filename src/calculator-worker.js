import {initialize} from './engine.js';
import {dispatchCalculation} from './calculation-modules.js';
import {CalculationModuleError,calculationErrorReply} from './calculation-protocol.js';

// build.mjs bundles the pure module dependencies and embeds the pinned WASM.
// Keep startup rejection handled until a request arrives.
const calculatorWorkerReady=initialize(Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0))).then(()=>null,()=>new CalculationModuleError('unavailable','Background calculation could not start.'));
const activeRefinements=new Map();
self.onmessage=async({data})=>{
 if(data?.type==='cancel-refinement'){activeRefinements.get(data.id)?.abort();return;}
 const controller=data?.moduleId==='workflows'&&data.methodId==='diagram-refine'?new AbortController():null;
 if(controller)activeRefinements.set(data.id,controller);
 try{
  const startupError=await calculatorWorkerReady;if(startupError)throw startupError;
  const context=controller?{signal:controller.signal,yieldFrame:async()=>{await new Promise(resolve=>setTimeout(resolve,0));if(controller.signal.aborted)throw new CalculationModuleError('cancelled','Calculation cancelled.');}}:{};
  self.postMessage(await dispatchCalculation(data,context));
 }catch(error){self.postMessage(calculationErrorReply(data,error));}
 finally{if(controller)activeRefinements.delete(data.id);}
};
