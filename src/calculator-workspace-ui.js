function calculatorManualCopy(content,title){
 $('copy-result-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='copy-result-dialog';const heading=document.createElement('h2');heading.textContent=title||uiTranslator.t('calculator.manualCopy');const area=document.createElement('textarea');area.dataset.i18nIgnore='';area.readOnly=true;area.value=content;area.setAttribute('aria-label',uiTranslator.t('calculator.copyContent'));const close=document.createElement('button');close.textContent=uiTranslator.t('calculator.close');const previous=document.activeElement;close.onclick=()=>{dialog.close();dialog.remove();previous?.focus();};dialog.addEventListener('cancel',()=>{dialog.remove();previous?.focus();});dialog.append(heading,area,close);document.body.append(dialog);dialog.showModal();area.focus();area.select();
}
async function calculatorCopyProperty(button){
 if(!last)return;let q;
 if(button.dataset.copyPhase)q=last.saturation?.[button.dataset.copyPhase];
 else q=button.dataset.alternative==null?last.state:last.alternatives?.[Number(button.dataset.alternative)];
 if(!q)return;q=ambientResult({state:q}).state;
 const key=button.dataset.copy,row=rows.find(r=>r[0]===key);if(!row)return;
 const [value,unit]=display(key,key==='T'?q.T-273.15:q[key],row[3]),content=calculatorCopyValue(value,uiTranslator.text(unit),{digits:displayDigits,locale:uiTranslator.numberLocale,includeUnit:$('calculator-copy-units').checked});if(content===null)return;
 try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(content);$('result-status').textContent=uiTranslator.t('calculator.copied',{value:content});}
 catch{calculatorManualCopy(content,uiTranslator.t('calculator.manualProperty',{property:uiTranslator.text(row[1])}));}
}
function calculatorResultSummary(result){
 if(!result.state)return '';const s=result.state,keys=['p','T','h','s','rho',Number.isFinite(s.x)?'x':'v'];
 return '<section id="calculator-result-summary" aria-label="'+escapeHTML(uiTranslator.t('calculator.keyResults'))+'">'+keys.map(key=>{const row=rows.find(r=>r[0]===key),name=key==='p'?'Тиск ('+pressureBasisLabel()+')':row[1],[value,unit]=display(key,key==='T'?s.T-273.15:s[key],row[3]);return '<button type="button" data-copy="'+key+'" aria-label="'+escapeHTML(uiTranslator.t('calculator.copyProperty',{property:uiTranslator.text(name)}))+'"><span>'+escapeHTML(uiTranslator.text(name))+'</span><strong>'+escapeHTML(format(value))+'</strong><small>'+escapeHTML(uiTranslator.text(unit))+'</small></button>';}).join('')+'</section>';
}
function calculatorErrorSummary(){
 const summary=$('calculator-error-summary');if(!summary)return;const fields=[...$('input-fields').children].map(row=>row.querySelector('input')).filter(input=>input?.getAttribute('aria-invalid')==='true');const signature=JSON.stringify([uiTranslator.language,...fields.map(input=>[input.id,$('label-'+input.id.at(-1)).textContent,$('input-error-'+input.id.at(-1)).textContent])]);if(summary.dataset.errors===signature)return;summary.dataset.errors=signature;summary.replaceChildren();summary.hidden=!fields.length;if(!fields.length)return;
 const intro=document.createElement('p');intro.textContent=uiTranslator.t('calculator.errorSummary',{count:fields.length});summary.append(intro);
 for(const input of fields){const b=document.createElement('button');b.type='button';const letter=input.id.at(-1);b.textContent=$('label-'+letter).textContent+' '+$('input-error-'+letter).textContent;b.onclick=()=>{input.focus();input.scrollIntoView({block:'nearest'});};summary.append(b);}
}
function syncCalculatorResultTools(){
 const tools=$('calculator-result-tools');if(tools)tools.hidden=!last;
}
function openCalculatorHistoryState(index){
 const q=historyStates[index];if(!q)return;const source=calculatorHistoryInput(q);selectModel(q.model||'IF97');selectView('general');$('mode').value=source.mode;resetMode();
 $('input-a').value=String(pressureOutput(source.a,$('unit-a').value,pressureSettings));if(!$('input-b').disabled)$('input-b').value=String(pressureOutput(source.b,$('unit-b').value,pressureSettings));
 last={state:q};render();$('result-status').textContent=uiTranslator.t('calculator.historyOpened',{name:q.name||String(historyStates.length-index)});saveProject();
}
function addCalculatorHistoryToReport(index){const q=historyStates[index];if(!q)return;appendStudyEntry({kind:'state',title:q.name||uiTranslator.t('calculator.historyState',{number:historyStates.length-index}),model:q.model||'IF97',input:calculatorHistoryInput(q)});}
$('calculator-add-report').onclick=captureStudyCalculation;
$('calculator-open-report').onclick=showStudyReport;
$('history-clear').onclick=()=>{if(!historyStates.length)return;historyUndo=[...historyStates];historyStates.length=0;renderHistory();saveProject();$('result-status').textContent=uiTranslator.t('calculator.historyCleared');};
