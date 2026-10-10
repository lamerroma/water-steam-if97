import init, {initSync,pt,px,hs} from '../vendor/seuif97.js';
import {gibbs,helmholtz,TC,PC,RHOC,PMIN_SAT,saturationPressure,saturationTemperature,boundary23Pressure,boundary23Temperature} from './equations.js';
import {viscosity,conductivity,surfaceTension} from './transport.js';
export {TC,PC,PMIN_SAT,saturationPressure,saturationTemperature,boundary23Pressure};
export async function initialize(bytes) { if(bytes)initSync({module:bytes});else await init(); }
function finite(n,name) {if(!Number.isFinite(n))throw Error(`${name}: введіть скінченне число.`);}
function pressure(p) {finite(p,'Тиск');if(p<=0||p>100)throw Error('Тиск має бути більшим за 0 і не перевищувати 100 МПа. Використовуйте абсолютний тиск.');}
export function regionPT(p,T) {
  pressure(p);finite(T,'Температура');
  if(T<273.15||T>2273.15)throw Error('Температура має бути від 273,15 до 2273,15 K (0…2000 °C).');
  if(T>1073.15) {if(p>50)throw Error('Для температур понад 1073,15 K тиск не може перевищувати 50 МПа.');return 5;}
  if(T<=623.15)return p>=saturationPressure(T)?1:2;
  if(T<=863.15 && p>boundary23Pressure(T))return 3;
  return 2;
}
function critical(p,T) {return Math.abs(p-PC)<1e-10 && Math.abs(T-TC)<2e-9;}
// Official v(p,T) backward equation supplies only an initial guess; Newton solves Eq. 28.
function densityState(p,T,guess,side) {
  if(critical(p,T))return {...helmholtz(TC,RHOC),p:PC,T:TC,cp:null,drhodp:null,critical:true};
  let rho=guess;
  for(let k=0;k<60;k++) {
    const state=helmholtz(T,rho),err=state.p-p;
    if(Math.abs(err)<Math.max(2e-12,Math.abs(p)*2e-13) && state.drhodp>0)return {...state,p};
    const step=err*state.drhodp;
    let accepted=false;
    for(let damping=1;damping>=2**-24;damping/=2) {
      const next=rho-step*damping;
      if(next<=0||next>1300 || (T<TC&&side==='liquid'&&next<RHOC) || (T<TC&&side==='vapor'&&next>RHOC))continue;
      const ns=helmholtz(T,next);
      if(ns.drhodp>0&&Math.abs(ns.p-p)<Math.abs(err)) {rho=next;accepted=true;break;}
    }
    if(!accepted)break;
  }
  const state=helmholtz(T,rho);
  if(state.drhodp>0&&Math.abs(state.p-p)<1e-9)return {...state,p};
  throw Error('Не вдалося збігтися до стабільного кореня області 3. Стан надто близький до критичної точки або межі; змініть вхідні дані.');
}
function basePT(p,T) {
  const region=regionPT(p,T);
  if(region!==3)return gibbs(p,T,region);
  const side=T<TC?(p>=saturationPressure(T)?'liquid':'vapor'):undefined;
  return densityState(p,T,pt(p,T-273.15,2),side);
}
function finish(state,phase,x=null) {
  for(const key of ['p','T','rho','v','h','s','u','cv','w'])if(!Number.isFinite(state[key]))throw Error('Стан перевищує числові можливості обчислення; перевірте порядок величин тиску і температури.');
  if(!state.critical && (!Number.isFinite(state.cp)||state.cp<=0))throw Error('Нестабільна похідна поблизу критичної точки; змініть вхідні дані.');
  const notes=[];
  let mu=null,lambda=null;
  if(state.critical) notes.push('Критична точка: Cp і теплопровідність мають сингулярність; числові значення не наведено. Ступінь сухості не визначений.');
  if(TC-1e-3<state.T&&state.T<TC+1e-3 && Math.abs(state.p-PC)<0.01&&!state.critical)notes.push('Дуже близько до критичної точки похідні IF97 чисельно чутливі.');
  if(state.T<=1173.15 && state.cp!==null) {mu=viscosity(state.T,state.rho);lambda=conductivity(state);}
  else if(state.critical)mu=viscosity(state.T,state.rho);
  else notes.push('В’язкість і теплопровідність не наведено: T > 1173,15 K, поза реалізованим діапазоном транспортних формуляцій.');
  if(state.T<273.16 && state.p<0.000611657)notes.push('Діапазон 273,15–273,16 K: рівняння IF97 може описувати метастабільну рідину/пару відносно льоду; лід не моделюється.');
  const kappa=state.drhodp==null?null:state.drhodp/state.rho;
  const derivatives=state.critical?{alpha:null,kappa:null,dvdt:null,dvdp:null,dpdt:null,dpdv:null,jt:null,ijt:null}: {
    alpha:state.alpha,kappa,dvdt:state.v*state.alpha,dvdp:-state.v*kappa,dpdt:state.alpha/kappa,dpdv:-1/(state.v*kappa),
    jt:1000*state.v*(state.T*state.alpha-1)/state.cp,ijt:1000*state.v*(1-state.T*state.alpha)};
  return {...state,...derivatives,phase,x,mu,lambda,notes,A:state.u-state.T*state.s,G:state.h-state.T*state.s,Z:1000*state.p*state.v/0.461526/state.T,
    isentropic:state.w**2*state.rho/(state.p*1e6),nu:mu==null?null:mu/state.rho,diffusivity:lambda==null?null:lambda/(state.rho*state.cp*1000),Pr:mu==null||lambda==null?null:mu*state.cp*1000/lambda,
    sigma:x===0||x===1||state.critical?surfaceTension(state.T):null};
}
export function saturation(p) {
  const T=saturationTemperature(p);
  if(p===PC) {const c=finish({...helmholtz(TC,RHOC),p:PC,cp:null,drhodp:null,critical:true},'Критична точка');return {p,T,liquid:c,vapor:{...c},latentHeat:0,critical:true};}
  const liquid=T<=623.15?gibbs(p,T,1):densityState(p,T,px(p,0,2),'liquid');
  const vapor=T<=623.15?gibbs(p,T,2):densityState(p,T,px(p,1,2),'vapor');
  return {p,T,liquid:finish(liquid,'Насичена рідина',0),vapor:finish(vapor,'Насичена пара',1),latentHeat:vapor.h-liquid.h};
}
function mix(sat,x) {
  const a=sat.liquid,b=sat.vapor;
  if(x===0)return {...a,region:4};if(x===1)return {...b,region:4};
  const blend=k=>a[k]+x*(b[k]-a[k]);
  const v=blend('v');
  return {p:sat.p,T:sat.T,region:4,phase:'Двофазна суміш',x,v,rho:1/v,h:blend('h'),s:blend('s'),u:blend('u'),cp:null,cv:null,w:null,mu:null,lambda:null,
    A:blend('u')-sat.T*blend('s'),G:blend('h')-sat.T*blend('s'),Z:1000*sat.p*v/0.461526/sat.T,sigma:surfaceTension(sat.T),alpha:null,kappa:null,dvdt:null,dvdp:null,dpdt:null,dpdv:null,jt:null,ijt:null,isentropic:null,nu:null,diffusivity:null,Pr:null,
    notes:['Cp, Cv, швидкість звуку, в’язкість і теплопровідність суміші не визначаються однозначно цим станом; значення фаз наведено окремо.']};
}
export function solvePT(p,T) {
  regionPT(p,T);
  if(critical(p,T))return {state:finish(basePT(p,T),'Критична точка')};
  if(T<=TC) {
    const ps=saturationPressure(T);
    if(Math.abs(p-ps)<=Math.max(1e-12,ps*1e-10))return {saturation:saturation(Math.min(PC,Math.max(PMIN_SAT,p))),ambiguous:true};
  }
  const s=basePT(p,T);
  const phase=s.region===1?'Стиснена рідина':s.region===2||s.region===5?'Перегріта пара':T>=TC&&p>=PC?'Надкритичний флюїд':T<TC&&p>saturationPressure(T)?'Густа рідина':'Густий флюїд / пара';
  return {state:finish(s,phase)};
}
export function solveInverse(p,target,key,tolerance) {
  pressure(p);finite(target,key==='h'?'Ентальпія':'Ентропія');
  if(!['h','s'].includes(key))throw Error('Невідомий режим інверсії.');
  let sat;
  if(p>=PMIN_SAT&&p<PC) {
    sat=saturation(p);const a=sat.liquid[key],b=sat.vapor[key];
    if(target>=a&&target<=b)return {state:mix(sat,(target-a)/(b-a)),saturation:sat};
  }
  if(p===PC) {
    const c=finish({...helmholtz(TC,RHOC),p,cp:null,drhodp:null,critical:true},'Критична точка');
    if(Math.abs(target-c[key])<1e-8)return {state:c};
  }
  // Separate fundamental regions: do not interpolate across IF97 consistency gaps.
  const maxT=p<=50?2273.15:1073.15;
  let cuts=[273.15,623.15,1073.15,maxT];
  if(p>boundary23Pressure(623.15))cuts.push(boundary23Temperature(p));
  if(sat)cuts.push(sat.T);
  if(p===PC)cuts.push(TC);
  cuts=[...new Set(cuts.filter(t=>t>=273.15&&t<=maxT))].sort((a,b)=>a-b);
  const candidates=[];
  for(let i=0;i<cuts.length-1;i++) {
    let lo=cuts[i],hi=cuts[i+1];if(hi===lo)continue;
    const region=regionPT(p,(lo+hi)/2);
    const evaluate=T=>region===3?densityState(p,T,pt(p,T-273.15,2),T<TC?(p>=saturationPressure(T)?'liquid':'vapor'):undefined):gibbs(p,T,region);
    const endpoint=T=>sat&&Math.abs(T-sat.T)<1e-9?(T===lo?sat.vapor:sat.liquid):evaluate(T);
    const a=endpoint(lo),b=endpoint(hi);
    if(target<a[key]-1e-9||target>b[key]+1e-9)continue;
    let answer;
    if(Math.abs(target-a[key])<1e-9)answer=a;
    else if(Math.abs(target-b[key])<1e-9)answer=b;
    else for(let k=0;k<90;k++) {
      const mid=(lo+hi)/2,m=evaluate(mid);
      if(Math.abs(m[key]-target)<(tolerance??(key==='h'?2e-8:2e-11))){answer=m;break;}
      if(m[key]<target)lo=mid;else hi=mid;
    }
    if(!answer)throw Error('Інверсія не збіглася поблизу межі областей.');
    const phase=region===1?'Стиснена рідина':region===2||region===5?'Перегріта пара':answer.T>=TC&&p>=PC?'Надкритичний флюїд':'Густий флюїд / пара';
    if(!candidates.some(c=>Math.abs(c.T-answer.T)<1e-7))candidates.push(finish(answer,answer.phase||phase));
  }
  if(candidates.length) {
    const state=candidates[0];
    if(candidates.length>1)state.notes.push('На межі рівнянь IF97 є мале перекриття: можливі кілька коренів. Показано корінь з нижчою температурою. Інші: '+candidates.slice(1).map(c=>c.T.toPrecision(10)+' K (область '+c.region+')').join('; ')+'.');
    return {state,alternatives:candidates.slice(1)};
  }
  const min=basePT(p,273.15)[key],max=basePT(p,maxT)[key];
  throw Error(`Значення поза допустимим діапазоном або в малому розриві на межі рівнянь IF97. Для цього тиску: ${min.toPrecision(8)}…${max.toPrecision(8)} ${key==='h'?'кДж/кг':'кДж/(кг·K)'}.`);
}
export function solveQuality(p,x) {
 finite(x,'Сухість');if(x<0||x>1)throw Error('Ступінь сухості x має бути від 0 до 1 (0…100 %).');
 const sat=saturation(p);
 if(sat.critical)throw Error('У критичній точці ступінь сухості не визначений. Використайте P–T або насичення без x.');
 return {state:mix(sat,x),saturation:sat};
}
// At fixed h, ds/dp = -1000*v/T (MPa, kJ/kg). The vendored backward
// equation supplies a seed only; all accepted states satisfy fundamental IF97.
export function solveHS(h,s) {
 finite(h,'Ентальпія');finite(s,'Ентропія');
 const evaluate=p=>solveInverse(p,h,'h',1e-10);
 const valid=r=>Math.abs(r.state.h-h)<1e-6&&Math.abs(r.state.s-s)<2e-11;
 const finalize=result=>{const state=result.state;if(state.x===null&&state.p>=PMIN_SAT&&state.p<PC){const sat=saturation(state.p);for(const endpoint of [sat.liquid,sat.vapor])if(Math.abs(endpoint.h-h)<1e-6&&Math.abs(endpoint.s-s)<2e-9)return {state:mix(sat,endpoint.x),saturation:sat};}return result;};
 let seed;try{seed=hs(h,s,0);}catch{}
 if(Number.isFinite(seed)&&seed>0&&seed<=100){
  let p=seed;
  for(let k=0;k<25;k++){
   let result;try{result=evaluate(p);}catch{break;}
   if(valid(result))return finalize(result);
   const state=result.state,err=state.s-s;
   const step=Math.max(-2,Math.min(2,err/(-1000*p*state.v/state.T)));
   let accepted=false;
   for(let d=1;d>=1/256;d/=2){const next=p*Math.exp(-step*d);if(next<=0||next>100)continue;
    try{const nr=evaluate(next);if(Math.abs(nr.state.s-s)<Math.abs(err)){p=next;accepted=true;break;}}catch{}
   }
   if(!accepted)break;
  }
 }
 // A bounded pressure scan also covers region 5, absent from many hs backward equations.
 const pressures=[PMIN_SAT,PC,50,100];
 for(let k=0;k<=180;k++)pressures.push(10**(-12+k*14/180));
 if(Number.isFinite(seed)&&seed>0&&seed<=100)pressures.push(seed);
 pressures.sort((a,b)=>a-b);let previous=null;
 for(const p of pressures){
  let result;try{result=evaluate(p);}catch{previous=null;continue;}
  if(valid(result))return finalize(result);
  const error=result.state.s-s;
  if(previous&&previous.error*error<0){
   let lo=previous.p,hi=p,elo=previous.error;
   for(let j=0;j<85;j++){
    const mid=Math.sqrt(lo*hi);let r;try{r=evaluate(mid);}catch{break;}
    if(valid(r))return finalize(r);
    const e=r.state.s-s;if(e*elo>0){lo=mid;elo=e;}else hi=mid;
   }
  }
  previous={p,error};
 }
 throw Error('Не знайдено узгоджений стан h–s у межах IF97. Перевірте одиниці та значення; біля меж областей можливий малий розрив рівнянь. Для дуже низьких тисків використайте P–h/P–s.');
}
export function calculate(mode,a,b) {
  switch(mode) {
    case 'pt':return solvePT(a,b);
    case 'ph':return solveInverse(a,b,'h');
    case 'ps':return solveInverse(a,b,'s');
    case 'px':return solveQuality(a,b);
    case 'tx':return solveQuality(saturationPressure(a),b);
    case 'hs':return solveHS(a,b);
    case 'satp':return {saturation:saturation(a)};
    case 'satt':return {saturation:saturation(saturationPressure(a))};
    default:throw Error('Невідомий режим розрахунку.');
  }
}
