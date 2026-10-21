import {initialize} from './engine.js';
import {initializeWaterHeos} from './water-heos.js';
import {dispatchCalculation} from './calculation-modules.js';
import {CalculationModuleError,calculationErrorReply} from './calculation-protocol.js';

// The optional HEOS runtime owns its WASM, extension registration and lifetime.
// Existing water requests use calculator-worker.js without these dependencies.
const heosWorkerReady=initialize(Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0))).then(()=>null,()=>new CalculationModuleError('unavailable','Background calculation could not start.'));
self.onmessage=async({data})=>{
 try{const error=await heosWorkerReady;if(error)throw error;await initializeWaterHeos();self.postMessage(await dispatchCalculation(data));}
 catch(error){self.postMessage(calculationErrorReply(data,error));}
};
