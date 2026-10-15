import {calculate} from './engine.js';
import {processGas} from './process-gas.js';

export const CYCLE_CHARTS={ts:{x:'s',y:'T',label:'T–s'},hs:{x:'s',y:'h',label:'h–s'},pv:{x:'v',y:'p',label:'p–v'},pt:{x:'T',y:'p',label:'p–T'},ps:{x:'s',y:'p',label:'p–s'},tv:{x:'v',y:'T',label:'T–v'}};
const cycleChartUnits={p:'MPa abs',T:'K',h:'kJ/kg',s:'kJ/(kg K)',v:'m³/kg'};
const cycleChartEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function readCycleChartView(value){
 const v=value??{};if(typeof v!=='object'||Array.isArray(v))throw Error('Invalid cycle chart view.');
 const kind=v.kind??'ts';if(!Object.hasOwn(CYCLE_CHARTS,kind)||v.guides!=null&&typeof v.guides!=='boolean')throw Error('Invalid cycle chart coordinates.');
 const ranges={};if(v.ranges!=null&&(typeof v.ranges!=='object'||Array.isArray(v.ranges)))throw Error('Invalid cycle chart ranges.');
 for(const [k,r]of Object.entries(v.ranges||{})){
  if(!Object.hasOwn(CYCLE_CHARTS,k)||!r||!['xmin','xmax','ymin','ymax'].every(a=>Number.isFinite(r[a])&&Math.abs(r[a])<1e12)||r.xmax-r.xmin<Math.max(Math.abs(r.xmin)*1e-12,Math.abs(r.xmax)*1e-12,1e-12)||r.ymax-r.ymin<Math.max(Math.abs(r.ymin)*1e-12,Math.abs(r.ymax)*1e-12,1e-12))throw Error('Invalid cycle chart range.');
  ranges[k]={xmin:r.xmin,xmax:r.xmax,ymin:r.ymin,ymax:r.ymax};
 }
 if(v.selected!=null&&(!Number.isInteger(v.selected)||v.selected<0||v.selected>11))throw Error('Invalid cycle chart selection.');
 return {kind,guides:v.guides===true,ranges,selected:v.selected??0};
}
export function cycleChartRange(q,kind){
 const axes=CYCLE_CHARTS[kind];if(!axes)throw Error('Unknown cycle chart.');
 const samples=[...q.states,...q.edges.flatMap(e=>e.result.path)];
 const extent=k=>{let min=Infinity,max=-Infinity;for(const s of samples){if(!Number.isFinite(s[k]))throw Error('Non-finite cycle chart coordinate.');min=Math.min(min,s[k]);max=Math.max(max,s[k]);}const pad=Math.max((max-min)*.08,Math.abs(min)*1e-5,1e-7);return [min-pad,max+pad];};
 const [xmin,xmax]=extent(axes.x),[ymin,ymax]=extent(axes.y);return {xmin,xmax,ymin,ymax};
}
export function transformCycleChartRange(range,factor=1,dx=0,dy=0){
 if(!Number.isFinite(factor)||factor<=0||![dx,dy].every(Number.isFinite))throw Error('Invalid cycle chart transform.');
 const w=range.xmax-range.xmin,h=range.ymax-range.ymin,cx=(range.xmin+range.xmax)/2+dx*w,cy=(range.ymin+range.ymax)/2+dy*h;
 const r={xmin:cx-w*factor/2,xmax:cx+w*factor/2,ymin:cy-h*factor/2,ymax:cy+h*factor/2};
 if(w*factor<Math.max(Math.abs(cx)*1e-12,1e-12)||h*factor<Math.max(Math.abs(cy)*1e-12,1e-12))return {...range};
 try{return readCycleChartView({ranges:{ts:r}}).ranges.ts;}catch{return {...range};}
}
// Fixed p/T families use the same fluid/model as the cycle. Invalid or ambiguous
// states and phase changes split segments; no straight bridge crosses saturation.
export function cycleChartGuides(q){
 const samples=q.edges.flatMap(e=>e.result.path),bounds=k=>{let lo=Infinity,hi=-Infinity;for(const s of samples){lo=Math.min(lo,s[k]);hi=Math.max(hi,s[k]);}return [lo,hi];},[plo,phi]=bounds('p'),[tlo,thi]=bounds('T'),water=q.input.fluid==='water',get=water?(p,T)=>{const r=calculate('pt',p,T,q.model);if(!r.state||r.alternatives?.length)throw Error('Ambiguous');return r.state;}:processGas(q.input.fluid,q.model).get;
 const state=(p,T)=>water?get(p,T):get('pt',p,T),lines=[];
 for(const family of ['p','T'])for(const f of [.25,.5,.75]){
  const value=family==='p'?plo+(phi-plo)*f:tlo+(thi-tlo)*f,segments=[];let segment=[];
  const flush=()=>{if(segment.length>1)segments.push(segment);segment=[];};
  for(let i=0;i<=48;i++){
   try{const s=state(family==='p'?value:plo+(phi-plo)*i/48,family==='T'?value:tlo+(thi-tlo)*i/48);if(!['p','T','h','s','v'].every(k=>Number.isFinite(s[k])))throw Error('Invalid');if(water&&segment.length&&segment.at(-1).phase!==s.phase)flush();segment.push(s);}catch{flush();}
  }
  flush();if(segments.length)lines.push({family,value,segments});
 }
 return lines;
}
export function customCycleSVG(q,kind='ts',en=false,selected=-1,options={}){
 if(!Object.hasOwn(CYCLE_CHARTS,kind))throw Error('Unknown cycle chart.');
 const {x:xkey,y:ykey,label:title}=CYCLE_CHARTS[kind],view=readCycleChartView({kind,ranges:options.range?{[kind]:options.range}:{}}),r=view.ranges[kind]??cycleChartRange(q,kind),dx=r.xmax-r.xmin,dy=r.ymax-r.ymin;
 const px=s=>100+600*(s[xkey]-r.xmin)/dx,py=s=>325-280*(s[ykey]-r.ymin)/dy,n=v=>Number(v.toPrecision(5)),esc=cycleChartEscape,colors=['#005f99','#b24b18','#35732e','#824fa1','#946b00','#147b78'];
 const points=path=>path.map(s=>`${px(s).toFixed(3)},${py(s).toFixed(3)}`).join(' '),clip='cycle-clip-'+kind,inside=s=>px(s)>=100&&px(s)<=700&&py(s)>=45&&py(s)<=325;
 const guides=options.guides?(q.guides??cycleChartGuides(q)):[];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 410" role="img" data-cycle-chart="${kind}" aria-label="${title} ${en?'cycle':'цикл'}"><title>${title} · ${esc(q.model)} · ${esc(q.input.fluid)}</title><rect width="760" height="410" fill="white"/><defs><clipPath id="${clip}"><rect x="100" y="45" width="600" height="280"/></clipPath></defs><g font-family="Arial" font-size="13" fill="#18364e">${Array.from({length:5},(_,i)=>{const t=i/4;return `<path d="M${100+600*t} 45V325M100 ${325-280*t}H700" stroke="#e1e8ef"/><text x="${100+600*t}" y="348" text-anchor="middle">${n(r.xmin+dx*t)}</text><text x="91" y="${330-280*t}" text-anchor="end">${n(r.ymin+dy*t)}</text>`;}).join('')}<path d="M100 45V325H700" fill="none" stroke="#708090"/><text x="400" y="377" text-anchor="middle">${xkey} [${cycleChartUnits[xkey]}]</text><text x="100" y="25">${ykey} [${cycleChartUnits[ykey]}]</text><text x="700" y="25" text-anchor="end">${title}</text><g clip-path="url(#${clip})">${guides.map(line=>line.segments.map(path=>`<polyline data-cycle-guide="${line.family}" points="${points(path)}" fill="none" stroke="${line.family==='p'?'#7a8c9c':'#a98765'}" stroke-dasharray="5 5" stroke-width="1"><title>${line.family} = ${n(line.value)} ${cycleChartUnits[line.family]}</title></polyline>`).join('')).join('')}${q.edges.map((e,i)=>{const series=options.seriesBreak==null?null:i<options.seriesBreak?'A':'B',color=series?(series==='A'?'#005f99':'#b24b18'):colors[i%colors.length];const path=e.result.path,m=Math.max(0,Math.floor(path.length*.55)-1),a=path[m],b=path[m+1],angle=Math.atan2(py(b)-py(a),px(b)-px(a))*180/Math.PI;return `<polyline data-cycle-path="${i}"${e.result.schematic?' data-machine-schematic="true"':''}${series?` data-cycle-series="${series}"`:""} points="${points(path)}" fill="none" stroke="${color}" stroke-width="2.5" ${series==='B'||e.result.schematic?'stroke-dasharray="8 4"':''}>${e.result.schematic?`<title>${en?'Schematic inlet–outlet connection; internal path unknown':'Схематичне з’єднання входу й виходу; внутрішній шлях невідомий'}</title>`:''}</polyline><path d="M-6 -4L2 0L-6 4" transform="translate(${px(b)} ${py(b)}) rotate(${angle})" fill="none" stroke="${color}" stroke-width="2"/>`;}).join('')}</g>${q.states.filter(inside).map(s=>{const i=q.states.indexOf(s),second=options.stateBreak!=null&&i>=options.stateBreak;return `<g data-custom-state="${i}" ${selected>=0?`role="button" tabindex="0" aria-pressed="${i===selected}"`:''} aria-label="${esc(s.name)}"><title>${esc(s.name)}: p = ${n(s.p)} MPa abs; T = ${n(s.T)} K; h = ${n(s.h)} kJ/kg; s = ${n(s.s)} kJ/(kg K); v = ${n(s.v)} m³/kg</title><circle cx="${px(s)}" cy="${py(s)}" r="18" fill="transparent" pointer-events="all"/><circle cx="${px(s)}" cy="${py(s)}" r="${i===selected?7:second?4:5}" fill="${i===selected?'#b04020':options.stateBreak==null?'#18364e':i<options.stateBreak?'#005f99':'#b24b18'}"/><text x="${px(s)+9}" y="${py(s)+(second?20:-9)}">${esc(s.name)}</text></g>`;}).join('')}<text x="100" y="400" font-size="11">${options.seriesBreak!=null?(en?'A: blue solid; B: orange dashed.':'A: синя суцільна; B: помаранчева штрихова.'):options.guides?(en?'Dashed: p = const (blue-grey), T = const (brown); gaps at phase changes.':'Штрихові: p = const (сіро-сині), T = const (коричневі); розриви на зміні фази.'):''}</text></g></svg>`;
}
