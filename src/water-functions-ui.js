import {FN_PROPERTIES,FN_ARGUMENTS,FN_MATH,evaluateFnProgram,buildFnFormula,fnProgramCSV} from './water-functions.js';
// Formula panel ("Функції"): water and steam properties as functions with named
// arguments, arithmetic, variables and argument ranges. The program text and the
// model are saved in the project; the form helper outside the form only builds lines.
export const FN_DEFAULT_PROGRAM=['# Приклад: властивості в точці, процес і таблиця','h(p=10 бар; t=250 °C)','h0 = h(p=10; t=550)','h2 = h(p=10; t=550; p2=0.005; eta=0.85)','N = h0 - h2','x(p=10; t=550; p2=0.005; eta=0.85)','psat(t=100)','cp(p=1; t=100..300 step 50)'].join('\n');
export const FN_PROPERTY_GROUPS=Object.freeze({
 basic:['t','T','p','rho','v','h','s','u','x','region'],
 caloric:['cp','cv','w','k','A','G','Z'],
 derivatives:['alpha','kappa','dvdt','dvdp','dpdt','dpdv','drhodh','drhodph','jt','ijt'],
 transport:['mu','nu','lambda','a','Pr','sigma','dc','pKw','nD'],
 saturation:['psat','tsat','Tsat','r','dpsdt']
});
const FN_PAIR_ARGS=['p','t','T','h','s','u','v','rho','x'];
export function fnMessage(t,error){
 if(!error)return '';
 if(error.code==='engine')return fnUiText(error.params.message);
 return t('fn.error.'+error.code,error.params);
}
function fnUiText(text){try{return uiTranslator.text(text);}catch{return text;}}
function fnFormat(value){return value==null?'—':format(value);}
function fnArgUnits(name){const spec=FN_ARGUMENTS[name];return [spec.defaultUnit??spec.base,...Object.keys(spec.units).filter(u=>u!==(spec.defaultUnit??spec.base))].filter((u,i,a)=>a.indexOf(u)===i);}
let fnResult=null;
function showFunctions(){
 selectView('panel');activeSection='functions';fnResult=null;$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[role=tab][data-action=functions]')?.setAttribute('aria-selected','true');
 const t=(k,p)=>escapeHTML(uiTranslator.t(k,p));
 const propOptions=Object.entries(FN_PROPERTY_GROUPS).map(([g,keys])=>`<optgroup label="${t('fn.group.'+g)}">${keys.map(k=>`<option value="${k}">${escapeHTML(k)} — ${t('fn.prop.'+k)}</option>`).join('')}</optgroup>`).join('');
 const argSelect=(id,def)=>`<select id="${id}" aria-label="${t('fn.builder.argument')}">${FN_PAIR_ARGS.map(a=>`<option value="${a}"${a===def?' selected':''}>${a}</option>`).join('')}</select>`;
 const reference=Object.entries(FN_PROPERTY_GROUPS).map(([g,keys])=>`<tr><th colspan="3">${t('fn.group.'+g)}</th></tr>`+keys.map(k=>`<tr><td><code>${escapeHTML(k)}</code></td><td>${t('fn.prop.'+k)}</td><td>${escapeHTML(FN_PROPERTIES[k][0])}</td></tr>`).join('')).join('');
 const argReference=Object.entries(FN_ARGUMENTS).map(([a,spec])=>`<tr><td><code>${a}</code></td><td>${t('fn.arg.'+a)}</td><td>${spec.text?'IF97, IAPWS-95':escapeHTML([spec.defaultUnit??spec.base,...Object.keys(spec.units||{})].filter((u,i,arr)=>arr.indexOf(u)===i).join(', '))}</td></tr>`).join('');
 $('process-view').innerHTML=`<section class="method"><h2 data-i18n="fn.title">${t('fn.title')}</h2><p data-i18n="fn.intro">${t('fn.intro')}</p>
<div class="fn-builder" id="fn-builder"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9em),1fr));gap:.5em;align-items:end"><label>${t('fn.builder.property')}<select id="fn-b-prop" style="max-width:100%">${propOptions}</select></label>
<label>${t('fn.builder.first')}${argSelect('fn-b-a','p')}</label><label>${t('fn.builder.value')}<input id="fn-b-av" value="1" inputmode="decimal"></label><label>${t('fn.builder.unit')}<select id="fn-b-au"></select></label>
<label>${t('fn.builder.second')}${argSelect('fn-b-b','t')}</label><label>${t('fn.builder.value')}<input id="fn-b-bv" value="250" inputmode="decimal"></label><label>${t('fn.builder.unit')}<select id="fn-b-bu"></select></label></div>
<button type="button" id="fn-b-add" style="margin:.5em 0 1em">${t('fn.builder.add')}</button></div>
<form id="fn-form" novalidate><div class="process-grid"><label>${t('fn.model')}<select id="fn-model"><option value="IF97">IAPWS-IF97</option><option value="IAPWS-95">IAPWS-95</option></select></label></div>
<label class="fn-text-label">${t('fn.program')}<textarea id="fn-text" rows="10" spellcheck="false" autocomplete="off" style="width:100%;font-family:ui-monospace,monospace">${escapeHTML(FN_DEFAULT_PROGRAM)}</textarea></label>
<button type="submit" id="fn-calculate">${t('fn.calculate')}</button> <button type="button" id="fn-copy" disabled>${t('fn.copy')}</button> <button type="button" id="fn-csv" disabled>${t('fn.csv')}</button><p id="fn-error" role="alert" hidden></p></form>
<div id="fn-results" aria-live="polite"></div>
<details class="fn-reference"><summary>${t('fn.reference')}</summary><p>${t('fn.syntax')}</p><table class="sat-table"><thead><tr><th>${t('fn.ref.function')}</th><th>${t('fn.ref.meaning')}</th><th>${t('fn.ref.unit')}</th></tr></thead><tbody>${reference}</tbody></table>
<table class="sat-table"><thead><tr><th>${t('fn.ref.argument')}</th><th>${t('fn.ref.meaning')}</th><th>${t('fn.ref.units')}</th></tr></thead><tbody>${argReference}</tbody></table><p>${t('fn.ref.math')} ${Object.keys(FN_MATH).map(k=>'<code>'+k+'()</code>').join(', ')}.</p></details></section>`;
 const form=$('fn-form');
 function syncUnits(){for(const [arg,unit] of [['fn-b-a','fn-b-au'],['fn-b-b','fn-b-bu']]){const units=fnArgUnits($(arg).value);$(unit).innerHTML=units.map(u=>`<option value="${escapeHTML(u)}">${escapeHTML(u==='–'?'—':u)}</option>`).join('');}}
 $('fn-b-a').onchange=syncUnits;$('fn-b-b').onchange=syncUnits;syncUnits();
 $('fn-b-add').onclick=()=>{
  const unit=id=>{const v=$(id).value,spec=FN_ARGUMENTS[$(id==='fn-b-au'?'fn-b-a':'fn-b-b').value];return v==='–'||v===(spec.defaultUnit??spec.base)?'':v;};
  const line=buildFnFormula($('fn-b-prop').value,[{name:$('fn-b-a').value,value:$('fn-b-av').value,unit:unit('fn-b-au')},{name:$('fn-b-b').value,value:$('fn-b-bv').value,unit:unit('fn-b-bu')}]);
  const area=$('fn-text');area.value=(area.value.replace(/\s+$/,'')+'\n'+line).replace(/^\n/,'');area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();
 };
 function invalidate(){fnResult=null;$('fn-results').replaceChildren();$('fn-copy').disabled=true;$('fn-csv').disabled=true;$('fn-error').hidden=true;}
 function edited(){invalidate();if(!restoringWorkspace){panelEdited(form);capturePanel();saveProject();}}
 form.addEventListener('change',edited);
 form.addEventListener('input',e=>{if(e.target.tagName!=='SELECT')edited();});
 form.onsubmit=e=>{e.preventDefault();invalidate();
  const result=evaluateFnProgram($('fn-text').value,{model:$('fn-model').value});fnResult=result;form.dataset.model=result.model;
  if(!result.lines.length){$('fn-error').textContent=uiTranslator.t('fn.empty');$('fn-error').hidden=false;return;}
  const body=result.lines.map(l=>{
   const notes=(l.notes||[]).map(n=>`<div class="fn-note">${t('fn.note.'+n)}</div>`).join('');
   if(l.error)return `<tr class="fn-error-row"><td>${l.line}</td><td><code>${escapeHTML(l.source)}</code></td><td colspan="2" role="note">${escapeHTML(fnMessage(uiTranslator.t.bind(uiTranslator),l.error))}</td></tr>`;
   if(l.rows){const inner=l.rows.map(r=>`<tr><td>${fnFormat(r.argument)}</td><td>${r.error?escapeHTML(fnMessage(uiTranslator.t.bind(uiTranslator),r.error)):fnFormat(r.value)}</td></tr>`).join('');
    return `<tr><td>${l.line}</td><td><code>${escapeHTML(l.source)}</code>${notes}</td><td colspan="2"><table class="sat-table fn-series"><thead><tr><th>${escapeHTML(l.argument)}, ${escapeHTML(l.argumentUnit)}</th><th>${t('fn.value')}${l.unit?', '+escapeHTML(l.unit):''}</th></tr></thead><tbody>${inner}</tbody></table></td></tr>`;}
   return `<tr><td>${l.line}</td><td><code>${escapeHTML(l.source)}</code>${notes}</td><td>${fnFormat(l.value)}</td><td>${escapeHTML(l.unit||'')}</td></tr>`;
  }).join('');
  const errors=result.lines.filter(l=>l.error).length;
  $('fn-results').innerHTML=`<p>${t('fn.summary',{lines:result.lines.length,errors})}</p><table class="sat-table" id="fn-table"><thead><tr><th>№</th><th>${t('fn.formula')}</th><th>${t('fn.value')}</th><th>${t('fn.unit')}</th></tr></thead><tbody>${body}</tbody></table>`;
  $('fn-copy').disabled=false;$('fn-csv').disabled=false;panelCalculated(form);
 };
 $('fn-copy').onclick=()=>{if(!fnResult)return;const tr=uiTranslator.t.bind(uiTranslator);const text=fnResult.lines.flatMap(l=>l.rows?l.rows.map(r=>[l.source,r.argument,r.error?fnMessage(tr,r.error):r.value,l.unit].join('\t')):[[l.source,'',l.error?fnMessage(tr,l.error):l.value,l.unit??''].join('\t')]).join('\n');navigator.clipboard?.writeText(text).catch(()=>{});};
 $('fn-csv').onclick=()=>{if(fnResult)downloadFile(fnProgramCSV(fnResult),'water-functions.csv','text/csv;charset=utf-8');};
 restorePanelInputs('functions',form);restorePanelResult('functions',form);
}
globalThis.document?.addEventListener('languagechange',()=>{if(activeSection==='functions'){capturePanel();showFunctions();}});
