// Explicit HEOS adapter; migration of the main application model is staged.
// CoolProp 8 / HEOS::Water uses IAPWS-95. Canonical units: MPa, K, kJ/kg.
import {initializeHumidAir,getCoolPropBackend,quarantineCoolPropBackend} from './humid-air-scientific.js';
import {fluidAboveMelting95,lowerFluidTemperature95,transportAvailable95,MIN_FLUID_T95} from './water-validity.js';
import {dielectric} from './dielectric.js';
import {CalculationModuleError} from './calculation-protocol.js';
import {extraInputs,refineInputs} from './extra-inputs.js';
import {diagnoseCalculation} from './inverse-diagnostics.js';
import {registerWaterBackend} from './engine.js';
import {registerCalculationAdapter} from './calculation-adapter-registry.js';

export const WATER_HEOS_MODES={pt:['p','T'],ph:['p','h'],ps:['p','s'],pv:['p','v'],pu:['p','u'],th:['T','h'],ts:['T','s'],tv:['T','v'],tu:['T','u'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],satp:['p'],satt:['T'],px:['p','x'],tx:['T','x'],prho:['p','rho'],trho:['T','rho']};
const HEOS_WATER='HEOS::Water',HEOS_TC=647.096,HEOS_PC=22.064;
const heosFinite=n=>Number.isFinite(n)&&Math.abs(n)<1e100;
let heosNativeState=null,heosNativeFailure=null;
export function waterHeosRuntimeFailure(){return heosNativeFailure;}
const heosAccessors={P:'p',T:'T',Dmass:'rhomass',Hmass:'hmass',Smass:'smass',Umass:'umass',Cpmass:'cpmass',Cvmass:'cvmass',A:'speed_sound',Q:'Q',ISOBARIC_EXPANSION_COEFFICIENT:'isobaric_expansion_coefficient',ISOTHERMAL_COMPRESSIBILITY:'isothermal_compressibility',VISCOSITY:'viscosity',CONDUCTIVITY:'conductivity',SURFACE_TENSION:'surface_tension'};
function heosNativeError(error){
 // This pinned Emscripten build wraps native exceptions in CppException.
 // Never reuse its shadow stack after an unexpected native exception.
 const message=error?.message||'Native CoolProp failure';
 // Do not invoke native cleanup here: this binary's thrown exception can have
 // refcount zero. Discard the entire Worker/heap instead of risking an abort.
 const reloadPage=typeof document!=='undefined';
 heosNativeFailure=new CalculationModuleError('unavailable',reloadPage?'CoolProp: збій обчислювального ядра. Оновіть сторінку для відновлення розрахунків.':'CoolProp: збій обчислювального ядра. Повторіть розрахунок.',{resetWorker:true,...(reloadPage?{reloadPage:true}:{}),upstream:message});
 quarantineCoolPropBackend(heosNativeFailure);
 return heosNativeFailure;
}
function heosGetter(k1,a,k2,b){
 if(heosNativeFailure)throw heosNativeFailure;
 const cp=getCoolPropBackend();
 // PropsSI catches C++ flash failures internally. Preflight protects the
 // reusable low-level instance from expected errors during bounded searches.
 heosValue('Dmass',k1,a,k2,b);
 const pair=k1==='Dmass'?['DmassT_INPUTS',a,b]:k1==='T'?['QT_INPUTS',b,a]:k1==='Hmass'?['HmassSmass_INPUTS',a,b]:k2==='T'?['PT_INPUTS',a,b]:k2==='Q'?['PQ_INPUTS',a,b]:k2==='Hmass'?['HmassP_INPUTS',b,a]:k2==='Smass'?['PSmass_INPUTS',a,b]:['PUmass_INPUTS',a,b];
 try{heosNativeState??=cp.factory('HEOS','Water');heosNativeState.update(cp.input_pairs[pair[0]],pair[1],pair[2]);}catch(error){throw heosNativeError(error);}
 return (output,optional=false)=>{
  let value;try{value=output==='Phase'?heosNativeState.keyed_output(cp.parameters.iPhase):heosNativeState[heosAccessors[output]]();}catch(error){throw heosNativeError(error);}
  if(heosFinite(value))return value;if(optional)return null;
  throw new CalculationModuleError('invalid-result','CoolProp: нескінченна властивість стану.',{output});
 };
}
export async function initializeWaterHeos(bytes){
 if(heosNativeFailure)throw heosNativeFailure;
 let cp;try{cp=getCoolPropBackend();}catch{}
 if(!cp&&!bytes){
  if(typeof COOLPROP_WASM_URL!=='string')throw new CalculationModuleError('unavailable','CoolProp: потрібні локальні байти WASM.');
  const response=await fetch(COOLPROP_WASM_URL);
  if(!response.ok)throw new CalculationModuleError('unavailable','CoolProp: офлайн-ресурси недоступні. Підготуйте PWA й повторіть.');
  bytes=new Uint8Array(await response.arrayBuffer());
 }
 cp??=await initializeHumidAir(bytes);
 registerWaterBackend('HEOS::Water',calculateWaterHeos);
 registerCalculationAdapter('water-heos',heosCalculationAdapter,waterHeosRuntimeFailure);
 return cp;
}
const heosCalculationAdapter={calculate:p=>calculateWaterHeos(p.mode,p.a,p.b,p.options)};
function heosValue(output,k1,a,k2,b,optional=false){
 if(heosNativeFailure)throw heosNativeFailure;
 const cp=getCoolPropBackend();let value;
 try{value=cp.PropsSI(output,k1,a,k2,b,HEOS_WATER);}catch(error){throw heosNativeError(error);}
 if(heosFinite(value))return value;
 if(optional)return null;
 throw new CalculationModuleError('calculation','CoolProp: не знайдено стан у межах моделі.',{upstream:cp.get_global_param_string('errstring'),output});
}
function heosDomain(p,T){
 if(!Number.isFinite(p)||p<=0||p>1000||!Number.isFinite(T)||T<MIN_FLUID_T95||T>1273||!fluidAboveMelting95(p,T))throw new CalculationModuleError('invalid-input','CoolProp вода: стійкий флюїд вище кривої плавлення, T ≤ 1273 K, 0 < P ≤ 1000 МПа.');
 if(p===HEOS_PC&&T===HEOS_TC)throw new CalculationModuleError('invalid-input','CoolProp вода: точна критична точка виключена з пілотного режиму.');
}
function heosState(k1,a,k2,b,quality=null,requestedPressure){
 const get=heosGetter(k1,a,k2,b);
 const nativeP=get('P')/1e6,p=requestedPressure??(k1==='P'?a/1e6:nativeP),T=k2==='T'?b:k1==='T'?a:get('T');
 if(requestedPressure!==undefined&&Math.abs(nativeP-p)>Math.max(2e-9,p*2e-9))throw new CalculationModuleError('invalid-result','CoolProp: неузгоджений тиск стабільної гілки.');
 const nativeQuality=get('Q');
 if(quality===null&&nativeQuality>=0&&nativeQuality<=1)throw new CalculationModuleError('calculation','CoolProp: для співіснування фаз потрібна сухість.');
 if(k1==='Hmass'&&p>1000&&p-1000<=2e-8)return heosState('P',1e9,'Hmass',a);
 // Native flash roundoff can cross a closed upper bound or the fluid-side
 // lower endpoint. Re-evaluate at that endpoint, then check the input residual.
 if(k1==='P'&&['Hmass','Smass','Umass'].includes(k2)){
  const floor=lowerFluidTemperature95(p);
  if(T>1273&&T-1273<=2e-7)return heosState('P',a,'T',1273);
  if(T<floor&&floor-T<=2e-7)return heosState('P',a,'T',floor);
 }
 heosDomain(p,T);
 const rho=get('Dmass'),h=get('Hmass')/1000,s=get('Smass')/1000,u=get('Umass')/1000,v=1/rho;
 const cp=get('Cpmass')/1000,cv=get('Cvmass')/1000,w=get('A');
 if(!(rho>0&&cp>0&&cv>0&&w>0))throw new CalculationModuleError('invalid-result','CoolProp: нестійкий однофазний стан.');
 const alpha=get('ISOBARIC_EXPANSION_COEFFICIENT'),kappa=get('ISOTHERMAL_COMPRESSIBILITY')*1e6;
 // Optional correlations use the high-level exception boundary: an unavailable
 // transport output must not invalidate a successful thermodynamic state.
 const mu=transportAvailable95('mu',p,T)?heosValue('VISCOSITY',k1,a,k2,b,true):null,lambda=transportAvailable95('lambda',p,T)?heosValue('CONDUCTIVITY',k1,a,k2,b,true):null;
 const phase=quality===0?'Насичена рідина':quality===1?'Насичена пара':({0:'Стиснена рідина',1:'Надкритичний флюїд',2:'Перегріта пара',3:'Надкритична рідина',5:'Перегріта пара'})[get('Phase')]||'Флюїд';
 return {model:HEOS_WATER,modelName:'CoolProp 8 · HEOS · IAPWS-95',p,T,rho,v,h,s,u,cp,cv,w,x:quality,phase,mu,lambda,alpha,kappa,drhodp:rho*kappa,
  A:u-T*s,G:h-T*s,Z:p*1000*v/(.46151805*T),gamma:cp/cv,isentropic:w*w*rho/(p*1e6),
  dvdt:v*alpha,dvdp:-v*kappa,dpdt:alpha/kappa,dpdv:-1/(v*kappa),jt:1000*v*(T*alpha-1)/cp,ijt:1000*v*(1-T*alpha),
  nu:mu==null?null:mu/rho,diffusivity:lambda==null?null:lambda/(rho*cp*1000),Pr:mu==null||lambda==null?null:mu*cp*1000/lambda,
  dc:dielectric(T,rho),sigma:quality==null?null:heosValue('SURFACE_TENSION',k1,a,k2,b,true),
  notes:['Пілот CoolProp 8 / HEOS::Water; система відліку h/s — стандартна IAPWS-95 у CoolProp.','μ та λ обмежено діапазонами IAPWS R12-08 / R15-11; пропуск означає недоступність.']};
}
function heosSaturation(key,value){
 const T=key==='T'?value:heosValue('T',key,value,'Q',0);
 if(T<273.16||T>=HEOS_TC)throw new CalculationModuleError('invalid-input','CoolProp насичення: 273,16 ≤ T < 647,096 K; критична точка виключена.');
 const liquid=heosState(key,value,'Q',0,0),vapor=heosState(key,value,'Q',1,1);
 return {model:HEOS_WATER,p:liquid.p,T:liquid.T,liquid,vapor,latentHeat:vapor.h-liquid.h};
}
function heosMixture(sat,x){
 if(x===0)return {...sat.liquid};if(x===1)return {...sat.vapor};
 const blend=key=>sat.liquid[key]+x*(sat.vapor[key]-sat.liquid[key]);
 const h=blend('h'),s=blend('s'),u=blend('u'),v=blend('v');
 const unavailable=Object.fromEntries(['cp','cv','w','gamma','isentropic','mu','lambda','dc','alpha','kappa','drhodp','dvdt','dvdp','dpdt','dpdv','jt','ijt','nu','diffusivity','Pr'].map(key=>[key,null]));
 return {model:sat.liquid.model,p:sat.p,T:sat.T,x,phase:'Двофазна суміш',h,s,u,v,rho:1/v,A:u-sat.T*s,G:h-sat.T*s,Z:sat.p*1000*v/(.46151805*sat.T),sigma:sat.liquid.sigma,...unavailable,
  notes:['Пілот CoolProp 8 / HEOS::Water.','Теплоємності, звук, похідні й транспорт двофазної суміші не наведено; властивості фаз подано окремо.']};
}
function heosPoint(p,T,search=false){
 heosDomain(p,T);
 if(T>=273.16&&T<HEOS_TC){
  const ps=heosValue('P','T',T,'Q',0)/1e6,delta=Math.abs(p-ps);
  if(delta<=Math.max(1e-12,ps*(search?1e-12:1e-6)))return {ambiguous:true,saturation:heosSaturation('T',T)};
  if(search&&delta<=ps*2e-6){
   // The stable side is known from p versus ps(T). Use a forced-phase
   // density only in PropsSI's exclusion band, then evaluate stable rho-T.
   const rho=heosValue('Dmass',p>ps?'P|liquid':'P|gas',p*1e6,'T',T);
   return {state:heosState('Dmass',rho,'T',T,null,p)};
  }
 }
 return {state:heosState('P',p*1e6,'T',T)};
}
function heosSearchCalculation(mode,a,b){
 if(mode==='pt'){
  if(a>1000&&a-1000<=2e-8)a=1000;
  if(b>1273&&b-1273<=2e-8)b=1273;
  return heosPoint(a,b,true);
 }
 return calculateWaterHeosRaw(mode,a,b);
}
function calculateWaterHeosRaw(mode,a,b){
 if(heosNativeFailure)throw heosNativeFailure;
 if(!Object.hasOwn(WATER_HEOS_MODES,mode))throw new CalculationModuleError('unsupported-method','Невідома пара входів CoolProp.');
 if(!Number.isFinite(a)||(WATER_HEOS_MODES[mode].length===2&&!Number.isFinite(b)))throw new CalculationModuleError('invalid-input','Потрібні скінченні числові входи.');
 if(WATER_HEOS_MODES[mode][0]==='p'&&(a<=0||a>1000))throw new CalculationModuleError('invalid-input','Абсолютний тиск: 0 < P ≤ 1000 МПа.');
 if(WATER_HEOS_MODES[mode][0]==='T'&&(a<MIN_FLUID_T95||a>1273))throw new CalculationModuleError('invalid-input','Температура CoolProp: 251,165 ≤ T ≤ 1273 K з перевіркою кривої плавлення.');
 if(['th','ts','tu','tv','trho','pv','prho','us','vs','hv','uv'].includes(mode))return extraInputs(mode,a,b,'HEOS::Water',heosSearchCalculation);
 if(['px','tx'].includes(mode)&&(b<0||b>1))throw new CalculationModuleError('invalid-input','Сухість x має бути від 0 до 1.');
 if(['satt','tx','satp','px'].includes(mode)){
  const sat=heosSaturation(['satt','tx'].includes(mode)?'T':'P',['satt','tx'].includes(mode)?a:a*1e6);
  return ['px','tx'].includes(mode)?{state:heosMixture(sat,b),saturation:sat}:{saturation:sat};
 }
 if(mode==='pt')return heosPoint(a,b);
 const key={ph:'Hmass',ps:'Smass',pu:'Umass'}[mode],k1=mode==='hs'?'Hmass':'P',n1=mode==='hs'?a*1000:a*1e6,k2=mode==='hs'?'Smass':key,q=heosValue('Q',k1,n1,k2,b*1000,true);
 let result;
 if(q!=null&&q>=0&&q<=1){const sat=heosSaturation('P',mode==='hs'?heosValue('P',k1,n1,k2,b*1000):a*1e6);result={state:heosMixture(sat,q),saturation:sat};}
 else result={state:heosState(k1,n1,k2,b*1000)};
 const actual=result.state[mode==='hs'?'s':{ph:'h',ps:'s',pu:'u'}[mode]];
 if(Math.abs(actual-b)>Math.max(['ps','hs'].includes(mode)?1e-8:1e-6,Math.abs(b)*1e-8))throw new CalculationModuleError('invalid-result','CoolProp: обернений розрахунок не задовольняє заданий вхід.');
 return refineInputs(result,WATER_HEOS_MODES[mode],[a,b],'HEOS::Water',heosSearchCalculation);
}
export function calculateWaterHeos(mode,a,b,options){
 try{const result=calculateWaterHeosRaw(mode,a,b);if(heosNativeFailure)throw heosNativeFailure;return diagnoseCalculation(result,mode,a,b,options);}
 catch(error){if(heosNativeFailure)throw heosNativeFailure;throw error;}
}
