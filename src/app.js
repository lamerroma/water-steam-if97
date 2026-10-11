import {readDisplayDigits,formatProperty,propertyUnavailableReason,INPUT_MODE_LABELS} from './ux-display.js';
import {readPressure,pressureInput,pressureOutput,PRESSURE_UNITS} from './pressure.js';
import {initializeHumidAir} from './humid-air-scientific.js';
import {GLOSSARY} from './glossary.js';
import {printableReport} from './print-report.js';
import {compression,heatExchanger,engineeringStates,engineeringCSV} from './engineering.js';
import {batchUnits,batchRange,parseBatchCSV,calculateBatch,batchStates,batchCSV} from './batch.js';
import {readDiagramWorkspace,syncDiagramWorkspace,diagramWorkspaceSnapshot,diagramTable,diagramCSV,diagramReport} from './diagram-workspace.js';
import {diagramQuantity} from './diagram-units.js';
import {referenceState,withExergy} from './exergy.js';
import {readProject,processCSV} from './project.js';
import {WORKSPACE_PANELS,readWorkspace,readCalculation} from './workspace.js';
import {modeGuidance} from './input-guidance.js';
import {turbine,turbineInverse,flash,diagramData} from './processes.js';
import {exportCSV} from './export.js';
import {initialize,calculate,PMIN_SAT,TC,PC} from './engine.js';
import {parseNumber,toCanonical,fromCanonical,englishProperty} from './units.js';
const $=id=>document.getElementById(id);
// Small original inline-SVG icon set (stroke, currentColor) - no external assets, nothing from the reference site.
const ICON_SVG={
 calc:'<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="7.5" cy="11" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r=".6" fill="currentColor" stroke="none"/><circle cx="16.5" cy="11" r=".6" fill="currentColor" stroke="none"/><circle cx="7.5" cy="15" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r=".6" fill="currentColor" stroke="none"/><circle cx="16.5" cy="15" r=".6" fill="currentColor" stroke="none"/><circle cx="7.5" cy="19" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r=".6" fill="currentColor" stroke="none"/>',
 copy:'<rect x="9" y="9" width="12" height="12" rx="1.5"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
 trash:'<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="11" y1="4" x2="11" y2="20"/>',
 printer:'<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="1.5"/><path d="M7 14h10v7H7z"/>',
 download:'<path d="M12 4v11"/><polyline points="7 10 12 15 17 10"/><line x1="4" y1="19" x2="20" y2="19"/>',
 upload:'<path d="M12 19V8"/><polyline points="7 13 12 8 17 13"/><line x1="4" y1="19" x2="20" y2="19"/>',
 report:'<path d="M14 2H6a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
 flask:'<path d="M9 2h6"/><path d="M10 2v6l-6 11a1.5 1.5 0 0 0 1.3 2.2h13.4a1.5 1.5 0 0 0 1.3-2.2L14 8V2"/><line x1="7.5" y1="14" x2="16.5" y2="14"/>',
 droplet:'<path d="M12 3c4 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 3-7 7-12z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".75" fill="currentColor" stroke="none"/>',
 expand:'<polyline points="4 9 4 4 9 4"/><polyline points="15 4 20 4 20 9"/><polyline points="20 15 20 20 15 20"/><polyline points="9 20 4 20 4 15"/>',
};
const icon=(name,size=14)=>`<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SVG[name]||''}</svg>`;
for(const [action,name] of [['clear','trash'],['export','table'],['print','printer'],['general','flask'],['saturation','droplet'],['help','help']]){const el=document.querySelector(`.toolbar button[data-action="${action}"]`);if(el)el.innerHTML=icon(name,15);}
for(const [action,name] of [['clear','trash'],['export','table'],['export-history','table'],['print','printer']]){const el=document.querySelector(`.menubar .menu button[data-action="${action}"]`);if(el)el.innerHTML=icon(name)+el.textContent;}
{const el=document.querySelector('.menu-right button[data-action="fullscreen"]');if(el)el.innerHTML=icon('expand')+el.textContent.replace(/^▣\s*/,'');}
{const a=document.getElementById('tab-general'),b=document.getElementById('tab-saturation');if(a)a.innerHTML=icon('flask')+a.textContent.replace(/^▣\s*/,'');if(b)b.innerHTML=icon('droplet')+b.textContent.replace(/^▤\s*/,'');}
// Native <details> siblings don't close each other; without this, opening "Тема" while "Файл" is
// still open leaves both dropdowns visible and overlapping.
for(const d of document.querySelectorAll('.menubar details'))d.addEventListener('toggle',()=>{if(d.open)for(const o of document.querySelectorAll('.menubar details'))if(o!==d)o.open=false;});
let last=null, revision=0, persistenceReady=false, storedProcess=null;
let activeSection='general',restoringWorkspace=false;
let pressureSettings=readPressure(),displayDigits=8;
const panelRecords={};
const processDrafts={};let ambient={p:.101325,T:298.15},ambientRef=null;
function ambientResult(result){const model=result.state?.model||result.saturation?.model||'IF97';return withExergy(result,referenceState(ambient.p,ambient.T,model));}
const modelValue=()=>document.querySelector('input[name=formulation]:checked').value;
function selectModel(model){for(const el of document.querySelectorAll('input[name=formulation]'))el.checked=el.value===model;}
const historyStates=[];
const collapsedGroups=new Set();
const PU=[['MPa','МПа'],['kPa','кПа'],['Pa','Па'],['bar','бар'],['atm','атм'],['psi','psi']];
const TU=[['C','°C'],['K','K'],['F','°F']], HU=[['kJkg','кДж/кг'],['Jkg','Дж/кг'],['Btulb','Btu/lb']], SU=[['kJkgK','кДж/(кг·K)'],['JkgK','Дж/(кг·K)'],['BtulbR','Btu/(lb·°R)']];
const definitions=[['h','Ентальпія','h','кДж/кг'],['s','Ентропія','s','кДж/(кг·K)'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['cp','Ізобарна теплоємність','Cₚ','кДж/(кг·K)'],['cv','Ізохорна теплоємність','Cᵥ','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['ex','Фізична ексергія потоку','ex','кДж/кг'],['u','Внутрішня енергія','u','кДж/кг'],['dc','Статична відносна діелектрична проникність','εr','–'],['mu','Динамічна в’язкість','μ','Па·с'],['lambda','Теплопровідність','λ','Вт/(м·K)']];
function options(id,list) {$(id).replaceChildren(...list.map(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;return o;}));$(id).dataset.previous=$(id).value;}
function resetMode() {
 const m=$('mode').value,t=['satt','tx','th','ts','trho','tv','tu'].includes(m),h=m==='hs',quality=m==='px'||m==='tx',sat=m==='satp'||m==='satt';
 const types={C:'Температура',MPa:'Тиск (абсолютний)',kJkg:['us','uv'].includes(m)?'Внутрішня енергія':'Ентальпія',kJkgK:'Ентропія',kgm3:'Густина',m3kg:'Питомий об’єм',fraction:'Ступінь сухості'};
 const labels={...Object.fromEntries([...PU,...TU,...HU,...SU]),kgm3:'кг/м³',lbft3:'lb/ft³',m3kg:'м³/кг',ft3lb:'ft³/lb',fraction:'0…1',percent:'%'};
 const units=batchUnits(m);$('field-b').hidden=sat;$('input-b').disabled=sat;
 $('label-a').textContent='1. '+(PRESSURE_UNITS.includes(units.a[0])?'Тиск ('+pressureBasisLabel()+')':types[units.a[0]])+':';$('label-b').textContent='2. '+(['pu','tu'].includes(m)?'Внутрішня енергія':types[units.b[0]])+':';
 options('unit-a',units.a.map(k=>[k,labels[k]]));options('unit-b',units.b.map(k=>[k,labels[k]]));
 const defaults={C:'100',MPa:'3',kJkg:'2500',kJkgK:'6',kgm3:'997',m3kg:'0.1',fraction:'0.5'};
 $('input-a').value=PRESSURE_UNITS.includes(units.a[0])?String(pressureOutput(Number(defaults[units.a[0]]),units.a[0],pressureSettings)):defaults[units.a[0]];$('input-b').value=defaults[units.b[0]];
 $('mode-help').textContent=modeGuidance(m);
 for(const name of ['general','saturation','help'])$('tab-'+name).setAttribute('aria-selected',String(name===((sat||quality)?'saturation':'general')));
 if(!$('calculator-view').hidden)activeSection=(sat||quality)?'saturation':'general';
 invalidate();
}
function invalidate() {
 $('model-status').textContent='Таблиці води та пари → '+modelValue();
  last=null;$('export-csv').disabled=true;$('result-status').textContent='Параметри змінено — розрахуйте знову';$('error').hidden=true;
  $('results').innerHTML=propertyTable(null);$('state-summary').textContent=sourceUIText($('mode-help'));
}
function format(n){return formatProperty(n,displayDigits,uiTranslator.numberLocale);}
function display(key,value,unit) {if(key==='p'){if(value!=null&&pressureSettings.basis==='gauge')value-=pressureSettings.atmosphere;const out=$('output-system').value==='english'?englishProperty(key,value,unit):[value,unit];return [out[0],out[1]+(pressureSettings.basis==='gauge'?' (ман.)':'')];}if($('output-system').value==='english')return englishProperty(key,key==='T'&&value!=null?value+273.15:value,unit);if(['h','s','cp','cv','u','A','G','ijt','ex'].includes(key)&&$('output-energy').value==='J')return [value===null?null:value*1000,unit.replace('кДж','Дж')];return [value,unit];}
const rows=[['p','Тиск (абсолютний)','p','МПа'],['T','Температура','t','°C'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['h','Питома ентальпія','h','кДж/кг'],['s','Питома ентропія','s','кДж/(кг·K)'],['u','Питома внутрішня енергія','u','кДж/кг'],['cp','Питома ізобарна теплоємність','cp','кДж/(кг·K)'],['cv','Питома ізохорна теплоємність','cv','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['ex','Фізична ексергія потоку','ex','кДж/кг'],['x','Ступінь сухості (масова частка пари)','x','–'],['region','Область IF97','region','–'],['isentropic','Ізентропний показник','κs','–'],['A','Питома енергія Гельмгольца','a','кДж/кг'],['G','Питома енергія Гіббса','g','кДж/кг'],['Z','Коефіцієнт стисливості','Z','–'],['alpha','Ізобарне об’ємне розширення','α','1/K'],['kappa','Ізотермічна стисливість','κT','1/МПа'],['dvdt','Похідна (∂v/∂T)p','vT','м³/(кг·K)'],['dvdp','Похідна (∂v/∂p)T','vp','м³/(кг·МПа)'],['dpdt','Похідна (∂p/∂T)v','pT','МПа/K'],['dpdv','Похідна (∂p/∂v)T','pv','МПа·кг/м³'],['ijt','Ізотермічний коефіцієнт Джоуля–Томсона','δT','кДж/(кг·МПа)'],['jt','Коефіцієнт Джоуля–Томсона','μJT','K/МПа'],['dc','Статична відносна діелектрична проникність','εr','–'],['mu','Динамічна в’язкість','μ','Па·с'],['nu','Кінематична в’язкість','ν','м²/с'],['lambda','Теплопровідність','λ','Вт/(м·K)'],['diffusivity','Температуропровідність','aT','м²/с'],['Pr','Число Прандтля','Pr','–'],['sigma','Поверхневий натяг рідина–пара','σ','Н/м']];
rows.splice(6,0,rows.splice(rows.findIndex(r=>r[0]==='ex'),1)[0]);
const constants=['Газова стала R = 0,461526 кДж/(кг·K)','Молярна газова стала Rm = 8,31451 Дж/(моль·K)','Молярна маса M = 18,015257 г/моль','Критична температура Tc = 647,096 K','Критичний тиск pc = 22,064 МПа','Критична густина ρc = 322 кг/м³','Потрійна точка Tt = 273,16 K','Потрійна точка pt = 611,657 Па'];
let openGlossary=new Set(),hintsEnabled=true;
// Shared by the main property table and the other learning panels (ice/D2O/seawater/
// gases/humid air/cycles, see learning-ui.js). The main table uses hover-only labels;
// learning panels also allow expanding the explanation by clicking its button.
function glossaryCell(key,label,expand=true){
 if(!hintsEnabled||!GLOSSARY[key])return escapeHTML(label);
 if(!expand)return `<span class="glossary-tooltip" title="${escapeHTML(GLOSSARY[key])}">${escapeHTML(label)} ${icon('help',11)}</span>`;
 return `<button class="glossary-toggle" data-glossary="${key}" aria-expanded="${openGlossary.has(key)}" title="${escapeHTML(GLOSSARY[key])}">${escapeHTML(label)} ${icon('help',11)}</button>`;
}
function glossaryDetailRow(key,leadCells,span,extraHidden){
 if(!hintsEnabled||!GLOSSARY[key]||!openGlossary.has(key))return '';
 return `<tr class="glossary-row" data-glossary-row="${key}" ${extraHidden?'hidden':''}>${'<td></td>'.repeat(leadCells)}<td colspan="${span}">${GLOSSARY[key]}</td></tr>`;
}
function propertyTable(state,alternativeIndex=null) {
 const modelConstants=modelValue()==='IAPWS-95'?['Газова стала R = 0,46151805 кДж/(кг·K)','','','Критична температура Tc = 647,096 K','Критичний тиск pc = 22,064 МПа','Критична густина ρc = 322 кг/м³','Потрійна точка Tt = 273,16 K','Потрійна точка (EOS) pt ≈ 611,654771 Па']:constants;
 return `<table class="property-table"><thead><tr><th>№</th><th>Назва властивості</th><th>Символ</th><th>⧉</th><th>Результат</th><th>Одиниці</th><th>Константи ${modelValue()}</th></tr></thead><tbody>${rows.map(([key,name,symbol,unit],i)=>{
 const value=state?(key==='T'?state.T-273.15:state[key]):null;
 const [v,u]=display(key,value,unit);
 const groupId=i<11?'main':i<26?'state':'transport';
 const groupName=i===0?'1. Термодинамічні властивості — основні':i===11?'2. Термодинамічні властивості — стан':i===26?'3. Транспортні властивості':null;
 const collapsed=collapsedGroups.has(groupId);
 const group=groupName?`<tr class="group"><td colspan="7"><button data-group="${groupId}" aria-expanded="${!collapsed}">${collapsed?'⊞':'⊟'} ${groupName}</button></td></tr>`:'';
 const nameCell=glossaryCell(key==='p'&&pressureSettings.basis==='gauge'?'pgauge':key,key==='p'?'Тиск ('+pressureBasisLabel()+')':name,false);
 return `${group}<tr data-group-row="${groupId}" ${collapsed?'hidden':''} data-property="${key}"><td>${i+1}</td><td>${nameCell}</td><td>${symbol}</td><td><button class="copy" data-copy="${key}" ${alternativeIndex===null?'':`data-alternative="${alternativeIndex}"`} aria-label="Копіювати: ${name}" ${v==null?'disabled':''}>${icon('copy',13)}</button></td><td>${state?format(v):''}${state&&v==null?`<small class="unavailable-reason">${escapeHTML(propertyUnavailableReason(key,state))}</small>`:''}</td><td>${u}</td><td class="constant">${modelConstants[i]||''}</td></tr>`;
 }).join('')}</tbody></table><details class="compact-constants"><summary>Константи ${modelValue()}</summary><ul>${modelConstants.filter(Boolean).map(text=>`<li>${escapeHTML(text)}</li>`).join('')}</ul></details>`;
}
let historyUndo=null,unsavedProject=false;
function renderHistory() {
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 $('history-body').innerHTML=historyStates.map((s,i)=>`<tr><td>${historyStates.length-i}</td><td><input class="state-name" data-history-name="${i}" aria-label="Назва стану ${historyStates.length-i}" maxlength="80" value="${escapeHTML(s.name||'')}"></td><td><button data-history-open="${i}" aria-label="Відкрити стан ${historyStates.length-i}">↗</button><button data-history-delete="${i}" aria-label="Видалити стан ${historyStates.length-i}">×</button></td>${keys.map(k=>`<td>${format(display(k,k==='T'?s.T-273.15:s[k],rows.find(r=>r[0]===k)?.[3]||'')[0])}</td>`).join('')}<td>${escapeHTML(s.model||'IF97')}</td></tr>`).join('')+Array.from({length:Math.max(0,6-historyStates.length)},(_,i)=>`<tr><td>${historyStates.length+i+1}</td>${'<td></td>'.repeat(16)}</tr>`).join('');
 document.querySelector('#history thead tr').innerHTML='<th>№</th><th>Назва</th><th>Дії</th>'+keys.map(k=>`<th>${k} [${display(k,null,rows.find(r=>r[0]===k)?.[3]||'–')[1]}]</th>`).join('')+'<th>Модель</th>';
 $('history-count').textContent=`Станів: ${historyStates.length}`;$('history-undo').disabled=!historyUndo;
}
$('history-body').addEventListener('input',e=>{if(e.target.dataset.historyName!=null){historyStates[Number(e.target.dataset.historyName)].name=e.target.value;saveProject();}});
$('history-body').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const open=button.dataset.historyOpen,del=button.dataset.historyDelete;if(del!=null){historyUndo=[...historyStates];historyStates.splice(Number(del),1);renderHistory();saveProject();}if(open!=null){const q=historyStates[Number(open)];selectModel(q.model||'IF97');selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(pressureOutput(q.p,'MPa',pressureSettings));$('input-b').value=String(q.h);last={state:q};render();$('result-status').textContent='Відкрито стан журналу';saveProject();}});
$('history-undo').onclick=()=>{if(!historyUndo)return;historyStates.splice(0,historyStates.length,...historyUndo);historyUndo=null;renderHistory();saveProject();};
window.addEventListener('beforeunload',e=>{if(unsavedProject){e.preventDefault();e.returnValue='';}});

function selectView(view) {
 capturePanel();activeSection=view==='panel'?'general':view;currentPanelKind=null;learningResult=null;
 leaveDiagram();
 for(const b of document.querySelectorAll('[role="tab"]'))b.setAttribute('aria-selected','false');$('process-view').hidden=true;$('calculator-view').hidden=view==='help';$('help-view').hidden=view!=='help';
 for(const name of ['general','saturation','help'])$('tab-'+name).setAttribute('aria-selected',String(name===view));
 if(view==='saturation'&&!['satp','satt','px','tx'].includes($('mode').value)){$('mode').value='satp';resetMode();}
 if(view==='general'&&['satp','satt','px','tx'].includes($('mode').value)){$('mode').value='pt';resetMode();}
}
function notes(list) {return list.length?`<div class="notes">${[...new Set(list)].map(n=>`<p>${n}</p>`).join('')}</div>`:'';}
function table(sat) {
 return `<div class="sat-scroll"><table class="sat-table"><thead><tr><th>Властивість</th><th>Насичена рідина</th><th>Насичена пара</th></tr></thead><tbody>${rows.filter(r=>!['p','T','region','x'].includes(r[0])).map(([k,name,symbol,unit])=>{
  const [a,u]=display(k,sat.liquid[k],unit),[b]=display(k,sat.vapor[k],unit);
  return `<tr><td>${name} <span class="symbol">${symbol}</span><small>${u}</small></td><td>${format(a)}</td><td>${format(b)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function render() {
 if(!last)return;const original=last;last=ambientResult(last);let html='';
 if(last.state) {
  const s=last.state;
  $('state-summary').textContent=`${s.phase} · ${s.model||'IF97'}${s.region!=null?' · Область '+s.region:''}`;
  html=propertyTable(s)+notes(s.notes);if(last.alternatives?.length)html+='<h3>Інші знайдені стани</h3>'+last.alternatives.map((q,i)=>`<p>P = ${format(q.p)} МПа (абс.) · T = ${format(q.T)} K · ${q.phase}</p>`+`<button data-use-alternative="${i}">Вибрати цей стан</button>`+propertyTable(q,i)).join('');
 }
 if(last.saturation) {
  const sat=last.saturation;
  if(!last.state){$('state-summary').textContent=sat.critical?'Критична точка':'Рівновага рідина–пара';}
  const [satPressure,satPressureUnit]=display('p',sat.p,'МПа'),[satTemperature,satTemperatureUnit]=display('T',sat.T-273.15,'°C');
  if(!last.state)html=`<div class="state-banner"><strong>${sat.critical?'Критична точка':'Лінія насичення'}</strong><span>${sat.model||'IAPWS-IF97'}</span></div><p class="state-meta">P = ${format(satPressure)} ${satPressureUnit} &nbsp;·&nbsp; t = ${format(satTemperature)} ${satTemperatureUnit}</p>`;
  if(last.ambiguous)html+=notes(['На лінії насичення P і T залежні. Частка пари невідома: для властивостей суміші використайте P–h або P–s.']);
  if(last.state)html+='<h3>Властивості фаз при цьому тиску</h3>';
  html+=table(sat);
  const [latent,unit]=display('h',sat.latentHeat,'кДж/кг');
  html+=`<p class="state-meta">Теплота пароутворення: ${format(latent)} ${unit}</p>${notes([...sat.liquid.notes,...sat.vapor.notes])}`;
 }
 last=original;$('results').innerHTML=html;$('export-csv').disabled=false;
 $('result-status').textContent=`Розрахунок № ${revision} · ${displayDigits} значущих цифр`;
}
function run(event) {
 event?.preventDefault();$('error').hidden=true;
 try {
   const m=$('mode').value,a=pressureInput(parseNumber($('input-a').value),$('unit-a').value,pressureSettings);
   const b=m.startsWith('sat')?undefined:pressureInput(parseNumber($('input-b').value),$('unit-b').value,pressureSettings);
   const result=calculate(m,a,b,modelValue());if(result.state)result.state.source={mode:m,a,b};if(result.saturation)for(const q of [result.saturation.liquid,result.saturation.vapor])q.source=q.critical?{mode:'pt',a:q.p,b:q.T}:{mode:'px',a:q.p,b:q.x};last=result;revision++;if(result.state)historyStates.unshift(result.state);else if(result.saturation)historyStates.unshift(result.saturation.vapor,result.saturation.liquid);historyStates.splice(500);renderHistory();render();saveProject();
 }catch(e) {invalidate();$('error').textContent=e.message;$('error').hidden=false;$('result-status').textContent='Перевірте вхідні дані';}
}
for(const option of $('mode').options)option.textContent=INPUT_MODE_LABELS[option.value]||option.textContent;
 document.querySelector('.quick-modes').onclick=e=>{const button=e.target.closest('[data-quick-mode]');if(!button)return;$('mode').value=button.dataset.quickMode;resetMode();$('input-a').focus();saveProject();};
 $('mode').addEventListener('change',resetMode);
for(const el of document.querySelectorAll('input[name=formulation]'))el.onchange=()=>{diagramCache=null;plottedProcess=null;selectView('general');invalidate();saveProject();};
for(const letter of ['a','b']) {
 $('input-'+letter).addEventListener('input',invalidate);
 $('unit-'+letter).addEventListener('change',()=>{const select=$('unit-'+letter);try{const n=parseNumber($('input-'+letter).value);$('input-'+letter).value=String(Number(fromCanonical(toCanonical(n,select.dataset.previous),select.value).toPrecision(12)));}catch{}select.dataset.previous=select.value;invalidate();});
}
let calculationPending=false;
 $('calculator').addEventListener('submit',event=>{event.preventDefault();if(calculationPending)return;calculationPending=true;$('calculate').disabled=true;$('calculate').textContent='Обчислення…';$('calculator').setAttribute('aria-busy','true');$('result-status').textContent='Обчислення стану…';requestAnimationFrame(()=>requestAnimationFrame(()=>{try{run();}finally{calculationPending=false;$('calculate').disabled=false;$('calculate').innerHTML=icon('calc')+'Розрахувати';$('calculator').removeAttribute('aria-busy');}}));});
 $('display-digits').onchange=()=>{displayDigits=readDisplayDigits(Number($('display-digits').value));renderHistory();if(last)render();if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();const form=panelForm();if(form?.dataset.calculated==='true')form.requestSubmit();saveProject();};
$('output-energy').addEventListener('change',()=>{renderHistory();if(last)render();else $('results').innerHTML=propertyTable(null);if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();if($('batch-results'))renderBatch();if($('eng-result'))renderEngineering();});
for(const button of document.querySelectorAll('[data-p]')) button.addEventListener('click',()=>{$('mode').value='pt';resetMode();$('input-a').value=String(pressureOutput(Number(button.dataset.p),'MPa',pressureSettings));$('unit-b').value='K';$('unit-b').dataset.previous='K';$('input-b').value=button.dataset.t;run();});
$('export-csv').addEventListener('click',()=>{
 if(!last)return;
 const csv=exportCSV(ambientResult(last),$('output-energy').value,ambient,$('output-system').value);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='water-steam-if97.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action],[data-copy],[data-group],[data-glossary],[data-use-alternative]');if(!target)return;
 const action=target.dataset.action;
 if(target.dataset.group){const g=target.dataset.group;collapsedGroups.has(g)?collapsedGroups.delete(g):collapsedGroups.add(g);if(last)render();else $('results').innerHTML=propertyTable(null);}
 if(target.dataset.glossary){const g=target.dataset.glossary;openGlossary.has(g)?openGlossary.delete(g):openGlossary.add(g);if(currentPanelKind&&learningResult)renderLearning(currentPanelKind,learningResult);else if(last)render();else $('results').innerHTML=propertyTable(null);}
 if(action==='toggle-setup'){document.body.classList.toggle('setup-collapsed');}
 if(action==='toggle-output'){document.body.classList.toggle('output-collapsed');}
 if(action==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{$('result-status').textContent='Повний екран недоступний';});}
 if(action==='export-history')exportHistory();
 if(action==='units-si'||action==='units-english'){$('output-system').value=action==='units-si'?'si':'english';$('output-system').dispatchEvent(new Event('change'));}
 if(['general','saturation','help'].includes(action))selectView(action);
 if(['turbine','flash','ts','hsdiagram'].includes(action))showProcess(action);
 if(action==='batch')showBatch();
 if(action==='engineering')showEngineering();
 if(action==='flow')showFlow();
 if(action==='tutorials')showTutorials();
 if(action==='clear'){historyUndo=historyStates.length?[...historyStates]:historyUndo;historyStates.length=0;revision=0;renderHistory();invalidate();$('result-status').textContent='Результати очищено';}
 if(action==='export')$('export-csv').click();
 if(action==='print')window.print();
 if(action==='blue'||action==='gray')document.body.classList.toggle('gray',action==='gray');
 if(action==='hints'){hintsEnabled=!hintsEnabled;$('hints-toggle').setAttribute('aria-pressed',String(hintsEnabled));if(!hintsEnabled)openGlossary.clear();if(last)render();else $('results').innerHTML=propertyTable(null);if(currentPanelKind&&learningResult)renderLearning(currentPanelKind,learningResult);}
 if(target.dataset.useAlternative!=null&&last?.alternatives){const q=last.alternatives[Number(target.dataset.useAlternative)];if(q){selectView('panel');$('calculator-view').hidden=false;const mixed=q.x!=null&&!q.critical;$('mode').value=mixed?'px':'pt';resetMode();$('input-a').value=String(pressureOutput(q.p,'MPa',pressureSettings));if(!mixed){$('unit-b').value='K';$('unit-b').dataset.previous='K';}$('input-b').value=String(mixed?q.x:q.T);run();}}
 if(target.dataset.copy&&last?.state){const source=target.dataset.alternative==null?ambientResult(last).state:ambientResult({state:last.alternatives[Number(target.dataset.alternative)]}).state;const k=target.dataset.copy;const row=rows.find(r=>r[0]===k);const raw=k==='T'?source.T-273.15:source[k];const [value]=display(k,raw,row[3]);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(String(value)).then(()=>{$('result-status').textContent='Значення скопійовано';}).catch(()=>{$('result-status').textContent='Копіювання недоступне в цьому браузері';});else $('result-status').textContent='Копіювання недоступне в цьому браузері';}
 if(action)for(const d of document.querySelectorAll('.menubar details'))d.open=false;
});
function exportHistory(){
 if(!historyStates.length){$('result-status').textContent='Історія порожня — спочатку розрахуйте стан';return;}
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 const headings=['p [MPa]','T [K]','v [m3/kg]','h [kJ/kg]','s [kJ/(kg K)]','u [kJ/kg]','cp [kJ/(kg K)]','cv [kJ/(kg K)]','w [m/s]','x [-]','region [-]','mu [Pa s]','lambda [W/(m K)]'];
 const selectedHeadings=keys.map(k=>`${k} [${display(k,null,rows.find(r=>r[0]===k)?.[3]||'–')[1]}]`);
 const content='\ufeff'+[['name','model',...selectedHeadings].join(';'),...historyStates.map(s=>['"'+String(/^[=+\-@]/.test(s.name||'')?"'"+(s.name||''):(s.name||'')).replaceAll('"','""')+'"',s.model||'IF97',...keys.map(k=>{const v=display(k,k==='T'?s.T-273.15:s[k],rows.find(r=>r[0]===k)?.[3]||'')[0];return Number.isFinite(v)?String(v):'';})].join(';'))].join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='water-steam-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('result-status').textContent='CSV історії підготовлено';
}
$('ui-scale').addEventListener('change',()=>{document.documentElement.style.setProperty('--ui-scale',$('ui-scale').value);});
const divider=$('output-resize');let resizing=false,resizeStartY=0,resizeStartHeight=218;
function resizeOutput(height){const max=Math.max(100,Math.min(400,window.innerHeight-350));const h=Math.round(Math.max(100,Math.min(max,height)));document.documentElement.style.setProperty('--output-height',h+'px');divider.setAttribute('aria-valuenow',String(h));}
divider.addEventListener('pointerdown',e=>{if(window.innerWidth<=900)return;resizing=true;resizeStartY=e.clientY;resizeStartHeight=Number(divider.getAttribute('aria-valuenow'));divider.setPointerCapture(e.pointerId);document.body.classList.remove('output-collapsed');});
divider.addEventListener('pointermove',e=>{if(resizing)resizeOutput(resizeStartHeight+resizeStartY-e.clientY);});
divider.addEventListener('pointerup',()=>{resizing=false;});divider.addEventListener('pointercancel',()=>{resizing=false;});
divider.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();resizeOutput(Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowUp'?20:-20));}});
resetMode();renderHistory();
(async()=>{
 try {$('result-status').textContent='Підготовка ядра води й пари…';const bytes=Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0));await initialize(bytes);$('calculate').disabled=false;$('calculate').innerHTML=icon('calc')+'Розрахувати';persistenceReady=true;$('result-status').textContent='Готово до розрахунку';restoreLocal();}
 catch(e){$('error').textContent='Не вдалося ініціалізувати WebAssembly. Використайте сучасний браузер. '+e.message;$('error').hidden=false;$('calculate').textContent='Помилка завантаження';}
})();
// CoolProp WASM (~9 MB) is only needed by the gases/humid-air panels, so it is not
// loaded at startup. Standalone build embeds it as base64 (no network allowed);
// the multi-file site fetches assets/coolprop.wasm lazily on first use of either panel.
let coolPropReady=null;
function ensureCoolProp(){
 if(coolPropReady)return coolPropReady;
 coolPropReady=(async()=>{
  const bytes=typeof COOLPROP_WASM_BASE64==='string'
   ?Uint8Array.from(atob(COOLPROP_WASM_BASE64),c=>c.charCodeAt(0))
   :new Uint8Array(await (await fetch('assets/coolprop.wasm')).arrayBuffer());
  await initializeHumidAir(bytes);
 })();
 coolPropReady.catch(()=>{coolPropReady=null;});
 return coolPropReady;
}

let diagramCache=null, plottedProcess=null, diagramRedraw=null,diagramObserver=null;
let diagramPlan=readDiagramWorkspace(null,[]),diagramReportContent=null;
const diagramRanges=new Map(),diagramIsobars=new Map();
function leaveDiagram(){document.body.classList.remove('diagram-active','diagram-expanded','diagram-history-empty');diagramObserver?.disconnect();diagramObserver=null;}
function massTo(v,u){return u==='kgh'?v/3600:u==='lbs'?v*.45359237:u==='lbh'?v*.45359237/3600:v;}
function massFrom(v,u){return u==='kgh'?v*3600:u==='lbs'?v/.45359237:u==='lbh'?v*3600/.45359237:v;}
function processDisplay(k,v,u){return display(k,v,u);}
function showProcess(kind){
 capturePanel();activeSection=kind;currentPanelKind=null;learningResult=null;
 leaveDiagram();
 $('calculator-view').hidden=true;$('help-view').hidden=true;$('process-view').hidden=false;
 for(const b of document.querySelectorAll('[role="tab"]'))b.setAttribute('aria-selected',String(b.dataset.action===kind));
 if(kind==='ts'||kind==='hsdiagram'){showDiagram(kind);return;}
 const tur=kind==='turbine';const draft=processDrafts[kind]||{};
 $('process-view').innerHTML=`<h2>${tur?'Парова турбіна':'Дроселювання та випаровування'}</h2><p>${tur?'Адіабатичне розширення з ізоентропним ККД. Потужність потоку без механічних і генераторних втрат.':'Адіабатичне дроселювання: h₂ = h₁. Поділ потоків наведено лише для рівноважного двофазного стану.'} Змінами кінетичної й потенціальної енергій знехтувано.</p><form id="process-form"><label>Режим<select id="process-mode">${tur?'<option value="power">Потужність</option><option value="flow">Витрата пари</option><option value="efficiency">Ізоентропний ККД</option>':'<option value="subcooled">Однофазний вхід P–T</option><option value="saturated">Насичений конденсат</option>'}</select></label><fieldset><legend>Вхідні дані · ${pressureBasisLabel()} тиск</legend><label>Одиниця тиску<select id="process-pressure"><option value="MPa">МПа</option><option value="bar">бар</option><option value="kPa">кПа</option><option value="psi">psi</option></select></label><label>Одиниця температури<select id="process-temperature"><option value="C">°C</option><option value="K">K</option><option value="F">°F</option></select></label><label>Одиниця витрати<select id="process-mass"><option value="kgs">кг/с</option><option value="kgh">кг/год</option><option value="lbs">lb/s</option><option value="lbh">lb/h</option></select></label>${tur?'<label>Одиниця потужності<select id="process-power-unit"><option value="kW">кВт</option><option value="Btuh">Btu/h</option></select></label>':''}${[['p1','Вхідний тиск','3'],['t1','Вхідна температура',tur?'400':'200'],['p2','Вихідний тиск','0.1'],...(tur?[['eta','Ізоентропний ККД, %','85']]:[]),['flow','Масова витрата','1'],...(tur?[['power','Потужність','600']]:[])].map(([id,label,value])=>`<label>${label}<input id="process-${id}" value="${value}" inputmode="decimal" required></label>`).join('')}</fieldset><button type="submit">Розрахувати</button></form><p id="process-error" role="alert"></p><div id="process-result"></div>`;
 for(const id of ['p1','p2'])$('process-'+id).value=String(pressureOutput(Number($('process-'+id).value),'MPa',pressureSettings));
 for(const id of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit'])if($('process-'+id)&&draft[id])$('process-'+id).value=draft[id];
 function updateProcessMode(){const mode=$('process-mode').value;for(const id of ['eta','flow','power','t1']){const el=$('process-'+id);if(!el)continue;const hidden=tur?(id==='power'&&mode==='power')||(id==='eta'&&mode==='efficiency')||(id==='flow'&&mode==='flow'):id==='t1'&&mode==='saturated';el.disabled=hidden;el.closest('label').hidden=hidden;}}
 updateProcessMode();$('process-mode').addEventListener('change',()=>{updateProcessMode();$('process-result').innerHTML='';rememberDraft();});
 function rememberDraft(){processDrafts[kind]={};for(const id of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit'])if($('process-'+id))processDrafts[kind][id]=$('process-'+id).value;saveProject();}
 for(const id of ['pressure','temperature','mass','power-unit']){
 const el=$('process-'+id);if(!el)continue;el.dataset.previous=el.value;el.addEventListener('change',()=>{try{const converted=[];for(const k of id==='pressure'?['p1','p2']:id==='temperature'?['t1']:id==='power-unit'?['power']:['flow']){const input=$('process-'+k);if(!input.value.trim())continue;const v=parseNumber(input.value);converted.push([input,String(id==='power-unit'?v*(el.dataset.previous==='Btuh'?1055.05585262/3600000:1)/(el.value==='Btuh'?1055.05585262/3600000:1):id==='mass'?(massFrom(massTo(v,el.dataset.previous),el.value)):fromCanonical(toCanonical(v,el.dataset.previous),el.value))]);}for(const [input,value] of converted)input.value=value;}catch(error){el.value=el.dataset.previous;$('process-error').textContent=error.message;}el.dataset.previous=el.value;$('process-result').innerHTML='';rememberDraft();});
 }
 $('process-form').addEventListener('input',()=>{panelEdited($('process-form'));});$('process-form').addEventListener('change',()=>panelEdited($('process-form')));
 $('process-form').addEventListener('input',rememberDraft);
 for(const input of $('process-form').querySelectorAll('input'))input.addEventListener('input',()=>{$('process-result').innerHTML='';$('process-error').textContent='';$('result-status').textContent='Параметри процесу змінено — розрахуйте знову';});
 $('process-form').addEventListener('submit',event=>{event.preventDefault();$('process-result').innerHTML='';$('process-error').textContent='';try{
 const n=id=>{const v=parseNumber($('process-'+id).value);return ['p1','p2'].includes(id)?pressureInput(v,$('process-pressure').value,pressureSettings):id==='t1'?toCanonical(v,$('process-temperature').value)-273.15:id==='flow'?massTo(v,$('process-mass').value):id==='power'&&$('process-power-unit').value==='Btuh'?v*1055.05585262/3600000:v;};
 const pm=$('process-mode').value,saturated=!tur&&pm==='saturated';
 const Tin=saturated?calculate('px',n('p1'),0,modelValue()).state.T:n('t1')+273.15;
 const r=tur?(pm==='power'?turbine(n('p1'),Tin,n('p2'),n('eta')/100,n('flow'),modelValue()):turbineInverse(pm,n('p1'),Tin,n('p2'),n('power'),pm==='flow'?n('eta')/100:n('flow'),modelValue())):flash(n('p1'),Tin,n('p2'),n('flow'),saturated?1:0,modelValue());
 storedProcess={type:kind,model:modelValue(),args:tur?[n('p1'),Tin,n('p2'),r.eta,r.flow]:[n('p1'),Tin,n('p2'),r.flow,saturated?1:0]};plottedProcess={kind:tur?'Турбіна':'Дроселювання',result:r};rememberDraft();saveProject();
 renderProcessOutput(kind,r);
 panelCalculated($('process-form'));$('result-status').textContent='Розрахунок процесу виконано';
 }catch(e){panelEdited($('process-form'));$('process-error').textContent=e.message;$('result-status').textContent='Перевірте вхідні дані';}});
 restorePanelInputs(kind,$('process-form'));restorePanelResult(kind,$('process-form'));
}
function renderProcessOutput(kind,r){
 const tur=kind==='turbine';
 const metrics=tur?[['Питома робота',r.work,'кДж/кг'],['Потужність потоку',r.power,'кВт'],['Витрата пари',r.flow,'кг/с'],['Питома витрата пари',3600/r.work,'кг/(кВт·год)'],['Ізоентропний ККД',r.eta*100,'%']]:[['Витрата пари',r.vaporFlow,'кг/с'],['Витрата рідини',r.liquidFlow,'кг/с'],['Пароутворення',r.outlet.x==null?null:r.outlet.x*100,'%']];
 const metricKey={'Питома робота':'work','Потужність потоку':'power','Витрата пари':'flow','Витрата рідини':'flow','Питома витрата пари':'consumption','Ізоентропний ККД':'eta','Пароутворення':'x'};
 $('process-result').innerHTML=`<p>${metrics.map(([l,v,u])=>`${l}: <strong>${format(processDisplay(metricKey[l]||'eta',v,u)[0])} ${processDisplay(metricKey[l]||'eta',v,u)[1]}</strong>`).join(' · ')}</p>${!tur&&r.outlet.x==null?'<p>Вихід однофазний; баланс сепарації на рідину й пару не застосовується.</p>':''}<table><thead><tr><th>Стан</th>${[['p','МПа'],['T','°C'],['h','кДж/кг'],['s','кДж/(кг·K)']].map(([k,u])=>`<th>${k}, ${processDisplay(k,null,u)[1]}</th>`).join('')}<th>x</th><th>Фаза</th></tr></thead><tbody>${[['Вхід',r.inlet],...(tur?[['Ізоентропний вихід',r.ideal]]:[]),['Вихід',r.outlet]].map(([l,q])=>`<tr><td>${l}</td>${[['p',q.p],['T',q.T-273.15],['h',q.h],['s',q.s],['x',q.x]].map(([k,v])=>`<td>${format(processDisplay(k,v,'')[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')}</tbody></table><button id="process-csv">CSV процесу</button><button id="process-plot">Нанести процес на h–s діаграму</button><button id="process-transfer">Показати вихід у загальних властивостях</button>`;
 $('process-csv').onclick=()=>downloadFile(processCSV(kind,r,$('output-system').value),kind+'.csv','text/csv;charset=utf-8');
 $('process-plot').addEventListener('click',()=>{showProcess('hsdiagram');$('diagram-fit-process').click();});
 $('process-transfer').addEventListener('click',()=>{selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(pressureOutput(r.outlet.p,'MPa',pressureSettings));$('input-b').value=String(r.outlet.h);run();});
}
function showDiagram(kind){
 diagramObserver?.disconnect();
 document.body.classList.add('diagram-active');document.body.classList.toggle('diagram-history-empty',!historyStates.length);
 const dq=(k,v)=>diagramQuantity(k,v,$('output-system').value,$('output-energy').value);
 const dt=(k,v)=>{const [n,u]=dq(k,v);return format(n)+' '+uiTranslator.text(u)+(k==='p'?uiTranslator.text(' (абс.)'):'');};
 if(!diagramCache)diagramCache=diagramData(modelValue());
 const isTS=kind==='ts',vertical=isTS?'T':'h',baseY=isTS?800:4500,viewKey=modelValue()+':'+kind;
 const initial={xmin:0,xmax:11,ymin:0,ymax:baseY};
 const savedView=diagramPlan.views[viewKey];
 let range={...(savedView?.range||diagramRanges.get(viewKey)||initial)},selected=null,plot;
 let diagramSaveTimer=null;const persistDiagram=()=>{clearTimeout(diagramSaveTimer);diagramSaveTimer=setTimeout(()=>{if(svg.isConnected&&!restoringWorkspace)saveProject();},200);};
 const colors=['#a75b00','#3977a6','#8b4599','#27825a','#b84242','#706c25','#555'];
 const process=plottedProcess&&(plottedProcess.result.inlet.model||'IF97')===modelValue()?plottedProcess:null;
 syncDiagramWorkspace(diagramPlan,historyStates);
 const processPoints=process?[[process.result.inlet,'Вхід'],...(process.result.ideal?[[process.result.ideal,'Ізоентропний вихід']]:[]),[process.result.outlet,'Вихід'],...(process.result.coldInlet?[[process.result.coldInlet,'Холодний вхід'],[process.result.coldOutlet,'Холодний вихід']]:[])]:[];
 let choices;
 const refreshChoices=()=>{choices=[...diagramPlan.order.filter(q=>(q.model||'IF97')===modelValue()).map(q=>[q,q.name||`Журнал № ${historyStates.length-historyStates.indexOf(q)}`,'history']),...processPoints.map(([q,l])=>[q,(process?.kind||'Процес')+' · '+l,'process'])];};refreshChoices();
 if(savedView?.point)selected=choices.findIndex(([q,_,source])=>source==='history'&&q===savedView.point);else if(savedView?.processIndex!=null)selected=choices.findIndex(([q,_,source])=>source==='process'&&q===processPoints[savedView.processIndex]?.[0]);if(selected<0)selected=null;
 const diagramNote=()=>`${modelValue()} · ${isTS?'T–s':'h–s'} · ${process?process.kind+'; зелена — вхід → вихід. '+(process.result.ideal?'Пунктир — ізоентропний вихід. ':'')+(process.result.coldInlet?'Синя — холодний потік. ':''):''}${diagramPlan.connectHistory?`Фіолетова — журнал: ${choices.map(([q,l,source],i)=>source==='history'&&!diagramPlan.excluded.includes(q)?i+1:null).filter(n=>n!=null).join(' → ')||'не обрано станів'}.`:'З’єднання журналу вимкнено.'}`;
 const hiddenIsobars=diagramIsobars.get(viewKey)||new Set();diagramIsobars.set(viewKey,hiddenIsobars);
 $('process-view').innerHTML=`<div class="diagram-heading"><h2>${isTS?'T–s':'h–s'} діаграма · ${modelValue()}</h2><button id="diagram-expand" aria-pressed="${document.body.classList.contains('diagram-expanded')}">Розгорнути графік</button></div><div class="diagram-controls" aria-label="Керування діаграмою"><button id="diagram-in" aria-label="Збільшити масштаб" title="Збільшити масштаб">＋</button><button id="diagram-out" aria-label="Зменшити масштаб" title="Зменшити масштаб">−</button><button id="diagram-reset">Весь графік</button><button id="diagram-pan" aria-pressed="false">Переміщувати</button><button id="diagram-fit-selected" ${choices.some(([q,l,source])=>source==='history'&&!diagramPlan.excluded.includes(q))?'':'disabled'}>До обраних</button><button id="diagram-fit" ${choices.length?'':'disabled'}>До точок</button>${process?'<button id="diagram-fit-process">До процесу</button>':''}<label for="diagram-point">Точка<select id="diagram-point" ${choices.length?'':'disabled'}><option value="">${choices.length?'Виберіть стан':'Немає розрахованих станів'}</option>${choices.map(([q,label],i)=>`<option value="${i}" ${q.name?'data-i18n-ignore':''}>${i+1}. ${escapeHTML(label)} · ${dt('p',q.p)} · ${dt('T',q.T-273.15)}</option>`).join('')}</select></label></div><details class="diagram-settings"><summary>Параметри вигляду: лінії, одиниці, цифри</summary><div class="diagram-options"><label><input id="diagram-connect" type="checkbox" ${diagramPlan.connectHistory?'checked':''}> З’єднати обрані стани журналу</label><label><input id="diagram-numbers" type="checkbox" ${diagramPlan.numbers?'checked':''}> Номери точок</label><span id="diagram-process-note"></span></div><div class="diagram-units"><label>Система<select id="diagram-system"><option value="si">SI</option><option value="english">Англійські</option></select></label><label>Енергія<select id="diagram-energy"><option value="kJ">кДж</option><option value="J">Дж</option></select></label><label>Цифри<select id="diagram-digits"><option value="4">4</option><option value="6">6</option><option value="8">8</option></select></label></div></details><div class="diagram-exports"><button id="diagram-save">SVG</button><button id="diagram-csv" ${choices.length?'':'disabled'}>CSV станів</button><button id="diagram-report">Звіт із графіком</button></div><div class="diagram-stage"><svg id="steam-diagram" style="font:13px Arial" tabindex="0" role="group" aria-label="${isTS?'T–s':'h–s'} діаграма води й пари" aria-describedby="diagram-help" xmlns="http://www.w3.org/2000/svg"></svg></div><div id="diagram-legend" class="diagram-legend" aria-label="Ізобари">${diagramCache.isobars.map(({p},i)=>`<button data-isobar="${i}" aria-pressed="${!hiddenIsobars.has(i)}" title="Показати або приховати ізобару" style="color:${colors[i]}">━ ${dt('p',p)}</button>`).join('')}<span>━ Насичення</span></div><div id="diagram-nearby" hidden aria-label="Точки поруч"></div><div id="diagram-selected" aria-live="polite">${choices.length?'Виберіть точку на графіку або зі списку.':'Щоб додати точку, спочатку розрахуйте стан у вкладці «Загальні властивості».'}</div><details class="diagram-tools"><summary>Дії та керування</summary><p id="diagram-help">Перетягування — переміщення. Ctrl + колесо або +/− — масштаб. На сенсорному екрані спочатку ввімкніть «Переміщувати» для перетягування й масштабу двома пальцями; без цього жест прокручує сторінку. Стрілки переміщують сфокусований графік. Кольорові кнопки показують або приховують ізобари. Лінії процесу з’єднують кінцеві стани; проміжний шлях реальної турбіни не визначений її ККД.</p><button id="diagram-refresh">Оновити точки</button><button id="diagram-clear" ${process?'':'disabled'}>Прибрати процес</button><span id="diagram-range"></span></details><details class="diagram-states"><summary>Стани й порядок з’єднання (${choices.length})</summary><p>Позначте стани журналу й змініть їхній порядок стрілками. Точки інших формуляцій не включаються. Номер у таблиці вибирає точку; ізоентропний вихід процесу — окрема контрольна точка.</p><div id="diagram-state-list"></div><details class="diagram-properties"><summary>Повна таблиця властивостей</summary><div id="diagram-table" class="sat-scroll"></div></details></details>`;
 const svg=$('steam-diagram'),stage=svg.parentElement;$('process-view').querySelector('.diagram-settings').open=matchMedia('(min-width:601px)').matches;
 for(const [chart,global] of [['diagram-system','output-system'],['diagram-energy','output-energy'],['diagram-digits','display-digits']]){ $(chart).value=$(global).value;$(chart).onchange=()=>{$(global).value=$(chart).value;$(global).dispatchEvent(new Event('change'));};}
 function updatePointList(){for(const [chart,global] of [['diagram-system','output-system'],['diagram-energy','output-energy'],['diagram-digits','display-digits']])$(chart).value=$(global).value;const chosen=selected;$('diagram-point').innerHTML='<option value="">Виберіть стан</option>'+choices.map(([q,label],i)=>`<option value="${i}" ${q.name?'data-i18n-ignore':''}>${i+1}. ${escapeHTML(label)} · ${dt('p',q.p)} · ${dt('T',q.T-273.15)}</option>`).join('');$('diagram-point').value=chosen==null?'':String(chosen);}
 function updateTable(){ $('diagram-fit-selected').hidden=!choices.some(x=>x[2]==='history');$('diagram-fit').hidden=!!process&&!choices.some(x=>x[2]==='history');$('diagram-table').innerHTML=diagramTable(choices,$('output-system').value,$('output-energy').value,false,[],displayDigits);$('diagram-process-note').textContent=diagramNote();$('diagram-state-list').innerHTML=choices.map(([q,label,source],i)=>`<div class="diagram-state-item">${source==='history'?`<label><input type="checkbox" data-diagram-include="${i}" ${diagramPlan.excluded.includes(q)?'':'checked'} aria-label="Додати точку ${i+1} до лінії"></label>`:'<span class="process-point-tag">Процес</span>'}<button type="button" data-diagram-select="${i}" aria-pressed="${selected===i}">${i+1}. <span ${q.name?'data-i18n-ignore':''}>${escapeHTML(label)}</span></button>${source==='history'?`<span><button type="button" data-diagram-move="${i}" data-direction="-1" aria-label="Точку ${i+1} раніше">↑</button><button type="button" data-diagram-move="${i}" data-direction="1" aria-label="Точку ${i+1} пізніше">↓</button></span>`:''}</div>`).join('');$('diagram-fit-selected').disabled=!choices.some(([q,l,source])=>source==='history'&&!diagramPlan.excluded.includes(q));}
 updateTable();updatePointList();
 const value=q=>isTS?q.T-273.15:q.h;
 const X=s=>plot.left+(s-range.xmin)/(range.xmax-range.xmin)*plot.width;
 const Y=q=>plot.bottom-(value(q)-range.ymin)/(range.ymax-range.ymin)*plot.height;
 const path=points=>{let pen=false;return points.map(q=>{if(!q||!Number.isFinite(q.s)||!Number.isFinite(value(q))){pen=false;return '';}const str=`${pen?'L':'M'}${X(q.s).toFixed(2)},${Y(q).toFixed(2)}`;pen=true;return str;}).join(' ');};
 const tick=(k,v)=>new Intl.NumberFormat(uiTranslator.numberLocale,{maximumSignificantDigits:4}).format(dq(k,v)[0]);
 function draw(){
  if(!stage.isConnected)return;
  const width=Math.max(240,stage.clientWidth),height=Math.max(180,stage.clientHeight);
  plot={left:width<500?68:80,top:32,right:width-20,bottom:height-48};plot.width=plot.right-plot.left;plot.height=plot.bottom-plot.top;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);
  const focusIndex=document.activeElement?.getAttribute('data-point'),ticks=width<500?2:5;
  svg.innerHTML=`<defs><marker id="diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker><clipPath id="plot-clip"><rect x="${plot.left}" y="${plot.top}" width="${plot.width}" height="${plot.height}"/></clipPath></defs><rect width="${width}" height="${height}" fill="white"/>${Array.from({length:6},(_,i)=>{const y=plot.bottom-i*plot.height/5;return `<path d="M${plot.left} ${y}H${plot.right}" stroke="#dde3eb"/><text x="${plot.left-8}" y="${y+4}" text-anchor="end">${tick(vertical,range.ymin+(range.ymax-range.ymin)*i/5)}</text>`;}).join('')}${Array.from({length:ticks+1},(_,i)=>{const x=plot.left+i*plot.width/ticks;return `<path d="M${x} ${plot.top}V${plot.bottom}" stroke="#dde3eb"/><text x="${x}" y="${plot.bottom+20}" text-anchor="${i===ticks?'end':i===0?'start':'middle'}">${tick('s',range.xmin+(range.xmax-range.xmin)*i/ticks)}</text>`;}).join('')}<path d="M${plot.left} ${plot.top}V${plot.bottom}H${plot.right}" fill="none" stroke="#333"/><text x="${plot.left+plot.width/2}" y="${height-8}" text-anchor="middle">s, ${dq('s',null)[1]}</text><text x="${plot.left}" y="20">${isTS?'t':'h'}, ${dq(vertical,null)[1]}</text><g clip-path="url(#plot-clip)">${diagramCache.isobars.map(({p,points},i)=>hiddenIsobars.has(i)?'':`<path d="${path(points)}" fill="none" stroke="${colors[i]}" stroke-width="1.6"><title>${dt('p',p)}</title></path>`).join('')}${diagramCache.dome.map(points=>`<path d="${path(points)}" fill="none" stroke="#12477c" stroke-width="3"/>`).join('')}${diagramPlan.connectHistory?`<path data-history-path="true" d="${path(choices.filter(([q,l,source])=>source==='history'&&!diagramPlan.excluded.includes(q)).map(([q])=>q))}" fill="none" stroke="#8b4599" stroke-width="2.5" marker-mid="url(#diagram-arrow)" marker-end="url(#diagram-arrow)"/>`:''}${process?`<path d="${path([process.result.inlet,process.result.outlet])}" fill="none" stroke="#12804a" stroke-width="3" marker-end="url(#diagram-arrow)"/>${process.result.coldInlet?`<path d="${path([process.result.coldInlet,process.result.coldOutlet])}" fill="none" stroke="#1a77b9" stroke-width="3" marker-end="url(#diagram-arrow)"/>`:''}${process.result.ideal?`<path d="${path([process.result.inlet,process.result.ideal])}" fill="none" stroke="#12804a" stroke-width="2" stroke-dasharray="6 4"/>`:''}`:''}${choices.map(([q,label],i)=>{const inside=q.s>=range.xmin&&q.s<=range.xmax&&value(q)>=range.ymin&&value(q)<=range.ymax;return `<g data-point="${i}" tabindex="${inside?0:-1}" role="button" ${q.name?'data-i18n-ignore-attributes':''} aria-label="${i+1}. ${escapeHTML(label)}" transform="translate(${X(q.s)},${Y(q)})"><circle r="14" fill="transparent"/><circle class="diagram-marker" r="${selected===i?7:5}" fill="${selected===i?'#f09a00':'#c62828'}" stroke="white" stroke-width="1.5"/>${diagramPlan.numbers?`<text x="9" y="-9" fill="#182b40" stroke="white" stroke-width="3" paint-order="stroke" font-weight="bold">${i+1}</text>`:''}<title ${q.name?'data-i18n-ignore':''}>${i+1}. ${escapeHTML(label)}: p=${dt('p',q.p)}; t=${dt('T',q.T-273.15)}; h=${dt('h',q.h)}; s=${dt('s',q.s)}</title></g>`;}).join('')}</g>`;
  if(focusIndex!==null&&focusIndex!==undefined)svg.querySelector(`[data-point="${focusIndex}"]`)?.focus({preventScroll:true});
  $('diagram-range').textContent=`s: ${dt('s',range.xmin)}…${dt('s',range.xmax)}; ${isTS?'t':'h'}: ${dt(vertical,range.ymin)}…${dt(vertical,range.ymax)}`;
  diagramRanges.set(viewKey,{...range});diagramPlan.views[viewKey]={range:{...range},point:selected!=null&&choices[selected][2]==='history'?choices[selected][0]:null,processIndex:selected!=null&&choices[selected][2]==='process'?processPoints.findIndex(([q])=>q===choices[selected][0]):null};persistDiagram();
 }
 function choose(i){
  if(!choices[i])return;selected=i;$('diagram-point').value=String(i);const [q,label]=choices[i],y=value(q),w=range.xmax-range.xmin,h=range.ymax-range.ymin;
  if(q.s<range.xmin||q.s>range.xmax||y<range.ymin||y>range.ymax)range={xmin:q.s-w/2,xmax:q.s+w/2,ymin:y-h/2,ymax:y+h/2};
  $('diagram-selected').innerHTML=`<strong><span ${q.name?'data-i18n-ignore':''}>${escapeHTML(label)}</span> · ${escapeHTML(q.phase)}</strong><div class="diagram-metrics"><span>p: ${dt('p',q.p)}</span><span>t: ${dt('T',q.T-273.15)}</span><span>h: ${dt('h',q.h)}</span><span>s: ${dt('s',q.s)}</span><span>x: ${format(q.x)}</span></div><button id="diagram-transfer">Усі властивості стану</button>`;
  $('diagram-state-list').querySelectorAll('[data-diagram-select]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.diagramSelect)===i)));
  $('diagram-transfer').onclick=()=>{selectModel(q.model||'IF97');selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(pressureOutput(q.p,'MPa',pressureSettings));$('input-b').value=String(q.h);run();};draw();
 }
 function zoom(f,cx=.5,cy=.5){const w=range.xmax-range.xmin,h=range.ymax-range.ymin;if(w*f<.05||w*f>44)return;const x=range.xmin+w*cx,y=range.ymin+h*cy;range={xmin:x-w*f*cx,xmax:x+w*f*(1-cx),ymin:y-h*f*cy,ymax:y+h*f*(1-cy)};draw();}
 function fractions(x,y){const pt=svg.createSVGPoint();pt.x=x;pt.y=y;const p=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:Math.max(0,Math.min(1,(p.x-plot.left)/plot.width)),y:Math.max(0,Math.min(1,(plot.bottom-p.y)/plot.height))};}
 $('diagram-in').onclick=()=>zoom(.8);$('diagram-out').onclick=()=>zoom(1.25);$('diagram-reset').onclick=()=>{range={...initial};draw();};
 function fitEntries(entries){if(!entries.length)return;const xs=entries.map(([q])=>q.s),ys=entries.map(([q])=>value(q)),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys),padX=Math.max(.5,(xmax-xmin)*.15),padY=Math.max(baseY*.06,(ymax-ymin)*.15);range={xmin:xmin-padX,xmax:xmax+padX,ymin:ymin-padY,ymax:ymax+padY};draw();}
 $('diagram-fit').onclick=()=>fitEntries(choices);$('diagram-fit-selected').onclick=()=>fitEntries(choices.filter(([q,l,source])=>source==='history'&&!diagramPlan.excluded.includes(q)));if(process)$('diagram-fit-process').onclick=()=>fitEntries(processPoints);
 $('diagram-point').onchange=()=>{if($('diagram-point').value!=='')choose(Number($('diagram-point').value));};
 function expandLabel(){const expanded=document.body.classList.contains('diagram-expanded');$('diagram-expand').textContent=expanded?'Повернути панелі':'Розгорнути графік';$('diagram-expand').setAttribute('aria-pressed',String(expanded));}
 $('diagram-expand').onclick=()=>{document.body.classList.toggle('diagram-expanded');expandLabel();};expandLabel();
 $('diagram-refresh').onclick=()=>showDiagram(kind);$('diagram-clear').onclick=()=>{plottedProcess=null;storedProcess=null;saveProject();showDiagram(kind);};
 $('diagram-connect').onchange=()=>{diagramPlan.connectHistory=$('diagram-connect').checked;updateTable();draw();saveProject();};
 $('diagram-numbers').onchange=()=>{diagramPlan.numbers=$('diagram-numbers').checked;draw();saveProject();};
 $('diagram-state-list').onclick=e=>{const b=e.target.closest('[data-diagram-select],[data-diagram-move]');if(!b)return;if(b.dataset.diagramSelect!=null){choose(Number(b.dataset.diagramSelect));return;}const i=Number(b.dataset.diagramMove),q=choices[i]?.[0],visible=choices.filter(x=>x[2]==='history').map(x=>x[0]),j=visible.indexOf(q),other=visible[j+Number(b.dataset.direction)];if(!other)return;const a=diagramPlan.order.indexOf(q),c=diagramPlan.order.indexOf(other);[diagramPlan.order[a],diagramPlan.order[c]]=[diagramPlan.order[c],diagramPlan.order[a]];selected=null;refreshChoices();updateTable();updatePointList();$('diagram-selected').textContent='Порядок оновлено. Виберіть точку за новим номером.';draw();$('diagram-state-list').querySelector(`[data-diagram-move="${choices.findIndex(([state])=>state===q)}"][data-direction="${b.dataset.direction}"]`)?.focus({preventScroll:true});saveProject();};
 $('diagram-state-list').onchange=e=>{if(e.target.dataset.diagramInclude==null)return;const q=choices[Number(e.target.dataset.diagramInclude)][0];diagramPlan.excluded=diagramPlan.excluded.filter(x=>x!==q);if(!e.target.checked)diagramPlan.excluded.push(q);$('diagram-process-note').textContent=diagramNote();$('diagram-fit-selected').disabled=!choices.some(([q,l,source])=>source==='history'&&!diagramPlan.excluded.includes(q));draw();saveProject();};
 $('diagram-csv').onclick=()=>downloadFile(diagramCSV(choices,$('output-system').value,$('output-energy').value,diagramPlan),kind+'-states.csv','text/csv;charset=utf-8');
 diagramReportContent=()=>diagramReport($('project-title').value+' · '+(isTS?'T–s':'h–s')+' · '+modelValue(),svg.outerHTML,choices,$('output-system').value,$('output-energy').value,diagramNote());
 $('diagram-report').onclick=()=>downloadFile(diagramReportContent(),kind+'-report.html','text/html;charset=utf-8');
 $('diagram-save').onclick=()=>downloadFile(svg.outerHTML,kind+'.svg','image/svg+xml;charset=utf-8');
 $('diagram-legend').onclick=e=>{const b=e.target.closest('[data-isobar]');if(!b)return;const i=Number(b.dataset.isobar);hiddenIsobars.has(i)?hiddenIsobars.delete(i):hiddenIsobars.add(i);b.setAttribute('aria-pressed',String(!hiddenIsobars.has(i)));draw();};
 function nearby(x,y){const r=svg.getBoundingClientRect();return choices.map(([q,label],i)=>({i,label,x:r.left+X(q.s)/svg.viewBox.baseVal.width*r.width,y:r.top+Y(q)/svg.viewBox.baseVal.height*r.height})).filter(q=>choices[q.i][0].s>=range.xmin&&choices[q.i][0].s<=range.xmax&&value(choices[q.i][0])>=range.ymin&&value(choices[q.i][0])<=range.ymax&&q.x>=r.left&&q.x<=r.right&&q.y>=r.top&&q.y<=r.bottom&&Math.hypot(q.x-x,q.y-y)<=20);}
 function offerNearby(x,y){const found=nearby(x,y),box=$('diagram-nearby');if(!found.length){box.hidden=true;return;}if(found.length===1){box.hidden=true;choose(found[0].i);return;}box.hidden=false;box.innerHTML='<strong>Поруч кілька точок — виберіть стан:</strong>'+found.map(q=>`<button data-nearby-point="${q.i}">${q.i+1}. <span ${choices[q.i][0].name?'data-i18n-ignore':''}>${escapeHTML(q.label)}</span></button>`).join('');}
 $('diagram-nearby').onclick=e=>{const b=e.target.closest('[data-nearby-point]');if(b){choose(Number(b.dataset.nearbyPoint));$('diagram-nearby').hidden=true;}};
 stage.append($('diagram-nearby'));
 const hover=document.createElement('div');hover.className='diagram-hover';hover.hidden=true;stage.append(hover);
 svg.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||e.buttons){hover.hidden=true;return;}const found=nearby(e.clientX,e.clientY);if(!found.length){hover.hidden=true;return;}const q=choices[found[0].i][0];hover.setAttribute('data-i18n-ignore','');hover.textContent=found.map(x=>`${x.i+1}. ${choices[x.i][0].name?x.label:uiTranslator.text(x.label)}`).join(' · ')+` | p: ${dt('p',q.p)}; t: ${dt('T',q.T-273.15)}; h: ${dt('h',q.h)}; s: ${dt('s',q.s)}`;hover.hidden=false;});svg.addEventListener('pointerleave',()=>hover.hidden=true);
 svg.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const p=fractions(e.clientX,e.clientY);zoom(e.deltaY<0?.8:1.25,p.x,p.y);},{passive:false});
 let panEnabled=false;const touchPointers=new Map();
 $('diagram-pan').onclick=()=>{panEnabled=!panEnabled;$('diagram-pan').setAttribute('aria-pressed',String(panEnabled));svg.style.touchAction=panEnabled?'none':'pan-y';};
 const pointers=new Map();let gesture=null,moved=false,downPoint=null;
 function rebase(){const ps=[...pointers.values()];gesture={range:{...range},points:ps.map(p=>({...p}))};}
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(e.pointerType==='touch'&&!panEnabled){touchPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});return;}if(!pointers.size){moved=false;downPoint=e.target.closest('[data-point]')?.dataset.point??null;}else moved=true;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);rebase();svg.classList.add('is-dragging');});
 svg.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...pointers.values()],start=gesture.points,w=gesture.range.xmax-gesture.range.xmin,h=gesture.range.ymax-gesture.range.ymin;
  if(ps.length===1){const dx=ps[0].x-start[0].x,dy=ps[0].y-start[0].y;if(Math.hypot(dx,dy)>4)moved=true;const r=svg.getBoundingClientRect();range={xmin:gesture.range.xmin-dx/r.width*svg.viewBox.baseVal.width/plot.width*w,xmax:gesture.range.xmax-dx/r.width*svg.viewBox.baseVal.width/plot.width*w,ymin:gesture.range.ymin+dy/r.height*svg.viewBox.baseVal.height/plot.height*h,ymax:gesture.range.ymax+dy/r.height*svg.viewBox.baseVal.height/plot.height*h};}
  else {moved=true;const distance=p=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),factor=distance(start)/Math.max(distance(ps),1);if(w*factor<.05||w*factor>44)return;const a=fractions((start[0].x+start[1].x)/2,(start[0].y+start[1].y)/2),c=fractions((ps[0].x+ps[1].x)/2,(ps[0].y+ps[1].y)/2),x=gesture.range.xmin+a.x*w,y=gesture.range.ymin+a.y*h;range={xmin:x-c.x*w*factor,xmax:x+(1-c.x)*w*factor,ymin:y-c.y*h*factor,ymax:y+(1-c.y)*h*factor};}draw();
 });
 function endGesture(e,cancel=false){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(pointers.size){rebase();return;}gesture=null;svg.classList.remove('is-dragging');if(!cancel&&!moved)offerNearby(e.clientX,e.clientY);downPoint=null;}
 svg.addEventListener('pointerup',e=>{const start=touchPointers.get(e.pointerId);touchPointers.delete(e.pointerId);if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8){offerNearby(e.clientX,e.clientY);return;}endGesture(e);});svg.addEventListener('pointercancel',e=>touchPointers.delete(e.pointerId));svg.addEventListener('pointercancel',e=>endGesture(e,true));svg.addEventListener('lostpointercapture',e=>endGesture(e,true));
 svg.addEventListener('keydown',e=>{const point=e.target.closest('[data-point]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();choose(Number(point.dataset.point));return;}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.25:.8);}if(e.key.startsWith('Arrow')){e.preventDefault();const dx=(range.xmax-range.xmin)*.1,dy=(range.ymax-range.ymin)*.1,x=e.key==='ArrowLeft'?-dx:e.key==='ArrowRight'?dx:0,y=e.key==='ArrowDown'?-dy:e.key==='ArrowUp'?dy:0;range={xmin:range.xmin+x,xmax:range.xmax+x,ymin:range.ymin+y,ymax:range.ymax+y};draw();}});
 diagramRedraw=()=>{updatePointList();updateTable();draw();for(const b of $('diagram-legend').querySelectorAll('[data-isobar]'))b.textContent='━ '+dt('p',diagramCache.isobars[Number(b.dataset.isobar)].p);if(selected!==null)choose(selected);};
 diagramObserver=new ResizeObserver(draw);diagramObserver.observe(stage);draw();if(process&&!savedView)$('diagram-fit-process').click();if(selected!=null)choose(selected);$('process-view').scrollTop=0;
}

function inputCaption(el){const label=el.closest('label')?.cloneNode(true);if(label){label.querySelectorAll('input,select,button').forEach(n=>n.remove());return label.textContent.trim();}return document.querySelector(`label[for="${el.id}"]`)?.textContent||el.id;}
function panelForm(){return document.querySelector('#process-form,#engineering-form,#learn-form,#scientific-form,#batch-form,#flow-form,#tutorial-form');}
function panelInputs(form){const fields=form.id==='batch-form'?$('process-view').querySelectorAll('input,select,textarea'):form.querySelectorAll('input,select,textarea');return Object.fromEntries([...fields].filter(el=>el.id&&el.type!=='file').map(el=>[el.id,el.value]));}
function capturePanel(){if(restoringWorkspace)return;const form=panelForm();if(!form||!WORKSPACE_PANELS.includes(activeSection))return;panelRecords[activeSection]={inputs:panelInputs(form),calculated:form.dataset.calculated==='true',model:form.dataset.model||modelValue(),...(form.dataset.source?{source:form.dataset.source}:{})};}
function panelEdited(form){form.dataset.calculated='false';}
function panelCalculated(form,source){form.dataset.calculated='true';form.dataset.model=modelValue();if(source)form.dataset.source=source;capturePanel();saveProject();}
function restorePanelInputs(kind,form){
 const record=panelRecords[kind];if(!record)return false;
 const previous=restoringWorkspace;restoringWorkspace=true;
 try{
  // Select handlers build dependent options and visibility first; restore text values last.
  for(const el of form.querySelectorAll('select'))if(record.inputs[el.id]!=null){el.value=record.inputs[el.id];el.dispatchEvent(new Event('change',{bubbles:true}));}
  for(const [id,value] of Object.entries(record.inputs)){const el=$(id);if(el){el.value=value;if(el.tagName==='SELECT')el.dataset.previous=value;}}
 }finally{restoringWorkspace=previous;}
 return record.calculated;
}
function restorePanelResult(kind,form,ready=Promise.resolve()){
 const record=panelRecords[kind];if(!record?.calculated)return;
 ready.then(()=>{if(!form.isConnected||activeSection!==kind)return;if(form.id==='batch-form'&&record.source==='csv')$('batch-import').click();else form.requestSubmit();}).catch(()=>{});
}
function openSection(kind){if(['general','saturation','help'].includes(kind))selectView(kind);else if(['ts','hsdiagram','turbine','flash'].includes(kind))showProcess(kind);else if(kind==='batch')showBatch();else if(kind==='engineering')showEngineering();else if(kind==='flow')showFlow();else if(kind==='tutorials')showTutorials();else if(['boundaries','comparison'].includes(kind))scientificPanel(kind);else learningPanel(kind);}
const STORAGE_KEY='water-steam-if97-project-v1';
function projectSnapshot(){capturePanel();return {format:'water-steam-if97',version:1,digits:displayDigits,diagram:diagramWorkspaceSnapshot(diagramPlan,historyStates),pressure:pressureSettings,title:$('project-title').value,history:historyStates.map(q=>({p:q.p,h:q.h,model:q.model||'IF97',name:q.name||'',...(q.source?{source:q.source}:{})})),workspace:{active:activeSection,panels:panelRecords},process:storedProcess,form:{calculated:!!last,model:modelValue(),mode:$('mode').value,a:$('input-a').value,b:$('input-b').value,ua:$('unit-a').value,ub:$('unit-b').value},drafts:processDrafts,ambient,system:$('output-system').value,energy:$('output-energy').value,gray:document.body.classList.contains('gray'),scale:$('ui-scale').value,hints:hintsEnabled};}
function saveProject(){if(!persistenceReady||restoringWorkspace)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projectSnapshot()));unsavedProject=false;$('project-save-status').textContent='Збережено локально · JSON для резервної копії';}catch{unsavedProject=true;$('project-save-status').textContent='Є незбережені зміни — експортуйте JSON';$('result-status').textContent='Локальне збереження недоступне — експортуйте проєкт у файл';}}
function applyProject(p){restoringWorkspace=true;try{capturePanel();for(const key of Object.keys(panelRecords))delete panelRecords[key];Object.assign(panelRecords,p.workspace.panels);displayDigits=p.digits;$('display-digits').value=String(displayDigits);diagramPlan=p.diagram;diagramRanges.clear();pressureSettings=p.pressure;syncPressureControls();diagramCache=null;selectModel(p.form.model||'IF97');$('project-title').value=p.title;historyUndo=null;historyStates.splice(0,historyStates.length,...p.states);revision=p.states.length;ambient=p.ambient;ambientRef=referenceState(ambient.p,ambient.T);$('ambient-p').value=String(ambient.p);$('ambient-t').value=String(ambient.T-273.15);selectView('general');$('mode').value=p.form.mode;resetMode();for(const [id,v] of [['input-a',p.form.a],['input-b',p.form.b],['unit-a',p.form.ua],['unit-b',p.form.ub]])$(id).value=v;for(const id of ['unit-a','unit-b']){if(!$(id).value)throw Error('Одиниці не відповідають режиму.');$(id).dataset.previous=$(id).value;}Object.keys(processDrafts).forEach(k=>delete processDrafts[k]);Object.assign(processDrafts,p.drafts);storedProcess=p.process?{type:p.process.type,args:p.process.args,model:p.process.model||'IF97'}:null;plottedProcess=p.process?{kind:processLabel(p.process.type),result:p.process.result}:null;$('output-system').value=p.system;$('output-energy').value=p.energy;document.body.classList.toggle('gray',p.gray);hintsEnabled=p.hints!==false;$('hints-toggle').setAttribute('aria-pressed',String(hintsEnabled));if(!hintsEnabled)openGlossary.clear();$('ui-scale').value=p.scale;document.documentElement.style.setProperty('--ui-scale',p.scale);renderHistory();invalidate();if(p.result){last=p.result;render();$('result-status').textContent='Відновлено результат проєкту';}const active=p.workspace.active;if(active!=='general'&&active!=='saturation')openSection(active);else if(active==='saturation'){activeSection='saturation';$('tab-general').setAttribute('aria-selected','false');$('tab-saturation').setAttribute('aria-selected','true');}}finally{restoringWorkspace=false;}}
function restoreLocal(){try{const text=localStorage.getItem(STORAGE_KEY);if(text){const raw=JSON.parse(text);if(!raw.workspace){const panels={};for(const kind of ['gases','humid','cycles','ice','d2o','seawater']){try{const inputs=JSON.parse(localStorage.getItem('water-steam-learning-'+kind)||'null');if(inputs)Object.assign(panels,readWorkspace({active:kind,panels:{[kind]:{inputs,calculated:false,model:raw.form?.model||'IF97'}}}).panels);}catch{}}raw.workspace={active:'general',panels};}applyProject(readProject(JSON.stringify(raw)));}}catch{$('result-status').textContent='Збережений проєкт не відновлено; можна імпортувати файл';}}
function downloadFile(content,name,type){if(type.startsWith('text/html'))content=localizedDocument(content);else if(type.startsWith('image/svg+xml'))content=localizedDocument(content,'image/svg+xml');const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const fileMenu=document.querySelector('.menubar .menu');
const projectExport=document.createElement('button');projectExport.innerHTML=icon('download')+'Експорт проєкту JSON';projectExport.onclick=()=>{unsavedProject=false;$('project-save-status').textContent='JSON підготовлено для збереження';fileMenu.closest('details').open=false;downloadFile(JSON.stringify(projectSnapshot(),null,2),'water-steam-project.json','application/json');};fileMenu.append(projectExport);
const projectImport=document.createElement('button');projectImport.innerHTML=icon('upload')+'Імпорт проєкту / розрахунку JSON';const projectFile=document.createElement('input');projectFile.type='file';projectFile.accept='.json,application/json';projectFile.hidden=true;document.body.append(projectFile);projectImport.onclick=()=>{fileMenu.closest('details').open=false;projectFile.click();};fileMenu.append(projectImport);
projectFile.onchange=async()=>{const file=projectFile.files[0];if(!file)return;try{if(file.size>2000000)throw Error('Файл завеликий (максимум 2 МБ).');const text=await file.text();if(JSON.parse(text)?.format==='water-steam-if97'){const p=readProject(text);applyProject(p);$('result-status').textContent='Проєкт імпортовано';}else{const q=readCalculation(text);capturePanel();panelRecords[q.module]=q.record;if(['cycles','turbine','flash','engineering','batch','flow'].includes(q.module)&&q.record.model!==modelValue()){selectModel(q.record.model);diagramCache=null;invalidate();}openSection(q.module);$('result-status').textContent='Розрахунок імпортовано; результати обчислюються з входів';}saveProject();}catch(e){$('error').textContent='Імпорт: '+e.message;$('error').hidden=false;$('result-status').textContent='Не вдалося імпортувати проєкт';}projectFile.value='';};
document.addEventListener('input',e=>{if(e.target.closest('#calculator')||e.target.id==='project-title'||e.target.closest('#process-view'))saveProject();});
document.addEventListener('change',saveProject);document.addEventListener('click',e=>{if(e.target.closest('[data-action],[data-p]'))queueMicrotask(saveProject);});
window.addEventListener('pagehide',saveProject);

$('ambient-apply').onclick=()=>{try{const next={p:parseNumber($('ambient-p').value),T:parseNumber($('ambient-t').value)+273.15};const ref=referenceState(next.p,next.T);ambient=next;ambientRef=ref;$('ambient-status').textContent=`Застосовано P₀=${format(ambient.p)} МПа, T₀=${format(ambient.T)} K · ${ref.phase}`;if(last)render();saveProject();}catch(e){$('ambient-status').textContent=e.message;}};

$('output-system').addEventListener('change',()=>{if(last)render();else $('results').innerHTML=propertyTable(null);renderHistory();if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();if($('batch-results'))renderBatch();if($('process-form')?.dataset.calculated==='true'&&storedProcess?.type===activeSection&&plottedProcess)renderProcessOutput(activeSection,plottedProcess.result);
 if($('flow-results'))renderFlow();if($('eng-result'))renderEngineering();if(!$('process-view').hidden&&$('process-form')&&$('process-result')?.textContent.trim())$('process-form').requestSubmit();saveProject();});

function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let batchResults=[];
function showBatch(){
 selectView('panel');activeSection='batch';batchResults=[];$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[data-action="batch"]').setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');
 $('process-view').innerHTML=`<h2>Пакетні розрахунки</h2><p>До 500 точок. Помилки залишаються в таблиці; P–T на насиченні показує дві фази. Тиски абсолютні.</p><form id="batch-form"><fieldset><legend>Серія за діапазоном</legend><label>Режим<select id="batch-mode">${['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'].map(m=>`<option>${m}</option>`).join('')}</select></label><label>Змінний параметр<select id="batch-vary"><option value="b">Другий</option><option value="a">Перший</option></select></label><label>Одиниця першого<select id="batch-ua"></select></label><label>Одиниця другого<select id="batch-ub"></select></label>${[['start','Початок','30'],['end','Кінець','300'],['count','Кількість точок','10'],['fixed','Фіксований параметр','3']].map(([id,label,v])=>`<label>${label}<input id="batch-${id}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><button>Розрахувати серію</button></form><fieldset><legend>Вхідний CSV</legend><p>mode,a,b,unit_a,unit_b,name · коди одиниць: MPa, bar, psi, C, K, F, kJkg, kJkgK, Btulb, BtulbR, fraction. Роздільник кома або крапка з комою.</p><label for="batch-text">Дані CSV</label><textarea id="batch-text" rows="5">mode,a,b,unit_a,unit_b,name
pt,3,300,MPa,K,Рідина
px,0.1,0.5,MPa,fraction,Суміш</textarea><input type="file" id="batch-file" accept=".csv,text/csv" aria-label="Відкрити CSV"><button id="batch-import">Розрахувати CSV</button><button id="batch-example">Зберегти зразок CSV</button></fieldset><p id="batch-error" role="alert"></p><div id="batch-results"></div>`;
 function resetBatch(){const m=$('batch-mode').value,u=batchUnits(m);options('batch-ua',u.a.map(x=>[x,x]));options('batch-ub',u.b.map(x=>[x,x]));const sat=m.startsWith('sat');$('batch-ub').disabled=sat;$('batch-fixed').disabled=sat;$('batch-vary').disabled=sat;if(sat)$('batch-vary').value='a';}
 resetBatch();$('batch-mode').onchange=resetBatch;
 function clearBatch(){panelEdited($('batch-form'));batchResults=[];$('batch-results').replaceChildren();$('batch-error').textContent='';}
 $('batch-form').oninput=clearBatch;$('batch-form').addEventListener('change',clearBatch);$('batch-text').oninput=clearBatch;
 function evaluateBatch(inputs,source){$('batch-error').textContent='';batchResults=calculateBatch(inputs,modelValue());renderBatch();panelCalculated($('batch-form'),source);}
 $('batch-form').onsubmit=e=>{e.preventDefault();clearBatch();try{evaluateBatch(batchRange({mode:$('batch-mode').value,vary:$('batch-vary').value,...Object.fromEntries(['start','end','count','fixed'].map(k=>[k,$('batch-'+k).disabled?0:parseNumber($('batch-'+k).value)])),ua:$('batch-ua').value,ub:$('batch-ub').value}),'range');}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-import').onclick=()=>{clearBatch();try{evaluateBatch(parseBatchCSV($('batch-text').value),'csv');}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-file').onchange=async()=>{try{const f=$('batch-file').files[0];if(!f)return;if(f.size>1000000)throw Error('CSV завеликий (1 МБ).');clearBatch();$('batch-text').value=await f.text();saveProject();$('batch-error').textContent='Файл відкрито — натисніть «Розрахувати CSV».';}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-example').onclick=()=>downloadFile($('batch-text').value,'water-steam-input.csv','text/csv;charset=utf-8');restorePanelInputs('batch',$('batch-form'));restorePanelResult('batch',$('batch-form'));
}
function renderBatch(){if(!$('batch-results'))return;const keys=['p','T','h','s','x'];$('batch-results').innerHTML=`<p>Рядків: ${batchResults.length}; успішних: ${batchResults.filter(r=>!r.error).length}; помилок: ${batchResults.filter(r=>r.error).length}.</p><button id="batch-export">CSV результатів</button><button id="batch-history">Додати успішні стани до журналу</button><table><thead><tr><th>Назва</th>${keys.map(k=>`<th>${k} [${display(k,null,rows.find(r=>r[0]===k)[3])[1]}]</th>`).join('')}<th>Фаза / помилка</th></tr></thead><tbody>${batchResults.map(r=>r.error?`<tr><td data-i18n-ignore>${escapeHTML(r.input.name)}</td><td colspan="6">${escapeHTML(r.error)}</td></tr>`:batchStates(r).map(q=>`<tr><td data-i18n-ignore>${escapeHTML(r.input.name)}</td>${keys.map(k=>`<td>${format(display(k,k==='T'?q.T-273.15:q[k],rows.find(r=>r[0]===k)[3])[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')).join('')}</tbody></table>`;
 $('batch-export').onclick=()=>downloadFile(batchCSV(batchResults,$('output-system').value,$('output-energy').value),'water-steam-batch.csv','text/csv;charset=utf-8');$('batch-history').onclick=()=>{for(const r of batchResults)for(const q of batchStates(r))historyStates.unshift({...q,name:r.input.name});historyStates.splice(500);renderHistory();saveProject();$('batch-history').disabled=true;};}

function processLabel(kind){return {turbine:'Турбіна',flash:'Дроселювання',throttle:'Дроселювання',pump:'Насос',compressor:'Компресор','heat-exchanger':'Теплообмінник'}[kind]||kind;}
let engineeringResult=null,engineeringKind='compressor';
function showEngineering(){
 selectView('panel');activeSection='engineering';$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[data-action="engineering"]').setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');const draft=processDrafts.engineering||{};
 $('process-view').innerHTML=`<h2>Насос, компресор і теплообмінник</h2><p>Насос/компресор: адіабатичне стиснення, h₂=h₁+(h₂s−h₁)/η. Теплообмінник: протитечійний баланс двох потоків без втрат у довкілля; перевірка кінцевих температур. Площа, UA та внутрішній температурний профіль не визначаються.</p><form id="engineering-form"><label>Процес<select id="eng-mode"><option value="compressor">Компресор</option><option value="pump">Насос</option><option value="heat-exchanger">Теплообмінник</option></select></label><fieldset><legend>Одиниці · ${pressureBasisLabel()} тиск</legend><label>Тиск<select id="eng-pressure">${PU.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Температура<select id="eng-temperature">${TU.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Витрата<select id="eng-mass"><option value="kgs">кг/с</option><option value="kgh">кг/год</option><option value="lbs">lb/s</option><option value="lbh">lb/h</option></select></label><label>Теплова потужність<select id="eng-power-unit"><option value="kW">кВт</option><option value="Btuh">Btu/h</option></select></label></fieldset><fieldset><legend>Потік / гарячий потік</legend>${[['p1','Вхідний тиск','0.1'],['t1','Вхідна температура','150'],['p2','Вихідний тиск','1'],['eta','Ізоентропний ККД, %','80'],['flow','Масова витрата','1'],['power','Теплова потужність Q','100']].map(([k,l,v])=>`<label>${l}<input id="eng-${k}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><fieldset id="eng-cold"><legend>Холодний потік</legend>${[['pc1','Холодний вхідний тиск','0.1'],['tc1','Холодна вхідна температура','20'],['pc2','Холодний вихідний тиск','0.1'],['coldflow','Холодна масова витрата','1']].map(([k,l,v])=>`<label>${l}<input id="eng-${k}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><button>Розрахувати процес</button></form><p id="eng-error" role="alert"></p><div id="eng-result"></div>`;
 for(const k of ['p1','p2','pc1','pc2'])$('eng-'+k).value=String(pressureOutput(Number($('eng-'+k).value),'MPa',pressureSettings));
 const ids=['mode','pressure','temperature','mass','power-unit','p1','t1','p2','eta','flow','power','pc1','tc1','pc2','coldflow'];for(const id of ids)if(draft[id])$('eng-'+id).value=draft[id];
 function remember(){processDrafts.engineering=Object.fromEntries(ids.map(id=>[id,$('eng-'+id).value]));saveProject();}
 function mode(){const hx=$('eng-mode').value==='heat-exchanger';$('eng-cold').hidden=!hx;for(const k of ['power','power-unit','pc1','tc1','pc2','coldflow'])$('eng-'+k).disabled=!hx;$('eng-power').closest('label').hidden=!hx;$('eng-power-unit').closest('label').hidden=!hx;$('eng-eta').disabled=hx;$('eng-eta').closest('label').hidden=hx;
 // p1/p2 are shared across modes but their valid relation flips: compressor/pump need p2>p1, heat exchanger needs p2<=p1 (hot-side pressure drop).
 const p1=parseNumber($('eng-p1').value),p2=parseNumber($('eng-p2').value);
 if(Number.isFinite(p1)&&Number.isFinite(p2)){if(hx&&p2>p1)$('eng-p2').value=String(p1);else if(!hx&&p2<=p1)$('eng-p2').value=String(p1*10);}}
 mode();$('eng-mode').onchange=()=>{mode();engineeringResult=null;$('eng-result').innerHTML='';remember();};
 for(const id of ['pressure','temperature','mass','power-unit']){const el=$('eng-'+id);el.dataset.previous=el.value;el.onchange=()=>{try{const converted=[];for(const k of id==='pressure'?['p1','p2','pc1','pc2']:id==='temperature'?['t1','tc1']:id==='mass'?['flow','coldflow']:['power']){const input=$('eng-'+k);if(!input.value.trim())continue;const v=parseNumber(input.value);converted.push([input,String(id==='mass'?massFrom(massTo(v,el.dataset.previous),el.value):id==='power-unit'?v*(el.dataset.previous==='Btuh'?1055.05585262/3600000:1)/(el.value==='Btuh'?1055.05585262/3600000:1):fromCanonical(toCanonical(v,el.dataset.previous),el.value))]);}for(const [input,value] of converted)input.value=value;}catch(error){el.value=el.dataset.previous;$('eng-error').textContent=error.message;}el.dataset.previous=el.value;engineeringResult=null;$('eng-result').innerHTML='';remember();};}
 $('engineering-form').addEventListener('change',()=>panelEdited($('engineering-form')));
 $('engineering-form').oninput=()=>{panelEdited($('engineering-form'));engineeringResult=null;$('eng-result').innerHTML='';remember();};
 $('engineering-form').onsubmit=e=>{e.preventDefault();try{const n=k=>{const v=parseNumber($('eng-'+k).value);return ['p1','p2','pc1','pc2'].includes(k)?pressureInput(v,$('eng-pressure').value,pressureSettings):['t1','tc1'].includes(k)?toCanonical(v,$('eng-temperature').value):['flow','coldflow'].includes(k)?massTo(v,$('eng-mass').value):k==='power'&&$('eng-power-unit').value==='Btuh'?v*1055.05585262/3600000:v;};engineeringKind=$('eng-mode').value;const args=engineeringKind==='heat-exchanger'?[n('p1'),n('t1'),n('p2'),n('flow'),n('pc1'),n('tc1'),n('pc2'),n('coldflow'),n('power')]:[n('p1'),n('t1'),n('p2'),n('eta')/100,n('flow')];engineeringResult=engineeringKind==='heat-exchanger'?heatExchanger(...args,modelValue()):compression(engineeringKind,...args,modelValue());storedProcess={type:engineeringKind,args,model:modelValue()};plottedProcess={kind:processLabel(engineeringKind),result:engineeringResult};$('eng-error').textContent='';remember();renderEngineering();panelCalculated($('engineering-form'));}catch(e){panelEdited($('engineering-form'));engineeringResult=null;$('eng-result').innerHTML='';$('eng-error').textContent=e.message;}};
 restorePanelInputs('engineering',$('engineering-form'));restorePanelResult('engineering',$('engineering-form'));
}
function renderEngineering(){if(!engineeringResult||!$('eng-result'))return;const r=engineeringResult,keys=['p','T','h','s','x'];const metric=(k,v,u)=>{const [a,b]=processDisplay(k,v,u);return format(a)+' '+b;};$('eng-result').innerHTML=`<p>${engineeringKind==='heat-exchanger'?'Теплова потужність':'Споживана потужність'}: <strong>${metric('power',r.power,'кВт')}</strong>${r.work!=null?' · Робота стиснення: '+metric('work',r.work,'кДж/кг'):''}</p><table><thead><tr><th>Стан</th>${keys.map(k=>`<th>${k} [${processDisplay(k,null,{p:'МПа',T:'°C',h:'кДж/кг',s:'кДж/(кг·K)',x:'–'}[k])[1]}]</th>`).join('')}<th>Фаза</th></tr></thead><tbody>${engineeringStates(r).map(([name,q])=>`<tr><td>${name}</td>${keys.map(k=>`<td>${format(processDisplay(k,k==='T'?q.T-273.15:q[k],'')[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')}</tbody></table><button id="eng-export">CSV процесу</button><button id="eng-history">Додати кінцеві стани до журналу</button><button id="eng-plot">Нанести процес на діаграму</button>`;
 $('eng-export').onclick=()=>downloadFile(engineeringCSV(engineeringKind,r,$('output-system').value),engineeringKind+'.csv','text/csv;charset=utf-8');$('eng-history').onclick=()=>{for(const [name,q] of engineeringStates(r))historyStates.unshift({...q,name:processLabel(engineeringKind)+' · '+name});historyStates.splice(500);renderHistory();saveProject();$('eng-history').disabled=true;};$('eng-plot').onclick=()=>{showProcess('hsdiagram');$('diagram-fit-process').click();};}

const reportExport=document.createElement('button');reportExport.innerHTML=icon('report')+'Звіт для друку HTML';reportExport.onclick=()=>{if($('steam-diagram')&&!$('process-view').hidden&&diagramReportContent){downloadFile(diagramReportContent(),'diagram-report.html','text/html;charset=utf-8');return;}fileMenu.closest('details').open=false;const states=historyStates.length?historyStates:last?.state?[last.state]:[];const panel=$('process-view').hidden?null:$('process-view').cloneNode(true);let extra='';if(panel&&panelForm()?.dataset.calculated==='true'){const form=panel.querySelector('form');const inputs=[...panelForm().querySelectorAll('input,select')].filter(el=>!el.disabled&&el.type!=='file').map(el=>[inputCaption(el),el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:el.value]);panel.querySelectorAll('[data-glossary]').forEach(el=>el.replaceWith(document.createTextNode(el.textContent.trim())));panel.querySelectorAll('form,button,input,textarea').forEach(el=>el.remove());extra='<h2>Поточний розрахунок</h2><table><thead><tr><th>Вхідний параметр</th><th>Значення</th></tr></thead><tbody>'+inputs.map(([name,value])=>`<tr><td>${escapeHTML(name)}</td><td>${escapeHTML(value)}</td></tr>`).join('')+'</tbody></table>'+panel.innerHTML;}if(!states.length&&!extra){$('result-status').textContent='Спочатку розрахуйте хоча б один стан';return;}downloadFile(printableReport($('project-title').value,states,$('output-system').value,$('output-energy').value,{extra,result:last?ambientResult(last):null,ambient,pressure:pressureSettings}),'water-steam-report.html','text/html;charset=utf-8');};fileMenu.append(reportExport);
document.querySelector('[role=tablist]').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...document.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();});

// Start with room for results on phones; the menu can reveal settings at any time.
if(window.matchMedia('(max-width:700px)').matches)document.body.classList.add('setup-collapsed');
// A native section picker keeps every panel reachable on narrow screens.
const sectionTabs=[...document.querySelectorAll('[role="tab"]')];
$('section-select').replaceChildren(...sectionTabs.map(tab=>new Option(sourceUIText(tab).trim(),tab.dataset.action)));
$('section-select').onchange=()=>sectionTabs.find(tab=>tab.dataset.action===$('section-select').value)?.click();
const syncSection=()=>{const selected=sectionTabs.find(tab=>tab.getAttribute('aria-selected')==='true');if(selected)$('section-select').value=selected.dataset.action;};
new MutationObserver(syncSection).observe(document.querySelector('[role="tablist"]'),{subtree:true,attributes:true,attributeFilter:['aria-selected']});
syncSection();

function pressureBasisLabel(){return pressureSettings.basis==='gauge'?'манометричний':'абсолютний';}
function syncPressureControls(){$('pressure-basis').value=pressureSettings.basis;$('pressure-atmosphere').value=String(pressureSettings.atmosphere*1000);}
function convertPressureFields(inputs,prefix,old,next){
 const unit=inputs[prefix+'pressure']||'MPa';
 for(const k of prefix==='eng-'?['p1','p2','pc1','pc2']:['p1','p2'])if(inputs[prefix+k]!=null&&inputs[prefix+k].trim())inputs[prefix+k]=String(Number(pressureOutput(pressureInput(parseNumber(inputs[prefix+k]),unit,old),unit,next).toPrecision(12)));
}
$('pressure-apply').onclick=()=>{
 try{
  const next=readPressure({basis:$('pressure-basis').value,atmosphere:parseNumber($('pressure-atmosphere').value)/1000}),old=pressureSettings;
  capturePanel();const records=JSON.parse(JSON.stringify(panelRecords)),drafts=JSON.parse(JSON.stringify(processDrafts));
  for(const kind of ['turbine','flash','engineering']){const prefix=kind==='engineering'?'eng-':'process-';if(records[kind])convertPressureFields(records[kind].inputs,prefix,old,next);if(drafts[kind]){const values=Object.fromEntries(Object.entries(drafts[kind]).map(([k,v])=>[prefix+k,v]));convertPressureFields(values,prefix,old,next);drafts[kind]=Object.fromEntries(Object.entries(values).map(([k,v])=>[k.slice(prefix.length),v]));}}
  let a=$('input-a').value;if(PRESSURE_UNITS.includes($('unit-a').value)&&a.trim())a=String(Number(pressureOutput(pressureInput(parseNumber(a),$('unit-a').value,old),$('unit-a').value,next).toPrecision(12)));
  pressureSettings=next;Object.assign(panelRecords,records);Object.assign(processDrafts,drafts);$('input-a').value=a;
  if(PRESSURE_UNITS.includes($('unit-a').value))$('label-a').textContent='1. Тиск ('+pressureBasisLabel()+'):';
  if(['turbine','flash','engineering'].includes(activeSection)){const form=panelForm(),rec=records[activeSection];if(rec)for(const [id,v] of Object.entries(rec.inputs))if($(id))$(id).value=v;const legend=form?.querySelector('fieldset legend');if(legend)legend.textContent='Вхідні дані · '+pressureBasisLabel()+' тиск';form?.dispatchEvent(new Event('input',{bubbles:true}));if(rec?.calculated)form.requestSubmit();}
  renderHistory();if(last)render();else $('results').innerHTML=propertyTable(null);syncPressureControls();
  $('pressure-status').textContent='Застосовано '+pressureBasisLabel()+' тиск; Pатм = '+format(next.atmosphere*1000)+' кПа. Абсолютний стан збережено. Інші вкладки й CSV — абсолютний тиск.';saveProject();
 }catch(e){syncPressureControls();$('pressure-status').textContent='Тиск не змінено: '+e.message;}
};

for(const id of ['pressure-basis','pressure-atmosphere'])$(id).addEventListener('input',()=>{$('pressure-status').textContent='Зміни ще не застосовано — натисніть «Застосувати тиск». Абсолютний стан буде збережено.';});

document.addEventListener('languagechange',()=>{
 renderHistory();if(last)render();else $('results').innerHTML=propertyTable(null);
 if(currentPanelKind&&learningResult)renderLearning(currentPanelKind,learningResult);
 if($('process-form')?.dataset.calculated==='true'&&storedProcess?.type===activeSection&&plottedProcess)renderProcessOutput(activeSection,plottedProcess.result);
 if($('flow-results'))renderFlow();if($('eng-result'))renderEngineering();if($('batch-form')?.dataset.calculated==='true')renderBatch();
 if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();
 translateUI();
});
