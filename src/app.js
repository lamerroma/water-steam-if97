import {printableReport} from './print-report.js';
import {compression,heatExchanger,engineeringStates,engineeringCSV} from './engineering.js';
import {batchUnits,batchRange,parseBatchCSV,calculateBatch,batchStates,batchCSV} from './batch.js';
import {diagramQuantity} from './diagram-units.js';
import {referenceState,withExergy} from './exergy.js';
import {readProject,processCSV} from './project.js';
import {turbine,turbineInverse,flash,diagramData} from './processes.js';
import {exportCSV} from './export.js';
import {initialize,calculate,PMIN_SAT,TC,PC} from './engine.js';
import {parseNumber,toCanonical,fromCanonical,englishProperty} from './units.js';
const $=id=>document.getElementById(id);
let last=null, revision=0, persistenceReady=false, storedProcess=null;
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
 const m=$('mode').value,t=['satt','tx','th','ts','trho'].includes(m),h=m==='hs',quality=m==='px'||m==='tx',sat=m==='satp'||m==='satt';
 $('field-b').hidden=sat;$('input-b').disabled=sat;
 $('label-a').textContent=t?'1. Температура:':h?'1. Ентальпія:':'1. Тиск (абсолютний):';options('unit-a',t?TU:h?HU:PU);
 $('label-b').textContent=quality?'2. Ступінь сухості:':['prho','trho'].includes(m)?'2. Густина:':['ph','th'].includes(m)?'2. Ентальпія:':['ps','ts'].includes(m)||h?'2. Ентропія:':'2. Температура:';
 options('unit-b',['prho','trho'].includes(m)?[['kgm3','кг/м³'],['lbft3','lb/ft³']]:quality?[['fraction','0…1'],['percent','%']]:['ph','th'].includes(m)?HU:['ps','ts'].includes(m)||h?SU:TU);
 $('input-a').value=t?'100':h?'2631.49474':'3';$('input-b').value=quality?'0.5':h?'5.17540298':['prho','trho'].includes(m)?'997':['ph','th'].includes(m)?'500':['ps','ts'].includes(m)?'1':'26.85';
 $('mode-help').textContent=quality?'x — масова частка пари: 0 рідина, 1 пара. У критичній точці x не визначений.':h?'Введіть питому ентальпію й ентропію. Тиск і температура визначаються чисельно за обраною формуляцією.':m==='pt'?'На лінії насичення P–T не визначає частку пари.':sat?'Показує обидві фази на лінії насичення.':'Сухість визначається з ентальпії або ентропії.';
 for(const name of ['general','saturation','help'])$('tab-'+name).setAttribute('aria-selected',String(name===((sat||quality)?'saturation':'general')));
 invalidate();
}
function invalidate() {
 $('model-status').textContent='Таблиці води та пари → '+modelValue();
  last=null;$('export-csv').disabled=true;$('result-status').textContent='Параметри змінено — розрахуйте знову';$('error').hidden=true;
  $('results').innerHTML=propertyTable(null);$('state-summary').textContent=$('mode-help').textContent;
}
function format(n) {if(n===null||n===undefined||!Number.isFinite(n))return '—';return new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:8,notation:Math.abs(n)>0&&Math.abs(n)<1e-4?'scientific':'standard'}).format(n);}
function display(key,value,unit) {if($('output-system').value==='english')return englishProperty(key,key==='T'&&value!=null?value+273.15:value,unit);if(['h','s','cp','cv','u','A','G','ijt','ex'].includes(key)&&$('output-energy').value==='J')return [value===null?null:value*1000,unit.replace('кДж','Дж')];return [value,unit];}
const rows=[['p','Тиск (абсолютний)','p','МПа'],['T','Температура','t','°C'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['h','Питома ентальпія','h','кДж/кг'],['s','Питома ентропія','s','кДж/(кг·K)'],['u','Питома внутрішня енергія','u','кДж/кг'],['cp','Питома ізобарна теплоємність','cp','кДж/(кг·K)'],['cv','Питома ізохорна теплоємність','cv','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['ex','Фізична ексергія потоку','ex','кДж/кг'],['x','Ступінь сухості (масова частка пари)','x','–'],['region','Область IF97','region','–'],['isentropic','Ізентропний показник','κs','–'],['A','Питома енергія Гельмгольца','a','кДж/кг'],['G','Питома енергія Гіббса','g','кДж/кг'],['Z','Коефіцієнт стисливості','Z','–'],['alpha','Ізобарне об’ємне розширення','α','1/K'],['kappa','Ізотермічна стисливість','κT','1/МПа'],['dvdt','Похідна (∂v/∂T)p','vT','м³/(кг·K)'],['dvdp','Похідна (∂v/∂p)T','vp','м³/(кг·МПа)'],['dpdt','Похідна (∂p/∂T)v','pT','МПа/K'],['dpdv','Похідна (∂p/∂v)T','pv','МПа·кг/м³'],['ijt','Ізотермічний коефіцієнт Джоуля–Томсона','δT','кДж/(кг·МПа)'],['jt','Коефіцієнт Джоуля–Томсона','μJT','K/МПа'],['dc','Статична відносна діелектрична проникність','εr','–'],['mu','Динамічна в’язкість','μ','Па·с'],['nu','Кінематична в’язкість','ν','м²/с'],['lambda','Теплопровідність','λ','Вт/(м·K)'],['diffusivity','Температуропровідність','aT','м²/с'],['Pr','Число Прандтля','Pr','–'],['sigma','Поверхневий натяг рідина–пара','σ','Н/м']];
rows.splice(6,0,rows.splice(rows.findIndex(r=>r[0]==='ex'),1)[0]);
const constants=['Газова стала R = 0,461526 кДж/(кг·K)','Молярна газова стала Rm = 8,31451 Дж/(моль·K)','Молярна маса M = 18,015257 г/моль','Критична температура Tc = 647,096 K','Критичний тиск pc = 22,064 МПа','Критична густина ρc = 322 кг/м³','Потрійна точка Tt = 273,16 K','Потрійна точка pt = 611,657 Па'];
function propertyTable(state) {
 return `<table class="property-table"><thead><tr><th>№</th><th>Назва властивості</th><th>Символ</th><th>⧉</th><th>Результат</th><th>Одиниці</th><th>Константи ${modelValue()}</th></tr></thead><tbody>${rows.map(([key,name,symbol,unit],i)=>{
 const value=state?(key==='T'?state.T-273.15:state[key]):null;
 const [v,u]=display(key,value,unit);
 const groupId=i<11?'main':i<26?'state':'transport';
 const groupName=i===0?'1. Термодинамічні властивості — основні':i===11?'2. Термодинамічні властивості — стан':i===26?'3. Транспортні властивості':null;
 const collapsed=collapsedGroups.has(groupId);
 const group=groupName?`<tr class="group"><td colspan="7"><button data-group="${groupId}" aria-expanded="${!collapsed}">${collapsed?'⊞':'⊟'} ${groupName}</button></td></tr>`:'';
 return `${group}<tr data-group-row="${groupId}" ${collapsed?'hidden':''} data-property="${key}"><td>${i+1}</td><td>${name}</td><td>${symbol}</td><td><button class="copy" data-copy="${key}" aria-label="Копіювати: ${name}" ${v==null?'disabled':''}>⧉</button></td><td>${state?format(v):''}</td><td>${u}</td><td class="constant">${(modelValue()==='IAPWS-95'?['Газова стала R = 0,46151805 кДж/(кг·K)','','','Критична температура Tc = 647,096 K','Критичний тиск pc = 22,064 МПа','Критична густина ρc = 322 кг/м³','Потрійна точка Tt = 273,16 K','Потрійна точка (EOS) pt ≈ 611,654771 Па'][i]:constants[i])||''}</td></tr>`;
 }).join('')}</tbody></table>`;
}
let historyUndo=null,unsavedProject=false;
function renderHistory() {
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 $('history-body').innerHTML=historyStates.map((s,i)=>`<tr><td>${historyStates.length-i}</td><td><input class="state-name" data-history-name="${i}" aria-label="Назва стану ${historyStates.length-i}" maxlength="80" value="${escapeHTML(s.name||'')}"></td><td><button data-history-open="${i}" aria-label="Відкрити стан ${historyStates.length-i}">↗</button><button data-history-delete="${i}" aria-label="Видалити стан ${historyStates.length-i}">×</button></td>${keys.map(k=>`<td>${format(display(k,k==='T'?s.T-273.15:s[k],rows.find(r=>r[0]===k)?.[3]||'')[0])}</td>`).join('')}<td>${escapeHTML(s.model||'IF97')}</td></tr>`).join('')+Array.from({length:Math.max(0,6-historyStates.length)},(_,i)=>`<tr><td>${historyStates.length+i+1}</td>${'<td></td>'.repeat(16)}</tr>`).join('');
 document.querySelector('#history thead tr').innerHTML='<th>№</th><th>Назва</th><th>Дії</th>'+keys.map(k=>`<th>${k} [${display(k,null,rows.find(r=>r[0]===k)?.[3]||'–')[1]}]</th>`).join('')+'<th>Модель</th>';
 $('history-count').textContent=`Станів: ${historyStates.length}`;$('history-undo').disabled=!historyUndo;
}
$('history-body').addEventListener('input',e=>{if(e.target.dataset.historyName!=null){historyStates[Number(e.target.dataset.historyName)].name=e.target.value;saveProject();}});
$('history-body').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const open=button.dataset.historyOpen,del=button.dataset.historyDelete;if(del!=null){historyUndo=[...historyStates];historyStates.splice(Number(del),1);renderHistory();saveProject();}if(open!=null){const q=historyStates[Number(open)];selectModel(q.model||'IF97');selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(q.p);$('input-b').value=String(q.h);last={state:q};render();$('result-status').textContent='Відкрито стан журналу';saveProject();}});
$('history-undo').onclick=()=>{if(!historyUndo)return;historyStates.splice(0,historyStates.length,...historyUndo);historyUndo=null;renderHistory();saveProject();};
window.addEventListener('beforeunload',e=>{if(unsavedProject){e.preventDefault();e.returnValue='';}});

function selectView(view) {
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
  html=propertyTable(s)+notes(s.notes);if(last.alternatives?.length)html+='<h3>Інші знайдені стани</h3>'+last.alternatives.map(q=>`<p>P = ${format(q.p)} МПа · T = ${format(q.T)} K · ${q.phase}</p>`+propertyTable(q)).join('');
 }
 if(last.saturation) {
  const sat=last.saturation;
  if(!last.state){$('state-summary').textContent=sat.critical?'Критична точка':'Рівновага рідина–пара';}
  if(!last.state)html=`<div class="state-banner"><strong>${sat.critical?'Критична точка':'Лінія насичення'}</strong><span>${sat.model||'IAPWS-IF97'}</span></div><p class="state-meta">P = ${format(sat.p)} МПа &nbsp;·&nbsp; T = ${format(sat.T)} K / ${format(sat.T-273.15)} °C</p>`;
  if(last.ambiguous)html+=notes(['На лінії насичення P і T залежні. Частка пари невідома: для властивостей суміші використайте P–h або P–s.']);
  if(last.state)html+='<h3>Властивості фаз при цьому тиску</h3>';
  html+=table(sat);
  const [latent,unit]=display('h',sat.latentHeat,'кДж/кг');
  html+=`<p class="state-meta">Теплота пароутворення: ${format(latent)} ${unit}</p>${notes([...sat.liquid.notes,...sat.vapor.notes])}`;
 }
 last=original;$('results').innerHTML=html;$('export-csv').disabled=false;
 $('result-status').textContent=`Розрахунок № ${revision} · 8 значущих цифр`;
}
function run(event) {
 event?.preventDefault();$('error').hidden=true;
 try {
   const m=$('mode').value,a=toCanonical(parseNumber($('input-a').value),$('unit-a').value);
   const b=m.startsWith('sat')?undefined:toCanonical(parseNumber($('input-b').value),$('unit-b').value);
   const result=calculate(m,a,b,modelValue());last=result;revision++;if(result.state)historyStates.unshift(result.state);else if(result.saturation)historyStates.unshift(result.saturation.vapor,result.saturation.liquid);historyStates.splice(500);renderHistory();render();saveProject();
 }catch(e) {invalidate();$('error').textContent=e.message;$('error').hidden=false;$('result-status').textContent='Перевірте вхідні дані';}
}
$('mode').addEventListener('change',resetMode);
for(const el of document.querySelectorAll('input[name=formulation]'))el.onchange=()=>{diagramCache=null;plottedProcess=null;selectView('general');invalidate();saveProject();};
for(const letter of ['a','b']) {
 $('input-'+letter).addEventListener('input',invalidate);
 $('unit-'+letter).addEventListener('change',()=>{const select=$('unit-'+letter);try{const n=parseNumber($('input-'+letter).value);$('input-'+letter).value=String(Number(fromCanonical(toCanonical(n,select.dataset.previous),select.value).toPrecision(12)));}catch{}select.dataset.previous=select.value;invalidate();});
}
$('calculator').addEventListener('submit',run);
$('output-energy').addEventListener('change',()=>{renderHistory();if(last)render();else $('results').innerHTML=propertyTable(null);if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();if($('batch-results'))renderBatch();if($('eng-result'))renderEngineering();});
for(const button of document.querySelectorAll('[data-p]')) button.addEventListener('click',()=>{$('mode').value='pt';resetMode();$('input-a').value=button.dataset.p;$('unit-b').value='K';$('unit-b').dataset.previous='K';$('input-b').value=button.dataset.t;run();});
$('export-csv').addEventListener('click',()=>{
 if(!last)return;
 const csv=exportCSV(ambientResult(last),$('output-energy').value,ambient,$('output-system').value);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='water-steam-if97.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action],[data-copy],[data-group]');if(!target)return;
 const action=target.dataset.action;
 if(target.dataset.group){const g=target.dataset.group;collapsedGroups.has(g)?collapsedGroups.delete(g):collapsedGroups.add(g);if(last)render();else $('results').innerHTML=propertyTable(null);}
 if(action==='toggle-setup'){document.body.classList.toggle('setup-collapsed');}
 if(action==='toggle-output'){document.body.classList.toggle('output-collapsed');}
 if(action==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{$('result-status').textContent='Повний екран недоступний';});}
 if(action==='export-history')exportHistory();
 if(action==='units-si'||action==='units-english'){$('output-system').value=action==='units-si'?'si':'english';$('output-system').dispatchEvent(new Event('change'));}
 if(['general','saturation','help'].includes(action))selectView(action);
 if(['turbine','flash','ts','hsdiagram'].includes(action))showProcess(action);
 if(action==='batch')showBatch();
 if(action==='engineering')showEngineering();
 if(action==='clear'){historyUndo=historyStates.length?[...historyStates]:historyUndo;historyStates.length=0;revision=0;renderHistory();invalidate();$('result-status').textContent='Результати очищено';}
 if(action==='export')$('export-csv').click();
 if(action==='print')window.print();
 if(action==='blue'||action==='gray')document.body.classList.toggle('gray',action==='gray');
 if(target.dataset.copy&&last?.state){const k=target.dataset.copy;const row=rows.find(r=>r[0]===k);const raw=k==='T'?last.state.T-273.15:ambientResult(last).state[k];const [value]=display(k,raw,row[3]);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(String(value)).then(()=>{$('result-status').textContent='Значення скопійовано';}).catch(()=>{$('result-status').textContent='Копіювання недоступне в цьому браузері';});else $('result-status').textContent='Копіювання недоступне в цьому браузері';}
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
const divider=$('output-resize');let resizing=false;
function resizeOutput(height){const max=Math.max(100,Math.min(400,window.innerHeight-350));const h=Math.round(Math.max(100,Math.min(max,height)));document.documentElement.style.setProperty('--output-height',h+'px');divider.setAttribute('aria-valuenow',String(h));}
divider.addEventListener('pointerdown',e=>{if(window.innerWidth<=700)return;resizing=true;divider.setPointerCapture(e.pointerId);document.body.classList.remove('output-collapsed');});
divider.addEventListener('pointermove',e=>{if(resizing)resizeOutput(window.innerHeight-e.clientY-24);});
divider.addEventListener('pointerup',()=>{resizing=false;});divider.addEventListener('pointercancel',()=>{resizing=false;});
divider.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();resizeOutput(Number(divider.getAttribute('aria-valuenow'))+(e.key==='ArrowUp'?20:-20));}});
resetMode();renderHistory();
(async()=>{
 try {const bytes=Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0));await initialize(bytes);$('calculate').disabled=false;$('calculate').innerHTML='Розрахувати';persistenceReady=true;$('result-status').textContent='Готово до розрахунку';restoreLocal();}
 catch(e){$('error').textContent='Не вдалося ініціалізувати WebAssembly. Використайте сучасний браузер. '+e.message;$('error').hidden=false;$('calculate').textContent='Помилка завантаження';}
})();

let diagramCache=null, plottedProcess=null, diagramRedraw=null;
function massTo(v,u){return u==='kgh'?v/3600:u==='lbs'?v*.45359237:u==='lbh'?v*.45359237/3600:v;}
function massFrom(v,u){return u==='kgh'?v*3600:u==='lbs'?v/.45359237:u==='lbh'?v*3600/.45359237:v;}
function processDisplay(k,v,u){return $('output-system').value==='english'?englishProperty(k,k==='T'?v+273.15:v,u):[v,u];}
function showProcess(kind){
 $('calculator-view').hidden=true;$('help-view').hidden=true;$('process-view').hidden=false;
 for(const b of document.querySelectorAll('[role="tab"]'))b.setAttribute('aria-selected',String(b.dataset.action===kind));
 if(kind==='ts'||kind==='hsdiagram'){showDiagram(kind);return;}
 const tur=kind==='turbine';const draft=processDrafts[kind]||{};
 $('process-view').innerHTML=`<h2>${tur?'Парова турбіна':'Дроселювання та випаровування'}</h2><p>${tur?'Адіабатичне розширення з ізоентропним ККД. Потужність потоку без механічних і генераторних втрат.':'Адіабатичне дроселювання: h₂ = h₁. Поділ потоків наведено лише для рівноважного двофазного стану.'} Змінами кінетичної й потенціальної енергій знехтувано.</p><form id="process-form"><label>Режим<select id="process-mode">${tur?'<option value="power">Потужність</option><option value="flow">Витрата пари</option><option value="efficiency">Ізоентропний ККД</option>':'<option value="subcooled">Однофазний вхід P–T</option><option value="saturated">Насичений конденсат</option>'}</select></label><fieldset><legend>Вхідні дані · абсолютний тиск</legend><label>Одиниця тиску<select id="process-pressure"><option value="MPa">МПа</option><option value="bar">бар</option><option value="kPa">кПа</option><option value="psi">psi</option></select></label><label>Одиниця температури<select id="process-temperature"><option value="C">°C</option><option value="K">K</option><option value="F">°F</option></select></label><label>Одиниця витрати<select id="process-mass"><option value="kgs">кг/с</option><option value="kgh">кг/год</option><option value="lbs">lb/s</option><option value="lbh">lb/h</option></select></label>${tur?'<label>Одиниця потужності<select id="process-power-unit"><option value="kW">кВт</option><option value="Btuh">Btu/h</option></select></label>':''}${[['p1','Вхідний тиск','3'],['t1','Вхідна температура',tur?'400':'200'],['p2','Вихідний тиск','0.1'],...(tur?[['eta','Ізоентропний ККД, %','85']]:[]),['flow','Масова витрата','1'],...(tur?[['power','Потужність','600']]:[])].map(([id,label,value])=>`<label>${label}<input id="process-${id}" value="${value}" inputmode="decimal" required></label>`).join('')}</fieldset><button type="submit">Розрахувати</button></form><p id="process-error" role="alert"></p><div id="process-result"></div>`;
 for(const id of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit'])if($('process-'+id)&&draft[id])$('process-'+id).value=draft[id];
 function updateProcessMode(){const mode=$('process-mode').value;for(const id of ['eta','flow','power','t1']){const el=$('process-'+id);if(!el)continue;const hidden=tur?(id==='power'&&mode==='power')||(id==='eta'&&mode==='efficiency')||(id==='flow'&&mode==='flow'):id==='t1'&&mode==='saturated';el.disabled=hidden;el.closest('label').hidden=hidden;}}
 updateProcessMode();$('process-mode').addEventListener('change',()=>{updateProcessMode();$('process-result').innerHTML='';rememberDraft();});
 function rememberDraft(){processDrafts[kind]={};for(const id of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit'])if($('process-'+id))processDrafts[kind][id]=$('process-'+id).value;saveProject();}
 for(const id of ['pressure','temperature','mass','power-unit']){
 const el=$('process-'+id);if(!el)continue;el.dataset.previous=el.value;el.addEventListener('change',()=>{try{for(const k of id==='pressure'?['p1','p2']:id==='temperature'?['t1']:id==='power-unit'?['power']:['flow']){const input=$('process-'+k),v=parseNumber(input.value);input.value=String(id==='power-unit'?v*(el.dataset.previous==='Btuh'?1055.05585262/3600000:1)/(el.value==='Btuh'?1055.05585262/3600000:1):id==='mass'?(massFrom(massTo(v,el.dataset.previous),el.value)):fromCanonical(toCanonical(v,el.dataset.previous),el.value));}}catch{}el.dataset.previous=el.value;$('process-result').innerHTML='';rememberDraft();});
 }
 $('process-form').addEventListener('input',rememberDraft);
 for(const input of $('process-form').querySelectorAll('input'))input.addEventListener('input',()=>{$('process-result').innerHTML='';$('process-error').textContent='';$('result-status').textContent='Параметри процесу змінено — розрахуйте знову';});
 $('process-form').addEventListener('submit',event=>{event.preventDefault();$('process-result').innerHTML='';$('process-error').textContent='';try{
 const n=id=>{const v=parseNumber($('process-'+id).value);return ['p1','p2'].includes(id)?toCanonical(v,$('process-pressure').value):id==='t1'?toCanonical(v,$('process-temperature').value)-273.15:id==='flow'?massTo(v,$('process-mass').value):id==='power'&&$('process-power-unit').value==='Btuh'?v*1055.05585262/3600000:v;};
 const pm=$('process-mode').value,saturated=!tur&&pm==='saturated';
 const Tin=saturated?calculate('px',n('p1'),0,modelValue()).state.T:n('t1')+273.15;
 const r=tur?(pm==='power'?turbine(n('p1'),Tin,n('p2'),n('eta')/100,n('flow'),modelValue()):turbineInverse(pm,n('p1'),Tin,n('p2'),n('power'),pm==='flow'?n('eta')/100:n('flow'),modelValue())):flash(n('p1'),Tin,n('p2'),n('flow'),saturated?1:0,modelValue());
 storedProcess={type:kind,model:modelValue(),args:tur?[n('p1'),Tin,n('p2'),r.eta,r.flow]:[n('p1'),Tin,n('p2'),r.flow,saturated?1:0]};plottedProcess={kind:tur?'Турбіна':'Дроселювання',result:r};rememberDraft();saveProject();
 const metrics=tur?[['Питома робота',r.work,'кДж/кг'],['Потужність потоку',r.power,'кВт'],['Витрата пари',r.flow,'кг/с'],['Ізоентропний ККД',r.eta*100,'%']]:[['Витрата пари',r.vaporFlow,'кг/с'],['Витрата рідини',r.liquidFlow,'кг/с']];
 $('process-result').innerHTML=`<p>${metrics.map(([l,v,u])=>`${l}: <strong>${format(processDisplay(l==='Питома робота'?'work':l==='Потужність потоку'?'power':u==='кг/с'?'flow':'eta',v,u)[0])} ${processDisplay(l==='Питома робота'?'work':l==='Потужність потоку'?'power':u==='кг/с'?'flow':'eta',v,u)[1]}</strong>`).join(' · ')}</p>${!tur&&r.outlet.x==null?'<p>Вихід однофазний; баланс сепарації на рідину й пару не застосовується.</p>':''}<table><thead><tr><th>Стан</th>${[['p','МПа'],['T','°C'],['h','кДж/кг'],['s','кДж/(кг·K)']].map(([k,u])=>`<th>${k}, ${processDisplay(k,null,u)[1]}</th>`).join('')}<th>x</th><th>Фаза</th></tr></thead><tbody>${[['Вхід',r.inlet],...(tur?[['Ізоентропний вихід',r.ideal]]:[]),['Вихід',r.outlet]].map(([l,q])=>`<tr><td>${l}</td>${[['p',q.p],['T',q.T-273.15],['h',q.h],['s',q.s],['x',q.x]].map(([k,v])=>`<td>${format(processDisplay(k,v,'')[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')}</tbody></table><button id="process-csv">CSV процесу</button><button id="process-plot">Нанести процес на h–s діаграму</button><button id="process-transfer">Показати вихід у загальних властивостях</button>`;
 $('process-csv').onclick=()=>downloadFile(processCSV(kind,r,$('output-system').value),kind+'.csv','text/csv;charset=utf-8');
 $('process-plot').addEventListener('click',()=>showProcess('hsdiagram'));
 $('process-transfer').addEventListener('click',()=>{selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(r.outlet.p);$('input-b').value=String(r.outlet.h);run();});
 $('result-status').textContent='Розрахунок процесу виконано';
 }catch(e){$('process-error').textContent=e.message;$('result-status').textContent='Перевірте вхідні дані';}});
}
function showDiagram(kind){
 const dq=(k,v)=>diagramQuantity(k,v,$('output-system').value,$('output-energy').value);
 const dt=(k,v)=>{const [n,u]=dq(k,v);return format(n)+' '+u;};
 if(!diagramCache)diagramCache=diagramData(modelValue());
 const isTS=kind==='ts',baseY=isTS?800:4500;
 let range={xmin:0,xmax:11,ymin:0,ymax:baseY},selected=null;
 const colors=['#a75b00','#3977a6','#8b4599','#27825a','#b84242','#706c25','#555'];
 const process=plottedProcess;
 const processPoints=process?[[process.result.inlet,'Вхід'],...(process.result.ideal?[[process.result.ideal,'Ізоентропний вихід']]:[]),[process.result.outlet,'Вихід'],...(process.result.coldInlet?[[process.result.coldInlet,'Холодний вхід'],[process.result.coldOutlet,'Холодний вихід']]:[])]:[];
 const choices=[...historyStates.filter(q=>(q.model||'IF97')===modelValue()).map((q,i)=>[q,`Журнал № ${historyStates.length-i}`]),...processPoints];
 const X=s=>60+(s-range.xmin)/(range.xmax-range.xmin)*820;
 const value=q=>isTS?q.T-273.15:q.h;
 const Y=q=>450-(value(q)-range.ymin)/(range.ymax-range.ymin)*400;
 const path=points=>{let pen=false;return points.map(q=>{if(!q||!Number.isFinite(q.s)||!Number.isFinite(value(q))){pen=false;return '';}const str=`${pen?'L':'M'}${X(q.s).toFixed(2)},${Y(q).toFixed(2)}`;pen=true;return str;}).join(' ');};
 $('process-view').innerHTML=`<h2>${isTS?'T–s':'h–s'} діаграма · ${modelValue()}</h2><p>Масштаб: кнопки +/− або колесо над графіком. Переміщення: перетягування або стрілки після фокусування графіка. Виберіть позначену точку для властивостей. Лінії процесу з’єднують кінцеві стани; проміжний шлях реальної турбіни не визначений її ККД.</p><button id="diagram-in">+</button><button id="diagram-out">−</button><button id="diagram-reset">Скинути масштаб</button><button id="diagram-refresh">Оновити точки</button><button id="diagram-save">Зберегти SVG</button><button id="diagram-clear">Прибрати процес</button><span id="diagram-range"></span><svg id="steam-diagram" tabindex="0" role="img" aria-label="${isTS?'T–s':'h–s'} діаграма води й пари" viewBox="0 0 960 520" xmlns="http://www.w3.org/2000/svg"></svg><p id="diagram-legend">${diagramCache.isobars.map(({p},i)=>`<span style="color:${colors[i]}">━ ${dt('p',p)}</span>`).join(' · ')} · Насичення: синя товста лінія. ${process?process.kind+': зелений відрізок; ізоентропне розширення: пунктир.':''}</p><div id="diagram-selected" aria-live="polite">Виберіть точку журналу або процесу.</div>`;
 const svg=$('steam-diagram');
 function draw(){
 svg.innerHTML=`<defs><clipPath id="plot-clip"><rect x="60" y="50" width="820" height="400"/></clipPath></defs><rect width="960" height="520" fill="white"/>${Array.from({length:6},(_,i)=>`<path d="M60 ${450-i*80}H880 M${60+i*164} 50V450" stroke="#dde3eb"/><text x="50" y="${454-i*80}" text-anchor="end">${format(dq(isTS?'T':'h',range.ymin+(range.ymax-range.ymin)*i/5)[0])}</text><text x="${60+i*164}" y="470" text-anchor="middle">${format(dq('s',range.xmin+(range.xmax-range.xmin)*i/5)[0])}</text>`).join('')}<path d="M60 50V450H880" fill="none" stroke="#333"/><text x="470" y="505" text-anchor="middle">s, ${dq('s',null)[1]}</text><text x="65" y="25">${isTS?'t':'h'}, ${dq(isTS?'T':'h',null)[1]}</text><g clip-path="url(#plot-clip)">${diagramCache.isobars.map(({p,points},i)=>`<path d="${path(points)}" fill="none" stroke="${colors[i]}" stroke-width="1.2"><title>${dt('p',p)}</title></path>`).join('')}${diagramCache.dome.map(points=>`<path d="${path(points)}" fill="none" stroke="#12477c" stroke-width="3"/>`).join('')}${process?`<path d="${path([process.result.inlet,process.result.outlet])}" fill="none" stroke="#12804a" stroke-width="3"/>${process.result.coldInlet?`<path d="${path([process.result.coldInlet,process.result.coldOutlet])}" fill="none" stroke="#1a77b9" stroke-width="3"/>`:''}${process.result.ideal?`<path d="${path([process.result.inlet,process.result.ideal])}" fill="none" stroke="#12804a" stroke-width="2" stroke-dasharray="6 4"/>`:''}`:''}${choices.map(([q,label],i)=>`<circle data-point="${i}" tabindex="0" role="button" aria-label="${label}" cx="${X(q.s)}" cy="${Y(q)}" r="${selected===i?7:5}" fill="${selected===i?'#f09a00':'#c62828'}"><title>${label}: p=${dt('p',q.p)}; t=${dt('T',q.T-273.15)}; h=${dt('h',q.h)}; s=${dt('s',q.s)}</title></circle>`).join('')}</g>`;
 $('diagram-range').textContent=` s: ${dt('s',range.xmin)}…${dt('s',range.xmax)}; ${isTS?'t':'h'}: ${dt(isTS?'T':'h',range.ymin)}…${dt(isTS?'T':'h',range.ymax)}`;
 }
 function choose(i){selected=i;const [q,label]=choices[i];$('diagram-selected').innerHTML=`<h3>${label}</h3><p>${q.phase} · p=${dt('p',q.p)} · t=${dt('T',q.T-273.15)} · h=${dt('h',q.h)} · s=${dt('s',q.s)} · x=${format(q.x)}</p><button id="diagram-transfer">Показати всі властивості</button>`;$('diagram-transfer').onclick=()=>{selectModel(q.model||'IF97');selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(q.p);$('input-b').value=String(q.h);run();};draw();}
 function zoom(f,cx=.5,cy=.5){const w=range.xmax-range.xmin,h=range.ymax-range.ymin;if(w*f<.05||w*f>44)return;const x=range.xmin+w*cx,y=range.ymin+h*cy;range={xmin:x-w*f*cx,xmax:x+w*f*(1-cx),ymin:y-h*f*cy,ymax:y+h*f*(1-cy)};draw();}
 $('diagram-in').onclick=()=>zoom(.8);$('diagram-out').onclick=()=>zoom(1.25);$('diagram-reset').onclick=()=>{range={xmin:0,xmax:11,ymin:0,ymax:baseY};draw();};
 $('diagram-refresh').onclick=()=>showDiagram(kind);$('diagram-clear').onclick=()=>{plottedProcess=null;storedProcess=null;saveProject();showDiagram(kind);};
 $('diagram-save').onclick=()=>{const url=URL.createObjectURL(new Blob([svg.outerHTML],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=kind+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 svg.addEventListener('wheel',e=>{e.preventDefault();const b=svg.getBoundingClientRect();zoom(e.deltaY<0?.8:1.25,Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),Math.max(0,Math.min(1,1-(e.clientY-b.top)/b.height)));},{passive:false});
 let drag=null,moved=false;
 svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-point]'))return;drag={x:e.clientX,y:e.clientY,range:{...range}};moved=false;svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag)return;const b=svg.getBoundingClientRect(),dx=(e.clientX-drag.x)/b.width*960/820*(drag.range.xmax-drag.range.xmin),dy=(e.clientY-drag.y)/b.height*520/400*(drag.range.ymax-drag.range.ymin);moved=Math.abs(dx)+Math.abs(dy)>0;range={xmin:drag.range.xmin-dx,xmax:drag.range.xmax-dx,ymin:drag.range.ymin+dy,ymax:drag.range.ymax+dy};draw();});
 svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
 svg.addEventListener('click',e=>{const point=e.target.closest('[data-point]');if(point)choose(Number(point.dataset.point));});
 svg.addEventListener('keydown',e=>{const point=e.target.closest('[data-point]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();choose(Number(point.dataset.point));return;}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.25:.8);}if(e.key.startsWith('Arrow')){e.preventDefault();const dx=(range.xmax-range.xmin)*.1,dy=(range.ymax-range.ymin)*.1;const x=e.key==='ArrowLeft'?-dx:e.key==='ArrowRight'?dx:0,y=e.key==='ArrowDown'?-dy:e.key==='ArrowUp'?dy:0;range={xmin:range.xmin+x,xmax:range.xmax+x,ymin:range.ymin+y,ymax:range.ymax+y};draw();}});
 diagramRedraw=()=>{draw();$('diagram-legend').innerHTML=diagramCache.isobars.map(({p},i)=>`<span style="color:${colors[i]}">━ ${dt('p',p)}</span>`).join(' · ');if(selected!==null)choose(selected);};
 draw();
}

const STORAGE_KEY='water-steam-if97-project-v1';
function projectSnapshot(){return {format:'water-steam-if97',version:1,title:$('project-title').value,history:historyStates.map(q=>({p:q.p,h:q.h,model:q.model||'IF97',name:q.name||''})),process:storedProcess,form:{model:modelValue(),mode:$('mode').value,a:$('input-a').value,b:$('input-b').value,ua:$('unit-a').value,ub:$('unit-b').value},drafts:processDrafts,ambient,system:$('output-system').value,energy:$('output-energy').value,gray:document.body.classList.contains('gray'),scale:$('ui-scale').value};}
function saveProject(){if(!persistenceReady)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(projectSnapshot()));unsavedProject=false;$('project-save-status').textContent='Збережено локально · JSON для резервної копії';}catch{unsavedProject=true;$('project-save-status').textContent='Є незбережені зміни — експортуйте JSON';$('result-status').textContent='Локальне збереження недоступне — експортуйте проєкт у файл';}}
function applyProject(p){diagramCache=null;selectModel(p.form.model||'IF97');$('project-title').value=p.title;historyUndo=null;historyStates.splice(0,historyStates.length,...p.states);revision=p.states.length;ambient=p.ambient;ambientRef=referenceState(ambient.p,ambient.T);$('ambient-p').value=String(ambient.p);$('ambient-t').value=String(ambient.T-273.15);selectView('general');$('mode').value=p.form.mode;resetMode();for(const [id,v] of [['input-a',p.form.a],['input-b',p.form.b],['unit-a',p.form.ua],['unit-b',p.form.ub]])$(id).value=v;for(const id of ['unit-a','unit-b']){if(!$(id).value)throw Error('Одиниці не відповідають режиму.');$(id).dataset.previous=$(id).value;}Object.keys(processDrafts).forEach(k=>delete processDrafts[k]);Object.assign(processDrafts,p.drafts);storedProcess=p.process?{type:p.process.type,args:p.process.args,model:p.process.model||'IF97'}:null;plottedProcess=p.process?{kind:processLabel(p.process.type),result:p.process.result}:null;$('output-system').value=p.system;$('output-energy').value=p.energy;document.body.classList.toggle('gray',p.gray);$('ui-scale').value=p.scale;document.documentElement.style.setProperty('--ui-scale',p.scale);renderHistory();invalidate();}
function restoreLocal(){try{const text=localStorage.getItem(STORAGE_KEY);if(text)applyProject(readProject(text));}catch{$('result-status').textContent='Збережений проєкт не відновлено; можна імпортувати файл';}}
function downloadFile(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const fileMenu=document.querySelector('.menubar .menu');
const projectExport=document.createElement('button');projectExport.textContent='Експорт проєкту JSON';projectExport.onclick=()=>{unsavedProject=false;$('project-save-status').textContent='JSON підготовлено для збереження';fileMenu.closest('details').open=false;downloadFile(JSON.stringify(projectSnapshot(),null,2),'water-steam-project.json','application/json');};fileMenu.append(projectExport);
const projectImport=document.createElement('button');projectImport.textContent='Імпорт проєкту JSON';const projectFile=document.createElement('input');projectFile.type='file';projectFile.accept='.json,application/json';projectFile.hidden=true;document.body.append(projectFile);projectImport.onclick=()=>{fileMenu.closest('details').open=false;projectFile.click();};fileMenu.append(projectImport);
projectFile.onchange=async()=>{const file=projectFile.files[0];if(!file)return;try{if(file.size>2000000)throw Error('Файл завеликий (максимум 2 МБ).');const p=readProject(await file.text());applyProject(p);saveProject();$('result-status').textContent='Проєкт імпортовано';}catch(e){$('error').textContent='Імпорт: '+e.message;$('error').hidden=false;$('result-status').textContent='Не вдалося імпортувати проєкт';}projectFile.value='';};
document.addEventListener('input',e=>{if(e.target.closest('#calculator')||e.target.id==='project-title')saveProject();});
document.addEventListener('change',saveProject);document.addEventListener('click',e=>{if(e.target.closest('[data-action],[data-p]'))saveProject();});
window.addEventListener('pagehide',saveProject);

$('ambient-apply').onclick=()=>{try{const next={p:parseNumber($('ambient-p').value),T:parseNumber($('ambient-t').value)+273.15};const ref=referenceState(next.p,next.T);ambient=next;ambientRef=ref;$('ambient-status').textContent=`Застосовано P₀=${format(ambient.p)} МПа, T₀=${format(ambient.T)} K · ${ref.phase}`;if(last)render();saveProject();}catch(e){$('ambient-status').textContent=e.message;}};

$('output-system').addEventListener('change',()=>{if(last)render();else $('results').innerHTML=propertyTable(null);renderHistory();if($('steam-diagram')&&!$('process-view').hidden)diagramRedraw?.();if($('batch-results'))renderBatch();if($('eng-result'))renderEngineering();if($('process-form')&&$('process-result')?.textContent.trim())$('process-form').requestSubmit();saveProject();});

function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let batchResults=[];
function showBatch(){
 selectView('general');$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[data-action="batch"]').setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');
 $('process-view').innerHTML=`<h2>Пакетні розрахунки</h2><p>До 500 точок. Помилки залишаються в таблиці; P–T на насиченні показує дві фази. Тиски абсолютні.</p><form id="batch-form"><fieldset><legend>Серія за діапазоном</legend><label>Режим<select id="batch-mode">${['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho'].map(m=>`<option>${m}</option>`).join('')}</select></label><label>Змінний параметр<select id="batch-vary"><option value="b">Другий</option><option value="a">Перший</option></select></label><label>Одиниця першого<select id="batch-ua"></select></label><label>Одиниця другого<select id="batch-ub"></select></label>${[['start','Початок','30'],['end','Кінець','300'],['count','Кількість точок','10'],['fixed','Фіксований параметр','3']].map(([id,label,v])=>`<label>${label}<input id="batch-${id}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><button>Розрахувати серію</button></form><fieldset><legend>Вхідний CSV</legend><p>mode,a,b,unit_a,unit_b,name · коди одиниць: MPa, bar, psi, C, K, F, kJkg, kJkgK, Btulb, BtulbR, fraction. Роздільник кома або крапка з комою.</p><label for="batch-text">Дані CSV</label><textarea id="batch-text" rows="5">mode,a,b,unit_a,unit_b,name
pt,3,300,MPa,K,Рідина
px,0.1,0.5,MPa,fraction,Суміш</textarea><input type="file" id="batch-file" accept=".csv,text/csv" aria-label="Відкрити CSV"><button id="batch-import">Розрахувати CSV</button><button id="batch-example">Зберегти зразок CSV</button></fieldset><p id="batch-error" role="alert"></p><div id="batch-results"></div>`;
 function resetBatch(){const m=$('batch-mode').value,u=batchUnits(m);options('batch-ua',u.a.map(x=>[x,x]));options('batch-ub',u.b.map(x=>[x,x]));const sat=m.startsWith('sat');$('batch-ub').disabled=sat;$('batch-fixed').disabled=sat;$('batch-vary').disabled=sat;if(sat)$('batch-vary').value='a';}
 resetBatch();$('batch-mode').onchange=resetBatch;
 function evaluateBatch(inputs){$('batch-error').textContent='';batchResults=calculateBatch(inputs,modelValue());renderBatch();}
 $('batch-form').onsubmit=e=>{e.preventDefault();try{evaluateBatch(batchRange({mode:$('batch-mode').value,vary:$('batch-vary').value,...Object.fromEntries(['start','end','count','fixed'].map(k=>[k,parseNumber($('batch-'+k).value)])),ua:$('batch-ua').value,ub:$('batch-ub').value}));}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-import').onclick=()=>{try{evaluateBatch(parseBatchCSV($('batch-text').value));}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-file').onchange=async()=>{try{const f=$('batch-file').files[0];if(!f)return;if(f.size>1000000)throw Error('CSV завеликий (1 МБ).');$('batch-text').value=await f.text();$('batch-error').textContent='Файл відкрито — натисніть «Розрахувати CSV».';}catch(e){$('batch-error').textContent=e.message;}};
 $('batch-example').onclick=()=>downloadFile($('batch-text').value,'water-steam-input.csv','text/csv;charset=utf-8');if(batchResults.length)renderBatch();
}
function renderBatch(){if(!$('batch-results'))return;const keys=['p','T','h','s','x'];$('batch-results').innerHTML=`<p>Рядків: ${batchResults.length}; успішних: ${batchResults.filter(r=>!r.error).length}; помилок: ${batchResults.filter(r=>r.error).length}.</p><button id="batch-export">CSV результатів</button><button id="batch-history">Додати успішні стани до журналу</button><table><thead><tr><th>Назва</th>${keys.map(k=>`<th>${k} [${display(k,null,rows.find(r=>r[0]===k)[3])[1]}]</th>`).join('')}<th>Фаза / помилка</th></tr></thead><tbody>${batchResults.map(r=>r.error?`<tr><td>${escapeHTML(r.input.name)}</td><td colspan="6">${escapeHTML(r.error)}</td></tr>`:batchStates(r).map(q=>`<tr><td>${escapeHTML(r.input.name)}</td>${keys.map(k=>`<td>${format(display(k,k==='T'?q.T-273.15:q[k],rows.find(r=>r[0]===k)[3])[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')).join('')}</tbody></table>`;
 $('batch-export').onclick=()=>downloadFile(batchCSV(batchResults,$('output-system').value,$('output-energy').value),'water-steam-batch.csv','text/csv;charset=utf-8');$('batch-history').onclick=()=>{for(const r of batchResults)for(const q of batchStates(r))historyStates.unshift({...q,name:r.input.name});historyStates.splice(500);renderHistory();saveProject();$('batch-history').disabled=true;};}

function processLabel(kind){return {turbine:'Турбіна',flash:'Дроселювання',pump:'Насос',compressor:'Компресор','heat-exchanger':'Теплообмінник'}[kind]||kind;}
let engineeringResult=null,engineeringKind='compressor';
function showEngineering(){
 selectView('general');$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[data-action="engineering"]').setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');const draft=processDrafts.engineering||{};
 $('process-view').innerHTML=`<h2>Насос, компресор і теплообмінник</h2><p>Насос/компресор: адіабатичне стиснення, h₂=h₁+(h₂s−h₁)/η. Теплообмінник: протитечійний баланс двох потоків без втрат у довкілля; перевірка кінцевих температур. Площа, UA та внутрішній температурний профіль не визначаються.</p><form id="engineering-form"><label>Процес<select id="eng-mode"><option value="compressor">Компресор</option><option value="pump">Насос</option><option value="heat-exchanger">Теплообмінник</option></select></label><fieldset><legend>Одиниці</legend><label>Тиск<select id="eng-pressure">${PU.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Температура<select id="eng-temperature">${TU.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>Витрата<select id="eng-mass"><option value="kgs">кг/с</option><option value="kgh">кг/год</option><option value="lbs">lb/s</option><option value="lbh">lb/h</option></select></label><label>Теплова потужність<select id="eng-power-unit"><option value="kW">кВт</option><option value="Btuh">Btu/h</option></select></label></fieldset><fieldset><legend>Потік / гарячий потік</legend>${[['p1','Вхідний тиск','0.1'],['t1','Вхідна температура','150'],['p2','Вихідний тиск','1'],['eta','Ізоентропний ККД, %','80'],['flow','Масова витрата','1'],['power','Теплова потужність Q','100']].map(([k,l,v])=>`<label>${l}<input id="eng-${k}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><fieldset id="eng-cold"><legend>Холодний потік</legend>${[['pc1','Холодний вхідний тиск','0.1'],['tc1','Холодна вхідна температура','20'],['pc2','Холодний вихідний тиск','0.1'],['coldflow','Холодна масова витрата','1']].map(([k,l,v])=>`<label>${l}<input id="eng-${k}" value="${v}" required inputmode="decimal"></label>`).join('')}</fieldset><button>Розрахувати процес</button></form><p id="eng-error" role="alert"></p><div id="eng-result"></div>`;
 const ids=['mode','pressure','temperature','mass','power-unit','p1','t1','p2','eta','flow','power','pc1','tc1','pc2','coldflow'];for(const id of ids)if(draft[id])$('eng-'+id).value=draft[id];
 function remember(){processDrafts.engineering=Object.fromEntries(ids.map(id=>[id,$('eng-'+id).value]));saveProject();}
 function mode(){const hx=$('eng-mode').value==='heat-exchanger';$('eng-cold').hidden=!hx;for(const k of ['power','power-unit','pc1','tc1','pc2','coldflow'])$('eng-'+k).disabled=!hx;$('eng-power').closest('label').hidden=!hx;$('eng-power-unit').closest('label').hidden=!hx;$('eng-eta').disabled=hx;$('eng-eta').closest('label').hidden=hx;
 // p1/p2 are shared across modes but their valid relation flips: compressor/pump need p2>p1, heat exchanger needs p2<=p1 (hot-side pressure drop).
 const p1=parseNumber($('eng-p1').value),p2=parseNumber($('eng-p2').value);
 if(Number.isFinite(p1)&&Number.isFinite(p2)){if(hx&&p2>p1)$('eng-p2').value=String(p1);else if(!hx&&p2<=p1)$('eng-p2').value=String(p1*10);}}
 mode();$('eng-mode').onchange=()=>{mode();engineeringResult=null;$('eng-result').innerHTML='';remember();};
 for(const id of ['pressure','temperature','mass','power-unit']){const el=$('eng-'+id);el.dataset.previous=el.value;el.onchange=()=>{try{for(const k of id==='pressure'?['p1','p2','pc1','pc2']:id==='temperature'?['t1','tc1']:id==='mass'?['flow','coldflow']:['power']){const input=$('eng-'+k),v=parseNumber(input.value);input.value=String(id==='mass'?massFrom(massTo(v,el.dataset.previous),el.value):id==='power-unit'?v*(el.dataset.previous==='Btuh'?1055.05585262/3600000:1)/(el.value==='Btuh'?1055.05585262/3600000:1):fromCanonical(toCanonical(v,el.dataset.previous),el.value));}}catch{}el.dataset.previous=el.value;engineeringResult=null;$('eng-result').innerHTML='';remember();};}
 $('engineering-form').oninput=()=>{engineeringResult=null;$('eng-result').innerHTML='';remember();};
 $('engineering-form').onsubmit=e=>{e.preventDefault();try{const n=k=>{const v=parseNumber($('eng-'+k).value);return ['p1','p2','pc1','pc2'].includes(k)?toCanonical(v,$('eng-pressure').value):['t1','tc1'].includes(k)?toCanonical(v,$('eng-temperature').value):['flow','coldflow'].includes(k)?massTo(v,$('eng-mass').value):k==='power'&&$('eng-power-unit').value==='Btuh'?v*1055.05585262/3600000:v;};engineeringKind=$('eng-mode').value;const args=engineeringKind==='heat-exchanger'?[n('p1'),n('t1'),n('p2'),n('flow'),n('pc1'),n('tc1'),n('pc2'),n('coldflow'),n('power')]:[n('p1'),n('t1'),n('p2'),n('eta')/100,n('flow')];engineeringResult=engineeringKind==='heat-exchanger'?heatExchanger(...args,modelValue()):compression(engineeringKind,...args,modelValue());storedProcess={type:engineeringKind,args,model:modelValue()};plottedProcess={kind:processLabel(engineeringKind),result:engineeringResult};$('eng-error').textContent='';remember();renderEngineering();}catch(e){engineeringResult=null;$('eng-result').innerHTML='';$('eng-error').textContent=e.message;}};
}
function renderEngineering(){if(!engineeringResult||!$('eng-result'))return;const r=engineeringResult,keys=['p','T','h','s','x'];const metric=(k,v,u)=>{const [a,b]=processDisplay(k,v,u);return format(a)+' '+b;};$('eng-result').innerHTML=`<p>${engineeringKind==='heat-exchanger'?'Теплова потужність':'Споживана потужність'}: <strong>${metric('power',r.power,'кВт')}</strong>${r.work!=null?' · Робота стиснення: '+metric('work',r.work,'кДж/кг'):''}</p><table><thead><tr><th>Стан</th>${keys.map(k=>`<th>${k} [${processDisplay(k,null,{p:'МПа',T:'°C',h:'кДж/кг',s:'кДж/(кг·K)',x:'–'}[k])[1]}]</th>`).join('')}<th>Фаза</th></tr></thead><tbody>${engineeringStates(r).map(([name,q])=>`<tr><td>${name}</td>${keys.map(k=>`<td>${format(processDisplay(k,k==='T'?q.T-273.15:q[k],'')[0])}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')}</tbody></table><button id="eng-export">CSV процесу</button><button id="eng-history">Додати кінцеві стани до журналу</button><button id="eng-plot">Нанести процес на діаграму</button>`;
 $('eng-export').onclick=()=>downloadFile(engineeringCSV(engineeringKind,r,$('output-system').value),engineeringKind+'.csv','text/csv;charset=utf-8');$('eng-history').onclick=()=>{for(const [name,q] of engineeringStates(r))historyStates.unshift({...q,name:processLabel(engineeringKind)+' · '+name});historyStates.splice(500);renderHistory();saveProject();$('eng-history').disabled=true;};$('eng-plot').onclick=()=>showProcess('hsdiagram');}

const reportExport=document.createElement('button');reportExport.textContent='Звіт для друку HTML';reportExport.onclick=()=>{fileMenu.closest('details').open=false;const states=historyStates.length?historyStates:last?.state?[last.state]:[];if(!states.length){$('result-status').textContent='Спочатку розрахуйте хоча б один стан';return;}downloadFile(printableReport($('project-title').value,states,$('output-system').value,$('output-energy').value),'water-steam-report.html','text/html;charset=utf-8');};fileMenu.append(reportExport);
document.querySelector('[role=tablist]').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...document.querySelectorAll('[role=tab]')],i=tabs.indexOf(e.target);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();tabs[n].click();});
