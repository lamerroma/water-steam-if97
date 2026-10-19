import {uiTransportQuantity} from './ui-quantities.js';
import {englishProperty} from './units.js';
import {modeGuidance} from './input-guidance.js';
export function printableReport(title,states,system='si',energy='kJ',context={}){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields=[['p','MPa'],['T','K'],['h','kJ/kg'],['s','kJ/(kg K)'],['u','kJ/kg'],['rho','kg/m3'],['v','m3/kg'],['cp','kJ/(kg K)'],['cv','kJ/(kg K)'],['w','m/s'],['x','-']];
 const pressure=context.pressure||{basis:'absolute',atmosphere:.101325};
 const convert=(k,v,u)=>{if(k==='p'&&v!=null&&pressure.basis==='gauge')v-=pressure.atmosphere;const out=system==='english'?englishProperty(k,v,u):energy==='J'&&['h','s','u','ex','cp','cv'].includes(k)?[v==null?null:v*1000,u.replace('kJ','J')]:[v,u];const transport=uiTransportQuantity(k,...out,context.preferences);return [transport[0],transport[1]+(k==='p'&&pressure.basis==='gauge'?' (gauge)':'')];};
 const number=v=>Number.isFinite(v)?esc(Number(v.toPrecision(10))):'—';
 const cell=(k,v,u)=>number(convert(k,v,u)[0]);
 const notes=list=>[...new Set(list||[])].map(n=>`<p>${esc(n)}</p>`).join('');
 const source=q=>q.source?`<p><strong>Задано:</strong> ${esc(q.source.mode.toUpperCase())}; a = ${number(q.source.a)}; b = ${number(q.source.b)} (канонічні SI: MPa (абсолютний тиск), K, kJ/kg, kJ/(kg K), m³/kg, kg/m³, частка 0…1 відповідно до режиму).</p><p>${esc(modeGuidance(q.source.mode))}</p>`:'';
 const r=context.result;
 let current='';
 if(r){
  const list=r.state?[['Поточний стан',r.state]]:r.saturation?[['Насичена рідина',r.saturation.liquid],['Насичена пара',r.saturation.vapor]]:[];
  const extraFields=[['ex','kJ/kg'],['mu','Pa s'],['lambda','W/(m K)'],['nu','m2/s'],['Pr','-'],['sigma','N/m']];
  current='<h2>Поточний стан і пояснення</h2>'+list.map(([label,q])=>`<h3>${esc(label)} · ${esc(q.model||'IF97')} · ${esc(q.phase)}</h3>${source(q)}<table class="properties"><thead><tr><th>Властивість</th><th>Результат</th><th>Одиниця</th></tr></thead><tbody>${[...fields,...extraFields].map(([k,u])=>`<tr><td>${k}</td><td>${cell(k,q[k],u)}</td><td>${esc(convert(k,null,u)[1])}</td></tr>`).join('')}</tbody></table>${notes(q.notes)}`).join('');
  if(r.ambiguous)current+='<p>P–T на насиченні не визначає сухість. Для суміші задайте P–x, T–x або інший незалежний параметр.</p>';
  current+='<p>Співвідношення в канонічних SI: ρ = 1/v; u = h − 1000·p·v (p — абсолютний тиск у MPa, v у m³/kg, h та u у kJ/kg).</p>';
  if(r.state?.x!=null&&r.state.x>0&&r.state.x<1)current+='<p>Для рівноважної суміші h, s, u, v = (1−x)·значення рідини + x·значення пари. Густина дорівнює 1/v; теплоємності та транспортні властивості суміші не усереднюються.</p>';
  if(context.ambient)current+=`<p>Фізична ексергія потоку: ex = (h−h₀)−T₀(s−s₀). Довкілля: P₀ = ${number(context.ambient.p)} MPa; T₀ = ${number(context.ambient.T)} K. Без хімічної, кінетичної та потенціальної складових.</p>`;
 }
 const journal=states.length?`<h2>Порівняння станів</h2><table><thead><tr><th>Стан</th>${fields.map(([k,u])=>`<th>${k} [${esc(convert(k,null,u)[1])}]</th>`).join('')}<th>Модель</th><th>Фаза</th></tr></thead><tbody>${states.map(q=>`<tr><td ${q.name?'data-i18n-ignore':''}>${esc(q.name||'Стан')}</td>${fields.map(([k,u])=>`<td>${cell(k,q[k],u)}</td>`).join('')}<td>${esc(q.model||'IF97')}</td><td>${esc(q.phase)}</td></tr>`).join('')}</tbody></table>`:'';
 // extra is generated from the current application DOM, never read from imported files.
 return `<!doctype html><html lang="uk"><meta charset="utf-8"><title data-i18n-ignore>${esc(title)} · звіт</title><style>body{font:14px Arial;margin:24px;color:#182b40}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #abc;padding:6px;text-align:right}th:first-child,td:first-child{text-align:left}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}.properties{max-width:650px}svg{max-width:100%;height:auto}button,form,input,select,textarea{display:none}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0}}</style><h1 data-i18n-ignore>${esc(title)}</h1><p>Тиск водяних таблиць: ${pressure.basis==='gauge'?'Манометричний тиск; Pатм = '+number(pressure.atmosphere)+' MPa (абс.)':'Абсолютний тиск'} · ${system==='english'?'Англійські одиниці, Btu IT':'SI'} · модель зазначена для кожного розрахунку.</p>${context.extra||''}${current}${journal}<p>Позначення: p — тиск; T — температура; h — ентальпія; s — ентропія; u — внутрішня енергія; ρ — густина; v — питомий об’єм; x — масова частка пари. Невизначені величини позначено —. Числова точність відображення не є оцінкою фізичної невизначеності.</p></html>`;
}
