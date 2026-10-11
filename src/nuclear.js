import {calculate} from './engine.js';
export const NPP_REFERENCE={url:'https://aris.iaea.org/Characteristics/',design:'VVER-1000 (V-466B)',accessed:'2026-10-11',thermalMW:3000,primaryP:15.7,coldC:291,hotC:321,steamP:6.27};
export const NPP_DEFAULT={thermalMW:3000,primaryP:15.7,coldC:291,hotC:321,steamP:6.27,condenserP:.005,etaT:.85,etaPump:.8};
export function nuclearCycle(input=NPP_DEFAULT,model='IF97'){
 const a={...NPP_DEFAULT,...input};if(!Object.values(a).every(Number.isFinite)||a.thermalMW<=0||a.primaryP<=a.steamP||a.steamP<=a.condenserP||a.condenserP<=0||a.hotC<=a.coldC||a.hotC>=373.946||a.etaT<=0||a.etaT>1||a.etaPump<=0||a.etaPump>1)throw Error('Неприпустимі параметри навчальної схеми АЕС.');
 const cold=calculate('pt',a.primaryP,a.coldC+273.15,model).state,hot=calculate('pt',a.primaryP,a.hotC+273.15,model).state;
 if(!cold||!hot||cold.x!=null||hot.x!=null||![cold,hot].every(s=>s.rho>322))throw Error('Перший контур має містити однофазну стиснену воду.');
 const condensate=calculate('px',a.condenserP,0,model).state,pumpIdeal=calculate('ps',a.steamP,condensate.s,model).state;
 const feed=calculate('ph',a.steamP,condensate.h+(pumpIdeal.h-condensate.h)/a.etaPump,model).state,steam=calculate('px',a.steamP,1,model).state;
 if(cold.T<=steam.T||steam.h<=feed.h)throw Error('Температури не забезпечують підведення тепла в парогенераторі.');
 const turbineIdeal=calculate('ps',a.condenserP,steam.s,model).state,exhaust=calculate('ph',a.condenserP,steam.h-a.etaT*(steam.h-turbineIdeal.h),model).state;
 const heatKW=a.thermalMW*1000,primaryFlow=heatKW/(hot.h-cold.h),secondaryFlow=heatKW/(steam.h-feed.h),turbineKW=secondaryFlow*(steam.h-exhaust.h),pumpKW=secondaryFlow*(feed.h-condensate.h),rejectedKW=secondaryFlow*(exhaust.h-condensate.h),netKW=turbineKW-pumpKW;
 if(!(primaryFlow>0&&secondaryFlow>0&&netKW>0&&rejectedKW>=0))throw Error('Параметри не утворюють фізичний тепловий цикл.');
 return {input:a,model,reference:NPP_REFERENCE,states:[cold,hot,feed,steam,exhaust,condensate].map((s,i)=>({...s,name:['P1','P2','S2','S3','S4','S1'][i]})),primaryFlow,secondaryFlow,heatKW,turbineKW,pumpKW,rejectedKW,netKW,efficiency:netKW/heatKW,steamGeneratorResidual:primaryFlow*(hot.h-cold.h)-secondaryFlow*(steam.h-feed.h),cycleResidual:heatKW+pumpKW-turbineKW-rejectedKW};
}
