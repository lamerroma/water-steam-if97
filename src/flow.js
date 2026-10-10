// Continuity and Reynolds number for a single-phase Newtonian fluid in a round pipe.
// NASA Glenn: https://www.grc.nasa.gov/WWW/K-12/airplane/reynolds.html
export const FLOW_UNITS={mass:{kgs:1,kgh:1/3600,lbs:.45359237,lbh:.45359237/3600},volume:{m3s:1,m3h:1/3600,ls:.001,lmin:.001/60,ft3min:.3048**3/60},velocity:{ms:1,fts:.3048},diameter:{m:1,mm:.001,inch:.0254},density:{kgm3:1,lbft3:.45359237/.3048**3},dynamic:{Pas:1,mPas:.001,cP:.001},kinematic:{m2s:1,mm2s:1e-6,cSt:1e-6}};
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
