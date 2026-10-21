import {CalculationModuleError} from './calculation-protocol.js';
const optionalCalculationAdapters=new Map();let optionalCalculationFailure=()=>null;
export function registerCalculationAdapter(moduleId,adapter,runtimeFailure){
 if(moduleId!=='water-heos'||typeof adapter?.calculate!=='function'||typeof runtimeFailure!=='function')throw new CalculationModuleError('unsupported-module','Invalid optional adapter registration.');
 optionalCalculationAdapters.set(moduleId,adapter);optionalCalculationFailure=runtimeFailure;
}
export function optionalCalculationMethod(moduleId,methodId){return optionalCalculationAdapters.get(moduleId)?.[methodId];}
export function optionalRuntimeFailure(){return optionalCalculationFailure();}
