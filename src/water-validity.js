// IAPWS R6-95(2018) §5, R14-08(2011) Eqs. 1–4,
// R12-08 §2.4 Eq. 9, R15-11 §2.4 Eq. 14. MPa and K.
// These are validated ranges, not the broader extrapolation ranges.
import {meltingPressure} from './phase-boundaries.js';
export const MIN_FLUID_T95=251.165;
export function upperMeltingPressure95(T){
 if(T>=355)return Infinity; // Ice VII starts at 2216 MPa, above our EOS limit.
 if(T<MIN_FLUID_T95)return -Infinity;
 return meltingPressure(T,T<256.164?'III':T<273.31?'V':'VI');
}
export function fluidAboveMelting95(p,T){
 return T>=MIN_FLUID_T95&&p<upperMeltingPressure95(T)&&
  (T>=273.16||p>meltingPressure(T,'Ih'));
}
const fluidFloorCache=new Map();
export function lowerFluidTemperature95(p){
 if(p<.000611657)return 273.16; // Sub-triple vapor is extrapolation, not this domain.
 if(fluidFloorCache.has(p))return fluidFloorCache.get(p);
 let lo=MIN_FLUID_T95,hi=355;
 // Return the first representable fluid-side temperature, never an ice state.
 for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;
  if(fluidAboveMelting95(p,mid))hi=mid;else lo=mid;
 }
 if(fluidFloorCache.size>=256)fluidFloorCache.clear();fluidFloorCache.set(p,hi);return hi;
}
export function transportTemperatureLimit(key,p){
 if(!Number.isFinite(p)||p<=0||p>1000)return null;
 if(key==='mu'||key==='nu')return p<=300?1173.15:p<=350?873.15:p<=500?433.15:373.15;
 if(key==='lambda'||key==='diffusivity')return p<=100?1173.15:p<=250?874:p<=687?573:p<=785?403:348;
 if(key==='Pr')return Math.min(transportTemperatureLimit('mu',p),transportTemperatureLimit('lambda',p));
 return null;
}
export function transportAvailable95(key,p,T){
 const max=transportTemperatureLimit(key,p);
 return max!=null&&Number.isFinite(T)&&T<=max&&T>=lowerFluidTemperature95(p);
}
