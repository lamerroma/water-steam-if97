import {solveRankineSweep} from './rankine-sweep.js';
import {studyReportHTML} from './study-report.js';
import {buildLibraryCycle,compareLibraryCycles} from './cycle-library.js';
import {cycleChartGuides} from './cycle-chart.js';
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
  const result=type==='rankine-sweep'?solveRankineSweep(payload.input):type==='study-report-html'?studyReportHTML(payload.title,payload.report,payload.options):type==='calculate'?calculate(payload.mode,payload.a,payload.b,payload.model):type==='project'?readProject(payload.text):type==='water-process'?solveWaterProcess(payload.input,payload.model):type==='custom-cycle'?workerCustomCycle(payload.input,payload.model):type==='library-cycle'?buildLibraryCycle(payload.input):type==='cycle-comparison'?compareLibraryCycles(payload.input):type==='cycle-preset'?customCyclePreset(payload.name,payload.model):null;
  if(!result)throw Error('Unknown background operation.');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:error.message});}
};

function workerCustomCycle(input,model){const q=solveCustomCycle(input,model);return {...q,guides:cycleChartGuides(q)};}
