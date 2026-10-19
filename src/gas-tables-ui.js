import {BSW2003_SPECIES,BSW2003_DATA,bswComposition} from './gas-bsw2003.js';
import {gasTableRows,gasCompositionRows} from './gas-table-rows.js';
// This panel uses the shared cancellable worker and canonical input-unit adapters.
const gasTablesRunner=createCalculationRunner(createCalculatorWorker);
let gasTablesSequence=0;
function cancelGasTables(){++gasTablesSequence;gasTablesRunner.cancel();const f=$('learn-form');if(f){f.removeAttribute('aria-busy');const b=f.querySelector('button[type=submit]');if(b&&$('gas-model')?.value==='bsw2003')b.disabled=false;}if($('gas-cancel'))$('gas-cancel').hidden=true;}
window.addEventListener('pagehide',()=>gasTablesRunner.cancel());
function gasFractionScale(){return $('gas-fraction-scale')?.value==='percent'?100:1;}
function initializeGasTableControls(){
 let oldScale=$('gas-fraction-scale').value;
 const scaleText=()=>{const key=$('gas-fraction-scale').value==='percent'?'gas.percentHelp':'gas.fractionHelp';$('gas-fraction-help').dataset.i18n=key;$('gas-fraction-help').textContent=uiTranslator.t(key);};
 $('gas-fraction-scale').onchange=()=>{
  if(!restoringWorkspace){try{const from=oldScale==='percent'?100:1,to=gasFractionScale(),values=GAS_DATA.map(d=>[d.id,learnNumber('fraction-'+d.id)]);for(const [id,value]of values)uiSetValue($('fraction-'+id),String(value*to/from));}catch(e){$('gas-fraction-scale').value=oldScale;$('learn-error').textContent=e.message;$('learn-error').hidden=false;}}
  oldScale=$('gas-fraction-scale').value;scaleText();
 };
 $('gas-dissociation').onchange=()=>updateGasTableControls();
 $('gas-cancel').onclick=()=>{cancelGasTables();$('learn-error').hidden=false;$('learn-error').textContent=uiTranslator.t('calculator.cancelled');};
 scaleText();return ()=>{oldScale=$('gas-fraction-scale').value;scaleText();};
}
function updateGasTableControls(modelChange=false){
 const bsw=$('gas-model').value==='bsw2003';
 $('gas-dissociation-choice').hidden=!bsw;
 const enabled=bsw&&$('gas-dissociation').value==='vdi4670';
 $('gas-dissociation-fields').hidden=!enabled;
 for(const id of ['gas-combustion','gas-excess-air'])$(id).disabled=!enabled;
 if(modelChange&&bsw&&!restoringWorkspace&&$('gas-fraction-scale').value==='fraction'){$('gas-fraction-scale').value='percent';$('gas-fraction-scale').dispatchEvent(new Event('change',{bubbles:true}));}
 for(const d of GAS_DATA){const el=$('fraction-'+d.id);if(bsw&&!BSW2003_SPECIES.includes(d.id))el.closest('label').hidden=Number(el.value)===0;}
 for(const o of $('gas-preset').options)o.disabled=bsw&&GAS_DATA.some(d=>d.id===o.value)&&!BSW2003_SPECIES.includes(o.value);
 $('gas-fraction-scale').closest('label').hidden=$('gas-model').value==='real';
 if(bsw||$('gas-model').value==='ideal'){const b=$('learn-form').querySelector('button[type=submit]');b.disabled=$('learn-form').getAttribute('aria-busy')==='true';b.textContent=uiTranslator.t('gas.calculate');}
}
async function submitBSWGas(form){
 cancelGasTables();const sequence=gasTablesSequence,mode=$('gas-mode').value,p=learnNumber('gas-p'),value=learnNumber('gas-b'),fractions=readGasFractions(),basis=$('gas-basis').value;
 form.setAttribute('aria-busy','true');form.querySelector('button[type=submit]').disabled=true;$('gas-cancel').hidden=false;
 try{const q=await gasTablesRunner.gasTable(mode,p,value,fractions,basis,$('gas-dissociation').value==='vdi4670'?{dissociation:true,combustion:$('gas-combustion').value,excessAirLambda:learnNumber('gas-excess-air')}:undefined);if(sequence!==gasTablesSequence||!form.isConnected||activeSection!=='gases')return null;return q;}
 catch(e){if(e.code==='cancelled'||sequence!==gasTablesSequence)return null;throw e;}
 finally{if(sequence===gasTablesSequence&&form.isConnected){form.removeAttribute('aria-busy');form.querySelector('button[type=submit]').disabled=false;$('gas-cancel').hidden=true;}}
}
function renderGasTableExtras(q){
 const rows=gasCompositionRows(q),table=document.createElement('div');table.id='gas-composition-result';table.innerHTML='<table class="sat-table"><thead><tr><th>'+uiTranslator.t('gas.component')+'</th><th>'+uiTranslator.t('gas.molePercent')+'</th><th>'+uiTranslator.t('gas.massPercent')+'</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+escapeHTML(typeof v==='number'?format(v):v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 if(q.dissociationApplied){const note=document.createElement('p');note.dataset.i18n='gas.initialComposition';note.textContent=uiTranslator.t('gas.initialComposition');$('learn-output').append(note);}
 $('learn-output').append(table);
 attachSpreadsheetExport($('learn-csv'),spreadsheetOptions('gas-spreadsheet',()=>gasTabular(q,panelInputs($('learn-form')),spreadsheetContext('gas / BSW2003',q.model),uiUnitPreferences)));
}

function refreshGasTableResult(){if(currentPanelKind==='gases'&&learningResult?.modelId?.startsWith('BSW2003-')&&$('learn-output'))renderLearning('gases',learningResult);}

function gasDissociationControlsHTML(){return `<label id="gas-dissociation-choice" hidden><span data-i18n="gas.dissociationLabel">Дисоціація</span><select id="gas-dissociation"><option value="off" data-i18n="gas.dissociationOff">Не враховувати</option><option value="vdi4670" data-i18n="gas.dissociationOn">Калорична поправка VDI4670 · дослідна</option></select></label><div id="gas-dissociation-fields" hidden><p data-i18n="gas.dissociationHelp"></p><div class="process-grid"><label><span data-i18n="gas.combustionLabel">Умови утворення газу</span><select id="gas-combustion"><option value="unspecified" data-i18n="gas.combustionUnknown">Не задано</option><option value="complete-air" data-i18n="gas.combustionAir">Повне згоряння у звичайному повітрі</option></select></label><label><span data-i18n="gas.excessAirLabel">Коефіцієнт надлишку повітря λ</span><input id="gas-excess-air" value="1.2" inputmode="decimal"></label></div></div>`;}
