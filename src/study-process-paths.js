import {calculate,PC} from './engine.js';
import {gasInverse,AIR} from './gases.js';
import {refineDiagramSamples} from './diagram-refinement.js';

// These are process definitions, not classifications inferred from equal endpoints.
// Separation and open mixing remain schematic even when their pressures match.
export function studyProcessEdges(q,npp=false){
 const spec=(from,to,type,eta=null)=>({from,to,type,eta,id:from+'-'+to});
 if(npp){const a=q.input;
  if(q.mode==='msr')return [spec(0,1,'isobaric'),spec(1,0,'isobaric'),spec(2,3,'compression',a.etaPump),spec(3,4,'isobaric'),spec(4,5,'expansion',a.etaT),spec(5,6,'separation'),spec(6,7,'isobaric'),spec(7,8,'expansion',a.etaLP),spec(8,2,'isobaric'),spec(5,9,'separation'),spec(9,11,'isenthalpic'),spec(11,2,'isobaric'),spec(4,10,'isobaric'),spec(10,12,'isenthalpic'),spec(12,2,'isobaric')];
  return [spec(0,1,'isobaric'),spec(1,0,'isobaric'),spec(5,2,'compression',a.etaPump),spec(2,3,'isobaric'),spec(3,4,'expansion',a.etaT),spec(4,5,'isobaric')];
 }
 const a=q.input;
 if(a.type==='rankine-regen')return [spec(0,1,'expansion',a.etaT),spec(1,2,'expansion',a.etaT),spec(2,3,'isobaric'),spec(3,4,'compression',a.etaC),spec(4,5,'mixing'),spec(1,5,'mixing'),spec(5,6,'compression',a.etaC),spec(6,0,'isobaric')];
 if(a.type==='rankine-reheat')return [spec(0,1,'compression',a.etaC),spec(1,2,'isobaric'),spec(2,3,'expansion',a.etaT),spec(3,4,'isobaric'),spec(4,5,'expansion',a.etaT),spec(5,0,'isobaric')];
 if(!['rankine','brayton'].includes(a.type))throw Error('Unknown cycle path model.');
 return [spec(0,1,'compression',a.etaC),spec(1,2,'isobaric'),spec(2,3,'expansion',a.etaT),spec(3,0,'isobaric')];
}
export function studyPathPoint(q,kind='ts'){return q?{x:q.s,y:kind==='ts'?q.T:q.h}:{x:NaN,y:NaN};}
export async function buildStudyProcessPaths(q,{npp=false,kind='ts',equipment='endpoints',ideal=true,width=900,height=550,yieldFrame=()=>Promise.resolve(),budget=6000,viewport=null}={}){
 if(!['ts','hs'].includes(kind)||!['endpoints','efficiency'].includes(equipment))throw Error('Unknown path display option.');
 const gas=q.input.type==='brayton',model=q.model,edges=studyProcessEdges(q,npp),stats={evaluations:0,budget,limited:false,gaps:0};
 const ph=(p,h)=>gas?gasInverse(p,h,'h',AIR):calculate('ph',p,h,model).state;
 const ps=(p,s)=>gas?gasInverse(p,s,'s',AIR):calculate('ps',p,s,model).state;
 async function evaluate(fn){if(stats.evaluations>=budget){stats.limited=true;return null;}stats.evaluations++;if(stats.evaluations%12===0)await yieldFrame();try{return fn()||null;}catch{return null;}}
 const prepared=[];
 for(const edge of edges){
  const a=q.states[edge.from],b=q.states[edge.to],machine=['compression','expansion'].includes(edge.type);
  let mode=edge.type;
  if(machine)mode=edge.eta===1?'isentropic':equipment==='efficiency'?'efficiency-model':'schematic';
  if(['mixing','separation'].includes(mode))mode='schematic';
  const definitions=[{...edge,mode,a,b,reference:false}];
  if(machine&&ideal&&edge.eta!==1){const end=await evaluate(()=>ps(b.p,a.s));if(end)definitions.push({...edge,id:edge.id+'-ideal',mode:'isentropic',a,b:{...end,name:b.name+'s'},reference:true});else stats.gaps++;}
  for(const d of definitions){
   d.fractions=Array.from({length:17},(_,i)=>i/16);d.anchors=new Map();
   if(d.mode==='isobaric'&&!gas&&a.p<PC&&a.h!==b.h){const sat=await evaluate(()=>calculate('satp',a.p,undefined,model).saturation);if(sat)for(const state of [sat.liquid,sat.vapor]){const t=(state.h-a.h)/(b.h-a.h);if(t>0&&t<1){d.fractions.push(t);d.anchors.set(t,state);}}}
   d.at=async t=>{
    if(t===0)return {t,state:d.a};if(t===1)return {t,state:d.b};if(d.anchors.has(t))return {t,state:d.anchors.get(t)};
    const p=d.a.p*(d.b.p/d.a.p)**t;
    const state=await evaluate(()=>{
     if(d.mode==='isobaric')return ph(d.a.p,d.a.h+t*(d.b.h-d.a.h));
     if(d.mode==='isenthalpic')return ph(p,d.a.h);
     const isentropic=ps(p,d.a.s);if(!isentropic)return null;
     if(d.mode==='isentropic')return isentropic;
     return ph(p,d.a.h+(isentropic.h-d.a.h)*(d.type==='compression'?1/d.eta:d.eta));
    });return state?{t,state}:null;
   };
   if(d.mode==='schematic')d.seeds=[{t:0,state:d.a},{t:1,state:d.b}];
   else{d.seeds=[];for(const t of [...new Set(d.fractions)].sort((a,b)=>a-b))d.seeds.push(await d.at(t));}
   prepared.push(d);
  }
 }
 const visible=prepared.flatMap(d=>d.seeds.filter(Boolean).map(s=>studyPathPoint(s.state,kind))),xs=visible.map(p=>p.x),ys=visible.map(p=>p.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),dx=xmax-xmin||1,dy=ymax-ymin||1,range={xmin:xmin-dx*.04,xmax:xmax+dx*.04,ymin:ymin-dy*.04,ymax:ymax+dy*.04};
 const paths=[];
 for(const d of prepared){
  let samples=d.seeds;
  if(d.mode!=='schematic'){
   const refined=await refineDiagramSamples(d.seeds,{parameter:s=>s?.t,evaluate:d.at,project:s=>s&&studyPathPoint(s.state,kind),range:viewport||range,width,height,budget:Math.min(1200,Math.max(0,budget-stats.evaluations)),yieldFrame});
   samples=refined.points;stats.limited||=refined.limited;
  }
  const points=samples.map(s=>s?.state||null);stats.gaps+=points.filter(s=>!s).length;
  paths.push({id:d.id,from:d.from,to:d.to,type:d.type,mode:d.mode,reference:d.reference,start:d.a.name,end:d.b.name,points});
 }
 await yieldFrame();return {model,kind,equipment,ideal,paths,range,stats};
}
export function studyPathsCSV(scene){
 const rows=[['edge','from','to','process','path_model','reference','model','sample','p_MPa_abs','T_K','h_kJkg','s_kJkgK','x','status']];
 for(const p of scene.paths)p.points.forEach((q,i)=>rows.push([p.id,p.start,p.end,p.type,p.mode,p.reference,scene.model,i+1,q?.p,q?.T,q?.h,q?.s,q?.x,q?'OK':'gap']));
 return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
}
