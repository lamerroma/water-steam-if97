// Continuity and Reynolds number for a single-phase Newtonian fluid in a round pipe.
// NASA Glenn: https://www.grc.nasa.gov/WWW/K-12/airplane/reynolds.html
export const FLOW_UNITS={mass:{kgs:1,kgh:1/3600,lbs:.45359237,lbh:.45359237/3600},volume:{m3s:1,m3h:1/3600,ls:.001,lmin:.001/60,ft3min:.3048**3/60},velocity:{ms:1,fts:.3048},diameter:{m:1,mm:.001,inch:.0254},length:{m:1,ft:.3048},pressureDrop:{Pa:1,kPa:1000,MPa:1e6,bar:1e5,psi:6894.757293168},density:{kgm3:1,lbft3:.45359237/.3048**3},dynamic:{Pas:1,mPas:.001,cP:.001},kinematic:{m2s:1,mm2s:1e-6,cSt:1e-6}};
export function flowToSI(value,kind,unit){const f=FLOW_UNITS[kind]?.[unit];if(!Number.isFinite(value)||f==null)throw Error('Некоректне число або одиниця потоку.');return value*f;}
export function flowFromSI(value,kind,unit){const f=FLOW_UNITS[kind]?.[unit];if(f==null)throw Error('Невідома одиниця потоку.');return value/f;}
function positive(n,label){if(!Number.isFinite(n)||n<=0)throw Error(label+' має бути додатним скінченним числом.');return n;}
export function gasDensity({p,T,M,Z=1}){positive(p,'Абсолютний тиск');positive(T,'Температура K');positive(M,'Молярна маса');positive(Z,'Коефіцієнт Z');const rho=p*1e6*(M/1000)/(Z*8.31446261815324*T);positive(rho,'Обчислена густина газу');return rho;}
export function pipeFlow({kind,value,diameter,rho,viscosity,viscosityKind='dynamic',standardDensity=null,soundSpeed=null}){
 if(!['mass','volume','velocity','standard'].includes(kind)||!['dynamic','kinematic'].includes(viscosityKind))throw Error('Невідомий режим потоку або в’язкості.');
 positive(diameter,'Внутрішній діаметр');positive(rho,'Густина');positive(viscosity,'В’язкість');
 if(!Number.isFinite(value)||value<0)throw Error('Витрата або швидкість має бути невід’ємною.');
 if(standardDensity!=null)positive(standardDensity,'Густина за стандартних умов');
 if(kind==='standard'&&standardDensity==null)throw Error('Задайте стандартні умови газу.');
 const area=Math.PI*diameter**2/4,mu=viscosityKind==='dynamic'?viscosity:viscosity*rho,nu=mu/rho;
 const mass=kind==='mass'?value:kind==='volume'?value*rho:kind==='standard'?value*standardDensity:value*area*rho;
 const volume=mass/rho,velocity=volume/area,Re=velocity*diameter/nu;
 const standardVolume=standardDensity==null?null:mass/standardDensity;
 const Mach=soundSpeed!=null&&soundSpeed>0?velocity/soundSpeed:null;
 const values={area,mu,nu,mass,volume,velocity,Re,standardVolume,Mach};
 if(Object.values(values).some(v=>v!=null&&!Number.isFinite(v)))throw Error('Переповнення розрахунку потоку. Перевірте масштаби величин.');
 return {...values,rho,diameter,regime:Re===0?'Немає течії':Re<2300?'Ламінарний':Re<4000?'Перехідний':'Турбулентний',notes:['Re = ρ·w·D/μ = w·D/ν; D — внутрішній діаметр круглої труби.','Класифікація режиму орієнтовна для однофазної течії ньютонівської рідини в круглій трубі. Перепад тиску й тертя не розраховуються.',...(Mach!=null&&Mach>=.3?['Mach ≥ 0,3: стисливість потоку може бути істотною. Це локальний перерахунок витрати, а не розрахунок стисливої течії.']:[])]};
}

// Darcy–Weisbach / Colebrook–White. Steady, fully developed, single-phase
// incompressible Newtonian flow; all loss coefficients refer to this pipe velocity.
// DOE-HDBK-1012/3-92, head loss. Darcy f = 4 * Fanning f.
export function darcyFactor(Re,relativeRoughness=0){
 if(!Number.isFinite(Re)||Re<0||!Number.isFinite(relativeRoughness)||relativeRoughness<0||relativeRoughness>.05)throw Error('Потрібні Re ≥ 0 та 0 ≤ ε/D ≤ 0,05.');
 if(Re===0)return {factor:null,method:'zero'};
 if(Re<2300)return {factor:64/Re,method:'laminar'};
 if(Re<4000)return {factor:null,method:'transition'};
 // Solve for y = 1/sqrt(f) by monotonic bisection, not an explicit approximation.
 const residual=y=>y+2*Math.log10(relativeRoughness/3.7+2.51*y/Re);
 let lo=1e-8,hi=1000;if(residual(lo)>=0||residual(hi)<=0)throw Error('Не вдалося обмежити корінь Colebrook–White.');
 for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(residual(mid)>0)hi=mid;else lo=mid;}
 const y=(lo+hi)/2;return {factor:1/y**2,method:'colebrook'};
}
export function pipeHydraulics(flow,{length,roughness=0,localK=0,efficiency=.75,heightDifference=0,pressureDifference=0}){
 for(const [v,label] of [[length,'Довжина'],[roughness,'Шорсткість'],[localK,'Σζ']])if(!Number.isFinite(v)||v<0)throw Error(label+' має бути невід’ємним скінченним числом.');
 if(!Number.isFinite(efficiency)||efficiency<=0||efficiency>1)throw Error('ККД насоса має бути > 0 та ≤ 100%.');
 if(!Number.isFinite(heightDifference)||!Number.isFinite(pressureDifference))throw Error('Різниці висоти й тиску мають бути скінченними.');
 for(const [v,label] of [[flow.rho,'Густина'],[flow.diameter,'Діаметр'],[flow.mu,'В’язкість']])positive(v,label);
 if(!Number.isFinite(flow.velocity)||flow.velocity<0||!Number.isFinite(flow.volume)||flow.volume<0)throw Error('Некоректний потік для гідравліки.');
 const relativeRoughness=roughness/flow.diameter,{factor,method}=darcyFactor(flow.Re,relativeRoughness),g=9.80665;
 const dynamicPressure=flow.rho*flow.velocity**2/2,localPressure=localK*dynamicPressure;
 const frictionPressure=length===0||flow.velocity===0?0:method==='transition'?null:method==='laminar'?32*flow.mu*length*flow.velocity/flow.diameter**2:factor*length/flow.diameter*dynamicPressure;
 const lossPressure=frictionPressure==null?null:frictionPressure+localPressure,lossHead=lossPressure==null?null:lossPressure/(flow.rho*g);
 const requiredHead=lossHead==null?null:lossHead+heightDifference+pressureDifference/(flow.rho*g);
 const pumpHead=requiredHead==null?null:Math.max(0,requiredHead),hydraulicPower=pumpHead==null?null:flow.rho*g*flow.volume*pumpHead,shaftPower=hydraulicPower==null?null:hydraulicPower/efficiency;
 const result={length,roughness,localK,efficiency,heightDifference,pressureDifference,relativeRoughness,factor,fanningFactor:factor==null?null:factor/4,method,dynamicPressure,frictionPressure,localPressure,lossPressure,lossHead,requiredHead,pumpHead,hydraulicPower,shaftPower};
 if(Object.values(result).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error('Переповнення гідравлічного розрахунку.');
 return result;
}
