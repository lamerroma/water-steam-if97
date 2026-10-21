import {calculate,PC,TC} from './engine.js';
function processSaturation(p,model){
 if(p>=PC)return {T:null,status:'no-saturation'};
 try{return {T:calculate('satp',p,undefined,model).saturation.T,status:'available'};}
 catch{return {T:null,status:'unavailable'};}
}
export function processSummary(type,r){
 return type==='turbine'?
  [['work',r.work,'kJ/kg'],['power',r.power,'kW'],['flow',r.flow,'kg/s'],['consumption',r.specificConsumption,'kg/(kW·h)'],['efficiency',r.eta,'fraction'],['inletTsat',r.inletTsat,'K'],['outletSuperheat',r.outletSuperheat,'K']]:
  [['flow',r.flow,'kg/s'],['vaporFlow',r.vaporFlow,'kg/s'],['liquidFlow',r.liquidFlow,'kg/s'],['vaporFraction',r.outlet.x,'fraction']];
}
export function processMetricReason(key,r){
 if(key==='inletTsat')return r.inletSaturationStatus==='no-saturation'?'За критичного або надкритичного тиску температура насичення не визначається.':'Температура насичення недоступна за цього тиску в обраній моделі.';
 if(key==='outletSuperheat')return r.outletSuperheatStatus==='compressed-liquid'?'Рідкий вихід: перегрів пари не визначається.':'Перегрів недоступний без температури насичення за вихідного тиску.';
 return 'Вихід однофазний; баланс сепарації на рідину й пару не застосовується.';
}
function processInput(p1,T1,p2,flow,model='IF97'){
 if(![p1,T1,p2,flow].every(Number.isFinite)||flow<0)throw Error('Введіть скінченні числа; витрата не може бути від’ємною.');
 if(p2<=0||p2>=p1)throw Error('Вихідний абсолютний тиск має бути додатним і нижчим за вхідний.');
 const inlet=calculate('pt',p1,T1,model).state;
 if(!inlet)throw Error('На вході потрібен однозначний однофазний стан; P–T на насиченні недостатньо.');
 return inlet;
}
export function turbine(p1,T1,p2,eta,flow=1,model='IF97'){
 if(!Number.isFinite(eta)||eta<=0||eta>1)throw Error('Ізоентропний ККД має бути в межах 0 < η ≤ 1.');
 const inlet=processInput(p1,T1,p2,flow,model),ideal=calculate('ps',p2,inlet.s,model).state;
 if(inlet.phase.includes('рідина')||inlet.h<=ideal.h)throw Error('Для парової турбіни задайте паровий стан на вході з додатним перепадом ентальпії.');
 const work=eta*(inlet.h-ideal.h),outlet=calculate('ph',p2,inlet.h-work,model).state;
 if(!(work>0)||!Number.isFinite(flow*work)||!Number.isFinite(3600/work))throw Error('Перепад ентальпії, потужність або питома витрата виходять за числові межі.');
 const sat1=processSaturation(p1,model),sat2=processSaturation(p2,model);
 const outletSuperheat=sat2.T==null?null:outlet.x!=null?0:outlet.T>=sat2.T?outlet.T-sat2.T:null;
 return {inlet,ideal,outlet,work,power:flow*work,eta,flow,specificConsumption:3600/work,inletTsat:sat1.T,outletTsat:sat2.T,outletSuperheat,inletSaturationStatus:sat1.status,outletSuperheatStatus:sat2.T==null?sat2.status:outletSuperheat==null?'compressed-liquid':outlet.x!=null?'saturated':'available'};
}
export function flash(p1,T1,p2,flow=1,saturated=0,model='IF97'){
 if(![0,1,2].includes(saturated))throw Error('Невірний режим конденсату.');
 if(![p1,p2,flow].every(Number.isFinite)||flow<0||p2<=0||p2>=p1)throw Error('Перевірте тиски й витрату.');
 const inlet=saturated===1?calculate('px',p1,0,model).state:processInput(p1,T1,p2,flow,model);
 if(saturated===1&&inlet.critical)throw Error('У критичній точці немає окремої насиченої рідини.');
 if(saturated===2&&(inlet.T>=TC||!inlet.phase.includes('рідина')))throw Error('Для недогрітого конденсату потрібна однофазна стиснена рідина на вході.');
 const result=calculate('ph',p2,inlet.h,model),outlet=result.state;
 const x=outlet.x;
 return {inlet,outlet,flow,inletMode:['single-phase','saturated','condensate'][saturated],vaporFlow:x==null?null:flow*x,liquidFlow:x==null?null:flow*(1-x),saturation:result.saturation};
}
export function turbineInverse(mode,p1,T1,p2,power,known,model='IF97'){
 if(!['flow','efficiency'].includes(mode)||!Number.isFinite(power)||power<=0||!Number.isFinite(known)||known<=0)throw Error('Для зворотного розрахунку потужність і відомий параметр мають бути додатними.');
 if(mode==='flow'){const unit=turbine(p1,T1,p2,known,1,model);return turbine(p1,T1,p2,known,power/unit.work,model);}
 const ideal=turbine(p1,T1,p2,1,known,model);const eta=power/ideal.power;return turbine(p1,T1,p2,eta,known,model);
}
// Native units: MPa absolute, K, kg/s, kW; efficiency is a fraction.
// The same kernels serve the standalone UI through a cancellable Worker.
export function steamProcess(input,model='IF97'){
 if(!input||typeof input!=='object')throw Error('Не задано входи процесу.');
 const {kind,mode,p1,T1,p2,eta,flow,power}=input;
 if(kind==='turbine'){
  if(mode==='power')return turbine(p1,T1,p2,eta,flow,model);
  if(['flow','efficiency'].includes(mode))return turbineInverse(mode,p1,T1,p2,power,mode==='flow'?eta:flow,model);
 }else if(kind==='flash'&&['condensate','saturated','subcooled'].includes(mode)){
  return flash(p1,T1,p2,flow,mode==='saturated'?1:mode==='condensate'?2:0,model);
 }
 throw Error('Невірний тип або режим процесу.');
}
// Every sample is evaluated by the selected model. Renderers join samples without spline overshoot.
export function diagramData(model='IF97'){
 const dome=[[],[]],isobars=[];
 for(let i=0;i<=180;i++){
  const T=(model==='IF97'?273.15:273.16)+((model==='IF97'?TC:TC-.0001)-(model==='IF97'?273.15:273.16))*Math.sin(i/180*Math.PI/2);
  try{const q=calculate('satt',T,undefined,model).saturation;dome[0].push(q.liquid);dome[1].push(q.vapor);}catch{dome[0].push(null);dome[1].push(null);}
 }
 for(const p of [.01,.1,1,10,22.064,50,100]){
  // Sort parameter records, not states: failed evaluations must retain their
  // temperature position and break the line instead of being moved to its start.
  const samples=[];
  for(let i=0;i<=100;i++){const T=(model==='IF97'?273.15:273.16)+(1073.15-(model==='IF97'?273.15:273.16))*i/100;let q=null;try{q=calculate('pt',p,T,model).state||null;}catch{}samples.push({T,q});}
  if(p<PC){const sat=calculate('satp',p,undefined,model).saturation;for(let i=0;i<=10;i++)samples.push({T:sat.T,order:i,q:calculate('px',p,i/10,model).state});}
  // IF97 supplies an exact critical state. Without this anchor the adaptive
  // sampler hits its depth limit and draws a chord past the critical marker.
  // IAPWS-95 intentionally does not evaluate the singular critical state.
  if(p===PC&&model==='IF97')samples.push({T:TC,q:calculate('pt',PC,TC,model).state});
  samples.sort((a,b)=>a.T-b.T||(a.order??0)-(b.order??0));
  const points=samples.map(sample=>sample.q);
  isobars.push({p,points});
 }
 return {dome,isobars};
}

export function throttle(p1,x,p2,model='IF97'){
 if(!Number.isFinite(p1)||!Number.isFinite(p2)||!Number.isFinite(x)||p2<=0||p2>=p1||x<0||x>1)throw Error('Потрібні 0 < P₂ < P₁ і сухість 0…1.');
 const inlet=calculate('px',p1,x,model).state,outlet=calculate('ph',p2,inlet.h,model).state;
 return {inlet,outlet};
}
