import {studyViewportBounds,studyViewportZoom,studyViewportPan} from './study-viewport.js';

function attachStudyChartWorkspace(q,npp,container,redraw){
 const text=featureText,canvas=$('cycle-chart'),viewer=canvas.closest('.study-viewer');
 const workspace=document.createElement('div');workspace.className='study-chart-workspace';
 const main=document.createElement('div');main.className='study-chart-main';
 const aside=document.createElement('aside');aside.className='study-chart-sidebar';aside.setAttribute('aria-label',text('Налаштування діаграми','Diagram settings'));
 viewer.before(workspace);workspace.append(main,aside);main.append(viewer);
 const intro=container.querySelector(':scope > p');if(intro)intro.remove();
 const settings=container.querySelector('.process-grid');aside.append(settings);const helpDetails=document.createElement('details'),helpSummary=document.createElement('summary');helpSummary.textContent=text('Припущення моделей','Model assumptions');helpDetails.append(helpSummary,$('cycle-path-help'));aside.append(helpDetails);
 const models=$('cycle-path-list').closest('details');aside.append(models);
 const exports=document.createElement('div');exports.className='feature-actions';
 for(const id of ['cycle-picture','cycle-paths-csv','cycle-research','cycle-report'])exports.append($(id));aside.append(exports);
 const inspector=container.parentElement.querySelector('.study-inspector');main.append(inspector);
 // Keep the original state table, so its buttons and values stay synchronized.
 const row=container.parentElement.querySelector('[data-study-row]');let table=row?.closest('.sat-scroll');
 if(row&&!table){table=document.createElement('div');table.className='sat-scroll';const original=row.closest('table');original.before(table);table.append(original);}
 if(table&&!inspector.contains(table)){const states=document.createElement('details');states.className='study-workspace-states';states.open=true;const summary=document.createElement('summary');summary.textContent=text('Стани циклу — виберіть рядок для підсвічування','Cycle states — select a row to highlight');states.append(summary,table);main.append(states);}
 const status=$('cycle-path-status');viewer.querySelector('.study-chart').before(status);
 const legend=document.createElement('p');legend.className='study-line-key';legend.innerHTML=`<span class="line-calculated">${text('Розраховані','Calculated')}</span><span class="line-schematic">${text('Схематичні','Schematic')}</span><span class="line-ideal">${text('Контрольні ізоентропи','Reference isentropes')}</span><span class="line-efficiency">${text('Навчальний ККД','Educational efficiency')}</span>`;status.before(legend);
 const controls=document.createElement('div');controls.className='feature-actions study-viewport-controls';
 const tools=viewer.querySelector('.feature-actions');tools.after(controls);
 const views=new Map();let history=[],timer,pan=false,drag=null;
 const kind=()=>$('cycle-chart-kind').value,chart=()=>Chart.getChart(canvas);
 const actual=()=>{const c=chart();return {xmin:c.scales.x.min,xmax:c.scales.x.max,ymin:c.scales.y.min,ymax:c.scales.y.max};};
 const current=()=>views.get(kind())||actual();
 const button=(id,label,run)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=label;b.onclick=run;controls.append(b);return b;};
 const back=button('cycle-view-back',text('Назад','Back'),()=>{const old=history.pop();if(old){views.set(kind(),old);apply();schedule();}back.disabled=!history.length;});back.disabled=true;
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(container.isConnected)redraw();},180);};
 function apply(){const c=chart(),r=views.get(kind());if(!c||!r)return;Object.assign(c.options.scales.x,{min:r.xmin,max:r.xmax});Object.assign(c.options.scales.y,{min:r.ymin,max:r.ymax});c.update('none');c.$studyViewport={...r};}
 function set(r,remember=true){if(!r||!Object.values(r).every(Number.isFinite)||r.xmax-r.xmin<1e-8||r.ymax-r.ymin<1e-6)return;if(remember){history.push({...current()});if(history.length>20)history.shift();back.disabled=false;}views.set(kind(),{...r});apply();schedule();}
 button('cycle-view-all',text('Увесь графік','Full chart'),()=>{const c=chart();set(studyViewportBounds(c.data.datasets.flatMap(d=>d.data)));});
 button('cycle-view-fit',text(npp?'Другий контур':'Показати цикл',npp?'Secondary loop':'Fit cycle'),()=>{
  const points=chart().data.datasets.filter(d=>d.role!=='ideal').flatMap(d=>{
   if(!npp)return d.data;
   if(d.role==='states')return d.data.filter((_,i)=>i>=2);
   return Number(d.edgeID.split('-')[0])<2?[]:d.data;
  });set(studyViewportBounds(points));
 });
 button('cycle-view-in','＋',()=>set(studyViewportZoom(current(),.7))).setAttribute('aria-label',text('Збільшити масштаб','Zoom in'));
 button('cycle-view-out','−',()=>set(studyViewportZoom(current(),1/.7))).setAttribute('aria-label',text('Зменшити масштаб','Zoom out'));
 const panButton=button('cycle-view-pan',text('Переміщувати','Pan'),()=>{pan=!pan;panButton.setAttribute('aria-pressed',String(pan));canvas.style.touchAction=pan?'none':'pan-y';canvas.style.cursor=pan?'grab':'';});panButton.setAttribute('aria-pressed','false');
 const help=document.createElement('p');help.id='cycle-view-help';help.className='study-viewport-help';help.textContent=text('Масштаб: +/− або Ctrl + колесо. Перетягування: увімкніть «Переміщувати». Клавіатура: стрілки — зсув, 0 — увесь графік. Вибір точки зберігає масштаб.','Zoom: +/− or Ctrl + wheel. Enable Pan to drag. Keyboard: arrows to pan, 0 for the full chart. Selecting a point preserves the view.');viewer.querySelector('.study-chart').after(help);
 canvas.tabIndex=0;canvas.setAttribute('aria-describedby','cycle-view-help cycle-path-status');
 canvas.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const c=chart(),r=canvas.getBoundingClientRect(),a=c.chartArea,x=(e.clientX-r.left)/r.width*c.width,y=(e.clientY-r.top)/r.height*c.height;if(x<a.left||x>a.right||y<a.top||y>a.bottom)return;set(studyViewportZoom(current(),e.deltaY<0?.8:1.25,{x:(x-a.left)/(a.right-a.left),y:1-(y-a.top)/(a.bottom-a.top)}));},{passive:false});
 canvas.addEventListener('keydown',e=>{const moves={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]};if(moves[e.key]){e.preventDefault();set(studyViewportPan(current(),...moves[e.key]));}else if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')$('cycle-view-all').click();else set(studyViewportZoom(current(),e.key==='-'?1/.7:.7));}});
 canvas.addEventListener('pointerdown',e=>{if(!pan||e.button!==0)return;clearTimeout(timer);const c=chart();drag={id:e.pointerId,x:e.clientX,y:e.clientY,range:{...current()},width:c.chartArea.width,height:c.chartArea.height,moved:false};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<4&&!drag.moved)return;if(!drag.moved){history.push({...drag.range});if(history.length>20)history.shift();back.disabled=false;}drag.moved=true;views.set(kind(),studyViewportPan(drag.range,-dx/drag.width,dy/drag.height));apply();});
 const finish=e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(moved){canvas.dataset.studyDragged='true';schedule();setTimeout(()=>{delete canvas.dataset.studyDragged;},0);}};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 // Prevent a pan ending over a state marker from changing the selection.
 canvas.addEventListener('click',e=>{if(canvas.dataset.studyDragged){e.stopImmediatePropagation();e.preventDefault();}},true);
 let lastKind=kind();return {range:k=>views.get(k),refresh(c){if(kind()!==lastKind){history=[];back.disabled=true;lastKind=kind();}if(views.has(kind()))apply();else c.$studyViewport=actual();}};
}
