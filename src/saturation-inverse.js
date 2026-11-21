// Saturation state from one property of the saturated liquid or vapor, or from
// the latent heat. Finds every saturation temperature where the property takes
// the given value (h'' and u'' have a maximum, so two roots are possible).
// Each root is refined by bisection on calculate('satt'), so the result is
// consistent with the selected water formulation.
import {calculate} from './engine.js';
import {TC} from './equations.js';

export const SATURATION_INVERSE_KEYS=['h','s','u','v','rho'];
const SAT_INV_SCAN=240;

function satInvValue(model,T,key,phase){
 const s=calculate('satt',T,undefined,model).saturation;
 if(key==='latent')return s.latentHeat;
 return s[phase==='vapor'?'vapor':'liquid'][key];
}
export function saturationTemperatureRange(model='IF97'){return {min:model==='IF97'?273.15:273.16,max:TC-1e-3};}

export function saturationByProperty({key,phase='liquid',value,model='IF97'}){
 if(key!=='latent'&&!SATURATION_INVERSE_KEYS.includes(key))throw Error('Невідома властивість насичення.');
 if(key!=='latent'&&!['liquid','vapor'].includes(phase))throw Error('Оберіть рідину або пару.');
 if(!Number.isFinite(value))throw Error('Значення має бути скінченним числом.');
 const {min,max}=saturationTemperatureRange(model),f=T=>satInvValue(model,T,key,phase)-value;
 const roots=[];let T0=min,f0=f(T0);
 if(f0===0)roots.push(T0);
 for(let i=1;i<=SAT_INV_SCAN;i++){
  // Denser sampling near the critical point, where properties change fastest.
  const T1=min+(max-min)*(1-(1-i/SAT_INV_SCAN)**2),f1=f(T1);
  if(f1===0)roots.push(T1);
  else if(f0*f1<0){let lo=T0,hi=T1,flo=f0;
   for(let k=0;k<100;k++){const mid=(lo+hi)/2,fm=f(mid);if(mid===lo||mid===hi||fm===0){lo=hi=mid;break;}if(flo*fm<0)hi=mid;else{lo=mid;flo=fm;}}
   roots.push((lo+hi)/2);}
  T0=T1;f0=f1;
 }
 if(!roots.length)throw Error('Це значення не досягається на лінії насичення в межах формуляції.');
 return roots.map(T=>({T,saturation:calculate('satt',T,undefined,model).saturation}));
}
