import {WATER_MODELS} from './water-models.js';
import {diagramAxes,diagramPoint} from './diagram-coordinates.js';
const diagramDrawingModels=WATER_MODELS,diagramDrawingHas=(o,k)=>Object.hasOwn(o,k);
const diagramDrawingObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const diagramDrawingName=v=>typeof v==='string'&&v.trim()&&v.trim().length<=80&&!/[;\r\n]/.test(v);
const diagramDrawingColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function readDiagramDrawing(raw,states){
 const sets=raw.pointSets??{},series=raw.series??[],style=raw.drawingStyle??{};
 if(!diagramDrawingObject(sets)||!Array.isArray(series)||series.length>32||!diagramDrawingObject(style))throw Error('Некоректні точки або серії діаграми.');
 const at=(i,model)=>{if(!Number.isInteger(i)||!states[i]||(states[i].model||'IF97')!==model)throw Error('Точка серії не відповідає історії або моделі.');return states[i];};
 const pointSets={};
 for(const [model,points]of Object.entries(sets)){
  if(!diagramDrawingModels.includes(model)||!Array.isArray(points)||points.length>500)throw Error('Некоректний набір точок діаграми.');
  const labels=new Set(),refs=new Set();pointSets[model]=points.map(p=>{
   if(!diagramDrawingObject(p)||!diagramDrawingName(p.label))throw Error('Підпис точки: від 1 до 80 символів, без крапки з комою.');
   const q=at(p.historyIndex,model),label=p.label.trim();if(labels.has(label)||refs.has(q))throw Error('ID та підписи точок мають бути унікальними.');labels.add(label);refs.add(q);return {state:q,label};
  });
 }
 const names=new Set();const lines=series.map(s=>{
  if(!diagramDrawingObject(s)||!diagramDrawingModels.includes(s.model)||!diagramDrawingName(s.name)||!['line','spline'].includes(s.kind)||!Array.isArray(s.points)||s.points.length>500)throw Error('Некоректна іменована серія.');
  const key=s.model+':'+s.name.trim();if(names.has(key))throw Error('Назва серії вже існує.');names.add(key);
  const points=s.points.map(i=>at(i,s.model));
  if(diagramDrawingHas(pointSets,s.model)&&points.some(q=>!pointSets[s.model].some(p=>p.state===q)))throw Error('Серія посилається на невибрану точку.');
  // History deletion can leave an incomplete series. Keep its name and surviving
  // references for repair; it is not drawn until the required points exist.
  return {name:s.name.trim(),model:s.model,kind:s.kind,points};
 });
 const drawingStyle={radius:style.radius??6,pointColor:style.pointColor??'phase',width:style.width??2.3,lineColor:style.lineColor??'#8b4599'};
 if(!Number.isFinite(drawingStyle.radius)||drawingStyle.radius<2||drawingStyle.radius>14||!(drawingStyle.pointColor==='phase'||diagramDrawingColor(drawingStyle.pointColor))||!Number.isFinite(drawingStyle.width)||drawingStyle.width<.5||drawingStyle.width>8||!diagramDrawingColor(drawingStyle.lineColor))throw Error('Некоректний радіус, колір або товщина лінії.');
 return {pointSets,series:lines,drawingStyle};
}
export function syncDiagramDrawing(plan,states){
 for(const points of Object.values(plan.pointSets||{}))for(let i=points.length-1;i>=0;i--)if(!states.includes(points[i].state))points.splice(i,1);
 for(const s of plan.series||[])s.points=s.points.filter(q=>states.includes(q));
}
export function diagramDrawingSnapshot(plan,states){
 return {pointSets:Object.fromEntries(Object.entries(plan.pointSets||{}).map(([model,points])=>[model,points.map(p=>({historyIndex:states.indexOf(p.state),label:p.label}))])),
  series:(plan.series||[]).map(s=>({...s,points:s.points.map(q=>states.indexOf(q))})),drawingStyle:{...plan.drawingStyle}};
}
export function diagramChoices(plan,states,model,process=[]){
 const set=plan.pointSets?.[model];
 return [...plan.order.filter(q=>(q.model||'IF97')===model&&(!set||set.some(p=>p.state===q))).map(q=>[q,set?.find(p=>p.state===q)?.label||q.name||`Журнал № ${states.length-states.indexOf(q)}`,'history',!!set||!!q.name]),...process];
}
export function setDiagramPoints(plan,states,model,idsText,labelsText){
 const ids=String(idsText).trim()?String(idsText).trim().split(/[;,\s]+/):[],labels=String(labelsText).trim()?String(labelsText).split(';').map(s=>s.trim()):[];
 if(ids.length!==labels.length)throw Error('Кількість ID і підписів має збігатися.');
 const points=ids.map((id,i)=>{if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id)))throw Error('ID точки має бути цілим числом з історії.');return {historyIndex:states.length-Number(id),label:labels[i]};});
 const raw={pointSets:{[model]:points}},parsed=readDiagramDrawing(raw,states),next=parsed.pointSets[model];
 if((plan.series||[]).some(s=>s.model===model&&s.points.some(q=>!next.some(p=>p.state===q))))throw Error('Спочатку змініть або видаліть серію, яка використовує прибрані точки.');
 plan.pointSets[model]=next;const ordered=next.map(p=>p.state);plan.order=[...ordered,...plan.order.filter(q=>!ordered.includes(q))];
}
export function saveDiagramSeries(plan,model,index,input,entries){
 if(index!=null&&(!Number.isInteger(index)||!plan.series[index]||plan.series[index].model!==model))throw Error('Виберіть серію для редагування.');
 if(!diagramDrawingName(input.name)||!['line','spline'].includes(input.kind))throw Error('Задайте назву серії та тип лінії.');
 const labels=String(input.labels).split(';').map(s=>s.trim()),points=labels.map(label=>{
  const matches=entries.filter(([q,l,source])=>source==='history'&&l===label);if(matches.length!==1)throw Error('Кожний підпис серії має однозначно відповідати показаній точці.');return matches[0][0];
 });
 if(points.length>500||new Set(points).size<(input.kind==='spline'?3:2))throw Error(input.kind==='spline'?'Для сплайна потрібно щонайменше 3 різні точки.':'Для лінії потрібно щонайменше 2 різні точки.');
 const title=input.name.trim();if(plan.series.some((s,i)=>i!==index&&s.model===model&&s.name===title))throw Error('Назва серії вже існує.');
 const s={name:title,kind:input.kind,model,points};if(index==null){if(plan.series.length>=32)throw Error('Дозволено до 32 іменованих серій.');plan.series.push(s);}else plan.series[index]=s;
 return index??plan.series.length-1;
}
// A drawing interpolant, never a thermodynamic path. Centripetal Catmull–Rom
// uses fixed canonical axis scales, so changing units or viewport cannot alter
// the curve. Both canvas and SVG receive this same sampled polyline.
export function diagramSeriesPath(kind,states,curve='line',geometry={}){
 const axes=diagramAxes(kind),base=axes.initial,span={x:base.xmax-base.xmin,y:base.ymax-base.ymin};
 const anchors=states.map(q=>diagramPoint(kind,q));
 if(anchors.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {points:[],limited:true};
 if(curve==='line')return {points:anchors,limited:false};
 const cleanAnchors=anchors.filter((p,i)=>!i||p.x!==anchors[i-1].x||p.y!==anchors[i-1].y),ps=cleanAnchors.map(p=>({x:p.x/span.x,y:p.y/span.y}));
 if(ps.length<3)return {points:[],limited:false};
 const closed=ps.length>3&&ps[0].x===ps.at(-1).x&&ps[0].y===ps.at(-1).y;
 const range=geometry.range||base,w=geometry.width||800,h=geometry.height||500,tolerance=.4,points=[anchors[0]],maxExtra=Math.max(0,4096-ps.length);let extra=0,limited=false;
 const physical=p=>({x:p.x*span.x,y:p.y*span.y}),pixel=p=>({x:(p.x*span.x-range.xmin)/(range.xmax-range.xmin)*w,y:(p.y*span.y-range.ymin)/(range.ymax-range.ymin)*h});
 const extrapolate=(a,b)=>({x:2*a.x-b.x,y:2*a.y-b.y}),distance=(a,b)=>Math.max(1e-12,Math.sqrt(Math.hypot(a.x-b.x,a.y-b.y)));
 for(let i=0;i<ps.length-1;i++){
  const b=ps[i],c=ps[i+1],a=ps[i-1]||(closed?ps.at(-2):extrapolate(b,c)),d=ps[i+2]||(closed?ps[1]:extrapolate(c,b)),ab=distance(a,b),bc=distance(b,c),cd=distance(c,d);
  const m={},n={};for(const k of ['x','y']){m[k]=bc*((b[k]-a[k])/ab-(c[k]-a[k])/(ab+bc)+(c[k]-b[k])/bc);n[k]=bc*((c[k]-b[k])/bc-(d[k]-b[k])/(bc+cd)+(d[k]-c[k])/cd);}
  // The Bezier control hull bounds the whole cubic. Invisible segments need no
  // subdivision and cannot consume the budget intended for visible detail.
  const hull=[b,{x:b.x+m.x/3,y:b.y+m.y/3},{x:c.x-n.x/3,y:c.y-n.y/3},c].map(pixel);
  if(hull.every(p=>p.x<0)||hull.every(p=>p.x>w)||hull.every(p=>p.y<0)||hull.every(p=>p.y>h)){points.push(cleanAnchors[i+1]);continue;}
  const at=t=>Object.fromEntries(['x','y'].map(k=>[k,(2*t**3-3*t*t+1)*b[k]+(t**3-2*t*t+t)*m[k]+(-2*t**3+3*t*t)*c[k]+(t**3-t*t)*n[k]]));
  const deviation=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,v=dx*dx+dy*dy,t=v?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/v)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  const emit=(t0,t1,p0,p1,depth)=>{const error=Math.max(...[.25,.5,.75].map(f=>deviation(pixel(at(t0+(t1-t0)*f)),pixel(p0),pixel(p1))));
   if(error<=tolerance){points.push(physical(p1));return;}
   if(depth>=12||extra>=maxExtra){limited=true;points.push(physical(p1));return;}
   extra++;const tm=(t0+t1)/2,pm=at(tm);emit(t0,tm,p0,pm,depth+1);emit(tm,t1,pm,p1,depth+1);
  };emit(0,1,b,c,0);points[points.length-1]=cleanAnchors[i+1];
 }
 return {points,limited};
}
