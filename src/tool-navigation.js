import {TOOL_CATALOG,toolMatches,toolStatus} from './tool-catalog.js';
export const TOOL_GROUPS=[
 {id:'properties',key:'nav.properties',actions:['general','saturation','satgrid','gases','humid','ice','d2o','seawater','boundaries','comparison']},
 {id:'processes',key:'nav.processes',actions:['turbine','flash','engineering','cycles','ts','hsdiagram','phdiagram']},
 {id:'heat',key:'nav.heat',actions:['flow','exchanger']},
 {id:'learning',key:'nav.learning',actions:['tutorials','laboratory','coursework','npp','research','help']},
 {id:'projects',key:'nav.projects',actions:['projects','study','batch']}
];
export function toolSearchMatch(query,label,action){return toolMatches(query,action,label);}
export function recentTools(items,action){const valid=TOOL_GROUPS.flatMap(g=>g.actions);return [action,...(Array.isArray(items)?items:[])].filter((v,i,a)=>valid.includes(v)&&a.indexOf(v)===i).slice(0,5);}
function initializeToolNavigation(){
 const tabs=[...document.querySelectorAll('[role=tab]')],tablist=document.querySelector('.tabs'),picker=$('section-select');
 const nav=document.createElement('section');nav.className='tool-navigation';nav.dataset.i18nIgnore='';nav.setAttribute('aria-label',uiTranslator.t('nav.tools'));
 nav.innerHTML='<div class="tool-group-bar"></div><label class="tool-group-picker"><span></span><select id="tool-group-select"></select></label><div class="tool-finder"><label class="tool-search"><span></span><input id="tool-search" type="search" autocomplete="off"></label><button id="tool-catalog-toggle" type="button" aria-expanded="false" aria-controls="tool-catalog"></button></div><div class="recent-tools"></div><p id="tool-search-status" role="status" hidden></p>';
 tablist.before(nav);let group=TOOL_GROUPS[0].id,recent=[];
 try{recent=recentTools(JSON.parse(localStorage.getItem('thermocalc-recent-tools')||'[]'),activeSection);}catch{}
 const title=action=>uiTranslator.t('tool.'+action+'.name');
 const mainScroll=$('calculator-view').parentElement,catalog=document.createElement('section');catalog.id='tool-catalog';catalog.className='tool-catalog';catalog.hidden=true;catalog.dataset.i18nIgnore='';
 const guide=document.createElement('section');guide.id='tool-context';guide.className='tool-context';guide.dataset.i18nIgnore='';mainScroll.insertBefore(catalog,$('process-view'));
 picker.dataset.i18nIgnore='';picker.replaceChildren();for(const g of TOOL_GROUPS){const options=document.createElement('optgroup');options.dataset.groupKey=g.key;for(const action of g.actions)options.append(new Option(title(action),action));picker.append(options);
 const button=document.createElement('button');button.type='button';button.dataset.toolGroup=g.id;button.onclick=()=>chooseGroup(g.id);nav.querySelector('.tool-group-bar').append(button);$('tool-group-select').append(new Option(uiTranslator.t(g.key),g.id));}
 const chooseGroup=id=>{group=id;$('tool-search').value='';refresh();};$('tool-group-select').onchange=()=>chooseGroup($('tool-group-select').value);
 function matched(action){return toolSearchMatch($('tool-search').value,title(action)+' '+uiTranslator.t('tool.'+action+'.description'),action);}
 function renderCatalogue(){
  if(catalog.hidden)return;catalog.replaceChildren();const heading=document.createElement('h2');heading.textContent=uiTranslator.t('catalog.title');catalog.append(heading);
  const query=$('tool-search').value.trim(),actions=query?tabs.map(t=>t.dataset.action).filter(matched):TOOL_GROUPS.find(g=>g.id===group).actions;
  const info=document.createElement('p');info.textContent=uiTranslator.t('catalog.results',{count:actions.length});catalog.append(info);
  if(!actions.length){info.textContent=uiTranslator.t('catalog.empty');return;}
  const grid=document.createElement('div');grid.className='tool-card-grid';for(const action of actions){const card=document.createElement('button');card.type='button';card.dataset.catalogAction=action;card.className='tool-card';const name=document.createElement('strong'),description=document.createElement('span'),badge=document.createElement('small');name.textContent=title(action);description.textContent=uiTranslator.t('tool.'+action+'.description');badge.textContent=uiTranslator.t('catalog.status.'+TOOL_CATALOG[action].status);badge.className='method-badge '+TOOL_CATALOG[action].status;card.append(name,description,badge);card.onclick=()=>{catalog.hidden=true;$('tool-catalog-toggle').setAttribute('aria-expanded','false');$('tool-search').value='';openSection(action);refresh();const selected=document.querySelector('[role=tab][aria-selected=true]');(selected?.offsetParent?selected:picker).focus({preventScroll:true});};grid.append(card);}catalog.append(grid);
 }
 function context(){
  const action=activeSection;if(!TOOL_CATALOG[action])return;const host=['general','saturation'].includes(action)?$('calculator-view'):action==='help'?$('help-view'):$('process-view');if(guide.parentElement!==host)host.prepend(guide);if(guide.dataset.route!==action){host.scrollTop=0;guide.dataset.route=action;}const form=['general','saturation','help'].includes(action)?null:panelForm(),kind=$('cw-kind')?.value,mode=$('gas-model')?.value,status=toolStatus(action,{kind,model:mode});
  const limitsKey=action==='coursework'&&kind==='reactor'?'catalog.reactorLimits':action==='coursework'&&kind==='core'?'catalog.coreLimits':action==='gases'&&mode==='mixture'?'catalog.mixturesLimits':action==='gases'&&mode==='ideal'?'catalog.idealLimits':'tool.'+action+'.limits';
  const signature=[action,status,uiTranslator.language,form?.dataset.calculated,form?.dataset.model,kind,mode].join('|');if(guide.dataset.context===signature)return;guide.dataset.context=signature;guide.dataset.status=status;guide.replaceChildren();
  const badge=document.createElement('span');badge.className='method-badge '+status;badge.textContent=uiTranslator.t('catalog.status.'+status);const summary=document.createElement('p');summary.className='tool-context-summary';summary.append(badge,document.createTextNode(' '+uiTranslator.t('tool.'+action+'.description')));guide.append(summary);
  // Unconfirmed correlations are visible before calculation, not buried in results.
  if(status==='provisional'||status==='experimental'){const limit=document.createElement('p');limit.className='method-limit';limit.textContent=uiTranslator.t(limitsKey);guide.append(limit);}
  const detail=document.createElement('details'),caption=document.createElement('summary');caption.textContent=uiTranslator.t('catalog.method');detail.append(caption);for(const [key,text] of [['catalog.limits',uiTranslator.t(limitsKey)],['catalog.testing',uiTranslator.t('catalog.'+status+'Note')]]){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=uiTranslator.t(key)+': ';p.append(strong,document.createTextNode(text));detail.append(p);}guide.append(detail);
  if(form&&!['workflow','visual'].includes(status)){const p=document.createElement('p');p.className='tool-workflow';p.id='tool-workflow';p.setAttribute('role','status');p.textContent=form.dataset.calculated==='true'?uiTranslator.t('catalog.calculated',{model:form.dataset.model||modelValue()}):uiTranslator.t('catalog.ready');guide.append(p);}
 }
 function refresh(){
  const query=$('tool-search').value.trim(),g=TOOL_GROUPS.find(g=>g.id===group);let count=0;
  for(const tab of tabs){const action=tab.dataset.action;tab.dataset.i18nIgnore='';tab.textContent=title(action);tab.title=uiTranslator.t('tool.'+action+'.description');tab.hidden=!(query?matched(action):g.actions.includes(action));if(!tab.hidden)count++;}
  const visible=tabs.filter(t=>!t.hidden),focus=visible.find(t=>t.getAttribute('aria-selected')==='true')||visible[0];for(const tab of tabs)tab.tabIndex=tab===focus?0:-1;
  for(const opt of picker.querySelectorAll('optgroup'))opt.label=uiTranslator.t(opt.dataset.groupKey);for(const opt of picker.querySelectorAll('option'))opt.textContent=title(opt.value);
  for(const b of nav.querySelectorAll('[data-tool-group]')){b.textContent=uiTranslator.t(TOOL_GROUPS.find(g=>g.id===b.dataset.toolGroup).key);b.setAttribute('aria-pressed',String(!query&&b.dataset.toolGroup===group));}
  for(const opt of $('tool-group-select').options)opt.textContent=uiTranslator.t(TOOL_GROUPS.find(g=>g.id===opt.value).key);$('tool-group-select').value=group;
  nav.querySelector('.tool-group-picker span').textContent=uiTranslator.t('catalog.group');nav.querySelector('.tool-search span').textContent=uiTranslator.t('nav.search');$('tool-search').setAttribute('aria-label',uiTranslator.t('nav.search'));$('tool-search').placeholder=uiTranslator.t('catalog.tip');
  $('tool-catalog-toggle').textContent=uiTranslator.t(catalog.hidden?'catalog.open':'catalog.close');$('tool-search-status').hidden=!query;$('tool-search-status').textContent=count?uiTranslator.t('nav.found',{count}):uiTranslator.t('nav.empty');
  const list=nav.querySelector('.recent-tools');list.replaceChildren();if(recent.length){const label=document.createElement('span');label.textContent=uiTranslator.t('nav.recent');list.append(label);for(const action of recent){const b=document.createElement('button');b.textContent=title(action);b.dataset.recentTool=action;b.onclick=()=>{catalog.hidden=true;$('tool-catalog-toggle').setAttribute('aria-expanded','false');openSection(action);};list.append(b);}}
  renderCatalogue();context();
 }
 function sync(){const selected=tabs.find(t=>t.getAttribute('aria-selected')==='true');if(!selected)return;const action=selected.dataset.action;catalog.hidden=true;$('tool-catalog-toggle').setAttribute('aria-expanded','false');group=TOOL_GROUPS.find(g=>g.actions.includes(action)).id;recent=recentTools(recent,action);try{localStorage.setItem('thermocalc-recent-tools',JSON.stringify(recent));}catch{}refresh();}
 $('tool-catalog-toggle').onclick=()=>{catalog.hidden=!catalog.hidden;$('tool-catalog-toggle').setAttribute('aria-expanded',String(!catalog.hidden));refresh();if(!catalog.hidden)catalog.scrollIntoView({block:'start'});};
 $('tool-search').oninput=()=>{if($('tool-search').value.trim()){catalog.hidden=false;$('tool-catalog-toggle').setAttribute('aria-expanded','true');}refresh();};
 $('tool-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const tab=tabs.find(t=>!t.hidden);if(tab){catalog.hidden=true;$('tool-catalog-toggle').setAttribute('aria-expanded','false');tab.click();refresh();}}if(e.key==='Escape'){$('tool-search').value='';catalog.hidden=true;$('tool-catalog-toggle').setAttribute('aria-expanded','false');refresh();}};
 new MutationObserver(sync).observe(tablist,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
 // A context signature prevents feedback when the guide is moved or rendered.
 for(const panel of [$('calculator-view'),$('process-view'),$('help-view')])new MutationObserver(context).observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['data-calculated','data-model']});
 document.addEventListener('change',context);document.addEventListener('input',context);document.addEventListener('languagechange',refresh);sync();
}
