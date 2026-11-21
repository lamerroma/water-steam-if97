// IAPWS-95 extrapolated beyond its validated range (T ≤ 1273 K, p ≤ 1000 MPa)
// up to T = 5000 K and p = 100 GPa, for P–T input only. IAPWS R6-95(2018)
// §6.3 states that the formulation behaves reasonably when extrapolated to
// these limits, but its accuracy there is not established. Results are marked.
import {raw95} from './iapws95.js';
import {fluidAboveMelting95} from './water-validity.js';
import {meltingPressure} from './phase-boundaries.js';
import {calculate} from './engine.js';

export const EXTRAPOLATION95_LIMITS={T:5000,p:100000};
const EXT95_VALID={T:1273,p:1000};

// Melting temperature of ice VII (IAPWS R14-08), 2216 MPa at 355 K to 715 K.
function ext95MeltingVII(p){let lo=355,hi=715;for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(meltingPressure(mid,'VII')<p)lo=mid;else hi=mid;}return hi;}
export function extrapolation95MinimumT(p){
 if(p<=2216)return null; // fluidAboveMelting95 decides below the ice VI–VII triple point
 return p<=meltingPressure(715,'VII')?ext95MeltingVII(p):715;
}

function ext95Density(p,T){
 // Scan density on a log grid, keep mechanically stable sign changes, refine
 // by bisection and choose the root with the lowest Gibbs energy.
 const f=rho=>{const q=raw95(T,rho);return {q,e:q.p-p};},roots=[];
 let prev=f(1e-9);
 for(let i=1;i<=400;i++){
  const rho=1e-9*(8000/1e-9)**(i/400),cur=f(rho);
  if(prev.e*cur.e<=0&&prev.q.drhodp>0&&cur.q.drhodp>0){
   let lo=prev.q.rho,hi=rho,flo=prev.e;
   for(let k=0;k<200;k++){const mid=Math.sqrt(lo*hi),m=f(mid);if(m.e===0||hi/lo-1<1e-15){lo=hi=mid;break;}if(flo*m.e<0)hi=mid;else{lo=mid;flo=m.e;}}
   const q=raw95(T,Math.sqrt(lo*hi));if(q.drhodp>0&&q.cp>0&&q.cv>0)roots.push(q);
  }
  prev=cur;
 }
 if(!roots.length)throw Error('IAPWS-95 (екстраполяція): не знайдено стабільний корінь густини.');
 return roots.reduce((a,b)=>(b.h-T*b.s)<(a.h-T*a.s)?b:a);
}

export function extrapolate95(p,T){
 if(!Number.isFinite(p)||p<=0||p>EXTRAPOLATION95_LIMITS.p)throw Error('Екстраполяція IAPWS-95: 0 < P ≤ 100 000 МПа.');
 if(!Number.isFinite(T)||T>EXTRAPOLATION95_LIMITS.T)throw Error('Екстраполяція IAPWS-95: T ≤ 5000 K.');
 if(p<=EXT95_VALID.p&&T<=EXT95_VALID.T){
  const r=calculate('pt',p,T,'IAPWS-95');if(!r.state)throw Error('Стан на лінії насичення: скористайтеся вкладкою «Насичення».');
  return {...r.state,extrapolated:false};
 }
 const min=extrapolation95MinimumT(p);
 if(min==null?!fluidAboveMelting95(p,T):T<=min)throw Error('Екстраполяція IAPWS-95: стан у твердій області (лід) або нижче кривої плавлення'+(min?` (T > ${min.toFixed(2)} K)`:'')+'.');
 const q=ext95Density(p,T),kappaT=q.drhodp/q.rho;
 return {...q,model:'IAPWS-95 (extrapolated)',extrapolated:true,kappa:kappaT,isentropic:q.w**2*q.rho/(p*1e6),Z:1000*p*q.v/(0.46151805*T),
  notes:['Екстраполяція за межі перевіреної області IAPWS-95 (T ≤ 1273 K, P ≤ 1000 МПа). IAPWS R6-95 зазначає лише розумну поведінку рівняння до 5000 K і 100 ГПа; точність тут не встановлена. Транспортні властивості не розраховуються.']};
}
