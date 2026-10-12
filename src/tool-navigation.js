export const TOOL_GROUPS=[
 {id:'properties',key:'nav.properties',actions:['general','saturation','satgrid','gases','humid','ice','d2o','seawater','boundaries','comparison']},
 {id:'processes',key:'nav.processes',actions:['turbine','flash','engineering','cycles','ts','hsdiagram','phdiagram']},
 {id:'heat',key:'nav.heat',actions:['flow','exchanger']},
 {id:'learning',key:'nav.learning',actions:['tutorials','laboratory','coursework','npp','research','help']},
 {id:'projects',key:'nav.projects',actions:['projects','study','batch']}
];
export function toolSearchMatch(query,label,action){return (label+' '+action).normalize('NFKC').toLocaleLowerCase().includes(query.trim().normalize('NFKC').toLocaleLowerCase());}
export function recentTools(items,action){const valid=TOOL_GROUPS.flatMap(g=>g.actions);return [action,...(Array.isArray(items)?items:[])].filter((v,i,a)=>valid.includes(v)&&a.indexOf(v)===i).slice(0,5);}
function initializeToolNavigation(){
 const tabs=[...document.querySelectorAll('[role=tab]')],tablist=document.querySelector('.tabs'),nav=document.createElement('section');nav.className='tool-navigation';nav.setAttribute('aria-label',uiTranslator.t('nav.tools'));
 nav.innerHTML='<div class="tool-group-bar"></div><label class="tool-search"><span data-i18n="nav.search"></span><input id="tool-search" type="search" autocomplete="off"></label><div class="recent-tools" data-i18n-ignore></div><p id="tool-search-status" role="status" data-i18n-ignore hidden></p>';
 nav.querySelector('[data-i18n="nav.search"]').textContent=uiTranslator.t('nav.search');tablist.before(nav);let group=TOOL_GROUPS[0].id,recent=[];try{recent=recentTools(JSON.parse(localStorage.getItem('thermocalc-recent-tools')||'[]'),activeSection);}catch{}
 const picker=$('section-select');picker.replaceChildren();for(const g of TOOL_GROUPS){const options=document.createElement('optgroup');options.dataset.groupKey=g.key;options.label=uiTranslator.t(g.key);for(const action of g.actions){const tab=tabs.find(t=>t.dataset.action===action);options.append(new Option(sourceUIText(tab).trim(),action));}picker.append(options);}
 for(const g of TOOL_GROUPS){const b=document.createElement('button');b.type='button';b.dataset.toolGroup=g.id;b.dataset.i18n=g.key;b.textContent=uiTranslator.t(g.key);b.onclick=()=>{group=g.id;$('tool-search').value='';refresh();};nav.querySelector('.tool-group-bar').append(b);}
 function refresh(){const query=$('tool-search').value.trim(),g=TOOL_GROUPS.find(g=>g.id===group);let count=0;for(const tab of tabs){const visible=query?toolSearchMatch(query,tab.textContent,tab.dataset.action):g.actions.includes(tab.dataset.action);tab.hidden=!visible;tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1;if(visible)count++;}
 const visibleTabs=tabs.filter(t=>!t.hidden),focusTab=visibleTabs.find(t=>t.getAttribute('aria-selected')==='true')||visibleTabs[0];for(const tab of tabs)tab.tabIndex=tab===focusTab?0:-1;for(const opt of picker.querySelectorAll('optgroup'))opt.label=uiTranslator.t(opt.dataset.groupKey);
 for(const b of nav.querySelectorAll('[data-tool-group]'))b.setAttribute('aria-pressed',String(!query&&b.dataset.toolGroup===group));
 $('tool-search').setAttribute('aria-label',uiTranslator.t('nav.search'));$('tool-search').placeholder=uiTranslator.t('nav.placeholder');$('tool-search-status').hidden=!query;$('tool-search-status').textContent=count?uiTranslator.t('nav.found',{count}):uiTranslator.t('nav.empty');
 const list=nav.querySelector('.recent-tools');list.replaceChildren();if(recent.length){const label=document.createElement('span');label.textContent=uiTranslator.t('nav.recent');list.append(label);for(const action of recent){const tab=tabs.find(t=>t.dataset.action===action),b=document.createElement('button');b.textContent=tab.textContent;b.dataset.i18nIgnore='';b.dataset.recentTool=action;b.onclick=()=>openSection(action);list.append(b);}}
 }
 function sync(){const selected=tabs.find(t=>t.getAttribute('aria-selected')==='true');if(!selected)return;const action=selected.dataset.action;group=TOOL_GROUPS.find(g=>g.actions.includes(action)).id;recent=recentTools(recent,action);try{localStorage.setItem('thermocalc-recent-tools',JSON.stringify(recent));}catch{}refresh();}
 $('tool-search').oninput=refresh;$('tool-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();tabs.find(t=>!t.hidden)?.click();}if(e.key==='Escape'){$('tool-search').value='';refresh();}};
 new MutationObserver(sync).observe(tablist,{subtree:true,attributes:true,attributeFilter:['aria-selected']});document.addEventListener('languagechange',()=>{translateUI(nav);refresh();});sync();translateUI(nav);
}
