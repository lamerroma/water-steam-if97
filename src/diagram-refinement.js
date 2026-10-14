import {calculate} from './engine.js';
import {diagramPoint} from './diagram-coordinates.js';
import {diagramMixture,diagramQualityLines} from './diagram-guides.js';
// Refine in screen space, using new model evaluations rather than smoothing.
// A fixed budget/depth bounds work even near singularities or at extreme zoom.
export async function refineDiagramSamples(samples,{parameter,evaluate,project,range,width,height,yieldFrame=()=>Promise.resolve(),budget=1200,tolerance=.5,maxDepth=16,evaluationCache=null}){
 let evaluations=0,limited=false;
 const pixel=q=>{const p=project(q);return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:(p.x-range.xmin)/(range.xmax-range.xmin)*width,y:(p.y-range.ymin)/(range.ymax-range.ymin)*height}:null;};
 const error=(a,m,b)=>{const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((m.x-a.x)*dx+(m.y-a.y)*dy)/n)):0;return Math.hypot(m.x-a.x-t*dx,m.y-a.y-t*dy);};
 // Reuse evaluated parameters when subdividing. Midpoint-only tests miss
 // inflections; quarter probes also locate curves returning from off screen.
 const memo=evaluationCache||new Map();for(const q of samples){const t=parameter(q);if(Number.isFinite(t))memo.set(t,q);}
 async function sample(t){
  if(memo.has(t))return {q:memo.get(t)};
  if(evaluations>=budget){limited=true;return {exhausted:true};}
  evaluations++;if(evaluations%12===0)await yieldFrame();
  let q=null;try{q=await evaluate(t);}catch(error){if(error?.name==='AbortError')throw error;}memo.set(t,q);return {q};
 }
 async function segment(a,b,depth){
  const pa=pixel(a),pb=pixel(b),ta=parameter(a),tb=parameter(b);
  if(!pa||!pb||!Number.isFinite(ta)||!Number.isFinite(tb)||Math.abs(tb-ta)<1e-12)return [b];
  const mid=await sample((ta+tb)/2);if(mid.exhausted)return [b];
  const m=mid.q,pm=pixel(m);if(!pm)return [null,b];
  let deviation=error(pa,pm,pb),probes=[m];
  for(const fraction of [.25,.75]){
   const probe=await sample(ta+(tb-ta)*fraction);if(probe.exhausted)return [m,b];
   const pp=pixel(probe.q);if(!pp)return [null,b];
   deviation=Math.max(deviation,error(pa,pp,pb));probes.push(probe.q);
  }
  const bounds=[pa,pb,...probes.map(pixel)];
  if(Math.max(...bounds.map(p=>p.x))<-4||Math.min(...bounds.map(p=>p.x))>width+4||Math.max(...bounds.map(p=>p.y))<-4||Math.min(...bounds.map(p=>p.y))>height+4)return [b];
  if(deviation<=tolerance)return [b];
  if(depth>=maxDepth){limited=true;return [...probes.sort((q,r)=>(parameter(q)-parameter(r))*Math.sign(tb-ta)),b];}
  return [...await segment(a,m,depth+1),...await segment(m,b,depth+1)];
 }
 const points=samples.length?[samples[0]]:[];
 for(let i=1;i<samples.length;i++)points.push(...await segment(samples[i-1],samples[i],0));
 await yieldFrame();return {points,evaluations,limited};
}
export async function refineDiagramScene(cache,isotherms,process,kind,range,size,model,hidden,dryness,yieldFrame){
 const stats={evaluations:0,limited:false,budget:6000};let remaining=stats.budget;
 async function refine(samples,parameter,evaluate,project=q=>q&&diagramPoint(kind,q),evaluationCache=null){
  const r=await refineDiagramSamples(samples,{parameter:q=>q?parameter(q):NaN,evaluate,project,range,width:size.width,height:size.height,yieldFrame,budget:Math.min(1200,remaining),evaluationCache});
  remaining-=r.evaluations;stats.evaluations+=r.evaluations;stats.limited||=r.limited;return r.points;
 }
 // Paired saturation samples keep quality lines aligned with both dome branches.
 const saturationSamples=new Map(),pairedEvaluationCache=new Map();const saturationAt=T=>{if(!saturationSamples.has(T)){const s=calculate('satt',T,undefined,model).saturation;saturationSamples.set(T,{liquid:s.liquid,vapor:s.vapor});}return saturationSamples.get(T);};
 let paired=cache.dome[0].map((q,i)=>q&&cache.dome[1][i]?{liquid:q,vapor:cache.dome[1][i]}:null);
 for(const branch of ['liquid','vapor',...dryness])paired=await refine(paired,q=>q.liquid.T,saturationAt,q=>q&&diagramPoint(kind,typeof branch==='number'?diagramMixture(q.liquid,q.vapor,branch)||q.liquid:q[branch]),pairedEvaluationCache);
 const dome=[paired.map(q=>q?.liquid||null),paired.map(q=>q?.vapor||null)];
 const isobars=[];
 for(let i=0;i<cache.isobars.length;i++){const line=cache.isobars[i];isobars.push(hidden.has(i)?line:{...line,points:await refine(line.points,q=>q.T,T=>calculate('pt',line.p,T,model).state)});}
 const thermal=[];
 for(const line of isotherms)thermal.push({...line,points:await refine(line.points,q=>Math.log(q.p),v=>calculate('pt',Math.exp(v),line.T,model).state)});
 const paths={};const r=process?.result;
 if(r?.ideal){const seeds=Array.from({length:17},(_,i)=>{if(i===0)return r.inlet;if(i===16)return r.ideal;try{return calculate('ps',r.inlet.p*(r.ideal.p/r.inlet.p)**(i/16),r.inlet.s,model).state;}catch{return null;}});paths.ideal=await refine(seeds,q=>Math.log(q.p),v=>calculate('ps',Math.exp(v),r.inlet.s,model).state);}
 if(r&&!r.ideal&&Math.abs(r.inlet.h-r.outlet.h)<1e-7){const seeds=Array.from({length:17},(_,i)=>{if(i===0)return r.inlet;if(i===16)return r.outlet;try{return calculate('ph',r.inlet.p*(r.outlet.p/r.inlet.p)**(i/16),r.inlet.h,model).state;}catch{return null;}});paths.process=await refine(seeds,q=>Math.log(q.p),v=>calculate('ph',Math.exp(v),r.inlet.h,model).state);}
 const refined={...cache,dome,isobars};return {cache:refined,isotherms:thermal,qualities:diagramQualityLines(refined,dryness),paths,stats};
}
export function diagramProcessDescription(process){
 if(!process)return '';
 const r=process.result;
 if(r.ideal)return 'Зелена штрихова — зв’язок входу й виходу, а не траєкторія. Пунктир — розрахована ізоентропа s = const. ККД визначає кінцевий стан, але не проміжний шлях.';
 if(Math.abs(r.inlet.h-r.outlet.h)<1e-7)return 'Зелена — розрахована рівноважна лінія h = const. Це модель адіабатичного дроселювання, а не просторовий шлях потоку.';
 return 'Кольорові штрихові лінії з’єднують кінцеві стани потоків. Проміжний шлях теплообміну не визначений кінцевими станами.';
}
