import {exportCSV} from './export.js';
import {initialize,calculate,PMIN_SAT,TC,PC} from './engine.js';
import {parseNumber,toCanonical,fromCanonical} from './units.js';
const $=id=>document.getElementById(id);
let last=null, revision=0;
const historyStates=[];
const PU=[['MPa','МПа'],['kPa','кПа'],['Pa','Па'],['bar','бар'],['atm','атм']];
const TU=[['C','°C'],['K','K']], HU=[['kJkg','кДж/кг'],['Jkg','Дж/кг']], SU=[['kJkgK','кДж/(кг·K)'],['JkgK','Дж/(кг·K)']];
const definitions=[['h','Ентальпія','h','кДж/кг'],['s','Ентропія','s','кДж/(кг·K)'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['cp','Ізобарна теплоємність','Cₚ','кДж/(кг·K)'],['cv','Ізохорна теплоємність','Cᵥ','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['u','Внутрішня енергія','u','кДж/кг'],['mu','Динамічна в’язкість','μ','Па·с'],['lambda','Теплопровідність','λ','Вт/(м·K)']];
function options(id,list) {$(id).replaceChildren(...list.map(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;return o;}));$(id).dataset.previous=$(id).value;}
function resetMode() {
  const m=$('mode').value,t=m==='satt';
  $('field-b').hidden=m.startsWith('sat');$('input-b').disabled=m.startsWith('sat');
  $('label-a').textContent=t?'1. Температура насичення:':'1. Тиск (абсолютний):';options('unit-a',t?TU:PU);
  $('label-b').textContent=m==='ph'?'2. Ентальпія:':m==='ps'?'2. Ентропія:':'2. Температура:';options('unit-b',m==='ph'?HU:m==='ps'?SU:TU);
  $('input-a').value=t?'100':'3';$('input-b').value=m==='ph'?'500':m==='ps'?'1':'26.85';
  $('mode-help').textContent=m==='pt'?'Тиск абсолютний. На лінії насичення P–T не визначає частку пари.':m.startsWith('sat')?'Показує обидві фази: насичену рідину та насичену пару.':'У двофазній області ступінь сухості визначається з ентальпії або ентропії.';
  invalidate();
}
function invalidate() {
  last=null;$('export-csv').disabled=true;$('result-status').textContent='Параметри змінено — розрахуйте знову';$('error').hidden=true;
  $('results').innerHTML=propertyTable(null);
}
function format(n) {if(n===null||n===undefined||!Number.isFinite(n))return '—';return new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:8,notation:Math.abs(n)>0&&Math.abs(n)<1e-4?'scientific':'standard'}).format(n);}
function display(key,value,unit) {if(['h','s','cp','cv','u'].includes(key)&&$('output-energy').value==='J')return [value===null?null:value*1000,unit.replace('кДж','Дж')];return [value,unit];}
const rows=[['p','Тиск (абсолютний)','p','МПа'],['T','Температура','t','°C'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['h','Питома ентальпія','h','кДж/кг'],['s','Питома ентропія','s','кДж/(кг·K)'],['u','Питома внутрішня енергія','u','кДж/кг'],['cp','Питома ізобарна теплоємність','cp','кДж/(кг·K)'],['cv','Питома ізохорна теплоємність','cv','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['x','Ступінь сухості (масова частка пари)','x','–'],['region','Область IF97','region','–'],['mu','Динамічна в’язкість','μ','Па·с'],['lambda','Теплопровідність','λ','Вт/(м·K)']];
function propertyTable(state) {
 return `<table class="property-table"><thead><tr><th>№</th><th>Назва властивості</th><th>Символ</th><th>⧉</th><th>Результат</th><th>Одиниці (SI)</th></tr></thead><tbody>${rows.map(([key,name,symbol,unit],i)=>{
 const value=state?(key==='T'?state.T-273.15:state[key]):null;
 const [v,u]=display(key,value,unit);
 const group=i===0?'<tr class="group"><td colspan="6">⊟ 1. Термодинамічні властивості — основні</td></tr>':i===10?'<tr class="group"><td colspan="6">⊟ 2. Термодинамічні властивості — стан</td></tr>':i===12?'<tr class="group"><td colspan="6">⊟ 3. Транспортні властивості</td></tr>':'';
 return `${group}<tr data-property="${key}"><td>${i+1}</td><td>${name}</td><td>${symbol}</td><td><button class="copy" data-copy="${key}" aria-label="Копіювати: ${name}" ${v==null?'disabled':''}>⧉</button></td><td>${state?format(v):''}</td><td>${u}</td></tr>`;
 }).join('')}</tbody></table>`;
}
function renderHistory() {
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 $('history-body').innerHTML=historyStates.map((s,i)=>`<tr><td>${historyStates.length-i}</td>${keys.map(k=>`<td>${format(k==='T'?s.T-273.15:s[k])}</td>`).join('')}<td>IF97</td></tr>`).join('')+Array.from({length:Math.max(0,6-historyStates.length)},(_,i)=>`<tr><td>${historyStates.length+i+1}</td>${'<td></td>'.repeat(14)}</tr>`).join('');
 $('history-count').textContent=`${historyStates.length} станів`;
}
function selectView(view) {
 $('calculator-view').hidden=view==='help';$('help-view').hidden=view!=='help';
 for(const name of ['general','saturation','help'])$('tab-'+name).setAttribute('aria-selected',String(name===view));
 if(view==='saturation'&&!$('mode').value.startsWith('sat')){$('mode').value='satp';resetMode();}
 if(view==='general'&&$('mode').value.startsWith('sat')){$('mode').value='pt';resetMode();}
}
function notes(list) {return list.length?`<div class="notes">${[...new Set(list)].map(n=>`<p>${n}</p>`).join('')}</div>`:'';}
function table(sat) {
 return `<div class="sat-scroll"><table class="sat-table"><thead><tr><th>Властивість</th><th>Насичена рідина</th><th>Насичена пара</th></tr></thead><tbody>${definitions.map(([k,name,symbol,unit])=>{
  const [a,u]=display(k,sat.liquid[k],unit),[b]=display(k,sat.vapor[k],unit);
  return `<tr><td>${name} <span class="symbol">${symbol}</span><small>${u}</small></td><td>${format(a)}</td><td>${format(b)}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function render() {
 if(!last)return;let html='';
 if(last.state) {
  const s=last.state;
  html=`<div class="state-banner"><strong>${s.phase}</strong><span>Область ${s.region} · IAPWS-IF97</span></div><p class="state-meta">P = ${format(s.p)} МПа &nbsp;·&nbsp; T = ${format(s.T)} K / ${format(s.T-273.15)} °C${s.x!==null?' &nbsp;·&nbsp; x = '+format(s.x):''}</p>${propertyTable(s)}${notes(s.notes)}`;
 }
 if(last.saturation) {
  const sat=last.saturation;
  if(!last.state)html=`<div class="state-banner"><strong>${sat.critical?'Критична точка':'Лінія насичення'}</strong><span>Область ${sat.critical?3:4} · IAPWS-IF97</span></div><p class="state-meta">P = ${format(sat.p)} МПа &nbsp;·&nbsp; T = ${format(sat.T)} K / ${format(sat.T-273.15)} °C</p>`;
  if(last.ambiguous)html+=notes(['На лінії насичення P і T залежні. Частка пари невідома: для властивостей суміші використайте P–h або P–s.']);
  if(last.state)html+='<h3>Властивості фаз при цьому тиску</h3>';
  html+=table(sat);
  const [latent,unit]=display('h',sat.latentHeat,'кДж/кг');
  html+=`<p class="state-meta">Теплота пароутворення: ${format(latent)} ${unit}</p>${notes([...sat.liquid.notes,...sat.vapor.notes])}`;
 }
 $('results').innerHTML=html;$('export-csv').disabled=false;
 $('result-status').textContent=`Розрахунок № ${revision} · 8 значущих цифр`;
}
function run(event) {
 event?.preventDefault();$('error').hidden=true;
 try {
   const m=$('mode').value,a=toCanonical(parseNumber($('input-a').value),$('unit-a').value);
   const b=m.startsWith('sat')?undefined:toCanonical(parseNumber($('input-b').value),$('unit-b').value);
   const result=calculate(m,a,b);last=result;revision++;if(result.state)historyStates.unshift(result.state);else if(result.saturation)historyStates.unshift(result.saturation.vapor,result.saturation.liquid);renderHistory();render();
 }catch(e) {invalidate();$('error').textContent=e.message;$('error').hidden=false;$('result-status').textContent='Перевірте вхідні дані';}
}
$('mode').addEventListener('change',()=>{resetMode();for(const name of ['general','saturation'])$('tab-'+name).setAttribute('aria-selected',String(name===($('mode').value.startsWith('sat')?'saturation':'general')));});
for(const letter of ['a','b']) {
 $('input-'+letter).addEventListener('input',invalidate);
 $('unit-'+letter).addEventListener('change',()=>{const select=$('unit-'+letter);try{const n=parseNumber($('input-'+letter).value);$('input-'+letter).value=String(Number(fromCanonical(toCanonical(n,select.dataset.previous),select.value).toPrecision(12)));}catch{}select.dataset.previous=select.value;invalidate();});
}
$('calculator').addEventListener('submit',run);
$('output-energy').addEventListener('change',render);
for(const button of document.querySelectorAll('[data-p]')) button.addEventListener('click',()=>{$('mode').value='pt';resetMode();$('input-a').value=button.dataset.p;$('unit-b').value='K';$('unit-b').dataset.previous='K';$('input-b').value=button.dataset.t;run();});
$('export-csv').addEventListener('click',()=>{
 if(!last)return;
 const csv=exportCSV(last,$('output-energy').value);
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='water-steam-if97.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-action],[data-copy]');if(!target)return;
 const action=target.dataset.action;
 if(['general','saturation','help'].includes(action))selectView(action);
 if(action==='clear'){historyStates.length=0;revision=0;renderHistory();invalidate();$('result-status').textContent='Результати очищено';}
 if(action==='export')$('export-csv').click();
 if(action==='print')window.print();
 if(action==='blue'||action==='gray')document.body.classList.toggle('gray',action==='gray');
 if(target.dataset.copy&&last?.state){const k=target.dataset.copy;const row=rows.find(r=>r[0]===k);const raw=k==='T'?last.state.T-273.15:last.state[k];const [value]=display(k,raw,row[3]);navigator.clipboard?.writeText(String(value)).then(()=>{$('result-status').textContent='Значення скопійовано';}).catch(()=>{$('result-status').textContent='Копіювання недоступне в цьому браузері';});}
 if(action)for(const d of document.querySelectorAll('.menubar details'))d.open=false;
});
resetMode();renderHistory();
(async()=>{
 try {const bytes=Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0));await initialize(bytes);$('calculate').disabled=false;$('calculate').innerHTML='Розрахувати';$('result-status').textContent='Готово до розрахунку';}
 catch(e){$('error').textContent='Не вдалося ініціалізувати WebAssembly. Використайте сучасний браузер. '+e.message;$('error').hidden=false;$('calculate').textContent='Помилка завантаження';}
})();
