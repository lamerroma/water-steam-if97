import {initialize} from './engine.js';
import {dispatchCalculation} from './calculation-modules.js';
import {CalculationModuleError,calculationErrorReply} from './calculation-protocol.js';

// build.mjs bundles the pure module dependencies and embeds the pinned WASM.
// Keep startup rejection handled until a request arrives.
const calculatorWorkerReady=initialize(Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0))).then(()=>null,()=>new CalculationModuleError('unavailable','Background calculation could not start.'));
self.onmessage=async({data})=>{
 try{
  const startupError=await calculatorWorkerReady;if(startupError)throw startupError;
  self.postMessage(await dispatchCalculation(data));
 }catch(error){self.postMessage(calculationErrorReply(data,error));}
};
