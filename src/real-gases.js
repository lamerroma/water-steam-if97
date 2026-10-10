// Pure-fluid HEOS calculations, using the same local MIT CoolProp WASM as humid air.
import {getCoolPropBackend} from './humid-air-scientific.js';
export const REAL_GAS_FLUIDS={N2:'Nitrogen',O2:'Oxygen',CO2:'CarbonDioxide',CO:'CarbonMonoxide',H2:'Hydrogen',H2O:'Water',CH4:'Methane',Ar:'Argon',He:'Helium',SO2:'SulfurDioxide',Ne:'Neon'};
export function realGasState(id,p,value,mode='pt'){
 const name=REAL_GAS_FLUIDS[id];if(!name)throw Error('Для '+id+' модель реального газу не підключена. Оберіть NASA7 явно.');
 if(!['pt','ph','ps'].includes(mode)||!Number.isFinite(p)||p<=0||!Number.isFinite(value))throw Error('Потрібні додатний абсолютний тиск і скінченний другий параметр.');
 const cp=getCoolPropBackend(),fluid='HEOS::'+name;
 const valid=n=>Number.isFinite(n)&&Math.abs(n)<1e100;
 const constant=key=>{const n=cp.PropsSI(key,'',0,'',0,fluid);if(!valid(n))throw Error('Не вдалося прочитати межі моделі '+name);return n;};
 const min=constant('Tmin'),max=constant('Tmax'),pmax=constant('pmax')/1e6;
 if(p>pmax||mode==='pt'&&(value<min||value>max))throw Error(`Модель ${id}: T=${min}…${max} K; P≤${pmax} МПа. Екстраполяція заборонена.`);
 const key=mode==='pt'?'T':mode==='ph'?'Hmass':'Smass',input=mode==='pt'?value:value*1000;
 const get=(output,optional=false)=>{let n;try{n=cp.PropsSI(output,'P',p*1e6,key,input,fluid);}catch{}if(!valid(n)){if(optional)return null;throw Error('Не знайдено стан '+id+'. Перевірте входи; на лінії насичення P–T не визначає фазу однозначно.');}return n;};
 const T=get('T'),rho=get('Dmass');if(T<min||T>max||rho<=0)throw Error('Результат поза межами рівняння стану.');
 const h=get('Hmass')/1000,s=get('Smass')/1000;
 if(mode!=='pt'&&Math.abs((mode==='ph'?h:s)-value)>1e-6*Math.max(1,Math.abs(value)))throw Error('Обернений розрахунок не задовольняє заданий вхід.');
 const quality=get('Q',true),twoPhase=quality!=null&&quality>=0&&quality<=1;
 const c=twoPhase?null:get('Cpmass',true),v=twoPhase?null:get('Cvmass',true);
 const phase=twoPhase?'Двофазний стан':({0:'Рідина',1:'Надкритичний флюїд',2:'Надкритичний газ',3:'Надкритична рідина',4:'Критична точка',5:'Газ',6:'Двофазний стан',7:'Невизначено'})[get('Phase')]||'Невизначено';
 return {model:'CoolProp 8 · HEOS · '+name,p,T,M:constant('molar_mass')*1000,h,s,u:get('Umass')/1000,rho,v:1/rho,cp:c==null?null:c/1000,cv:v==null?null:v/1000,w:twoPhase?null:get('A',true),gamma:c!=null&&v>0?c/v:null,Z:get('Z',true),mu:twoPhase?null:get('VISCOSITY',true),lambda:twoPhase?null:get('CONDUCTIVITY',true),quality:twoPhase?quality:null,phase,composition:{[id]:1},limits:{min,max,pmax},notes:['Чиста речовина; фаза: '+phase+'.','h та s — у системі відліку цієї моделі CoolProp; значення NASA7 мають інший базис.','Теплоємності, звук і транспортні властивості двофазної суміші не наведено. Недоступні властивості позначено «—».']};
}
