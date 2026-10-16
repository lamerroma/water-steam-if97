// Numerical inversions of the selected fundamental model, with explicit multiple roots.
import {boundary23Pressure,boundary23Temperature,PMIN_SAT} from './equations.js';
export function extraInputs(mode,a,b,model,calc){
 if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Параметри мають бути скінченними.');
 if(['pv','tv'].includes(mode)){if(b<=0)throw Error('Питомий об’єм має бути додатним.');return extraInputs(mode==='pv'?'prho':'trho',a,1/b,model,calc);}
 if(['us','vs','hv','uv'].includes(mode))return pairInputs(mode,a,b,model,calc);
 const fixedT=!['prho','pu'].includes(mode),key=['pu','tu'].includes(mode)?'u':mode==='th'?'h':mode==='ts'?'s':'rho';
 if(key==='rho'&&b<=0)throw Error('Густина має бути додатною.');
 const roots=[];let sat;try{sat=calc(fixedT?'satt':'satp',a,undefined,model).saturation;}catch{}
 const keep=r=>{if(!r?.state)return;r=refineInputs(r,fixedT?['T',key]:['p',key],[a,b],model,calc);if(!roots.some(z=>Math.abs(z.state.p-r.state.p)<Math.max(1e-12,r.state.p*1e-8)&&Math.abs(z.state.T-r.state.T)<1e-6))roots.push(r);};
 if(sat){const l=sat.liquid,v=sat.vapor;let x=key==='rho'?(1/b-l.v)/(v.v-l.v):(b-l[key])/(v[key]-l[key]);
 // Snap only roundoff and the propagated region-3 density-solver residual.
 // Derivative propagation matters near criticality; a quality-wide tolerance
 // would erase real wet states in the rest of the dome.
 const endpointTolerance=q=>{
  const roundoff=64*Number.EPSILON*Math.max(Math.abs(q[key]),Math.abs(b));
  if(model!=='IF97'||q.region!==3)return roundoff;
  const [dp,dT]=inputGradient(q,key);
  return Math.max(roundoff,Math.abs(dp)*Math.max(2e-12,q.p*2e-13)+Math.abs(dT)*64*Number.EPSILON*q.T);
 };
 if(Math.abs(b-l[key])<=endpointTolerance(l))x=0;else if(Math.abs(b-v[key])<=endpointTolerance(v))x=1;
 if(x>=0&&x<=1)keep(calc('px',sat.p,x,model));}
 const values=fixedT?Array.from({length:193},(_,i)=>10**(-9+(Math.log10(model==='IF97'?100:1000)+9)*i/192)):Array.from({length:257},(_,i)=>(model==='IF97'?273.15:273.16)+((model==='IF97'?(a<=50?2273.15:1073.15):1273)-(model==='IF97'?273.15:273.16))*i/256);
 if(fixedT)values.push(model==='IF97'?100:1000,50,22.064);
 else values.push(model==='IF97'?273.15:273.16,model==='IF97'?(a<=50?2273.15:1073.15):1273,274,275,276,277,277.13,277.5,278,279,280,623.15,647.096,1073.15);
 const addCut=z=>values.push(z,z*(1-64*Number.EPSILON),z*(1+64*Number.EPSILON));
 if(!fixedT&&model==='IF97'){addCut(623.15);if(a>boundary23Pressure(623.15)&&a<=100)addCut(boundary23Temperature(a));}
 // Put samples on both sides of changes in the phase/region labels. Otherwise
 // a valid narrow interval can be skipped by a coarse grid plus phase filtering.
 if(fixedT&&model==='IF97'&&a>623.15&&a<=863.15){const p=boundary23Pressure(a);values.push(p*(1-2e-8),p*(1+2e-8));}
 if(!fixedT)values.push(647.096-1e-6,647.096+1e-6);
 if(sat){const q=fixedT?sat.p:sat.T;values.push(q,q*(1-2e-8),q*(1+2e-8));}
 values.sort((x,y)=>x-y);let prev=null;
 const evaluate=z=>calc('pt',fixedT?z:a,fixedT?a:z,model);
 // A label such as “supercritical” is not a physical discontinuity. Keep the
 // fundamental IF97 regions separate and reset at actual coexistence instead.
 const sameBranch=(q,r)=>q.region===r.region;
 const tol=Math.max(1e-9,Math.abs(b)*2e-9);
 const sample=(z,r)=>({z,r,e:r.state[key]-b,d:inputGradient(r.state,key)[fixedT?0:1]});
 const bracket=(left,right)=>{
  if(Math.abs(left.e)<tol)keep(left.r);if(Math.abs(right.e)<tol)keep(right.r);
  if(left.e*right.e>=0)return;
  let lo=left.z,hi=right.z,elo=left.e;
  for(let i=0;i<70;i++){const mid=fixedT?Math.sqrt(lo*hi):(lo+hi)/2;let q;try{q=evaluate(mid);}catch{break;}
   if(!q.state||!sameBranch(left.r.state,q.state))break;
   const err=q.state[key]-b;if(Math.abs(err)<tol){keep(q);break;}if(err*elo>0){lo=mid;elo=err;}else hi=mid;
  }
 };
 for(const z of values){let r;try{r=evaluate(z);}catch{prev=null;continue;}if(!r.state){prev=null;continue;}const now=sample(z,r);
  if(Math.abs(now.e)<tol)keep(r);
  if(prev&&sameBranch(prev.r.state,r.state)){
   if(prev.d*now.d<0){
    // Locate an extremum analytically. Two roots (or a tangent root) can be
    // hidden in a single grid cell even though both endpoint errors agree.
    let lo=prev.z,hi=z,turn;
    for(let i=0;i<60;i++){const mid=fixedT?Math.sqrt(lo*hi):(lo+hi)/2;let q;try{q=evaluate(mid);}catch{break;}
     if(!q.state||!sameBranch(prev.r.state,q.state))break;turn=sample(mid,q);
     if(turn.d*prev.d>0)lo=mid;else hi=mid;
    }
    if(turn){bracket(prev,turn);bracket(turn,now);}else bracket(prev,now);
   }else bracket(prev,now);
  }
  prev=now;
 }
 if(!roots.length)throw Error('Не знайдено стан у межах обраної моделі. Перевірте одиниці та параметри.');
 roots.sort((x,y)=>fixedT?x.state.p-y.state.p:x.state.T-y.state.T);const result=roots[0];if(roots.length>1){result.alternatives=roots.slice(1).map(q=>q.state);result.state={...result.state,notes:[...result.state.notes,`Знайдено ${roots.length} станів. Показано стан із найменшим ${fixedT?'тиском':'значенням температури'}; інші корені наведені окремо.`]};}return result;
}

// Solve an isentrope or isoenthalp, including equilibrium mixtures, in log pressure.
function pairInputs(mode,a,b,model,calc){
 if(['vs','hv','uv'].includes(mode)&&(mode==='vs'?a:b)<=0)throw Error('Питомий об’єм має бути додатним.');
 const inner=mode==='us'||mode==='vs'?'ps':mode==='hv'?'ph':'pu',target=mode==='us'?'u':'v',wanted=mode==='vs'?a:mode==='us'?a:b,fixed=mode==='us'||mode==='vs'?b:a,roots=[];
 const keys={us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']}[mode];
 const evaluate=p=>calc(inner,p,fixed,model),keep=q=>{if(!q?.state)return;q=refineInputs(q,keys,[a,b],model,calc);const index=roots.findIndex(z=>Math.abs(Math.log(z.state.p/q.state.p))<1e-6&&Math.abs(z.state.T-q.state.T)<1e-5&&z.state.phase===q.state.phase);if(index<0)roots.push(q);else {const error=z=>Math.hypot(...keys.map((k,i)=>(z.state[k]-[a,b][i])/Math.max(Math.abs([a,b][i]),1e-12)));if(error(q)<error(roots[index]))roots[index]=q;}};
 let prev;const max=model==='IF97'?100:1000,tol=Math.max(target==='u'?1e-7:1e-12,Math.abs(wanted)*2e-10);
 const pressures=Array.from({length:161},(_,i)=>10**(-8+(8+Math.log10(max))*i/160));
 pressures.push(model==='IF97'?PMIN_SAT:.000611654771,max,50,20,21.5,22,22.064*(1-1e-5),22.064,22.1,23);pressures.sort((a,b)=>a-b);
 for(const p of pressures){
 let q;try{q=evaluate(p);}catch{prev=null;continue;}if(!q.state){prev=null;continue;}const e=q.state[target]-wanted;if(Math.abs(e)<(q.state.cp==null?tol:Math.max(1e-10,Math.abs(wanted)*2e-8)))keep(q);
 if(prev&&e*prev.e<0){let lo=prev.p,hi=p,elo=prev.e,best=null,bestError=Infinity;for(let j=0;j<60;j++){const mid=Math.sqrt(lo*hi);let z;try{z=evaluate(mid);}catch{break;}if(!z.state)break;const err=z.state[target]-wanted;if(Math.abs(err)<bestError){best=z;bestError=Math.abs(err);}if(j===59&&best?.state.cp==null&&bestError<Math.max(target==='u'?1e-6:1e-10,Math.abs(wanted)*2e-8)){keep(best);break;}if(Math.abs(err)<(z.state.cp==null?tol:Math.max(1e-10,Math.abs(wanted)*2e-8))){keep(z);break;}if(err*elo>0){lo=mid;elo=err;}else hi=mid;}}
 prev={p,e};
 }
 if(!roots.length||roots.some(r=>[273.15,623.15,1073.15,2273.15].some(T=>Math.abs(r.state.T-T)<.1)))for(const r of boundaryInputRoots(keys,[a,b],model,calc))keep(r);
 if(!roots.length)throw Error('Не знайдено узгоджений стан у межах обраної моделі.');
 roots.sort((x,y)=>x.state.p-y.state.p);const q=roots[0];if(roots.length>1){q.alternatives=roots.slice(1).map(z=>z.state);q.state={...q.state,notes:[...(q.state.notes||[]),`Знайдено ${roots.length} станів; показано найменший тиск, інші корені наведені окремо.`]};}return q;
}

// Exact thermodynamic derivatives of the selected EOS, in MPa, K and kJ/kg.
// Refine BOTH input residuals: a small energy residual alone does not bound
// pressure error in a nearly incompressible liquid. Never step across a phase.
function inputGradient(q,key){
 switch(key){
 case 'p':return [1,0];case 'T':return [0,1];
 case 'v':return [q.dvdp,q.dvdt];
 case 'rho':return [q.drhodp,-q.rho*q.alpha];
 case 'h':return [1000*q.v*(1-q.T*q.alpha),q.cp];
 case 's':return [-1000*q.v*q.alpha,q.cp/q.T];
 case 'u':return [-1000*(q.T*q.dvdt+q.p*q.dvdp),q.cp-1000*q.p*q.dvdt];
 default:throw Error('Невідома величина інверсії.');
 }
}
function refineInputs(result,keys,targets,model,calc){
 if(result.state.cp==null)return result; // Equilibrium mixture handled by the outer bracket.
 let best=result;const scales=targets.map((x,i)=>Math.max(Math.abs(x),keys[i]==='v'?1e-3:keys[i]==='s'?1:100));
 const norm=q=>Math.hypot(...keys.map((k,i)=>(q[k]-targets[i])/scales[i]));
 for(let i=0;i<16;i++){
 const q=best.state,[a,b]=inputGradient(q,keys[0]),[c,d]=inputGradient(q,keys[1]),det=a*d-b*c;
 if(!Number.isFinite(det)||det===0)break;
 const e=q[keys[0]]-targets[0],f=q[keys[1]]-targets[1],dp=(-d*e+b*f)/det,dT=(c*e-a*f)/det;
 if(!Number.isFinite(dp)||!Number.isFinite(dT))break;
 if(Math.abs(dp)<=Math.max(1e-15,q.p*1e-12)&&Math.abs(dT)<=1e-10)break;
 let accepted=false;
 for(let step=1;step>=1/1024;step/=2){
 try{const z=calc('pt',keys.includes('p')?targets[keys.indexOf('p')]:q.p+step*dp,keys.includes('T')?targets[keys.indexOf('T')]:Math.abs(step*dT)<=64*Number.EPSILON*q.T?q.T:q.T+step*dT,model);
 if(z.state&&z.state.region===q.region&&norm(z.state)<norm(q)){best=z;accepted=true;break;}}catch{}
 }
 if(!accepted)break;
 }
 return best;
}

// A closed temperature/pressure boundary can terminate an outer inverse bracket.
// Seed each adjacent fundamental region there, then solve both residuals. This
// also recovers the second branch in the small IF97 consistency overlaps.
export function boundaryInputRoots(keys,targets,model,calc){
 if(model!=='IF97')return [];
 const roots=[],keep=r=>{
  r=refineInputs(r,keys,targets,model,calc);
  const tolerances={h:2e-7,u:2e-7,s:2e-10,v:2e-12};
  if(keys.every((key,i)=>Math.abs(r.state[key]-targets[i])<=tolerances[key]))roots.push(r);
 };
 const mode={h:'th',s:'ts',u:'tu',v:'tv'}[keys[0]];
 const temperatures=[273.15,623.15,623.15*(1+64*Number.EPSILON),1073.15,1073.15*(1+64*Number.EPSILON),2273.15];
 for(const T of temperatures){try{const q=extraInputs(mode,T,targets[0],model,calc);for(const state of [q.state,...(q.alternatives||[])])keep({state});}catch{}}
 const pressureMode={h:'ph',s:'ps',u:'pu',v:'pv'}[keys[0]];
 for(const p of [50,100]){try{const q=calc(pressureMode,p,targets[0],model);for(const state of [q.state,...(q.alternatives||[])])keep({state});}catch{}}
 return roots;
}
