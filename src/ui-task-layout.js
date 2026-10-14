// Restore native actions before replacing result HTML so IDs resolve to the new controls.
function uiBeforeResultRender(){uiRestoreWorkflowButtons();$('ui-result-actions')?.remove();}
// Present existing controls in the order of a user's task; no model inputs change.
function uiTaskLayout(){
 const form=panelForm();if(form&&!document.body.classList.contains('diagram-active')){
  const root=form.closest('.method')||form.parentElement;
  if(root&&!root.querySelector(':scope > .ui-method-notes')){
   const paragraphs=[...root.children].filter(el=>el.tagName==='P'&&!el.id&&!el.hasAttribute('role')&&!!(el.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING));
   if(paragraphs.length){const details=document.createElement('details');details.className='ui-method-notes';const summary=document.createElement('summary');summary.dataset.i18n='ux.methodNotes';summary.textContent=uiTranslator.t('ux.methodNotes');details.append(summary);paragraphs[0].before(details);details.append(...paragraphs);}
  }
  for(const table of root.querySelectorAll('table')){if(table.closest('form,.sat-scroll,.table-scroll,.ui-table-scroll,#batch-results'))continue;const scroll=document.createElement('div');scroll.className='ui-table-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label',uiTranslator.t('ux.tableScroll'));table.before(scroll);scroll.append(table);}
  const submit=form.querySelector('button[type=submit],button:not([type])');if(submit)submit.classList.add('ui-primary-action');
 }
}
function uiRestoreWorkflowButtons(){
 const bar=$('ui-result-actions');if(!bar)return;for(const button of bar.querySelectorAll('[data-workflow-original]')){const saved=button.uiWorkflowOrigin;if(saved?.marker.isConnected){saved.marker.replaceWith(button);button.textContent=saved.text;button.disabled=saved.disabled;}delete button.dataset.workflowOriginal;delete button.uiWorkflowOrigin;}
}
function uiAdoptWorkflowButton(button,key){
 const marker=document.createComment('result action');button.before(marker);button.uiWorkflowOrigin={marker,text:button.textContent,disabled:button.disabled};button.dataset.workflowOriginal='true';button.dataset.workflowAction=key;button.textContent=uiTranslator.t(key);return button;
}
function uiTaskInitialize(){
 document.body.classList.add('ui-task-layout','setup-collapsed');const back=document.createElement('button');back.id='ui-back-to-tools';back.type='button';back.textContent=uiTranslator.t('ux.backToTools');back.hidden=scrollY<400;back.onclick=()=>{document.querySelector('.tool-navigation').scrollIntoView({block:'start'});const target=$('section-select').getClientRects().length?$('section-select'):$('tool-search');target.focus({preventScroll:true});};document.body.append(back);window.addEventListener('scroll',()=>{back.hidden=scrollY<400;},{passive:true});document.addEventListener('languagechange',()=>back.textContent=uiTranslator.t('ux.backToTools'));
 const options=document.createElement('div');options.className='ui-input-options';$('input-style-toggle').parentElement.before(options);options.append($('input-style-toggle'),$('smart-swap'));const quick=document.querySelector('.quick-modes'),heading=document.createElement('div');heading.className='ui-input-heading';quick.before(heading);heading.append(quick,options);$('input-style-toggle').parentElement.classList.add('ui-input-options');
 const tools=$('calculator-result-tools');tools.append($('copy-result-table'),$('copy-result-json'));const copied=document.createElement('span');copied.id='ui-copy-status';copied.setAttribute('role','status');copied.dataset.i18nIgnore='';tools.append(copied);let waitingForCopy=false;document.addEventListener('click',event=>{waitingForCopy=!!event.target.closest('[data-copy],#copy-result-table,#copy-result-json');if(waitingForCopy)copied.textContent='';},true);document.addEventListener('input',()=>{waitingForCopy=false;copied.textContent='';});new MutationObserver(()=>{if(waitingForCopy){copied.textContent=$('result-status').textContent;waitingForCopy=false;}}).observe($('result-status'),{childList:true,subtree:true,characterData:true});
 const close=document.querySelector('.setup-pane h2 [data-action=toggle-setup]');if(close){close.textContent='×';close.setAttribute('aria-label',uiTranslator.t('ux.closeSettings'));close.title=uiTranslator.t('ux.closeSettings');}
 document.querySelector('.setup-pane').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();document.querySelector('.menubar [data-action=toggle-setup]').click();$('ui-units-toggle').focus();}});
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.body.classList.add('ui-search-open');$('tool-search').focus();$('tool-search').select();}});
 document.addEventListener('languagechange',()=>{if(close){close.setAttribute('aria-label',uiTranslator.t('ux.closeSettings'));close.title=uiTranslator.t('ux.closeSettings');}});
 const printed=new Map();window.addEventListener('beforeprint',()=>{for(const note of document.querySelectorAll('.ui-method-notes')){printed.set(note,note.open);note.open=true;}});window.addEventListener('afterprint',()=>{for(const [note,open] of printed)note.open=open;printed.clear();});
 uiTaskLayout();
}
uiTaskInitialize();
