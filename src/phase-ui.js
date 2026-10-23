import {boundaryCalculation,D2O_PHASE_NOTE} from './phase-boundaries.js';
import {seawaterBoundary} from './seawater.js';
import {compareModels} from './comparison.js';
import {learningCSV} from './learning-export.js';
// Standalone panels retain the same offline CSV/JSON exports as learning modules.
function scientificPanel(kind){
 selectView('panel');activeSection=kind;$('calculator-view').hidden=true;$('process-view').hidden=false;
 document.querySelector(`[data-action="${kind}"]`).setAttribute('aria-selected','true');$('tab-general').setAttribute('aria-selected','false');
 const field=(id,label,value)=>`<label for="${id}" id="${id}-label">${label}</label><input id="${id}" value="${value}" required inputmode="decimal">`;
 const body=kind==='boundaries'?`<h2>Фазові межі</h2><p>H₂O: R14-08(2011). D₂O: R16-17(2018), §6. Морська вода: R13-08, рівновага хімічних потенціалів Eq. 30/32.</p><label for="phase-substance">Речовина</label><select id="phase-substance"><option value="H2O">H₂O</option><option value="D2O">D₂O</option><option value="seawater">Морська вода</option></select><label for="phase-kind">Рівновага</label><select id="phase-kind"></select><label for="phase-ice">Модифікація льоду</label><select id="phase-ice"><option>Ih</option><option>III</option><option>V</option><option>VI</option><option>VII</option></select>${field('phase-value','Температура, K',260)}${field('phase-s','Абсолютна солоність, г/кг',35.16504)}<p id="phase-range"></p><button type="submit">Розрахувати фазову межу</button>`:`<h2>Порівняння IF97 / IAPWS-95</h2><p>Однакові входи для обох моделей; межі застосування перевіряються окремо. Δ = IF97 − IAPWS-95.</p><label for="compare-mode">Вхідна пара</label><select id="compare-mode"><option value="pt">P–T</option><option value="ph">P–h</option><option value="ps">P–s</option><option value="px">P–x</option><option value="tx">T–x</option></select>${field('compare-a','Тиск, МПа',3)}${field('compare-b','Температура, K',300)}<button type="submit">Порівняти моделі</button>`;
 $('process-view').innerHTML=`<section class="method"><form id="scientific-form">${body}</form><p id="scientific-error" role="alert" hidden></p><div id="scientific-output" aria-live="polite"></div></section>`;
 $('process-view').scrollTop=0;
 if(kind==='boundaries'){
  const update=()=>{const sub=$('phase-substance').value,sw=sub==='seawater',m=$('phase-kind').value,iceOnly=!sw&&m==='melt';
   $('phase-ice').hidden=!iceOnly;$('phase-ice').disabled=!iceOnly;document.querySelector('label[for="phase-ice"]').hidden=!iceOnly;
   $('phase-ice').querySelector('option:last-child').disabled=sub==='D2O';if(sub==='D2O'&&$('phase-ice').value==='VII')$('phase-ice').value='Ih';
   $('phase-s').hidden=!sw;$('phase-s').disabled=!sw;$('phase-s-label').hidden=!sw;
   $('phase-value-label').textContent=sw?(m==='freeze'?'Абсолютний тиск, МПа':'Температура, K'):'Температура, K';
   $('phase-range').textContent=sw?(m==='freeze'?'Замерзання: p = 0,000611655…100 МПа; корінь T = 261…273,16 K.':'Кипіння: T = 265…353 K; розраховується тиск, а не температура кипіння при 1 атм.'):(sub==='D2O'?D2O_PHASE_NOTE:'R14-08: лід Ih/III/V/VI/VII; сублімація 50…273,16 K.');
  };
  $('phase-substance').onchange=()=>{const sw=$('phase-substance').value==='seawater';$('phase-kind').innerHTML=sw?'<option value="freeze">Замерзання за p</option><option value="boil">Кипіння за T</option>':'<option value="melt">Плавлення за T</option><option value="subl">Сублімація за T</option>';$('phase-value').value=sw?'.101325':'260';update();};
  $('phase-kind').onchange=()=>{$('phase-value').value=$('phase-substance').value==='seawater'?($('phase-kind').value==='freeze'?'.101325':'300'):($('phase-kind').value==='subl'?'230':'260');update();};
  $('phase-ice').onchange=()=>{const sub=$('phase-substance').value,p=$('phase-ice').value;$('phase-value').value=({Ih:260,III:sub==='D2O'?256:254,V:265,VI:sub==='D2O'?300:320,VII:550})[p];update();};
  $('phase-substance').onchange();
 }else{
  $('compare-mode').onchange=()=>{const m=$('compare-mode').value;$('compare-a-label').textContent=m==='tx'?'Температура, K':'Тиск, МПа';$('compare-b-label').textContent=m==='pt'?'Температура, K':m==='ph'?'Ентальпія, кДж/кг':m==='ps'?'Ентропія, кДж/(кг·K)':'Сухість, 0…1';$('compare-a').value=m==='tx'?'450':'3';$('compare-b').value=m==='pt'?'300':m==='ph'?'500':m==='ps'?'2':'0.5';};
 }
 const scientificForm=$('scientific-form');
 $('scientific-form').oninput=()=>{panelEdited(scientificForm);$('scientific-output').replaceChildren();$('scientific-error').hidden=true;};
 $('scientific-form').onchange=()=>{panelEdited(scientificForm);$('scientific-output').replaceChildren();$('scientific-error').hidden=true;};
 $('scientific-form').onsubmit=e=>{e.preventDefault();try{
  const number=id=>uiNumber(id);let q,entries=[],html='';
  if(kind==='boundaries'){
   const sub=$('phase-substance').value,m=$('phase-kind').value,value=number('phase-value');
   q=sub==='seawater'?seawaterBoundary(m,number('phase-s')/1000,m==='freeze'?value*1e6:value):boundaryCalculation(sub,m,value,$('phase-ice').value);
   entries=[['Температура',q.T,'K'],['Тиск',q.boundary?q.p/1e6:q.p,'МПа']];
   html=`<p><strong>${escapeHTML(q.model)}</strong></p><p>${escapeHTML(q.phase)}</p>`+notes(q.notes)+learningRows(entries);
  }else{
   q=compareModels($('compare-mode').value,number('compare-a'),number('compare-b'));
   html=notes(q.notes)+q.models.map(z=>`<p><strong>${z.model}:</strong> ${escapeHTML(z.error||z.result?.state?.phase||'Насичення; фаза неоднозначна')}</p>`).join('')+`<table class="sat-table"><thead><tr><th>Властивість</th><th>IF97</th><th>IAPWS-95</th><th>Δ</th><th>Δ, %</th><th>Одиниця</th></tr></thead><tbody>${q.rows.map(r=>`<tr><td>${r.label}</td><td>${format(r.if97)}</td><td>${format(r.iapws95)}</td><td>${format(r.delta)}</td><td>${format(r.relative)}</td><td>${r.unit}</td></tr>`).join('')}</tbody></table>`;
  }
  $('scientific-error').hidden=true;$('scientific-output').innerHTML=html+'<p><button id="scientific-csv">CSV розрахунку</button> <button id="scientific-json">JSON розрахунку</button></p>';
  const inputs=()=>[...$('scientific-form').querySelectorAll('input,select')].filter(el=>!el.disabled).map(el=>[el.id,el.value]);
  $('scientific-csv').onclick=()=>downloadFile(learningCSV(q,inputs(),entries),'water-steam-'+kind+'.csv','text/csv;charset=utf-8');
  $('scientific-json').onclick=()=>downloadFile(JSON.stringify({format:'water-steam-calculation',version:1,module:kind,model:modelValue(),inputs:panelInputs(scientificForm),result:q},null,2),'water-steam-'+kind+'.json','application/json');
  panelCalculated(scientificForm);$('scientific-output').scrollIntoView({block:'start'});
 }catch(error){panelEdited(scientificForm);$('scientific-output').replaceChildren();$('scientific-error').textContent=error.message;$('scientific-error').hidden=false;}};
 restorePanelInputs(kind,scientificForm);restorePanelResult(kind,scientificForm);
}
