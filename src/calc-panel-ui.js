// Generic calculator panel: one selector of related calculations, each with its
// visible inputs, formula, result rows, optional node table and inline SVG chart.
// Used by the channel thermal-hydraulics and power-plant sections; the Steam
// systems panel keeps its own older copy of the same pattern.
//
// Config: {action, prefix, i18n, fields, calcs, groups}
//  fields: key -> [id, unit label, default, options?, uiGroup?, uiBase?]
//  calcs:  id  -> {group, fields, visible?(values) -> keys, run(values) -> result}
//  result: {rows:[[labelKey, value, unit]], notes:[key|text], table?:{columns:[[key,unit]], rows:[[...]]}, svg?:string}
// Inputs, local units and the calculated flag are stored in the project workspace.
const calcPanelResults=new Map();
export function calcPanelValues(cfg,calc,raw){
 const spec=cfg.calcs[calc],out={};
 for(const key of spec.fields){const [, , ,opts]=cfg.fields[key];out[key]=opts?raw[key]:parseNumber(String(raw[key]??''));}
 return out;
}
export function calcPanelVisible(cfg,calc,values){const spec=cfg.calcs[calc],extra=spec.visible?.(values);return extra?spec.fields.filter(k=>extra.includes(k)):spec.fields.slice();}
export function calcPanelCheck(cfg,calc,values){
 for(const k of calcPanelVisible(cfg,calc,values)){const [id,, ,opts]=cfg.fields[k];if(!opts&&!Number.isFinite(values[k]))return {field:id};}
 return null;
}
function calcPanelText(cfg,key,parameters){return typeof key==='string'&&key.startsWith(cfg.i18n+'.')?uiTranslator.t(key,parameters):uiTranslator.text(String(key));}
function calcPanelFormat(cfg,value){if(value==null)return '—';if(typeof value==='string')return calcPanelText(cfg,value);return format(value);}
function calcPanelFieldHTML(cfg,key){
 const [id,unit,def,opts,group,base]=cfg.fields[key],p=cfg.prefix,label=escapeHTML(calcPanelText(cfg,cfg.i18n+'.f.'+id))+(unit?', '+escapeHTML(unit):'');
 if(opts)return `<label data-calc-field="${key}">${label}<select id="${p}-${id}">${opts.map(([v,l])=>`<option value="${v}">${escapeHTML(calcPanelText(cfg,l))}</option>`).join('')}</select></label>`;
 return `<label data-calc-field="${key}">${label}<input id="${p}-${id}" value="${def}" inputmode="decimal"${group?` data-ui-group="${group}" data-ui-base="${base}"`:''}></label>`;
}
function calcPanelResultHTML(cfg,r){
 const t=k=>escapeHTML(calcPanelText(cfg,k));
 const rows=r.rows.map(([k,v,u])=>`<tr><td>${t(k)}</td><td>${escapeHTML(calcPanelFormat(cfg,v))}</td><td>${escapeHTML(u?calcPanelText(cfg,u):'')}</td></tr>`).join('');
 let html=`<table class="sat-table"><thead><tr><th>${t(cfg.i18n+'.r.name')}</th><th>${t(cfg.i18n+'.r.value')}</th><th>${t(cfg.i18n+'.r.unit')}</th></tr></thead><tbody>${rows}</tbody></table>`;
 if(r.svg)html+=`<figure class="calc-panel-chart">${r.svg}</figure>`;
 if(r.table)html+=`<div class="calc-panel-table"><table class="sat-table"><thead><tr>${r.table.columns.map(([k,u])=>`<th>${t(k)}${u?', '+escapeHTML(u):''}</th>`).join('')}</tr></thead><tbody>${r.table.rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHTML(calcPanelFormat(cfg,v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return html+notes((r.notes||[]).map(n=>escapeHTML(calcPanelText(cfg,n))));
}
function calcPanelCopyText(cfg,r){
 const lines=r.rows.map(([k,v,u])=>[calcPanelText(cfg,k),calcPanelFormat(cfg,v),u?calcPanelText(cfg,u):''].join('\t'));
 if(r.table)lines.push('',r.table.columns.map(([k,u])=>calcPanelText(cfg,k)+(u?', '+u:'')).join('\t'),...r.table.rows.map(row=>row.map(v=>calcPanelFormat(cfg,v)).join('\t')));
 return lines.join('\n');
}
function calcPanelStyle(){
 if($('calc-panel-style'))return;const style=document.createElement('style');style.id='calc-panel-style';
 style.textContent='.calc-panel-chart{margin:1rem 0;max-width:760px}.calc-panel-chart svg{width:100%;height:auto;display:block}.calc-panel-table{overflow-x:auto;margin-top:1rem}.calc-panel-table table{min-width:640px}';
 document.head.append(style);
}
function calcPanelShow(cfg){
 const p=cfg.prefix,t=k=>escapeHTML(calcPanelText(cfg,k));calcPanelStyle();
 selectView('panel');activeSection=cfg.action;calcPanelResults.delete(cfg.action);$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector(`[role=tab][data-action=${cfg.action}]`)?.setAttribute('aria-selected','true');
 const calcOptions=cfg.groups.map(g=>`<optgroup label="${t(cfg.i18n+'.group.'+g)}">${Object.entries(cfg.calcs).filter(([,c])=>c.group===g).map(([id])=>`<option value="${id}">${t(cfg.i18n+'.calc.'+id)}</option>`).join('')}</optgroup>`).join('');
 $('process-view').innerHTML=`<section class="method"><h2>${t(cfg.i18n+'.title')}</h2><p>${t(cfg.i18n+'.intro')}</p><form id="${p}-form" novalidate><div class="process-grid"><label>${t(cfg.i18n+'.f.calc')}<select id="${p}-calc">${calcOptions}</select></label>${Object.keys(cfg.fields).map(k=>calcPanelFieldHTML(cfg,k)).join('')}</div><details class="steam-formula" open><summary>${t(cfg.i18n+'.formula')}</summary><p id="${p}-formula-text"></p></details><button type="submit" id="${p}-calculate">${t(cfg.i18n+'.calculate')}</button> <button type="button" id="${p}-copy" disabled>${t(cfg.i18n+'.copy')}</button><p id="${p}-error" role="alert" hidden></p></form><div id="${p}-results" aria-live="polite"></div></section>`;
 const form=$(p+'-form');
 const raw=()=>Object.fromEntries(Object.entries(cfg.fields).map(([k,[id]])=>[k,uiStoredValue($(p+'-'+id))]));
 function layout(){
  const calc=$(p+'-calc').value,visible=calcPanelVisible(cfg,calc,raw());
  for(const label of form.querySelectorAll('[data-calc-field]')){const show=visible.includes(label.dataset.calcField);label.hidden=!show;label.querySelector('input,select').disabled=!show;}
  $(p+'-formula-text').textContent=calcPanelText(cfg,cfg.i18n+'.formula.'+calc);
 }
 function clear(){calcPanelResults.delete(cfg.action);$(p+'-results').replaceChildren();$(p+'-copy').disabled=true;$(p+'-error').hidden=true;}
 function edited(){clear();if(!restoringWorkspace){panelEdited(form);capturePanel();saveProject();}}
 form.addEventListener('change',e=>{layout();if(e.target.id.startsWith('ui-unit-')){if(!restoringWorkspace){capturePanel();saveProject();}}else edited();});
 form.addEventListener('input',e=>{if(e.target.tagName!=='SELECT'&&e.isTrusted)edited();});
 form.onsubmit=e=>{e.preventDefault();clear();const calc=$(p+'-calc').value;
  try{const values=calcPanelValues(cfg,calc,raw()),bad=calcPanelCheck(cfg,calc,values);
   if(bad)throw Error(uiTranslator.t(cfg.i18n+'.error.number',{field:calcPanelText(cfg,cfg.i18n+'.f.'+bad.field)}));
   const r=cfg.calcs[calc].run(values);calcPanelResults.set(cfg.action,r);
   $(p+'-results').innerHTML=calcPanelResultHTML(cfg,r);$(p+'-copy').disabled=false;panelCalculated(form);
  }catch(err){$(p+'-error').textContent=calcPanelText(cfg,err.message);$(p+'-error').hidden=false;}
 };
 $(p+'-copy').onclick=()=>{const r=calcPanelResults.get(cfg.action);if(r)navigator.clipboard?.writeText(calcPanelCopyText(cfg,r)).catch(()=>{});};
 restorePanelInputs(cfg.action,form);layout();restorePanelResult(cfg.action,form);
}
// Simple line chart: series [{label, color, points:[[x,y]], dash?}], axis captions.
export function calcPanelLineChart({series,xLabel,yLabel,width=720,height=320}){
 const pts=series.flatMap(s=>s.points).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));
 if(!pts.length)return '';
 const m={l:58,r:16,t:12,b:70},W=width-m.l-m.r,H=height-m.t-m.b;
 let [x0,x1]=[Math.min(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[0]))],[y0,y1]=[Math.min(0,...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[1]))];
 if(x1===x0)x1=x0+1;if(y1===y0)y1=y0+1;
 const nice=(a,b)=>{const span=b-a,step=10**Math.floor(Math.log10(span/5)),s=[1,2,5,10].map(k=>k*step).find(k=>span/k<=6)||step*10;const out=[];for(let v=Math.ceil(a/s)*s;v<=b+s*1e-9;v+=s)out.push(+v.toPrecision(12));return out;};
 const X=x=>m.l+(x-x0)/(x1-x0)*W,Y=y=>m.t+H-(y-y0)/(y1-y0)*H,esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const fmt=v=>Math.abs(v)>=1e4||Math.abs(v)>0&&Math.abs(v)<1e-2?v.toExponential(1):String(+v.toPrecision(4));
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(yLabel)} — ${esc(xLabel)}" font-size="12" font-family="inherit"><rect x="${m.l}" y="${m.t}" width="${W}" height="${H}" fill="#fff" stroke="#a5bad4"/>`;
 for(const v of nice(x0,x1))svg+=`<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${m.t+H}" stroke="#e3e9f1"/><text x="${X(v)}" y="${m.t+H+16}" text-anchor="middle" fill="#526780">${fmt(v)}</text>`;
 for(const v of nice(y0,y1))svg+=`<line x1="${m.l}" x2="${m.l+W}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e9f1"/><text x="${m.l-6}" y="${Y(v)+4}" text-anchor="end" fill="#526780">${fmt(v)}</text>`;
 svg+=`<text x="${m.l+W/2}" y="${m.t+H+36}" text-anchor="middle" fill="#1f2d3d">${esc(xLabel)}</text><text transform="translate(14 ${m.t+H/2}) rotate(-90)" text-anchor="middle" fill="#1f2d3d">${esc(yLabel)}</text>`;
 series.forEach((s,i)=>{const d=s.points.filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)).map(([x,y],j)=>(j?'L':'M')+X(x).toFixed(1)+' '+Y(y).toFixed(1)).join('');svg+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"${s.dash?' stroke-dasharray="6 4"':''}/>`;
  const lx=m.l+i*Math.min(240,W/series.length),ly=height-10;svg+=`<line x1="${lx}" x2="${lx+22}" y1="${ly-4}" y2="${ly-4}" stroke="${s.color}" stroke-width="2"${s.dash?' stroke-dasharray="6 4"':''}/><text x="${lx+28}" y="${ly}" fill="#1f2d3d">${esc(s.label)}</text>`;});
 return svg+'</svg>';
}
