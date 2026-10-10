// Educational ideal moist-air model. IAPWS-95 saturation / liquid enthalpy,
// NASA7 integrated dry-air and water-vapour ideal-gas cp; not a virial humid-air EOS.
import {saturationT95} from './iapws95.js';
import {gasState,AIR} from './gases.js';
const HA_MIN=273.16, HA_MAX=373.15;
function haEnthalpy(T,W){const air=gasState(.101325,T,AIR),air0=gasState(.101325,HA_MIN,AIR),v=gasState(.101325,T,{H2O:1}),v0=gasState(.101325,HA_MIN,{H2O:1});const latent=saturationT95(HA_MIN).latentHeat;return air.h-air0.h+W*(latent+v.h-v0.h);}
function haRatio(T,p,rh){const pv=rh*saturationT95(T).p;if(pv>=p)throw Error('Парціальний тиск пари має бути нижчим за загальний тиск.');const ratio=gasState(.1,300,{H2O:1}).M/gasState(.1,300,AIR).M;return {pv,W:ratio*pv/(p-pv)};}
export function humidAir(p,T,rh){
 if(![p,T,rh].every(Number.isFinite)||p<.05||p>.2||T<HA_MIN||T>HA_MAX||rh<0||rh>1)throw Error('Вологе повітря: P=0,05…0,2 МПа, T=273,16…373,15 K, RH=0…1. Лід не моделюється.');
 const {pv,W}=haRatio(T,p,rh),h=haEnthalpy(T,W),a=gasState(p,T,AIR),v=a.R*T/(1000*(p-pv));
 let dew=null;if(pv>=saturationT95(HA_MIN).p){let lo=HA_MIN,hi=T;for(let i=0;i<55;i++){const m=(lo+hi)/2;if(saturationT95(m).p<pv)lo=m;else hi=m;}dew=(lo+hi)/2;}
 const wetError=t=>{const w=haRatio(t,p,1).W,liquid=saturationT95(t).liquid.h-saturationT95(HA_MIN).liquid.h;return haEnthalpy(t,w)-(w-W)*liquid-h;};
 let wet=null;if(wetError(HA_MIN)<=0){let lo=HA_MIN,hi=T;for(let i=0;i<50;i++){const m=(lo+hi)/2;if(wetError(m)>0)hi=m;else lo=m;}wet=(lo+hi)/2;}
 return {model:'Ідеальне вологе повітря · NASA7 + IAPWS-95',p,T,rh,pv,W,h,dew,wet,v,rho:(1+W)/v,cp:gasState(p,T,AIR).cp+W*gasState(p,T,{H2O:1}).cp,notes:['h, Cp та v віднесені до 1 кг сухого повітря; ρ — маса всієї суміші на об’єм.','Нуль ентальпії: сухе повітря і рідина при 273,16 K.','Ідеальна суміш без віріальних поправок. Точка роси / мокрого термометра нижче 273,16 K не наведена.']};
}
