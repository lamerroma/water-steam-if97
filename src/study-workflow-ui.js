import {comparisonSourceState} from './state-comparison.js';
import {studyReadiness} from './study-workflow.js';
function workflowStates(){
 if(['general','saturation'].includes(activeSection))return last?.state?[last.state]:last?.saturation?[last.saturation.liquid,last.saturation.vapor]:[];
 if(panelForm()?.dataset.calculated!=='true')return [];
 if(['turbine','flash'].includes(activeSection)){const r=plottedProcess?.result;return [r?.inlet,r?.outlet].filter(Boolean);}
 if(activeSection==='engineering')return engineeringResult?engineeringStates(engineeringResult).map(([,q])=>q):[];
 if(activeSection==='cycles')return learningResult?.input?.type==='brayton'?[]:learningResult?.states||[];
 if(activeSection==='npp')return nuclearResult?.states||[];
 if(activeSection==='coursework')return courseworkResult?.states||[];
 return [];
}
function workflowAddHistory(event){
 const states=workflowStates();let candidates;try{candidates=states.map((q,i)=>{const model=q.model||modelValue(),source=calculatorHistoryInput(q);comparisonSourceState({name:q.name||'',model,...source,p:q.p,h:q.h});return {...q,model,name:q.name||uiTranslator.t('workflow.stateName',{number:i+1}),source};});}catch(e){studyMessage(e.message);return;}let added=0;
 for(const [i,q] of candidates.entries()){const model=q.model||modelValue();if(historyStates.some(s=>(s.model||'IF97')===model&&s.p===q.p&&Math.abs(s.h-q.h)<1e-9))continue;historyStates.unshift({...q,model,name:q.name||uiTranslator.t('workflow.stateName',{number:i+1}),source:calculatorHistoryInput(q)});added++;}
 historyStates.splice(500);renderHistory();saveProject();if(event?.type==='click'){document.body.classList.add('ui-show-history');document.body.classList.remove('output-collapsed');document.querySelector('.output-pane').scrollIntoView({block:'start'});document.querySelector('#history-body input')?.focus({preventScroll:true});}const message=uiTranslator.t('workflow.historyAdded',{count:added});$('result-status').textContent=message;if($('ui-report-status'))$('ui-report-status').textContent=message;
}
function workflowTargets(){return {plot:{turbine:'process-plot',flash:'process-plot',engineering:'eng-plot',cycles:'cycle-chart',npp:'npp-hs',coursework:'cw-chart',exchanger:'hx-chart',laboratory:'lab-chart'}[activeSection],export:{turbine:'process-csv',flash:'process-csv',engineering:'eng-export',flow:'flow-csv',cycles:'learn-csv',exchanger:'hx-csv',npp:'cycle-states-csv',coursework:'cw-csv',laboratory:'lab-export'}[activeSection]};}
function workflowResultActions(force=false){
 const form=panelForm(),eligible=['turbine','flash','engineering','flow','cycles','exchanger','npp','coursework','laboratory'].includes(activeSection);
 if(!eligible||!form){$('ui-result-actions')?.remove();return;}if($('ui-result-actions')&&!force)return;uiRestoreWorkflowButtons();$('ui-result-actions')?.remove();
 const ready=form.dataset.calculated==='true',bar=document.createElement('div');bar.id='ui-result-actions';bar.className='ui-result-actions';bar.dataset.i18nIgnore='';bar.dataset.ready=String(ready);
 const state=document.createElement('p');state.id='workflow-result-state';state.setAttribute('role','status');state.textContent=uiTranslator.t(ready?'workflow.ready':form.dataset.workflowTouched?'workflow.stale':'workflow.empty');bar.append(state);
 const actions=document.createElement('div');actions.className='feature-actions';const targets=workflowTargets();
 const nativeReport=document.querySelector('#cw-report,#lab-report,#npp-add-report,#hx-report,#cycle-report');
 const add=(key,action,disabled,id,native)=>{let b;if(ready&&native){b=uiAdoptWorkflowButton(native,key);}else{b=document.createElement('button');b.type='button';b.textContent=uiTranslator.t(key);b.id=id;b.onclick=action;b.disabled=disabled;}b.dataset.workflowAction=key;actions.append(b);return b;};
 if(['turbine','flash','engineering','cycles','npp','coursework'].includes(activeSection)){const history=add('workflow.toHistory',workflowAddHistory,!ready||!workflowStates().length,'workflow-history',$('eng-history'));history.onclick=workflowAddHistory;}
 const report=add('workflow.toReport',captureStudyCalculation,!ready,'workflow-report',nativeReport);report.classList.add('ui-secondary-action');
 // Keep the original buttons and handlers, removing duplicate controls from the result.
 if(targets.plot&&$(targets.plot)){const native=$(targets.plot);add('workflow.toDiagram',()=>{if(native.tagName==='CANVAS'){native.tabIndex=0;native.scrollIntoView({block:'center'});native.focus({preventScroll:true});}else native.click();},!ready||native.disabled,'workflow-diagram',native.tagName==='BUTTON'?native:null);}
 if(targets.export&&$(targets.export))add('workflow.export',()=>$(targets.export)?.click(),!ready||$(targets.export).disabled,'workflow-export',$(targets.export));else if(workflowStates().length||activeSection==='exchanger')add('workflow.export',workflowExportCSV,!ready,'workflow-export');
 add('calculator.openReport',showStudyReport,false,'workflow-open-report');const status=document.createElement('span');status.id='ui-report-status';status.setAttribute('role','status');bar.append(actions,status);form.after(bar);
}
function workflowCalculatorStatus(ready,edited){const node=$('workflow-calculator-status');if(node){if(ready)node.dataset.edited='false';else if(edited!==undefined)node.dataset.edited=String(edited);node.dataset.ready=String(ready);node.textContent=uiTranslator.t(ready?'workflow.ready':node.dataset.edited==='true'?'workflow.stale':'workflow.empty');}}
function workflowReportReview(){
 const host=$('study-review');if(!host)return;host.replaceChildren();const summary=studyReadiness(studyReport);host.dataset.ready=String(summary.issues.length===0);const heading=document.createElement('h3');heading.textContent=uiTranslator.t('workflow.review');host.append(heading);const intro=document.createElement('p');intro.textContent=uiTranslator.t(summary.issues.length?'workflow.reviewNote':'workflow.reviewReady');host.append(intro);
 const list=document.createElement('ul');for(const issue of summary.issues){const item=document.createElement('li'),text=uiTranslator.t('workflow.missing.'+issue.key,{number:(issue.index??0)+1});if(issue.target){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>workflowFocus(issue.target,issue.key==='comment'?'textarea':'input');item.append(b);}else item.textContent=text;list.append(item);}host.append(list);
 const outline=$('study-outline');outline.replaceChildren();outline.setAttribute('aria-label',uiTranslator.t('workflow.outline',{count:summary.count}));const title=document.createElement('h3');title.textContent=uiTranslator.t('workflow.outline',{count:summary.count});outline.append(title);
 for(const [i,entry] of studyReport.entries.entries()){const b=document.createElement('button');b.type='button';b.textContent=String(i+1)+'. '+(entry.title.trim()||reportKindLabel(entry.kind,uiTranslator.language));b.onclick=()=>workflowFocus('study-block-'+i);outline.append(b);}
}
function workflowFocus(id,selector){const target=$(id);if(!target)return;const field=target.matches('input,textarea')?target:target.querySelector(selector||'input,textarea')||target.querySelector('button');target.scrollIntoView({block:'start'});field?.focus({preventScroll:true});}
$('calculator-history').onclick=workflowAddHistory;$('calculator-diagram').onclick=()=>{workflowAddHistory();showProcess('hsdiagram');};$('calculator-export').onclick=()=>{$('export-csv').click();};
document.addEventListener('languagechange',()=>{workflowResultActions(true);workflowCalculatorStatus(!!last);workflowReportReview();});

function workflowExportCSV(){
 if(panelForm()?.dataset.calculated!=='true')return;
 const output=[['state','model','property','value','unit']];
 for(const [i,q] of workflowStates().entries())for(const [key,unit] of [['p','MPa abs'],['T','K'],['h','kJ/kg'],['s','kJ/(kg K)'],['x','fraction']])output.push([q.name||String(i+1),q.model||modelValue(),key,q[key]??'',unit]);
 if(activeSection==='exchanger'&&exchangerResult){const r=evaluateReportEntry({kind:'exchanger',input:exchangerResult.input});for(const [key,value,unit] of r.rows)output.push(['exchanger','LMTD',key,value??'',unit]);}
 const cell=v=>'"'+(typeof v==='number'?String(v):String(v??'').replace(/^[=+\-@]/,"'$&")).replaceAll('"','""')+'"';downloadFile('\uFEFF'+output.map(row=>row.map(cell).join(';')).join('\r\n'),'calculation-results.csv','text/csv;charset=utf-8');
}
