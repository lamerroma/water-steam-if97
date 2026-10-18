import {readDiagramTools} from './diagram-guides.js';
import {diagramAxes} from './diagram-coordinates.js';
import {diagramQuantity} from './diagram-units.js';
import {readDiagramDrawing,syncDiagramDrawing,diagramDrawingSnapshot} from './diagram-series.js';
export function readDiagramWorkspace(data,states){
 const d=data??{};
 if(typeof d!=='object'||Array.isArray(d))throw Error('Некоректні налаштування діаграми.');
 for(const k of ['connectHistory','numbers'])if(d[k]!=null&&typeof d[k]!=='boolean')throw Error('Некоректний перемикач діаграми.');
 const indexes=k=>{const a=d[k]??[];if(!Array.isArray(a)||a.length>500||new Set(a).size!==a.length||a.some(i=>!Number.isInteger(i)||i<0||i>=states.length))throw Error('Некоректна послідовність станів діаграми.');return a.map(i=>states[i]);};
 const views={};if(d.views!=null&&(typeof d.views!=='object'||Array.isArray(d.views)))throw Error('Некоректний вигляд діаграми.');
 for(const [key,v] of Object.entries(d.views||{})){
  if(!['IF97:ts','IF97:hsdiagram','IF97:phdiagram','IAPWS-95:ts','IAPWS-95:hsdiagram','IAPWS-95:phdiagram'].includes(key)||!v||typeof v!=='object')throw Error('Невідомий вигляд діаграми.');
  const axes=diagramAxes(key.split(':')[1]);const r=v.range;if(!r||!['xmin','xmax','ymin','ymax'].every(k=>Number.isFinite(r[k])&&Math.abs(r[k])<1e7)||r.xmax-r.xmin<axes.minWidth*.98||r.xmax-r.xmin>axes.maxWidth*1.001||r.ymax<=r.ymin)throw Error('Некоректний масштаб діаграми.');
  if(v.historyIndex!=null&&(!Number.isInteger(v.historyIndex)||!states[v.historyIndex]))throw Error('Некоректна вибрана точка.');
  if(v.processIndex!=null&&(!Number.isInteger(v.processIndex)||v.processIndex<0||v.processIndex>4))throw Error('Некоректна точка процесу.');
  if(v.historyIndex!=null&&v.processIndex!=null)throw Error('Неоднозначна вибрана точка.');
  const preset=v.preset??'full';if(preset!=='full'&&!(preset==='vapor'&&key.endsWith(':hsdiagram')))throw Error('Невідомий масштаб діаграми.');
  if(v.hiddenIsobars!=null&&(!Array.isArray(v.hiddenIsobars)||new Set(v.hiddenIsobars).size!==v.hiddenIsobars.length||v.hiddenIsobars.some(i=>!Number.isInteger(i)||i<0||i>6)))throw Error('Некоректна видимість ізобар.');
  views[key]={range:{...r},point:v.historyIndex!=null?states[v.historyIndex]:null,processIndex:v.processIndex??null,preset,...(v.hiddenIsobars?{hiddenIsobars:[...v.hiddenIsobars]}:{})};
 }
 return {tools:readDiagramTools(d.tools),views,connectHistory:d.connectHistory===true,numbers:d.numbers!==false,order:indexes('order'),excluded:indexes('excluded'),...readDiagramDrawing(d,states)};
}
export function syncDiagramWorkspace(plan,states){
 plan.order=plan.order.filter(q=>states.includes(q));
 for(const q of [...states].reverse())if(!plan.order.includes(q))plan.order.push(q);
 plan.excluded=plan.excluded.filter(q=>states.includes(q));
 syncDiagramDrawing(plan,states);
 return plan;
}
export function diagramWorkspaceSnapshot(plan,states){
 syncDiagramWorkspace(plan,states);
 const views=Object.fromEntries(Object.entries(plan.views||{}).map(([k,v])=>[k,{range:{...v.range},preset:v.preset||'full',...(v.hiddenIsobars?{hiddenIsobars:[...v.hiddenIsobars]}:{}),...(states.includes(v.point)?{historyIndex:states.indexOf(v.point)}:v.processIndex!=null?{processIndex:v.processIndex}:{})}]));
 return {tools:readDiagramTools(plan.tools),views,connectHistory:plan.connectHistory,numbers:plan.numbers,order:plan.order.map(q=>states.indexOf(q)),excluded:plan.excluded.map(q=>states.indexOf(q)),...diagramDrawingSnapshot(plan,states)};
}
const diagramEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function diagramTable(entries,system='si',energy='kJ',interactive=false,excluded=[],digits=10,preferences){
 const fields=['p','T','h','s','x'];
 const val=(k,q)=>k==='x'?[q.x,'–']:diagramQuantity(k,k==='T'?q.T-273.15:q[k],system,energy,preferences);
 const text=v=>Number.isFinite(v)?String(Number(v.toPrecision(digits))):'—';
 return `<table class="sat-table diagram-state-table"><thead><tr><th>№</th><th>Стан</th>${fields.map(k=>`<th>${k} [${diagramEscape(val(k,{})[1])}${k==='p'?' (абс.)':''}]</th>`).join('')}<th>Фаза</th>${interactive?'<th>Послідовність журналу</th>':''}</tr></thead><tbody>${entries.map(([q,label,source,custom],i)=>`<tr><td>${interactive?`<button type="button" data-diagram-select="${i}" aria-label="Вибрати точку ${i+1}">${i+1}</button>`:i+1}</td><td ${q.name||custom?'data-i18n-ignore':''}>${diagramEscape(label)}</td>${fields.map(k=>`<td>${text(val(k,q)[0])}</td>`).join('')}<td>${diagramEscape(q.phase)}</td>${interactive?`<td>${source==='history'?`<label><input type="checkbox" data-diagram-include="${i}" ${excluded.includes(q)?'':'checked'}> Додати</label><button type="button" data-diagram-move="${i}" data-direction="-1" aria-label="Точку ${i+1} раніше">↑</button><button type="button" data-diagram-move="${i}" data-direction="1" aria-label="Точку ${i+1} пізніше">↓</button>`:'Процес'}</td>`:''}</tr>`).join('')}</tbody></table>`;
}
export function diagramExportRows(entries,system='si',energy='kJ',plan={connectHistory:false,excluded:[]},preferences){
 const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const fields=['p','T','h','s'];const convert=(k,q)=>diagramQuantity(k,k==='T'?q.T-273.15:q[k],system,energy,preferences);
 const rows=[['pressure_basis','absolute'],['history_connections',plan.connectHistory?'enabled':'disabled'],['number','state','source','journal_selected',...fields.map(k=>`${k} [${convert(k,{})[1]}]`),'x [-]','model','phase'],...entries.map(([q,label,source],i)=>[i+1,label,source,source==='history'?!plan.excluded.includes(q):'',...fields.map(k=>convert(k,q)[0]),q.x,q.model||'IF97',q.phase])];
 const model=plan.exportModel||entries[0]?.[0].model||'IF97';
 if(plan.drawingStyle)rows.push([],['point_radius_px',plan.drawingStyle.radius],['point_color',plan.drawingStyle.pointColor],['series_width_px',plan.drawingStyle.width],['series_color',plan.drawingStyle.lineColor]);
 const series=(plan.series||[]).filter(s=>s.model===model);
 if(series.length)rows.push([],['drawing_interpolation','centripetal Catmull-Rom; fixed canonical axis normalization; not a thermodynamic path'],['series','model','kind','point_labels','complete'],...series.map(s=>[s.name,s.model,s.kind,s.points.map(q=>entries.find(e=>e[0]===q)?.[1]||'').join(' → '),new Set(s.points).size>=(s.kind==='spline'?3:2)]));
 return rows;
}
export function diagramDrawingReport(plan,entries,model){
 const series=(plan?.series||[]).filter(s=>s.model===model);if(!series.length)return '';
 return '<h2>Іменовані серії</h2><p>Лінії та сплайни — графічні зв’язки між точками, а не розраховані проміжні термодинамічні стани.</p><table><thead><tr><th>Назва серії</th><th>Тип серії</th><th>Підписи точок серії</th><th>Стан</th></tr></thead><tbody>'+series.map(s=>`<tr><td data-i18n-ignore>${diagramEscape(s.name)}</td><td>${s.kind==='spline'?'Сплайн':'Лінія'}</td><td data-i18n-ignore>${diagramEscape(s.points.map(q=>entries.find(e=>e[0]===q)?.[1]||'').join(' → '))}</td><td>${new Set(s.points).size>=(s.kind==='spline'?3:2)?'Готово':'Бракує точок'}</td></tr>`).join('')+'</tbody></table>';
}
export function diagramReport(title,svg,entries,system='si',energy='kJ',note='',preferences,drawing){
 return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title data-i18n-ignore>${diagramEscape(title)}</title><style>body{font:14px Arial;color:#182b40;margin:24px}svg{display:block;width:100%;height:auto;max-height:65vh}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #abc;padding:6px}thead{display:table-header-group}tr{break-inside:avoid}.table-scroll{overflow:auto}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}svg{max-height:140mm}.table-scroll{overflow:visible}}</style></head><body><h1 data-i18n-ignore>${diagramEscape(title)}</h1><p>${diagramEscape(note)}</p><p>Усі тиски абсолютні. Коли нумерацію ввімкнено, номери точок відповідають таблиці; лінії між станами — схематичні зв’язки, а не розрахований проміжний шлях процесу.</p>${svg}${drawing?diagramDrawingReport(drawing.plan,entries,drawing.model):''}<h2>Стани на діаграмі</h2><div class="table-scroll">${diagramTable(entries,system,energy,false,[],10,preferences)}</div><p>Для друку або збереження PDF скористайтеся командою друку браузера.</p></body></html>`;
}

export function diagramCSV(...args){
 const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 return '\ufeff'+diagramExportRows(...args).map(r=>r.map(cell).join(';')).join('\r\n');
}
