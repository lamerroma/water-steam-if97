import {GAS_DATA,gasState,gasInverse,AIR,FLUE} from './gases.js';
import {humidAir} from './humid-air.js';
import {rankine,rankineReheat,rankineRegen,brayton} from './cycles.js';
// Shared workspace panels; these modules use explicit SI inputs/outputs independent of steam table settings.
let learningResult=null;
const learnField=(id,title,value)=>`<label>${title}<input id="${id}" value="${value}" inputmode="decimal" required></label>`;
const learnNumber=id=>parseNumber($(id).value);
function learningPanel(kind){
 selectView('general');$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector(`[data-action="${kind}"]`).setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');learningResult=null;
 let body='';
 if(kind==='gases')body=`<h2>11 газів і суміші · NASA7</h2><p>Ідеальний газ зі сталим складом. Ентальпія включає ентальпії утворення NASA; ентропія — з тиском і змішуванням. Конденсація, реакції та реальні гази не моделюються. Транспортні властивості газів не наведено.</p><form id="learn-form"><div class="process-grid"><label>Режим<select id="gas-mode"><option value="pt">P–T</option><option value="ph">P–h</option><option value="ps">P–s</option></select></label>${learnField('gas-p','Абсолютний тиск, МПа',.101325)}<label><span id="gas-b-title">Температура, K</span><input id="gas-b" value="300" inputmode="decimal" required></label><label>Базис складу<select id="gas-basis"><option value="mole">Молярні частки</option><option value="mass">Масові частки</option></select></label><label>Готовий склад<select id="gas-preset"><option value="air">Сухе повітря</option><option value="flue">Приклад димових газів</option>${GAS_DATA.map(d=>`<option>${d.id}</option>`).join('')}<option value="custom">Власна суміш</option></select></label></div><p>Частки 0…1; сума = 1. Зміна базису перераховує введений склад.</p><div class="process-grid">${GAS_DATA.map(d=>learnField('fraction-'+d.id,d.id,AIR[d.id]||0)).join('')}</div><button type="submit">Розрахувати газ</button></form>`;
 if(kind==='humid')body=`<h2>Вологе повітря · навчальна ідеальна суміш</h2><p>Насичення IAPWS-95 + інтегровані Cp(T) NASA7. Без віріальних поправок. P = 0,05…0,2 МПа; T = 273,16…373,15 K. Показники h, Cp і v — на 1 кг сухого повітря; ρ — для всієї суміші. Нуль h: сухе повітря та рідина при 273,16 K.</p><form id="learn-form"><div class="process-grid">${learnField('ha-p','Абсолютний тиск, МПа',.101325)}${learnField('ha-t','Температура, °C',30)}${learnField('ha-rh','Відносна вологість, %',50)}</div><button type="submit">Розрахувати вологе повітря</button></form>`;
 if(kind==='cycles')body=`<h2>Навчальні енергетичні цикли</h2><p>Ренкін: обрана формуляція води (${escapeHTML(modelValue())}). Варіанти з перегрівом і з регенерацією додають один проміжний тиск (ЦВТ/витяжка). Брайтон: сухе повітря NASA7, замкнений цикл зі змінною Cp(T), без реакцій. Втрати тиску та тепла в трубопроводах не враховано.</p><form id="learn-form"><label>Цикл<select id="cycle-kind"><option value="rankine">Ренкіна (простий)</option><option value="rankine-reheat">Ренкіна з перегрівом</option><option value="rankine-regen">Ренкіна з регенерацією</option><option value="brayton">Брайтона</option></select></label><div class="process-grid">${learnField('cycle-low','Нижній абсолютний тиск, МПа',.01)}${learnField('cycle-high','Тиск котла, МПа / ступінь стиснення',10)}${learnField('cycle-mid','Тиск проміжного перегріву, МПа',2)}${learnField('cycle-tmin','T₁ Брайтона, K (Ренкін: насичена рідина)',300)}${learnField('cycle-tmax','T₃ на вході турбіни, K',773.15)}${learnField('cycle-tmid','Температура після перегріву, K',773.15)}${learnField('cycle-et','Ізоентропний ККД турбіни, 0…1',.85)}${learnField('cycle-ec','Ізоентропний ККД насоса / компресора, 0…1',.8)}${learnField('cycle-flow','Масова витрата, кг/с',1)}</div><button type="submit">Розрахувати цикл</button></form>`;
 $('process-view').innerHTML=`<section class="method">${body}<p id="learn-error" role="alert" hidden></p><div id="learn-output" aria-live="polite"></div></section>`;
 $('process-view').scrollTop=0;
 const ids=[...$('learn-form').querySelectorAll('input,select')];let draft;try{draft=JSON.parse(localStorage.getItem('water-steam-learning-'+kind)||'null');}catch{}if(draft)for(const el of ids)if(draft[el.id]!=null)el.value=draft[el.id];
 const saveDraft=()=>{try{localStorage.setItem('water-steam-learning-'+kind,JSON.stringify(Object.fromEntries(ids.map(el=>[el.id,el.value]))));}catch{}};
 $('learn-form').oninput=()=>{learningResult=null;$('learn-output').replaceChildren();$('learn-error').hidden=true;saveDraft();};
 $('learn-form').onchange=()=>{learningResult=null;$('learn-output').replaceChildren();saveDraft();};
 if(kind==='gases'){
  const gasLabel=()=>{$('gas-b-title').textContent=$('gas-mode').value==='pt'?'Температура, K':$('gas-mode').value==='ph'?'Ентальпія, кДж/кг':'Ентропія, кДж/(кг·K)';};gasLabel();
  let oldBasis=$('gas-basis').value;
  const setFractions=q=>{for(const d of GAS_DATA)$('fraction-'+d.id).value=String(q[d.id]||0);};
  const fromMole=q=>{if($('gas-basis').value==='mole')return q;const M=GAS_DATA.reduce((s,d)=>s+(q[d.id]||0)*d.M,0);return Object.fromEntries(GAS_DATA.map(d=>[d.id,(q[d.id]||0)*d.M/M]));};
  $('gas-preset').onchange=()=>{const v=$('gas-preset').value;if(v!=='custom')setFractions(fromMole(v==='air'?AIR:v==='flue'?FLUE:{[v]:1}));};
  $('gas-basis').onchange=()=>{try{const q=gasState(.1,Math.max(300,...GAS_DATA.filter(d=>learnNumber('fraction-'+d.id)>0).map(d=>d.range[0])),readGasFractions(),oldBasis);setFractions(fromMole(q.composition));oldBasis=$('gas-basis').value;}catch(e){$('gas-basis').value=oldBasis;$('learn-error').textContent=e.message;$('learn-error').hidden=false;}};
  for(const d of GAS_DATA)$('fraction-'+d.id).oninput=()=>{$('gas-preset').value='custom';};
  $('gas-mode').onchange=()=>{gasLabel();$('gas-b').value=$('gas-mode').value==='pt'?'300':$('gas-mode').value==='ph'?'0':'7';};
 }
 function cycleMode(){const v=$('cycle-kind').value,gas=v==='brayton',reheat=v==='rankine-reheat',regen=v==='rankine-regen',mid=reheat||regen;
  $('cycle-tmin').disabled=!gas;$('cycle-tmin').closest('label').hidden=!gas;
  $('cycle-mid').disabled=!mid;$('cycle-mid').closest('label').hidden=!mid;
  if(mid)$('cycle-mid').closest('label').firstChild.textContent=reheat?'Тиск проміжного перегріву, МПа':'Тиск витяжки пари (ВПВ), МПа';
  $('cycle-tmid').disabled=!reheat;$('cycle-tmid').closest('label').hidden=!reheat;}
 if(kind==='cycles'){$('cycle-kind').onchange=()=>{const v=$('cycle-kind').value,gas=v==='brayton';$('cycle-low').value=gas?'.101325':'.01';$('cycle-high').value=gas?'8':'10';$('cycle-tmax').value=gas?'1400':'773.15';if(v==='rankine-reheat')$('cycle-tmid').value=$('cycle-tmax').value;cycleMode();};cycleMode();}
 $('learn-form').onsubmit=e=>{e.preventDefault();$('learn-error').hidden=true;try{
  let q;if(kind==='gases'){const m=$('gas-mode').value;q=m==='pt'?gasState(learnNumber('gas-p'),learnNumber('gas-b'),readGasFractions(),$('gas-basis').value):gasInverse(learnNumber('gas-p'),learnNumber('gas-b'),m==='ph'?'h':'s',readGasFractions(),$('gas-basis').value);}
  if(kind==='humid')q=humidAir(learnNumber('ha-p'),learnNumber('ha-t')+273.15,learnNumber('ha-rh')/100);
  if(kind==='cycles'){const v=$('cycle-kind').value,a=['cycle-low','cycle-high','cycle-tmin','cycle-tmax','cycle-mid','cycle-tmid','cycle-et','cycle-ec','cycle-flow'].map(learnNumber);
   q=v==='brayton'?brayton(a[0],a[1],a[2],a[3],a[6],a[7],a[8])
    :v==='rankine-reheat'?rankineReheat(a[1],a[4],a[0],a[3],a[5],a[6],a[7],a[8],modelValue())
    :v==='rankine-regen'?rankineRegen(a[1],a[4],a[0],a[3],a[6],a[7],a[8],modelValue())
    :rankine(a[1],a[0],a[3],a[6],a[7],a[8],modelValue());}
  learningResult=q;renderLearning(kind,q);$('learn-output').scrollIntoView({block:'start'});saveDraft();
 }catch(err){learningResult=null;$('learn-output').replaceChildren();$('learn-error').hidden=false;$('learn-error').textContent=err.message;}};
}
function readGasFractions(){return Object.fromEntries(GAS_DATA.map(d=>[d.id,learnNumber('fraction-'+d.id)]));}
function learningRows(entries){return `<table class="sat-table"><thead><tr><th>Показник</th><th>Результат</th><th>Одиниця</th></tr></thead><tbody>${entries.map(([k,v,u])=>`<tr><td>${k}</td><td>${format(v)}</td><td>${u}</td></tr>`).join('')}</tbody></table>`;}
function renderLearning(kind,q){let entries=[],html=`<p><strong>${escapeHTML(q.model)}</strong></p>`;
 if(kind==='gases'){entries=[['T',q.T,'K'],['P',q.p,'МПа'],['M',q.M,'кг/кмоль'],['h',q.h,'кДж/кг'],['s',q.s,'кДж/(кг·K)'],['u',q.u,'кДж/кг'],['ρ',q.rho,'кг/м³'],['v',q.v,'м³/кг'],['Cp',q.cp,'кДж/(кг·K)'],['Cv',q.cv,'кДж/(кг·K)'],['w',q.w,'м/с'],['Cp/Cv',q.gamma,'–']];html+=`<p>Діапазон складу: ${q.limits.min}…${q.limits.max} K. Z = 1 за моделлю. Молярний склад: ${Object.entries(q.composition).map(([k,v])=>k+'='+format(v)).join('; ')}.</p>`;}
 if(kind==='humid'){entries=[['Вологовміст W',q.W,'кг пари/кг сухого повітря'],['Парціальний Pᵥ',q.pv,'МПа'],['Ентальпія',q.h,'кДж/кг сухого повітря'],['Cp',q.cp,'кДж/(кг сухого повітря·K)'],['Питомий об’єм',q.v,'м³/кг сухого повітря'],['Густина суміші',q.rho,'кг/м³'],['Точка роси',q.dew==null?null:q.dew-273.15,'°C'],['Мокрий термометр',q.wet==null?null:q.wet-273.15,'°C']];html+=notes(q.notes);}
 if(kind==='cycles'){entries=[['Робота турбіни',q.turbine,'кДж/кг'],['Робота насоса / компресора',q.compressor,'кДж/кг'],['Підведене тепло',q.heat,'кДж/кг'],['Відведене тепло',q.rejected,'кДж/кг'],['Корисна робота',q.net,'кДж/кг'],['Термічний ККД',q.efficiency*100,'%'],['Потужність',q.power,'кВт']];html+=notes(q.assumptions)+(q.states.length===4?`<p>qᵢₙ = h₃ − h₂; qₒᵤₜ = h₄ − h₁; wₙₑₜ = (h₃ − h₄) − (h₂ − h₁); η = wₙₑₜ / qᵢₙ.</p>`:`<p>qᵢₙ − qₒᵤₜ = wₙₑₜ; η = wₙₑₜ / qᵢₙ (детальний розподіл по станах — у таблиці нижче).</p>`)+`<table class="sat-table"><thead><tr><th>Стан</th><th>P, МПа</th><th>T, K</th><th>h, кДж/кг</th><th>s, кДж/(кг·K)</th><th>x</th></tr></thead><tbody>${q.states.map((z,i)=>`<tr><td>${i+1}</td>${['p','T','h','s','x'].map(k=>`<td>${format(z[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
 $('learn-output').innerHTML=html+learningRows(entries)+'<p><button id="learn-csv">CSV розрахунку</button> <button id="learn-json">JSON: входи та результати</button></p>';
 $('learn-csv').onclick=()=>{const inputRows=[...$('learn-form').querySelectorAll('input,select')].map(el=>[el.id,el.value]);const lines=[['model',q.model],['input','value'],...inputRows,['quantity','value','unit'],...entries,...(q.states?[['state','p [MPa]','T [K]','h [kJ/kg]','s [kJ/(kg K)]'],...q.states.map((z,i)=>[i+1,z.p,z.T,z.h,z.s])]:[])];downloadFile('\uFEFF'+lines.map(row=>row.map(v=>String(v??'').replaceAll(';',',')).join(';')).join('\r\n'),'water-steam-'+kind+'.csv','text/csv;charset=utf-8');};
 $('learn-json').onclick=()=>downloadFile(JSON.stringify({module:kind,inputs:Object.fromEntries([...$('learn-form').querySelectorAll('input,select')].map(el=>[el.id,el.value])),result:q},null,2),'water-steam-'+kind+'.json','application/json');
}
document.addEventListener('click',e=>{const kind=e.target.closest('[data-action]')?.dataset.action;if(['gases','humid','cycles'].includes(kind))learningPanel(kind);});
