// Fault injection in a disposable process: never reuse the deliberately failed WASM.
import {readFile} from 'node:fs/promises';
import {initializeWaterHeos} from '../../src/water-heos.js';
import {dispatchCalculation} from '../../src/calculation-modules.js';
import {createCalculationRequest} from '../../src/calculation-protocol.js';
import {getCoolPropBackend,humidAirScientific,initializeHumidAir} from '../../src/humid-air-scientific.js';
import {realGasState} from '../../src/real-gases.js';
const sharedMain=process.argv[2]==='shared-main';
if(sharedMain)globalThis.document={};
const cp=await initializeWaterHeos(await readFile(new URL('../../vendor/coolprop.wasm',import.meta.url)));
const factory=cp.factory,highLevel=!['low-level','shared-main'].includes(process.argv[2]),batch=process.argv[2]==='batch';let faultCalls=0;
if(highLevel){const state=factory('HEOS','Water');cp.PropsSI=()=>{faultCalls++;state.update(cp.input_pairs.PT_INPUTS,-1,500);};}
else cp.factory=(...args)=>{const state=factory(...args);state.speed_sound=()=>{faultCalls++;state.update(cp.input_pairs.PT_INPUTS,-1,500);};return state;};
const input={fluid:'water',mass:1,closed:false,points:[{name:'1',mode:'pt',a:.1,b:400,kind:'isobaric'},{name:'2',mode:'pt',a:.1,b:500,kind:'isobaric'}]};
const request=batch?{id:1,moduleId:'workflows',methodId:'batch',payload:{model:'HEOS::Water',inputs:[{mode:'th',a:500,b:2891.218298958905,ua:'K',ub:'kJkg'},{mode:'pt',a:1,b:500,ua:'MPa',ub:'K'}]}}:highLevel?{id:1,moduleId:'water-heos',methodId:'calculate',payload:{mode:'th',a:500,b:2891.218298958905}}:{id:1,moduleId:'workflows',methodId:'custom-cycle',payload:{input,model:'HEOS::Water'}};
const reply=await dispatchCalculation(createCalculationRequest(request));
const followup=await dispatchCalculation(createCalculationRequest({id:2,moduleId:'water-heos',methodId:'calculate',payload:{mode:'pt',a:1,b:500}}));
let followupNativeCalls=0;cp.PropsSI=cp.HAPropsSI=()=>{followupNativeCalls++;throw Error('Quarantined WASM reused');};
const consumers={};
for(const [name,invoke] of Object.entries({backend:()=>getCoolPropBackend(),humidAir:()=>humidAirScientific(.101325,300,.5),realGas:()=>realGasState('N2',.1,300),initializeHumidAir:()=>initializeHumidAir(),initializeWater:()=>initializeWaterHeos()})){
 try{await invoke();consumers[name]={rejected:false};}catch(error){consumers[name]={rejected:true,resetWorker:error.details?.resetWorker===true,reloadPage:error.details?.reloadPage===true};}
}
console.log(JSON.stringify({...reply,faultCalls,followup,consumers,followupNativeCalls}));
