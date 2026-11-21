// Steam-system engineering calculations: pipe sizing, condensate return lines,
// compressed-air lines, control valves (Kv/Cv) and orifices.
// Water/steam states come from the IF97 engine; air is an ideal gas (NASA7)
// with Sutherland viscosity. All pressures here are absolute, in MPa.
//
// Sources:
//  - Darcy–Weisbach / Colebrook–White: see flow.js (DOE-HDBK-1012/3-92).
//  - Control valves: IEC 60534-2-1:2011, eqs. (1), (6)/(7), expansion factor Y,
//    N1 = 0.1 (Kv, m3/h, bar), N6 = 27.3 (Kv, kg/h, bar, kg/m3), Cv = 1.156·Kv.
//  - Orifice plates: ISO 5167-2:2003 expansibility ε (eq. 5); discharge
//    coefficient is an input (no Reader-Harris/Gallagher correlation here).
//  - Critical (choked) flow of a perfect gas through a nozzle: standard
//    isentropic relation with κ evaluated at the inlet state.
//  - Air viscosity: Sutherland, μ0 = 1.716e-5 Pa·s at 273.15 K, S = 110.4 K.
import {calculate} from './engine.js';
import {darcyFactor} from './flow.js';
import {gasState,AIR} from './gases.js';

export const KV_TO_CV=1.156;
const BAR=0.1; // 1 bar = 0.1 MPa

// Pipe schedules. Outside diameter and wall thickness in mm.
// ASME B36.10M Sch 40 / Sch 80, JIS G3454 Sch 40, EN 10220 (DIN 2448) typical walls.
const inch=25.4;
const ANSI=[['1/2',.840,.109,.147],['3/4',1.050,.113,.154],['1',1.315,.133,.179],['1-1/4',1.660,.140,.191],['1-1/2',1.900,.145,.200],['2',2.375,.154,.218],['2-1/2',2.875,.203,.276],['3',3.500,.216,.300],['4',4.500,.237,.337],['5',5.563,.258,.375],['6',6.625,.280,.432],['8',8.625,.322,.500],['10',10.750,.365,.594],['12',12.750,.406,.688],['14',14.000,.438,.750],['16',16.000,.500,.844],['18',18.000,.562,.938],['20',20.000,.594,1.031],['24',24.000,.688,1.219]];
const JIS=[['15A',21.7,2.8],['20A',27.2,2.9],['25A',34.0,3.4],['32A',42.7,3.6],['40A',48.6,3.7],['50A',60.5,3.9],['65A',76.3,5.2],['80A',89.1,5.5],['100A',114.3,6.0],['125A',139.8,6.6],['150A',165.2,7.1],['200A',216.3,8.2],['250A',267.4,9.3],['300A',318.5,10.3]];
const DIN=[['DN15',21.3,2.0],['DN20',26.9,2.3],['DN25',33.7,2.6],['DN32',42.4,2.6],['DN40',48.3,2.6],['DN50',60.3,2.9],['DN65',76.1,2.9],['DN80',88.9,3.2],['DN100',114.3,3.6],['DN125',139.7,4.0],['DN150',168.3,4.5],['DN200',219.1,6.3],['DN250',273.0,6.3],['DN300',323.9,7.1]];
const row=(standard,name,od,wall)=>({standard,name,od,wall,id:+(od-2*wall).toFixed(3)});
export const PIPE_SCHEDULES={
 'ANSI-40':{label:'ASME B36.10M Sch 40',pipes:ANSI.map(([n,od,w])=>row('ANSI-40','NPS '+n,od*inch,w*inch))},
 'ANSI-80':{label:'ASME B36.10M Sch 80',pipes:ANSI.map(([n,od,,w])=>row('ANSI-80','NPS '+n,od*inch,w*inch))},
 'JIS-40':{label:'JIS G3454 Sch 40',pipes:JIS.map(([n,od,w])=>row('JIS-40',n,od,w))},
 'DIN':{label:'EN 10220 / DIN 2448',pipes:DIN.map(([n,od,w])=>row('DIN',n,od,w))}
};
// Typical design velocities, m/s. Practical guidance, not a standard.
export const RECOMMENDED_VELOCITY={
 'saturated-steam':{min:20,max:35},
 'superheated-steam':{min:30,max:50},
 'water':{min:1,max:3},
 'condensate-return':{min:10,max:15},
 'air':{min:6,max:10}
};

function positive(n,label){if(!Number.isFinite(n)||n<=0)throw Error(label+' має бути додатним скінченним числом.');return n;}
function nonNegative(n,label){if(!Number.isFinite(n)||n<0)throw Error(label+' має бути невід’ємним скінченним числом.');return n;}
function waterState(mode,a,b){const r=calculate(mode,a,b);if(!r.state||r.alternatives?.length)throw Error('Не вдалося однозначно визначити стан води/пари.');return r.state;}

export function airViscosity(T){positive(T,'Температура');return 1.716e-5*(T/273.15)**1.5*(273.15+110.4)/(T+110.4);}

// Fluid at the pipe inlet. kind: 'steam' (p + T, or p alone = dry saturated),
// 'wet-steam' (p + x), 'water' (p + T), 'air' (p + T).
export function pipeFluid({kind,p,T=null,x=null}){
 positive(p,'Абсолютний тиск');
 if(kind==='air'){positive(T,'Температура');const g=gasState(p,T,AIR);return {kind,p,T,rho:g.rho,mu:airViscosity(T),kappa:g.gamma,w:g.w,h:null,phase:'Повітря (ідеальний газ)'};}
 let s;
 if(kind==='steam')s=T==null?waterState('px',p,1):waterState('pt',p,positive(T,'Температура'));
 else if(kind==='wet-steam'){if(!Number.isFinite(x)||x<0||x>1)throw Error('Сухість має бути в межах 0…1.');s=waterState('px',p,x);}
 else if(kind==='water')s=waterState('pt',p,positive(T,'Температура'));
 else throw Error('Невідоме середовище трубопроводу.');
 if(kind==='steam'&&s.x==null&&s.region===1)throw Error('За цих P і T вода рідка. Оберіть «вода» або підвищте температуру.');
 if(kind==='water'&&s.region!==1)throw Error('За цих P і T середовище не є рідкою водою.');
 return {kind,p:s.p,T:s.T,h:s.h,rho:s.rho,mu:mixtureViscosity(s),kappa:s.isentropic??s.kappa??null,w:s.w??null,x:s.x,phase:s.phase,state:s};
}
// Homogeneous two-phase viscosity (McAdams: 1/μ = x/μg + (1−x)/μl) when the
// engine does not give one for a wet state.
function mixtureViscosity(s){
 if(Number.isFinite(s.mu)&&s.mu>0)return s.mu;
 if(s.x==null)throw Error('Для цього стану немає в’язкості.');
 const l=waterState('px',s.p,0),g=waterState('px',s.p,1);
 return 1/(s.x/g.mu+(1-s.x)/l.mu);
}

// Inner diameter needed for a target velocity, and the smallest standard pipe
// with velocity not above the target.
export function sizePipe({fluid,massFlow,velocity,schedule='DIN'}){
 positive(massFlow,'Масова витрата');positive(velocity,'Цільова швидкість');positive(fluid?.rho,'Густина');
 const table=PIPE_SCHEDULES[schedule];if(!table)throw Error('Невідомий сортамент труб.');
 const requiredId=Math.sqrt(4*massFlow/(Math.PI*fluid.rho*velocity));
 const pick=table.pipes.find(q=>q.id/1000>=requiredId)||null;
 return {requiredId,schedule,scheduleLabel:table.label,pipe:pick,
  velocity:pick?massFlow/(fluid.rho*Math.PI*(pick.id/1000)**2/4):null,
  notes:pick?[]:['Потрібен діаметр більший за найбільшу трубу сортаменту. Розгляньте кілька паралельних ліній.']};
}

// Velocity, Reynolds and pressure drop for a given pipe.
// Water/steam: adiabatic marching along the pipe at constant h (kinetic and
// potential energy changes neglected), density re-evaluated at each step, so
// compressibility of steam is included. Air: isothermal marching.
export function pipePressureDrop({fluid,massFlow,diameter,length,roughness=4.5e-5,localK=0,segments=50}){
 positive(massFlow,'Масова витрата');positive(diameter,'Внутрішній діаметр');nonNegative(length,'Довжина');nonNegative(roughness,'Шорсткість');nonNegative(localK,'Σζ');
 if(!Number.isInteger(segments)||segments<1||segments>2000)throw Error('Кількість ділянок має бути цілим 1…2000.');
 const area=Math.PI*diameter**2/4,G2=massFlow/area;
 const at=(p)=>{
  if(fluid.kind==='air')return {rho:fluid.rho*p/fluid.p,mu:fluid.mu};
  if(fluid.kind==='water')return {rho:fluid.rho,mu:fluid.mu};
  const s=waterState('ph',p,fluid.h);return {rho:s.rho,mu:mixtureViscosity(s),x:s.x,T:s.T};
 };
 let p=fluid.p,lossFriction=0,lossLocal=0,first=null,last=null;
 const step=(dp)=>{p-=dp/1e6;if(!(p>0))throw Error('Тиск падає до нуля: труба надто вузька для цієї витрати.');};
 // Local resistances are applied at the inlet velocity (conservative for steam lines
 // where velocity grows downstream). Friction is integrated along the length.
 const inlet=at(p),vin=G2/inlet.rho,Rein=vin*diameter/inlet.mu;first={velocity:vin,Re:Rein,rho:inlet.rho};
 if(localK>0){const dp=localK*inlet.rho*vin**2/2;lossLocal=dp;step(dp);}
 if(length>0){const dl=length/segments;
  for(let i=0;i<segments;i++){
   const q=at(p),v=G2/q.rho,Re=v*diameter/q.mu,f=darcyFactor(Re,roughness/diameter);
   if(f.method==='transition')throw Error('Перехідний режим (2300 ≤ Re < 4000): тертя не визначене однозначно.');
   const dp=f.factor*dl/diameter*q.rho*v**2/2;lossFriction+=dp;step(dp);
  }}
 const out=at(p);last={velocity:G2/out.rho,rho:out.rho,x:out.x??null,T:out.T??fluid.T};
 const loss=lossFriction+lossLocal,notes=[];
 if(fluid.kind!=='water'&&loss>0.1*fluid.p*1e6)notes.push('Втрата тиску понад 10 % від вхідного: результат чутливий до моделі стисливої течії, перевірте більшим діаметром.');
 if(fluid.w&&last.velocity>0.3*fluid.w)notes.push('Швидкість понад 0,3 Mach: шум і ерозія, звичайна інженерна практика радить збільшити діаметр.');
 if(out.x!=null&&fluid.x==null)notes.push('Пара стає вологою в кінці лінії (дроселювання без теплообміну).');
 return {area,velocity:first.velocity,Re:first.Re,outletVelocity:last.velocity,inletDensity:first.rho,outletDensity:last.rho,
  frictionPressure:lossFriction,localPressure:lossLocal,lossPressure:loss,outletPressure:p,outletTemperature:last.T,outletQuality:last.x,
  pressureGradient:length>0?lossFriction/length:null,notes};
}

// Condensate return line: saturated condensate at p1 discharged into a line at p2
// partly flashes. Homogeneous mixture density; returns flash fraction and the
// volumetric flow that sets line size.
export function condensateReturn({p1,p2,massFlow,subcooling=0}){
 positive(p1,'Тиск перед конденсатовідвідником');positive(p2,'Тиск у лінії повернення');positive(massFlow,'Витрата конденсату');nonNegative(subcooling,'Переохолодження');
 if(p2>=p1)throw Error('Тиск у лінії повернення має бути нижчим за тиск перед конденсатовідвідником.');
 const sat1=waterState('px',p1,0),inlet=subcooling>0?waterState('pt',p1,sat1.T-subcooling):sat1;
 const l2=waterState('px',p2,0),g2=waterState('px',p2,1);
 const flash=Math.max(0,(inlet.h-l2.h)/(g2.h-l2.h));
 const vmix=flash*g2.v+(1-flash)*l2.v,rho=1/vmix;
 return {flashFraction:flash,flashSteam:flash*massFlow,liquid:(1-flash)*massFlow,mixtureDensity:rho,volumeFlow:massFlow*vmix,
  steamVolumeFlow:flash*massFlow*g2.v,T2:l2.T,inlet,fluid:{kind:'wet-steam',p:p2,T:l2.T,h:inlet.h,rho,mu:1/(flash/g2.mu+(1-flash)/l2.mu),x:flash,phase:'Конденсат з пролітною парою'},
  notes:['Гомогенна модель суміші: пара й рідина рухаються з однаковою швидкістю. Для довгих ліній можливі снарядний режим і гідроудари.']};
}

// ---------------------------------------------------------------- Valves (IEC 60534-2-1)
// mode: 'flow' (Kv → flow), 'kv' (flow → Kv), 'dp' (flow + Kv → Δp).
// Liquids: Q[m3/h] = Kv·√(Δp[bar]/(ρ/ρ0)), ρ0 = 1000 kg/m3 (IEC 60534-2-1 eq. 1).
// Choked liquid flow: Δp_max = FL²·(p1 − FF·pv), FF = 0.96 − 0.28·√(pv/pc).
export function valveLiquid({mode,rho,p1,dp=null,kv=null,volumeFlow=null,FL=0.9,pv=null}){
 positive(rho,'Густина');positive(p1,'Тиск на вході');
 const rel=rho/1000,dpChoked=pv!=null&&FL>0?FL**2*(p1-(0.96-0.28*Math.sqrt(pv/22.064))*pv)/BAR:Infinity;
 const notes=[];
 const flowAt=(kvv,dpbar)=>kvv*Math.sqrt(Math.min(dpbar,dpChoked)/rel);
 let result;
 if(mode==='flow'){positive(kv,'Kv');positive(dp,'Перепад тиску');const d=dp/BAR;result={kv,dp,volumeFlow:flowAt(kv,d)/3600,choked:d>=dpChoked};}
 else if(mode==='kv'){positive(volumeFlow,'Об’ємна витрата');positive(dp,'Перепад тиску');const d=dp/BAR,Q=volumeFlow*3600;result={dp,volumeFlow,kv:Q/Math.sqrt(Math.min(d,dpChoked)/rel),choked:d>=dpChoked};}
 else if(mode==='dp'){positive(volumeFlow,'Об’ємна витрата');positive(kv,'Kv');const Q=volumeFlow*3600,d=rel*(Q/kv)**2;if(d>=dpChoked)throw Error('Задана витрата перевищує граничну витрату кавітаційного (запертого) режиму для цього Kv.');result={kv,volumeFlow,dp:d*BAR,choked:false};}
 else throw Error('Невідомий режим розрахунку клапана.');
 if(result.choked)notes.push('Запертий (кавітаційний) режим: витрата більше не росте з перепадом тиску.');
 if(Number.isFinite(dpChoked))result.dpChoked=dpChoked*BAR;
 return {...result,massFlow:result.volumeFlow*rho,cv:result.kv*KV_TO_CV,notes};
}

// Compressible (steam, gas): W[kg/h] = N6·Kv·Y·√(x·p1·ρ1), x = Δp/p1, Fγ = κ/1.4,
// Y = 1 − x/(3·Fγ·xT), choked at x = Fγ·xT (Y = 2/3).
export function valveGas({mode,p1,rho1,kappa,dp=null,kv=null,massFlow=null,xT=0.72}){
 positive(p1,'Тиск на вході');positive(rho1,'Густина на вході');positive(kappa,'Показник ізоентропи');positive(xT,'xT');
 if(xT>1)throw Error('xT має бути ≤ 1.');
 const N6=27.3,Fg=kappa/1.4,xChoked=Fg*xT,p1bar=p1/BAR;
 const W=(kvv,x)=>{const xe=Math.min(x,xChoked),Y=1-xe/(3*xChoked);return {W:N6*kvv*Y*Math.sqrt(xe*p1bar*rho1)/3600,Y,xe};};
 let r;
 if(mode==='flow'){positive(kv,'Kv');positive(dp,'Перепад тиску');if(dp>=p1)throw Error('Перепад тиску має бути меншим за тиск на вході.');const x=dp/p1,q=W(kv,x);r={kv,dp,massFlow:q.W,Y:q.Y,x,choked:x>=xChoked};}
 else if(mode==='kv'){positive(massFlow,'Масова витрата');positive(dp,'Перепад тиску');if(dp>=p1)throw Error('Перепад тиску має бути меншим за тиск на вході.');const x=dp/p1,q=W(1,x);r={dp,massFlow,kv:massFlow/q.W,Y:q.Y,x,choked:x>=xChoked};}
 else if(mode==='dp'){positive(massFlow,'Масова витрата');positive(kv,'Kv');
  if(massFlow>W(kv,xChoked).W*(1+1e-12))throw Error('Задана витрата перевищує граничну (критичну) витрату для цього Kv.');
  let lo=0,hi=xChoked;for(let i=0;i<200;i++){const m=(lo+hi)/2;if(W(kv,m).W<massFlow)lo=m;else hi=m;}
  const x=(lo+hi)/2,q=W(kv,x);r={kv,massFlow,dp:x*p1,Y:q.Y,x,choked:false};}
 else throw Error('Невідомий режим розрахунку клапана.');
 return {...r,xChoked,cv:r.kv*KV_TO_CV,notes:r.choked?['Критичний (запертий) режим: x ≥ Fγ·xT, витрата не зростає при зниженні тиску за клапаном.']:[]};
}

// Valve on water/steam/air: builds inlet properties and dispatches.
export function valve({fluid,mode,dp,kv,massFlow,xT=0.72,FL=0.9}){
 if(fluid.kind==='water'){
  const pv=waterState('tx',fluid.T,0).p;
  const r=valveLiquid({mode,rho:fluid.rho,p1:fluid.p,dp,kv,volumeFlow:massFlow!=null?massFlow/fluid.rho:null,FL,pv});
  return {...r,phase:'liquid'};
 }
 positive(fluid.kappa,'Показник ізоентропи');
 return {...valveGas({mode,p1:fluid.p,rho1:fluid.rho,kappa:fluid.kappa,dp,kv,massFlow,xT}),phase:'gas'};
}

// ---------------------------------------------------------------- Orifices
// Differential-pressure orifice (ISO 5167-2 form): qm = C/√(1−β⁴)·ε·(π/4)d²·√(2Δp·ρ1).
export function orificeFlow({fluid,d,D,dp,C=0.61}){
 positive(d,'Діаметр отвору');positive(D,'Діаметр труби');positive(dp,'Перепад тиску');positive(C,'Коефіцієнт витрати');
 const beta=d/D;if(beta>=1)throw Error('Діаметр отвору має бути меншим за діаметр труби.');
 if(dp>=fluid.p*1e6)throw Error('Перепад тиску має бути меншим за тиск на вході.');
 let eps=1;
 if(fluid.kind!=='water'){positive(fluid.kappa,'Показник ізоентропи');const tau=1-dp/(fluid.p*1e6);eps=1-(0.351+0.256*beta**4+0.93*beta**8)*(1-tau**(1/fluid.kappa));}
 const area=Math.PI*d**2/4,massFlow=C/Math.sqrt(1-beta**4)*eps*area*Math.sqrt(2*dp*fluid.rho);
 const notes=[];if(beta<0.1||beta>0.75)notes.push('β поза межами 0,1…0,75, рекомендованими ISO 5167-2.');
 if(fluid.kind!=='water'&&dp/(fluid.p*1e6)>0.25)notes.push('Δp/p1 > 0,25: формула ε з ISO 5167-2 застосовна при p2/p1 ≥ 0,75.');
 return {beta,epsilon:eps,area,massFlow,volumeFlow:massFlow/fluid.rho,notes};
}

// Free discharge of steam or gas through an orifice/nozzle into a lower pressure
// (leaks, vents, steam-trap failure): critical flow when p2/p1 ≤ critical ratio.
export function orificeDischarge({fluid,d,p2,C=0.61}){
 positive(d,'Діаметр отвору');positive(p2,'Тиск за отвором');positive(C,'Коефіцієнт витрати');
 if(fluid.kind==='water')throw Error('Витікання рідини розраховуйте як диференційну діафрагму.');
 positive(fluid.kappa,'Показник ізоентропи');if(p2>=fluid.p)throw Error('Тиск за отвором має бути нижчим за тиск на вході.');
 const k=fluid.kappa,p1=fluid.p*1e6,rcrit=(2/(k+1))**(k/(k-1)),ratio=p2*1e6/p1,area=Math.PI*d**2/4;
 const choked=ratio<=rcrit,r=Math.max(ratio,rcrit);
 const massFlow=C*area*Math.sqrt(2*k/(k-1)*p1*fluid.rho*(r**(2/k)-r**((k+1)/k)));
 return {criticalRatio:rcrit,pressureRatio:ratio,choked,area,massFlow,notes:[choked?'Критичне витікання: витрата не залежить від тиску за отвором.':'Докритичне витікання.','Модель ідеального газу з κ на вході; для вологої пари це наближення.']};
}

