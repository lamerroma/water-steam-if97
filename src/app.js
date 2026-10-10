import {turbine,flash,diagramData} from './processes.js';
import {exportCSV} from './export.js';
import {initialize,calculate,PMIN_SAT,TC,PC} from './engine.js';
import {parseNumber,toCanonical,fromCanonical} from './units.js';
const $=id=>document.getElementById(id);
let last=null, revision=0;
const historyStates=[];
const collapsedGroups=new Set();
const PU=[['MPa','МПа'],['kPa','кПа'],['Pa','Па'],['bar','бар'],['atm','атм']];
const TU=[['C','°C'],['K','K']], HU=[['kJkg','кДж/кг'],['Jkg','Дж/кг']], SU=[['kJkgK','кДж/(кг·K)'],['JkgK','Дж/(кг·K)']];
const definitions=[['h','Ентальпія','h','кДж/кг'],['s','Ентропія','s','кДж/(кг·K)'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['cp','Ізобарна теплоємність','Cₚ','кДж/(кг·K)'],['cv','Ізохорна теплоємність','Cᵥ','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['u','Внутрішня енергія','u','кДж/кг'],['mu','Динамічна в’язкість','μ','Па·с'],['lambda','Теплопровідність','λ','Вт/(м·K)']];
function options(id,list) {$(id).replaceChildren(...list.map(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;return o;}));$(id).dataset.previous=$(id).value;}
function resetMode() {
 const m=$('mode').value,t=m==='satt'||m==='tx',h=m==='hs',quality=m==='px'||m==='tx',sat=m==='satp'||m==='satt';
 $('field-b').hidden=sat;$('input-b').disabled=sat;
 $('label-a').textContent=t?'1. Температура:':h?'1. Ентальпія:':'1. Тиск (абсолютний):';options('unit-a',t?TU:h?HU:PU);
 $('label-b').textContent=quality?'2. Ступінь сухості:':m==='ph'?'2. Ентальпія:':m==='ps'||h?'2. Ентропія:':'2. Температура:';
 options('unit-b',quality?[['fraction','0…1'],['percent','%']]:m==='ph'?HU:m==='ps'||h?SU:TU);
 $('input-a').value=t?'100':h?'2631.49474':'3';$('input-b').value=quality?'0.5':h?'5.17540298':m==='ph'?'500':m==='ps'?'1':'26.85';
 $('mode-help').textContent=quality?'x — масова частка пари: 0 рідина, 1 пара. У критичній точці x не визначений.':h?'Введіть питому ентальпію й ентропію. Тиск і температура визначаються чисельно за IF97.':m==='pt'?'На лінії насичення P–T не визначає частку пари.':sat?'Показує обидві фази на лінії насичення.':'Сухість визначається з ентальпії або ентропії.';
 for(const name of ['general','saturation','help'])$('tab-'+name).setAttribute('aria-selected',String(name===((sat||quality)?'saturation':'general')));
 invalidate();
}
function invalidate() {
  last=null;$('export-csv').disabled=true;$('result-status').textContent='Параметри змінено — розрахуйте знову';$('error').hidden=true;
  $('results').innerHTML=propertyTable(null);$('state-summary').textContent=$('mode-help').textContent;
}
function format(n) {if(n===null||n===undefined||!Number.isFinite(n))return '—';return new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:8,notation:Math.abs(n)>0&&Math.abs(n)<1e-4?'scientific':'standard'}).format(n);}
function display(key,value,unit) {if(['h','s','cp','cv','u','A','G','ijt'].includes(key)&&$('output-energy').value==='J')return [value===null?null:value*1000,unit.replace('кДж','Дж')];return [value,unit];}
const rows=[['p','Тиск (абсолютний)','p','МПа'],['T','Температура','t','°C'],['rho','Густина','ρ','кг/м³'],['v','Питомий об’єм','v','м³/кг'],['h','Питома ентальпія','h','кДж/кг'],['s','Питома ентропія','s','кДж/(кг·K)'],['u','Питома внутрішня енергія','u','кДж/кг'],['cp','Питома ізобарна теплоємність','cp','кДж/(кг·K)'],['cv','Питома ізохорна теплоємність','cv','кДж/(кг·K)'],['w','Швидкість звуку','w','м/с'],['x','Ступінь сухості (масова частка пари)','x','–'],['region','Область IF97','region','–'],['isentropic','Ізентропний показник','κs','–'],['A','Питома енергія Гельмгольца','a','кДж/кг'],['G','Питома енергія Гіббса','g','кДж/кг'],['Z','Коефіцієнт стисливості','Z','–'],['alpha','Ізобарне об’ємне розширення','α','1/K'],['kappa','Ізотермічна стисливість','κT','1/МПа'],['dvdt','Похідна (∂v/∂T)p','vT','м³/(кг·K)'],['dvdp','Похідна (∂v/∂p)T','vp','м³/(кг·МПа)'],['dpdt','Похідна (∂p/∂T)v','pT','МПа/K'],['dpdv','Похідна (∂p/∂v)T','pv','МПа·кг/м³'],['ijt','Ізотермічний коефіцієнт Джоуля–Томсона','δT','кДж/(кг·МПа)'],['jt','Коефіцієнт Джоуля–Томсона','μJT','K/МПа'],['mu','Динамічна в’язкість','μ','Па·с'],['nu','Кінематична в’язкість','ν','м²/с'],['lambda','Теплопровідність','λ','Вт/(м·K)'],['diffusivity','Температуропровідність','aT','м²/с'],['Pr','Число Прандтля','Pr','–'],['sigma','Поверхневий натяг рідина–пара','σ','Н/м']];
const constants=['Газова стала R = 0,461526 кДж/(кг·K)','Молярна газова стала Rm = 8,31451 Дж/(моль·K)','Молярна маса M = 18,015257 г/моль','Критична температура Tc = 647,096 K','Критичний тиск pc = 22,064 МПа','Критична густина ρc = 322 кг/м³','Потрійна точка Tt = 273,16 K','Потрійна точка pt = 611,657 Па'];
function propertyTable(state) {
 return `<table class="property-table"><thead><tr><th>№</th><th>Назва властивості</th><th>Символ</th><th>⧉</th><th>Результат</th><th>Одиниці (SI)</th><th>Константи IF97</th></tr></thead><tbody>${rows.map(([key,name,symbol,unit],i)=>{
 const value=state?(key==='T'?state.T-273.15:state[key]):null;
 const [v,u]=display(key,value,unit);
 const groupId=i<10?'main':i<24?'state':'transport';
 const groupName=i===0?'1. Термодинамічні властивості — основні':i===10?'2. Термодинамічні властивості — стан':i===24?'3. Транспортні властивості':null;
 const collapsed=collapsedGroups.has(groupId);
 const group=groupName?`<tr class="group"><td colspan="7"><button data-group="${groupId}" aria-expanded="${!collapsed}">${collapsed?'⊞':'⊟'} ${groupName}</button></td></tr>`:'';
 return `${group}<tr data-group-row="${groupId}" ${collapsed?'hidden':''} data-property="${key}"><td>${i+1}</td><td>${name}</td><td>${symbol}</td><td><button class="copy" data-copy="${key}" aria-label="Копіювати: ${name}" ${v==null?'disabled':''}>⧉</button></td><td>${state?format(v):''}</td><td>${u}</td><td class="constant">${constants[i]||''}</td></tr>`;
 }).join('')}</tbody></table>`;
}
function renderHistory() {
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 $('history-body').innerHTML=historyStates.map((s,i)=>`<tr><td>${historyStates.length-i}</td>${keys.map(k=>`<td>${format(k==='T'?s.T-273.15:s[k])}</td>`).join('')}<td>IF97</td></tr>`).join('')+Array.from({length:Math.max(0,6-historyStates.length)},(_,i)=>`<tr><td>${historyStates.length+i+1}</td>${'<td></td>'.repeat(14)}</tr>`).join('');
 $('history-count').textContent=`Станів: ${historyStates.length}`;
}
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
 if(!last)return;let html='';
 if(last.state) {
  const s=last.state;
  $('state-summary').textContent=`${s.phase} · Область ${s.region}`;
  html=propertyTable(s)+notes(s.notes);
 }
 if(last.saturation) {
  const sat=last.saturation;
  if(!last.state){$('state-summary').textContent=sat.critical?'Критична точка':'Рівновага рідина–пара';}
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
$('mode').addEventListener('change',resetMode);
for(const letter of ['a','b']) {
 $('input-'+letter).addEventListener('input',invalidate);
 $('unit-'+letter).addEventListener('change',()=>{const select=$('unit-'+letter);try{const n=parseNumber($('input-'+letter).value);$('input-'+letter).value=String(Number(fromCanonical(toCanonical(n,select.dataset.previous),select.value).toPrecision(12)));}catch{}select.dataset.previous=select.value;invalidate();});
}
$('calculator').addEventListener('submit',run);
$('output-energy').addEventListener('change',()=>{if(last)render();else $('results').innerHTML=propertyTable(null);});
for(const button of document.querySelectorAll('[data-p]')) button.addEventListener('click',()=>{$('mode').value='pt';resetMode();$('input-a').value=button.dataset.p;$('unit-b').value='K';$('unit-b').dataset.previous='K';$('input-b').value=button.dataset.t;run();});
$('export-csv').addEventListener('click',()=>{
 if(!last)return;
 const csv=exportCSV(last,$('output-energy').value);
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
 if(['general','saturation','help'].includes(action))selectView(action);
 if(['turbine','flash','ts','hsdiagram'].includes(action))showProcess(action);
 if(action==='clear'){historyStates.length=0;revision=0;renderHistory();invalidate();$('result-status').textContent='Результати очищено';}
 if(action==='export')$('export-csv').click();
 if(action==='print')window.print();
 if(action==='blue'||action==='gray')document.body.classList.toggle('gray',action==='gray');
 if(target.dataset.copy&&last?.state){const k=target.dataset.copy;const row=rows.find(r=>r[0]===k);const raw=k==='T'?last.state.T-273.15:last.state[k];const [value]=display(k,raw,row[3]);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(String(value)).then(()=>{$('result-status').textContent='Значення скопійовано';}).catch(()=>{$('result-status').textContent='Копіювання недоступне в цьому браузері';});else $('result-status').textContent='Копіювання недоступне в цьому браузері';}
 if(action)for(const d of document.querySelectorAll('.menubar details'))d.open=false;
});
function exportHistory(){
 if(!historyStates.length){$('result-status').textContent='Історія порожня — спочатку розрахуйте стан';return;}
 const keys=['p','T','v','h','s','u','cp','cv','w','x','region','mu','lambda'];
 const headings=['p [MPa]','T [K]','v [m3/kg]','h [kJ/kg]','s [kJ/(kg K)]','u [kJ/kg]','cp [kJ/(kg K)]','cv [kJ/(kg K)]','w [m/s]','x [-]','region [-]','mu [Pa s]','lambda [W/(m K)]'];
 const content='\ufeff'+[headings.join(';'),...historyStates.map(s=>keys.map(k=>Number.isFinite(s[k])?String(s[k]):'').join(';'))].join('\r\n');
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
 try {const bytes=Uint8Array.from(atob(WASM_BASE64),c=>c.charCodeAt(0));await initialize(bytes);$('calculate').disabled=false;$('calculate').innerHTML='Розрахувати';$('result-status').textContent='Готово до розрахунку';}
 catch(e){$('error').textContent='Не вдалося ініціалізувати WebAssembly. Використайте сучасний браузер. '+e.message;$('error').hidden=false;$('calculate').textContent='Помилка завантаження';}
})();

let diagramCache=null, plottedProcess=null;
function showProcess(kind){
 $('calculator-view').hidden=true;$('help-view').hidden=true;$('process-view').hidden=false;
 for(const b of document.querySelectorAll('[role="tab"]'))b.setAttribute('aria-selected',String(b.dataset.action===kind));
 if(kind==='ts'||kind==='hsdiagram'){showDiagram(kind);return;}
 const tur=kind==='turbine';
 $('process-view').innerHTML=`<h2>${tur?'Парова турбіна':'Дроселювання та випаровування'}</h2><p>${tur?'Адіабатичне розширення з ізоентропним ККД. Потужність потоку без механічних і генераторних втрат.':'Адіабатичне дроселювання: h₂ = h₁. Поділ потоків наведено лише для рівноважного двофазного стану.'} Змінами кінетичної й потенціальної енергій знехтувано.</p><form id="process-form"><fieldset><legend>Вхідні дані · абсолютний тиск</legend>${[['p1','Вхідний тиск, МПа','3'],['t1','Вхідна температура, °C',tur?'400':'200'],['p2','Вихідний тиск, МПа','0.1'],...(tur?[['eta','Ізоентропний ККД, %','85']]:[]),['flow','Масова витрата, кг/с','1']].map(([id,label,value])=>`<label>${label}<input id="process-${id}" value="${value}" inputmode="decimal" required></label>`).join('')}</fieldset><button type="submit">Розрахувати</button></form><p id="process-error" role="alert"></p><div id="process-result"></div>`;
 for(const input of $('process-form').querySelectorAll('input'))input.addEventListener('input',()=>{$('process-result').innerHTML='';$('process-error').textContent='';$('result-status').textContent='Параметри процесу змінено — розрахуйте знову';});
 $('process-form').addEventListener('submit',event=>{event.preventDefault();$('process-result').innerHTML='';$('process-error').textContent='';try{
 const n=id=>parseNumber($('process-'+id).value);
 const r=tur?turbine(n('p1'),n('t1')+273.15,n('p2'),n('eta')/100,n('flow')):flash(n('p1'),n('t1')+273.15,n('p2'),n('flow'));
 plottedProcess={kind:tur?'Турбіна':'Дроселювання',result:r};
 const metrics=tur?[['Питома робота',r.work,'кДж/кг'],['Потужність потоку',r.power,'кВт']]:[['Витрата пари',r.vaporFlow,'кг/с'],['Витрата рідини',r.liquidFlow,'кг/с']];
 $('process-result').innerHTML=`<p>${metrics.map(([l,v,u])=>`${l}: <strong>${format(v)} ${u}</strong>`).join(' · ')}</p>${!tur&&r.outlet.x==null?'<p>Вихід однофазний; баланс сепарації на рідину й пару не застосовується.</p>':''}<table><thead><tr><th>Стан</th><th>p, МПа</th><th>t, °C</th><th>h, кДж/кг</th><th>s, кДж/(кг·K)</th><th>x</th><th>Фаза</th></tr></thead><tbody>${[['Вхід',r.inlet],...(tur?[['Ізоентропний вихід',r.ideal]]:[]),['Вихід',r.outlet]].map(([l,q])=>`<tr><td>${l}</td>${[q.p,q.T-273.15,q.h,q.s,q.x].map(v=>`<td>${format(v)}</td>`).join('')}<td>${q.phase}</td></tr>`).join('')}</tbody></table><button id="process-plot">Нанести процес на h–s діаграму</button><button id="process-transfer">Показати вихід у загальних властивостях</button>`;
 $('process-plot').addEventListener('click',()=>showProcess('hsdiagram'));
 $('process-transfer').addEventListener('click',()=>{selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(r.outlet.p);$('input-b').value=String(r.outlet.h);run();});
 $('result-status').textContent='Розрахунок процесу виконано';
 }catch(e){$('process-error').textContent=e.message;$('result-status').textContent='Перевірте вхідні дані';}});
}
function showDiagram(kind){
 if(!diagramCache)diagramCache=diagramData();
 const isTS=kind==='ts',baseY=isTS?800:4500;
 let range={xmin:0,xmax:11,ymin:0,ymax:baseY},selected=null;
 const colors=['#a75b00','#3977a6','#8b4599','#27825a','#b84242','#706c25','#555'];
 const process=plottedProcess;
 const processPoints=process?[[process.result.inlet,'Вхід'],...(process.result.ideal?[[process.result.ideal,'Ізоентропний вихід']]:[]),[process.result.outlet,'Вихід']]:[];
 const choices=[...historyStates.map((q,i)=>[q,`Журнал № ${historyStates.length-i}`]),...processPoints];
 const X=s=>60+(s-range.xmin)/(range.xmax-range.xmin)*820;
 const value=q=>isTS?q.T-273.15:q.h;
 const Y=q=>450-(value(q)-range.ymin)/(range.ymax-range.ymin)*400;
 const path=points=>{let pen=false;return points.map(q=>{if(!q||!Number.isFinite(q.s)||!Number.isFinite(value(q))){pen=false;return '';}const str=`${pen?'L':'M'}${X(q.s).toFixed(2)},${Y(q).toFixed(2)}`;pen=true;return str;}).join(' ');};
 $('process-view').innerHTML=`<h2>${isTS?'T–s':'h–s'} діаграма</h2><p>Масштаб: кнопки +/− або колесо над графіком. Переміщення: перетягування або стрілки після фокусування графіка. Виберіть позначену точку для властивостей. Лінії процесу з’єднують кінцеві стани; проміжний шлях реальної турбіни не визначений її ККД.</p><button id="diagram-in">+</button><button id="diagram-out">−</button><button id="diagram-reset">Скинути масштаб</button><button id="diagram-refresh">Оновити точки</button><button id="diagram-save">Зберегти SVG</button><button id="diagram-clear">Прибрати процес</button><span id="diagram-range"></span><svg id="steam-diagram" tabindex="0" role="img" aria-label="${isTS?'T–s':'h–s'} діаграма води й пари" viewBox="0 0 960 520" xmlns="http://www.w3.org/2000/svg"></svg><p>${diagramCache.isobars.map(({p},i)=>`<span style="color:${colors[i]}">━ ${p} МПа</span>`).join(' · ')} · Насичення: синя товста лінія. ${process?process.kind+': зелений відрізок; ізоентропне розширення: пунктир.':''}</p><div id="diagram-selected" aria-live="polite">Виберіть точку журналу або процесу.</div>`;
 const svg=$('steam-diagram');
 function draw(){
 svg.innerHTML=`<defs><clipPath id="plot-clip"><rect x="60" y="50" width="820" height="400"/></clipPath></defs><rect width="960" height="520" fill="white"/>${Array.from({length:6},(_,i)=>`<path d="M60 ${450-i*80}H880 M${60+i*164} 50V450" stroke="#dde3eb"/><text x="50" y="${454-i*80}" text-anchor="end">${format(range.ymin+(range.ymax-range.ymin)*i/5)}</text><text x="${60+i*164}" y="470" text-anchor="middle">${format(range.xmin+(range.xmax-range.xmin)*i/5)}</text>`).join('')}<path d="M60 50V450H880" fill="none" stroke="#333"/><text x="470" y="505" text-anchor="middle">s, кДж/(кг·K)</text><text x="65" y="25">${isTS?'t, °C':'h, кДж/кг'}</text><g clip-path="url(#plot-clip)">${diagramCache.isobars.map(({p,points},i)=>`<path d="${path(points)}" fill="none" stroke="${colors[i]}" stroke-width="1.2"><title>${p} МПа</title></path>`).join('')}${diagramCache.dome.map(points=>`<path d="${path(points)}" fill="none" stroke="#12477c" stroke-width="3"/>`).join('')}${process?`<path d="${path([process.result.inlet,process.result.outlet])}" fill="none" stroke="#12804a" stroke-width="3"/>${process.result.ideal?`<path d="${path([process.result.inlet,process.result.ideal])}" fill="none" stroke="#12804a" stroke-width="2" stroke-dasharray="6 4"/>`:''}`:''}${choices.map(([q,label],i)=>`<circle data-point="${i}" tabindex="0" role="button" aria-label="${label}" cx="${X(q.s)}" cy="${Y(q)}" r="${selected===i?7:5}" fill="${selected===i?'#f09a00':'#c62828'}"><title>${label}: p=${q.p} МПа; t=${q.T-273.15} °C; h=${q.h}; s=${q.s}</title></circle>`).join('')}</g>`;
 $('diagram-range').textContent=` s: ${format(range.xmin)}…${format(range.xmax)}; ${isTS?'t':'h'}: ${format(range.ymin)}…${format(range.ymax)}`;
 }
 function choose(i){selected=i;const [q,label]=choices[i];$('diagram-selected').innerHTML=`<h3>${label}</h3><p>${q.phase} · p=${format(q.p)} МПа · t=${format(q.T-273.15)} °C · h=${format(q.h)} кДж/кг · s=${format(q.s)} кДж/(кг·K) · x=${format(q.x)}</p><button id="diagram-transfer">Показати всі властивості</button>`;$('diagram-transfer').onclick=()=>{selectView('general');$('mode').value='ph';resetMode();$('input-a').value=String(q.p);$('input-b').value=String(q.h);run();};draw();}
 function zoom(f,cx=.5,cy=.5){const w=range.xmax-range.xmin,h=range.ymax-range.ymin;if(w*f<.05||w*f>44)return;const x=range.xmin+w*cx,y=range.ymin+h*cy;range={xmin:x-w*f*cx,xmax:x+w*f*(1-cx),ymin:y-h*f*cy,ymax:y+h*f*(1-cy)};draw();}
 $('diagram-in').onclick=()=>zoom(.8);$('diagram-out').onclick=()=>zoom(1.25);$('diagram-reset').onclick=()=>{range={xmin:0,xmax:11,ymin:0,ymax:baseY};draw();};
 $('diagram-refresh').onclick=()=>showDiagram(kind);$('diagram-clear').onclick=()=>{plottedProcess=null;showDiagram(kind);};
 $('diagram-save').onclick=()=>{const url=URL.createObjectURL(new Blob([svg.outerHTML],{type:'image/svg+xml;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=kind+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 svg.addEventListener('wheel',e=>{e.preventDefault();const b=svg.getBoundingClientRect();zoom(e.deltaY<0?.8:1.25,Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),Math.max(0,Math.min(1,1-(e.clientY-b.top)/b.height)));},{passive:false});
 let drag=null,moved=false;
 svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-point]'))return;drag={x:e.clientX,y:e.clientY,range:{...range}};moved=false;svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag)return;const b=svg.getBoundingClientRect(),dx=(e.clientX-drag.x)/b.width*960/820*(drag.range.xmax-drag.range.xmin),dy=(e.clientY-drag.y)/b.height*520/400*(drag.range.ymax-drag.range.ymin);moved=Math.abs(dx)+Math.abs(dy)>0;range={xmin:drag.range.xmin-dx,xmax:drag.range.xmax-dx,ymin:drag.range.ymin+dy,ymax:drag.range.ymax+dy};draw();});
 svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});
 svg.addEventListener('click',e=>{const point=e.target.closest('[data-point]');if(point)choose(Number(point.dataset.point));});
 svg.addEventListener('keydown',e=>{const point=e.target.closest('[data-point]');if(point&&['Enter',' '].includes(e.key)){e.preventDefault();choose(Number(point.dataset.point));return;}if(['+','=','-'].includes(e.key)){e.preventDefault();zoom(e.key==='-'?1.25:.8);}if(e.key.startsWith('Arrow')){e.preventDefault();const dx=(range.xmax-range.xmin)*.1,dy=(range.ymax-range.ymin)*.1;const x=e.key==='ArrowLeft'?-dx:e.key==='ArrowRight'?dx:0,y=e.key==='ArrowDown'?-dy:e.key==='ArrowUp'?dy:0;range={xmin:range.xmin+x,xmax:range.xmax+x,ymin:range.ymin+y,ymax:range.ymax+y};draw();}});
 draw();
}
