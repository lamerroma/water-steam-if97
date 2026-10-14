import {readStateComparison,stateComparisonTable,stateComparisonCSV,STATE_COMPARISON_FIELDS} from './state-comparison.js';
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
 const tools=$('calculator-result-tools');if(tools)tools.hidden=!last;workflowCalculatorStatus(!!last);
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

// Object identity keeps selections attached to records when a new state is inserted.
function calculatorSelection(){return calculatorSelection.records||(calculatorSelection.records=new Set());}
function syncCalculatorSelection(){const selected=calculatorSelection();for(const q of selected)if(!historyStates.includes(q))selected.delete(q);const count=selected.size;if($('history-compare')){$('history-compare').disabled=count<2;$('history-compare').textContent=uiTranslator.t('comparison.open',{count});}if($('history-selection-clear'))$('history-selection-clear').disabled=count===0;}
function comparisonFromHistory(){return readStateComparison({states:[...calculatorSelection()].map((q,i)=>({name:q.name||uiTranslator.t('calculator.historyState',{number:historyStates.length-historyStates.indexOf(q)}),model:q.model||'IF97',...calculatorHistoryInput(q),p:q.p,h:q.h})),reference:0,units:uiUnitPreferences,pressure:pressureSettings});}
function showStateComparison(saved){
 let input;try{input=readStateComparison(saved||comparisonFromHistory());}catch(e){$('result-status').textContent=e.message;return;}
 $('state-comparison-dialog')?.remove();const previous=document.activeElement,dialog=document.createElement('dialog');dialog.id='state-comparison-dialog';dialog.dataset.i18nIgnore='';const heading=document.createElement('h2');heading.textContent=uiTranslator.t('comparison.title');const reference=document.createElement('select');reference.id='comparison-reference';const label=document.createElement('label');label.textContent=uiTranslator.t('comparison.reference');for(const [i,q] of input.states.entries())reference.append(new Option(q.name||String(i+1),String(i)));reference.value=String(input.reference);label.append(reference);const note=document.createElement('p');note.textContent=uiTranslator.t('comparison.note')+' '+uiTranslator.t('comparison.scroll');const scroll=document.createElement('div');scroll.className='comparison-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label',uiTranslator.t('comparison.title'));const actions=document.createElement('div');actions.className='feature-actions';const status=document.createElement('p');status.id='comparison-status';status.setAttribute('role','status');
 const paint=()=>{const table=stateComparisonTable(input,uiTranslator.language);scroll.innerHTML='<table id="state-comparison-table"><thead><tr>'+table.headers.map(h=>'<th scope="col">'+escapeHTML(h)+'</th>').join('')+'</tr></thead><tbody>'+table.rows.map((row,i)=>'<tr data-comparison-property="'+STATE_COMPARISON_FIELDS[i][0]+'">'+row.map((v,j)=>(j===0?'<th scope="row">':'<td>')+escapeHTML(typeof v==='number'?format(v):v??'—')+(j===0?'</th>':'</td>')).join('')+'</tr>').join('')+'</tbody></table>';};
 reference.onchange=()=>{input={...input,reference:Number(reference.value)};paint();};
 for(const [id,key,fn] of [['comparison-csv','comparison.csv',()=>downloadFile(stateComparisonCSV(input,uiTranslator.language),'state-comparison.csv','text/csv;charset=utf-8')],['comparison-report','comparison.report',()=>{const count=studyReport.entries.length;appendStudyEntry({kind:'comparison',title:uiTranslator.t('comparison.title'),input,model:input.states[0].model});status.textContent=studyReport.entries.length>count?uiTranslator.t('comparison.added'):uiTranslator.text('Додайте розрахунки до звіту');}],['comparison-close','calculator.close',()=>dialog.close()]]){const b=document.createElement('button');b.type='button';b.id=id;b.textContent=uiTranslator.t(key);b.onclick=fn;actions.append(b);}
 dialog.addEventListener('close',()=>{dialog.remove();previous?.focus();});dialog.append(heading,label,note,actions,status,scroll);document.body.append(dialog);paint();dialog.showModal();reference.focus();
}
function calculatorRepeatDraft(){}
function repeatCalculatorHistory(index){const q=historyStates[index];if(!q)return;openCalculatorHistoryState(index);invalidate();calculatorRepeatDraft.recordName=((q.name||uiTranslator.t('calculator.historyState',{number:historyStates.length-index}))+' '+uiTranslator.t('comparison.copySuffix')).slice(0,80);$('result-status').textContent=uiTranslator.t('comparison.repeatNotice');$('input-a').focus();$('input-a').scrollIntoView({block:'nearest'});}
$('history-body').addEventListener('change',event=>{const checkbox=event.target;if(checkbox.dataset.historySelect==null)return;const q=historyStates[Number(checkbox.dataset.historySelect)],selected=calculatorSelection();if(checkbox.checked){if(selected.size>=5){checkbox.checked=false;$('result-status').textContent=uiTranslator.t('comparison.limit');return;}selected.add(q);}else selected.delete(q);syncCalculatorSelection();});
$('history-compare').onclick=()=>showStateComparison();$('history-selection-clear').onclick=()=>{calculatorSelection().clear();renderHistory();};
function calculatorNameSuggestions(){const list=$('calculator-state-names');list.replaceChildren();for(const key of ['beforeTurbine','afterTurbine','afterPump','beforeBoiler']){const option=document.createElement('option');option.value=uiTranslator.t('comparison.'+key);list.append(option);}}
calculatorNameSuggestions();document.addEventListener('languagechange',calculatorNameSuggestions);
