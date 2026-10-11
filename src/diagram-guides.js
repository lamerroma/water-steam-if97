import {calculate,TC,PC} from './engine.js';
import {parseNumber,toCanonical} from './units.js';
import {diagramPoint} from './diagram-coordinates.js';
export const DEFAULT_DIAGRAM_TOOLS={crosshair:true,regions:true,isotherms:false,qualities:false,temperatureUnit:'C',temperatures:[373.15,473.15,573.15,673.15],dryness:[.1,.3,.5,.7,.9]};
export function readDiagramTools(value){
 const d=value??{};if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Некоректні допоміжні лінії діаграми.');
 const tools={...DEFAULT_DIAGRAM_TOOLS};
 for(const key of ['crosshair','regions','isotherms','qualities']){if(d[key]!=null&&typeof d[key]!=='boolean')throw Error('Некоректний перемикач допоміжних ліній.');tools[key]=d[key]??tools[key];}
 if(d.temperatureUnit!=null&&!['C','K','F'].includes(d.temperatureUnit))throw Error('Некоректна одиниця ізотерм.');tools.temperatureUnit=d.temperatureUnit??'C';
 for(const [key,max,min,upper] of [['temperatures',6,273.15,1073.15],['dryness',9,0,1]]){const a=d[key]??tools[key];if(!Array.isArray(a)||!a.length||a.length>max||new Set(a).size!==a.length||a.some(v=>!Number.isFinite(v)||v<min||v>upper||key==='dryness'&&(v===0||v===1)))throw Error('Некоректні значення допоміжних ліній.');tools[key]=[...a];}
 return tools;
}
export function parseDiagramGuideValues(text,kind,unit='C',model='IF97'){
 const parts=String(text).trim().split(/[;\s]+/).filter(Boolean),max=kind==='temperature'?6:9;
 if(!parts.length||parts.length>max)throw Error(kind==='temperature'?'Задайте від 1 до 6 температур через крапку з комою.':'Задайте від 1 до 9 значень сухості через крапку з комою.');
 const values=parts.map(s=>kind==='temperature'?toCanonical(parseNumber(s),unit):parseNumber(s));
 if(kind==='temperature'&&values.some(v=>v<(model==='IF97'?273.15:273.16)-1e-9||v>1073.15+1e-9))throw Error(model==='IF97'?'Ізотерми: діапазон 0…800 °C.':'Ізотерми IAPWS-95: діапазон 0,01…800 °C.');
 if(kind!=='temperature'&&values.some(v=>v<=0||v>=1))throw Error('Сухість: потрібно 0 < x < 1; x = 0 та x = 1 вже показані куполом.');
 const unique=[...new Set(values.map(v=>Number(v.toPrecision(12))))].sort((a,b)=>a-b);return unique;
}
export function diagramMixture(liquid,vapor,x){
 if(!liquid||!vapor||liquid.critical||vapor.critical)return null;
 return {T:liquid.T,p:liquid.p,h:liquid.h+x*(vapor.h-liquid.h),s:liquid.s+x*(vapor.s-liquid.s),x,model:liquid.model||vapor.model||'IF97',phase:'Двофазна суміш'};
}
export function diagramQualityLines(cache,values){
 return values.map(x=>({x,points:cache.dome[0].map((q,i)=>diagramMixture(q,cache.dome[1][i],x))}));
}
// Pressure increases monotonically. Explicit saturation endpoints include the
// complete two-phase segment without joining uncomputed P–T states across a gap.
export async function diagramIsotherm(T,model='IF97',yieldFrame=()=>Promise.resolve()){
 parseDiagramGuideValues(String(T),'temperature','K',model);
 const maxP=model==='IF97'?100:1000,minP=.0006,pressures=Array.from({length:81},(_,i)=>minP*(maxP/minP)**(i/80));
 let sat=null;if(T<TC){try{sat=calculate('satt',T,undefined,model).saturation;}catch{}}
 const samples=[];for(let i=0;i<pressures.length;i++){
  const p=pressures[i];if(sat&&Math.abs(p-sat.p)<sat.p*1e-7)continue;
  let q=null;try{q=calculate('pt',p,T,model).state||null;}catch{}
  samples.push({p,q});if(i%16===15)await yieldFrame();
 }
 if(sat){samples.push({p:sat.p,q:sat.vapor,order:0},{p:sat.p,q:sat.liquid,order:1});}
 samples.sort((a,b)=>a.p-b.p||(a.order??0)-(b.order??0));
 return {T,points:samples.map(s=>s.q)};
}
export function diagramRegionAnnotations(cache,model='IF97'){
 const annotations=[];
 for(const [text,p,T] of [['Рідина',10,423.15],['Перегріта пара',.1,673.15],['Надкритична область',30,773.15]]){try{const state=calculate('pt',p,T,model).state;if(state)annotations.push({text,state:{...state,model:state.model||model}});}catch{}}
 try{const sat=calculate('satt',473.15,undefined,model).saturation;annotations.push({text:'Волога пара',state:diagramMixture(sat.liquid,sat.vapor,.5)});}catch{}
 const a=cache.dome[0].at(-1),b=cache.dome[1].at(-1);
 if(a&&b)annotations.push({text:model==='IF97'?'Критична точка':'Критична точка ≈',critical:true,state:{model,T:TC,p:PC,h:(a.h+b.h)/2,s:(a.s+b.s)/2}});
 return annotations;
}
// Find an interior label location. The marker remains tied to a computed sample;
// labels are omitted when the entire curve is outside the current viewport.
export function diagramGuideLabel(kind,line,range){
 const visible=line.points.filter(Boolean).map(q=>({q,...diagramPoint(kind,q)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>range.xmin+(range.xmax-range.xmin)*.08&&p.x<range.xmax-(range.xmax-range.xmin)*.08&&p.y>range.ymin+(range.ymax-range.ymin)*.08&&p.y<range.ymax-(range.ymax-range.ymin)*.08);
 return visible.length?visible[Math.floor(visible.length*.6)].q:null;
}
