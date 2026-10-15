import {initialize,calculate} from './engine.js';
import {solveWaterProcess} from './water-process.js';
import {solveCustomCycle,customCyclePreset} from './custom-cycle.js';
import {readProject} from './project.js';

// build.mjs bundles the pure module dependencies and embeds the pinned WASM.
const calculatorWorkerReady=initialize(Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0)));
self.onmessage=async({data})=>{
 const {id,type,payload}=data;
 try{
  await calculatorWorkerReady;
  const result=type==='calculate'?calculate(payload.mode,payload.a,payload.b,payload.model):type==='project'?readProject(payload.text):type==='water-process'?solveWaterProcess(payload.input,payload.model):type==='custom-cycle'?solveCustomCycle(payload.input,payload.model):type==='cycle-preset'?customCyclePreset(payload.name,payload.model):null;
  if(!result)throw Error('Unknown background operation.');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:error.message});}
};
