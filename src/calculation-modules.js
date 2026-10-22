import {calculate} from './engine.js';
import {calculateBatch} from './batch.js';
import {calculateGasTable} from './gas-dissociation.js';
import {solveRankineSweep} from './rankine-sweep.js';
import {studyReportHTML} from './study-report.js';
import {buildLibraryCycle,compareLibraryCycles} from './cycle-library.js';
import {cycleChartGuides} from './cycle-chart.js';
import {solveWaterProcess} from './water-process.js';
import {steamProcess,diagramData} from './processes.js';
import {engineeringProcess} from './engineering.js';
import {diagramIsotherm,diagramRegionAnnotations} from './diagram-guides.js';
import {refineDiagramScene} from './diagram-refinement.js';
import {WATER_MODELS} from './water-models.js';
import {solveCustomCycle,customCyclePreset} from './custom-cycle.js';
import {readProject} from './project.js';
import {CalculationModuleError,normalizeCalculationRequest,calculationReplyIdentity,calculationErrorReply,calculationQuantities} from './calculation-protocol.js';
import {optionalCalculationMethod,optionalRuntimeFailure} from './calculation-adapter-registry.js';

// Each runtime adapter implements the same method signature. Future WASM/Python
// adapters can initialize lazily here; dispatch and UI do not depend on their runtime.
function diagramCalculationModel(payload){
 if(!WATER_MODELS.includes(payload.model))throw new CalculationModuleError('unsupported-model','Unknown diagram water model.');
 return payload.model;
}
const calculationAdapters={
 water:{calculate:p=>calculate(p.mode,p.a,p.b,p.model,p.options)},
 'gas-tables':{calculate:p=>calculateGasTable(p.mode,p.p,p.value,p.fractions,p.basis,p.options)},
 workflows:{
  batch:p=>calculateBatch(p.inputs,p.model),
  project:p=>readProject(p.text),
  'rankine-sweep':p=>solveRankineSweep(p.input),
  'study-report-html':p=>studyReportHTML(p.title,p.report,p.options),
  'water-process':p=>solveWaterProcess(p.input,p.model),
  'steam-process':p=>steamProcess(p.input,p.model),
  engineering:p=>engineeringProcess(p.kind,p.args,p.model),
  'diagram-base':p=>{const model=diagramCalculationModel(p),cache=diagramData(model);return {...cache,annotations:diagramRegionAnnotations(cache,model)};},
  'diagram-isotherm':p=>diagramIsotherm(p.T,diagramCalculationModel(p)),
  'diagram-refine':(p,context)=>refineDiagramScene(p.cache,p.isotherms,p.process,p.kind,p.range,p.size,diagramCalculationModel(p),new Set(p.hidden),p.dryness,context?.yieldFrame),
  'custom-cycle':p=>{const result=solveCustomCycle(p.input,p.model);return {...result,guides:cycleChartGuides(result)};},
  'library-cycle':p=>buildLibraryCycle(p.input),
  'cycle-comparison':p=>compareLibraryCycles(p.input),
  'cycle-preset':p=>customCyclePreset(p.name,p.model)
 }
};
export async function dispatchCalculation(request,context={}){
 try{
  const {descriptor,payload,canonicalUnits}=normalizeCalculationRequest(request);
  const execute=calculationAdapters[descriptor.id]?.[request.methodId]??optionalCalculationMethod(descriptor.id,request.methodId);
  if(typeof execute!=='function')throw new CalculationModuleError('unavailable','Calculation adapter is unavailable.');
  if(context.signal?.aborted)throw new CalculationModuleError('cancelled','Calculation cancelled.');
  const result=await execute(payload,context);
  if(context.signal?.aborted)throw new CalculationModuleError('cancelled','Calculation cancelled.');
  const runtimeFailure=optionalRuntimeFailure();if(runtimeFailure)throw runtimeFailure;
  const states=descriptor.resultFormat==='water-state'?[result.state,result.saturation?.liquid,result.saturation?.vapor]:descriptor.resultFormat==='gas-state'?[result]:[];
  const notes=[...new Set(states.flatMap(state=>state?.notes??[]))];
  const model=descriptor.id==='water'?payload.model??'IF97':descriptor.id==='water-heos'?'HEOS::Water':descriptor.id==='gas-tables'?result.modelId:null;
  return {...calculationReplyIdentity(request),status:'ok',result,model,
   units:{inputs:canonicalUnits,pressureBasis:descriptor.id==='workflows'?null:'absolute',inputCompositionBasis:descriptor.id==='gas-tables'?payload.basis??'mole':null,
    outputCompositionBasis:descriptor.id==='gas-tables'?{composition:'mole',massComposition:'mass'}:null},
   quantities:calculationQuantities(result,descriptor.resultFormat),
   warnings:notes.map(message=>({code:'model-note',message})),
   validity:{...descriptor.validity,...(descriptor.id==='water'?{selectedModel:model}:{}),...(descriptor.id==='gas-tables'?{dissociationApplied:result.dissociationApplied,reference:result.reference}:{} )}};
 }catch(error){return calculationErrorReply(request,optionalRuntimeFailure()??error);}
}
