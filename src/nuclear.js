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

export const NPP_MSR_DEFAULT={...NPP_DEFAULT,mode:'msr',pMid:.7,reheatC:250,etaLP:.85};
export function nuclearMSR(input=NPP_MSR_DEFAULT,model='IF97'){
 const a={...NPP_MSR_DEFAULT,...input};
 const simple=nuclearCycle(Object.fromEntries(Object.keys(NPP_DEFAULT).map(k=>[k,a[k]])),model);
 if(![a.pMid,a.reheatC,a.etaLP].every(Number.isFinite)||!(a.steamP>a.pMid&&a.pMid>a.condenserP)||a.etaLP<=0||a.etaLP>1)throw Error('Потрібні Pпари > Pсепаратора > Pконденсатора та 0 < ККД ЦНТ ≤ 1.');
 const [cold,hot,feed,steam,,condensate]=simple.states;
 const hpIdeal=calculate('ps',a.pMid,steam.s,model).state,hp=calculate('ph',a.pMid,steam.h-a.etaT*(steam.h-hpIdeal.h),model).state;
 if(!(hp.x>0&&hp.x<1))throw Error('На вході сепаратора потрібна волога пара (0 < x < 1).');
 const dry=calculate('px',a.pMid,1,model).state,drain=calculate('px',a.pMid,0,model).state,heatingDrain=calculate('px',a.steamP,0,model).state;
 if(!(a.reheatC+273.15>dry.T&&a.reheatC+273.15<steam.T))throw Error('Температура перегріву має бути між насиченням сепаратора та гріючої пари.');
 const reheat=calculate('pt',a.pMid,a.reheatC+273.15,model).state,lpIdeal=calculate('ps',a.condenserP,reheat.s,model).state,lp=calculate('ph',a.condenserP,reheat.h-a.etaLP*(reheat.h-lpIdeal.h),model).state;
 const qR=reheat.h-dry.h,qHeating=steam.h-heatingDrain.h,beta=hp.x*qR/(qHeating+hp.x*qR),m=simple.secondaryFlow,hpFlow=m*(1-beta),lpFlow=hpFlow*hp.x,separatorDrainFlow=hpFlow*(1-hp.x),heatingFlow=m*beta;
 const hpKW=hpFlow*(steam.h-hp.h),lpKW=lpFlow*(reheat.h-lp.h),turbineKW=hpKW+lpKW,pumpKW=simple.pumpKW,reheatKW=lpFlow*qR;
 const rejectedKW=lpFlow*(lp.h-condensate.h)+separatorDrainFlow*(drain.h-condensate.h)+heatingFlow*(heatingDrain.h-condensate.h),netKW=turbineKW-pumpKW;
 if(!(netKW>0&&rejectedKW>0&&beta>0&&beta<1))throw Error('Параметри не утворюють цикл із сепарацією та перегрівом.');
 const drainLow=calculate('ph',a.condenserP,drain.h,model).state,heatingDrainLow=calculate('ph',a.condenserP,heatingDrain.h,model).state;
 return {...simple,input:a,mode:'msr',states:[cold,hot,condensate,feed,steam,hp,dry,reheat,lp,drain,heatingDrain,drainLow,heatingDrainLow].map((s,i)=>({...s,name:['P1','P2','S1','S2','S3','H1','H2','R1','L1','D1','D2','D3','D4'][i]})),edges:[[0,1],[1,0],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,2],[5,9],[9,11],[11,2],[4,10],[10,12],[12,2]],beta,hpFlow,lpFlow,separatorDrainFlow,heatingFlow,hpKW,lpKW,reheatKW,turbineKW,pumpKW,rejectedKW,netKW,efficiency:netKW/simple.heatKW,massResidual:m-lpFlow-separatorDrainFlow-heatingFlow,separatorResidual:hpFlow*hp.h-lpFlow*dry.h-separatorDrainFlow*drain.h,reheatResidual:heatingFlow*qHeating-reheatKW,cycleResidual:simple.heatKW+pumpKW-turbineKW-rejectedKW};
}
export function solveNuclear(input,model='IF97'){return input?.mode==='msr'?nuclearMSR(input,model):nuclearCycle(Object.fromEntries(Object.keys(NPP_DEFAULT).map(k=>[k,input?.[k]??NPP_DEFAULT[k]])),model);}
