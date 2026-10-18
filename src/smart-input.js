import {MIN_FLUID_T95,lowerFluidTemperature95} from './water-validity.js';
import {PC,TC,PMIN_SAT} from './engine.js';
import {parseNumber,fromCanonical} from './units.js';
import {pressureInput,pressureOutput} from './pressure.js';
export const SMART_PAIRS={pt:['p','T'],ph:['p','h'],ps:['p','s'],pv:['p','v'],pu:['p','u'],th:['T','h'],ts:['T','s'],tv:['T','v'],tu:['T','u'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],satp:['p','sat'],satt:['T','sat'],px:['p','x'],tx:['T','x'],prho:['p','rho'],trho:['T','rho']};
export const SMART_PROPERTIES=['p','T','h','s','u','v','rho','x'];
export function smartPartners(first){return [...new Set(Object.values(SMART_PAIRS).flatMap(([a,b])=>a===first?[b]:b===first?[a]:[]))];}
export function resolveSmartPair(first,second){
 for(const [mode,[a,b]] of Object.entries(SMART_PAIRS)){if(first===a&&second===b)return {mode,reversed:false};if(first===b&&second===a&&b!=='sat')return {mode,reversed:true};}
 throw Error('Unsupported input pair');
}
export function validateCalculatorInput({mode,a,b,ua,ub,model='IF97',pressure={basis:'absolute',atmosphere:.101325}}){
 const pair=SMART_PAIRS[mode];if(!pair)throw Error('Unsupported mode');const values={},errors={};
 for(const [i,letter,raw,unit] of [[0,'a',a,ua],[1,'b',b,ub]]){
  const property=pair[i];if(property==='sat')continue;
  try{values[letter]=pressureInput(parseNumber(raw),unit,pressure);}catch{errors[letter]={key:String(raw).trim()?'input.error.number':'input.error.required'};continue;}
  const value=values[letter],sat=['satp','satt','px','tx'].includes(mode),is95=model==='IAPWS-95';
  if(property==='p'){
   const min=sat?(is95?.000611654771:PMIN_SAT):0,max=sat?PC:is95?1000:100;
   if(value<min||(!sat&&value===0)||value>max)errors[letter]={key:sat?'input.error.range':'input.error.pressure',params:{min:pressureOutput(min,unit,pressure),max:pressureOutput(max,unit,pressure),unit}};
  }else if(property==='T'){
   const min=sat?(is95?273.16:273.15):is95?MIN_FLUID_T95:273.15,max=sat?TC:is95?1273:2273.15;
   if(value<min-1e-10||value>max+1e-10)errors[letter]={key:'input.error.range',params:{min:fromCanonical(min,unit),max:fromCanonical(max,unit),unit}};
  }else if(['rho','v'].includes(property)&&value<=0)errors[letter]={key:'input.error.positive'};
  else if(property==='x'&&(value<0||value>1))errors[letter]={key:'input.error.range',params:{min:0,max:fromCanonical(1,unit),unit}};
 }
 if(mode==='pt'&&model==='IF97'&&values.a>50&&values.b>1073.15&&!Object.keys(errors).length)for(const letter of ['a','b'])errors[letter]={key:'input.error.region5'};
 if(mode==='pt'&&model==='IAPWS-95'&&values.a>0&&values.a<=1000&&values.b<lowerFluidTemperature95(values.a)&&!Object.keys(errors).length)errors.b={key:'input.error.range',params:{min:fromCanonical(lowerFluidTemperature95(values.a),ub),max:fromCanonical(1273,ub),unit:ub}};
 return {values,errors};
}
