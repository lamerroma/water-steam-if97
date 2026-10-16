import {readRankineSweepInput,rankineSweepPointConfig,rankineSweepTable,rankineSweepNotes,rankineSweepSVG,rankineSweepCSV,rankineSweepInputRows} from './rankine-sweep.js';
var rankineSweepResult;
function ccSweepInvalidate(){
 if(cycleLibraryState?.sweep)cycleLibraryState.sweep.input=null;
 rankineSweepResult=null;$('cs-results')?.replaceChildren();
}
function ccMountSweep(){
 const t=ccText,s=cycleLibraryState.sweep,host=document.createElement('details');host.id='cl-sweep';host.className='cl-sweep';
 host.innerHTML=`<summary>${t('Дослідити вплив тиску відбору','Study extraction pressure')}</summary><p>${t('Сталі параметри беруться з форми шаблону вище. Змінюється лише тиск відбору. Рівномірна сітка включає межі; 2…41 точка.','Fixed parameters come from the template form above. Only extraction pressure varies. Uniform grid includes both endpoints; 2–41 points.')}</p><form id="cs-form"><div class="process-grid">${[['min',t('Від','From')+' [MPa abs]'],['max',t('До','To')+' [MPa abs]'],['count',t('Кількість точок','Number of points')]].map(([k,label])=>`<label>${label}<input id="cs-${k}" inputmode="${k==='count'?'numeric':'decimal'}" maxlength="80" required></label>`).join('')}</div><button id="cs-run" data-cl-action>${t('Розрахувати діапазон','Calculate range')}</button><button type="button" id="cs-cancel" hidden>${t('Скасувати','Cancel')}</button></form><div id="cs-results"></div>`;
 $('cl-method').after(host);for(const k of ['min','max','count'])$('cs-'+k).value=s[k];
 $('cs-form').oninput=e=>{const k=e.target.id.slice(3);if(!['min','max','count'].includes(k))return;ccCancelLibrary();s[k]=e.target.value;ccSweepInvalidate();ccSyncDraft();$('cl-status').textContent=t('Діапазон змінено; запустіть дослідження.','Range changed; run the study.');};
 $('cs-form').onsubmit=e=>{e.preventDefault();ccLibraryRun('sweep',r=>{const raw={...cycleLibraryState.builder},keys=['mass','pLow','pHigh',...(raw.steamMode==='superheated'?['Tsteam']:[]),...(raw.equipment==='actual'?['etaPump','etaPumpHigh','etaHP','etaLP']:[])];for(const k of keys)raw[k]=parseNumber(raw[k]);return r.rankineSweep(readRankineSweepInput({config:raw,min:parseNumber(s.min),max:parseNumber(s.max),count:parseNumber(s.count)}));},q=>{q.input.selected=q.bestIndex??0;ccAcceptSweep(q);});};
 $('cs-cancel').onclick=()=>$('cl-cancel').click();host.hidden=cycleLibraryState.builder.kind!=='rankine-regenerative';
}
function ccAcceptSweep(q){rankineSweepResult=q;cycleLibraryState.sweep.input=q.input;ccSyncDraft();ccRenderSweep();}
function ccMaybeRestoreSweep(){
 if(activeSection!=='custom-cycle'||!$('cs-results')||rankineSweepResult||!cycleLibraryState?.sweep.input||cycleLibraryRunner?.busy||customCycleRunner?.busy)return;
 const input=cycleLibraryState.sweep.input;ccLibraryRun('restore-sweep',r=>r.rankineSweep(input),ccAcceptSweep);
}
function ccRenderSweep(){
 const q=rankineSweepResult,host=$('cs-results');if(!host||!q)return;
 const t=ccText,en=uiTranslator.language==='en',esc=customCycleEscape,s=cycleLibraryState.sweep,table=rankineSweepTable(q,en),best=q.bestIndex===null?null:q.points[q.bestIndex],selected=q.input.selected;
 host.innerHTML=`<p id="cs-summary" role="status">${q.points.filter(p=>p.valid).length}/${q.points.length} ${t('допустимих точок','valid points')}. ${best?t('Найбільший ККД серед розрахованих точок','Largest efficiency among sampled points')+`: p = ${format(best.p)} MPa abs; ηₕ = ${format(100*best.efficiency)} %.`:t('Допустимих точок немає.','No valid points.')} ${t('Це не неперервний оптимум.','This is not a continuous optimum.')}</p><details><summary>${t('Зафіксовані вхідні дані й метод','Frozen inputs and method')}</summary><p>${rankineSweepInputRows(q.input).map(([k,v,u])=>`${esc(k)} = ${esc(v)} ${esc(u)}`).join('; ')}</p>${rankineSweepNotes(en).map(n=>`<p>${esc(n)}</p>`).join('')}</details><div class="cs-toolbar"><label>${t('Показник графіка','Chart quantity')}<select id="cs-metric">${[['efficiency',t('ККД','Efficiency')],['work',t('Корисна робота','Net work')],['y',t('Частка відбору','Extraction fraction')],['moisture',t('Вологість виходу ЦНТ','LP exit moisture')]].map(([k,label])=>`<option value="${k}">${label}</option>`).join('')}</select></label><button id="cs-svg" type="button">SVG</button><button id="cs-csv" type="button">CSV</button><button id="cs-report" type="button">${t('Дослідження до звіту','Add study to report')}</button></div><div id="cs-chart">${rankineSweepSVG(q,s.metric,en,selected)}</div><p id="cs-selection">${t('Вибрана точка','Selected point')} ${selected+1}: p = ${format(q.points[selected].p)} MPa abs${q.points[selected].valid?'':'; '+esc(q.points[selected].error)}</p><button id="cs-open" type="button" data-cl-action ${q.points[selected].valid?'':'disabled'}>${t('Відкрити вибрану точку в редакторі','Open selected point in editor')}</button><div class="ui-table-scroll"><table id="cs-table"><thead><tr>${table.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row,i)=>`<tr aria-selected="${i===selected}">${row.map((v,j)=>`<td>${j===0?`<button type="button" data-sweep-row="${i}">${i+1}${i===q.bestIndex?' ★':''}</button>`:esc(typeof v==='number'?format(v):v??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const select=i=>{q.input.selected=i;s.input=q.input;ccSyncDraft();ccRenderSweep();};
 $('cs-metric').value=s.metric;$('cs-metric').onchange=()=>{s.metric=$('cs-metric').value;ccSyncDraft();ccRenderSweep();};
 for(const n of host.querySelectorAll('[data-sweep-point]')){n.onclick=()=>select(Number(n.dataset.sweepPoint));n.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const i=Number(n.dataset.sweepPoint);select(i);$('cs-chart').querySelector(`[data-sweep-point="${i}"]`).focus();}};}
 for(const n of host.querySelectorAll('[data-sweep-row]'))n.onclick=()=>select(Number(n.dataset.sweepRow));
 $('cs-open').onclick=()=>ccLibraryTry(()=>{const config=rankineSweepPointConfig(q,q.input.selected);ccLibraryRun('sweep-point',r=>r.libraryCycle(config),built=>{for(const [k,v]of Object.entries(config))if(Object.hasOwn(cycleLibraryState.builder,k)){cycleLibraryState.builder[k]=String(v);$('cl-'+k).value=String(v);}cycleLibraryState.builder.equipment=config.equipment??'ideal';$('cl-equipment').value=cycleLibraryState.builder.equipment;ccLibraryFields();ccApplyLibrary(built.result);});});
 $('cs-csv').onclick=()=>downloadFile(rankineSweepCSV(q),'rankine-extraction-study.csv','text/csv;charset=utf-8',{model:q.input.config.model});
 $('cs-svg').onclick=()=>downloadFile(rankineSweepSVG(q,s.metric,en),'rankine-extraction-'+s.metric+'.svg','image/svg+xml;charset=utf-8',{model:q.input.config.model});
 $('cs-report').onclick=()=>appendStudyEntry({kind:'rankine-sweep',model:q.input.config.model,title:t('Вплив тиску відбору на Ренкін','Rankine extraction pressure study'),input:q.input});
 ccLibraryBusy(!!cycleLibraryJob);
}
function showRankineSweepSource(value){
 const input=readRankineSweepInput(value);showCustomCycle();ccCancelLibrary();rankineSweepResult=null;
 for(const [k,v]of Object.entries(input.config))if(Object.hasOwn(cycleLibraryState.builder,k)){cycleLibraryState.builder[k]=String(v);$('cl-'+k).value=String(v);}cycleLibraryState.builder.equipment=input.config.equipment??'ideal';$('cl-equipment').value=cycleLibraryState.builder.equipment;
 Object.assign(cycleLibraryState.sweep,{min:String(input.min),max:String(input.max),count:String(input.count),input});for(const k of ['min','max','count'])$('cs-'+k).value=cycleLibraryState.sweep[k];
 ccLibraryFields();$('cc-library').open=true;$('cl-sweep').open=true;ccSyncDraft();ccMaybeRestoreSweep();
}
