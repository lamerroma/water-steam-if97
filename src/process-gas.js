import {AIR,gasState,gasInverse,gasLimits,GAS_P0} from './gases.js';

export const PROCESS_GASES=['air','N2','O2','CO2','He','Ar'];
export const PROCESS_MODELS=['IF97','IAPWS-95','IDEAL-CP','IDEAL-NASA7'];
export function processGas(fluid,model){
 if(!PROCESS_GASES.includes(fluid)||!['IDEAL-CP','IDEAL-NASA7'].includes(model))throw Error('Несумісна речовина й модель процесу. / Incompatible fluid and process model.');
 const composition=fluid==='air'?AIR:{[fluid]:1},reference=gasState(GAS_P0,300,composition),limits=gasLimits(composition),variable=model==='IDEAL-NASA7';
 function state(p,T){
  if(variable)return {...gasState(p,T,composition),model,x:null};
  const roundoff=64*Number.EPSILON*Math.max(1,Math.abs(T));
  if(Number.isFinite(T)){if(T<limits.min&&T>=limits.min-roundoff)T=limits.min;else if(T>limits.max&&T<=limits.max+roundoff)T=limits.max;}
  if(!Number.isFinite(p)||p<=0||!Number.isFinite(T)||T<limits.min||T>limits.max)throw Error(`Ідеальний газ: T = ${limits.min}…${limits.max} K, p > 0. / Ideal gas bounds exceeded.`);
  const {cp,cv,R}=reference,h=reference.h+cp*(T-300),s=reference.s+cp*Math.log(T/300)-R*Math.log(p/GAS_P0),v=R*T/(1000*p);
  return {model,p,T,v,rho:1/v,h,u:h-R*T,s,cp,cv,R,gamma:cp/cv,x:null,composition,limits};
 }
 function evaluate(mode,a,b){
  if(mode==='pt')return state(a,b);
  if(mode==='ph'||mode==='ps')return variable?{...gasInverse(a,b,mode==='ph'?'h':'s',composition),model,x:null}:state(a,mode==='ph'?300+(b-reference.h)/reference.cp:300*Math.exp((b-reference.s+reference.R*Math.log(a/GAS_P0))/reference.cp));
  if(mode==='pv')return state(a,1000*a*b/reference.R);
  if(mode==='tv')return state(reference.R*a/(1000*b),a);
  if(mode==='th'){const q=state(GAS_P0,a);if(Math.abs(q.h-b)>1e-6)throw Error('T та h несумісні. / Incompatible T and h.');throw Error('T та h не визначають тиск ідеального газу. / T and h do not determine ideal-gas pressure.');}
  if(mode==='ts'){const base=state(GAS_P0,a);return state(GAS_P0*Math.exp((base.s-b)/reference.R),a);}
  throw Error('Недоступна пара ідеального газу. / Unsupported ideal-gas pair.');
 }
 const get=(mode,a,b)=>{const q=evaluate(mode,a,b);if(!['p','T','v','rho','h','u','s'].every(k=>Number.isFinite(q[k]))||q.p<=0||q.v<=0||q.rho<=0)throw Error('Газовий стан виходить за числові межі. / Gas state exceeds numerical bounds.');return q;};
 return {get,reference,limits,composition};
}
