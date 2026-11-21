// Selection connects computed states, schematic equipment and the study chart.
function attachStudyInteraction(q,container){
 const text=(uk,en)=>featureText(uk,en),root=$('learn-output'),canvas=$('cycle-chart');
 const inspector=document.createElement('section');inspector.className='study-inspector';inspector.dataset.i18nIgnore='';inspector.innerHTML='<h3></h3><div class="study-state-buttons"></div><div class="study-state-details" aria-live="polite"></div>';
 container.prepend(inspector);const selected=new Set();
 function select(names,title){selected.clear();for(const name of names)if(q.states.some(s=>s.name===name))selected.add(name);inspector.querySelector('h3').textContent=title||text('Вибраний стан','Selected state');
 const states=q.states.filter(s=>selected.has(s.name));inspector.querySelector('.study-state-details').innerHTML=`<div class="sat-scroll"><table class="sat-table"><thead><tr><th>${text('Стан','State')}</th><th>p [MPa (abs)]</th><th>T [K]</th><th>h [kJ/kg]</th><th>s [kJ/(kg K)]</th><th>x [–]</th></tr></thead><tbody>${states.map(s=>`<tr><td>${escapeHTML(s.name)}</td>${['p','T','h','s','x'].map(k=>`<td>${format(s[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>${text('Тиск абсолютний. Для кривих дивіться обрану модель лінії; навчальна крива агрегату не є виміряною траєкторією.','Pressure is absolute. See the selected line model; an educational machine curve is not a measured trajectory.')}</p>`;
 for(const status of root.querySelectorAll('.study-viewer-state'))status.textContent=(title||text('Стан','State'))+' · '+states.map(s=>s.name+': p = '+format(s.p)+' MPa (abs), T = '+format(s.T)+' K, h = '+format(s.h)+' kJ/kg, s = '+format(s.s)+' kJ/(kg K)').join(' · ');
 for(const b of inspector.querySelectorAll('[data-study-state]'))b.setAttribute('aria-pressed',String(selected.has(b.dataset.studyState)));
 for(const row of root.querySelectorAll('[data-study-row]')){const hit=selected.has(row.dataset.studyRow);row.classList.toggle('study-selected',hit);row.querySelector('button')?.setAttribute('aria-pressed',String(hit));}
 const chart=Chart.getChart(canvas);if(chart){const points=chart.data.datasets.find(d=>d.pointNames);points.pointRadius=q.states.map(s=>selected.has(s.name)?8:5);points.backgroundColor=q.states.map(s=>selected.has(s.name)?'#d17613':'#18364e');chart.update('none');}
 }
 for(const s of q.states){const b=document.createElement('button');b.textContent=s.name;b.dataset.studyState=s.name;b.onclick=()=>select([s.name]);inspector.querySelector('.study-state-buttons').append(b);}
 canvas.onclick=e=>{const chart=Chart.getChart(canvas);if(!chart)return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*chart.width/rect.width,y=(e.clientY-rect.top)*chart.height/rect.height,area=chart.chartArea;if(x<area.left||x>area.right||y<area.top||y>area.bottom)return;
 const index=chart.data.datasets.findIndex(d=>d.pointNames),dataset=chart.data.datasets[index];let nearest=null,distance=Infinity;
 chart.getDatasetMeta(index).data.forEach((point,i)=>{if(point.skip||point.x<area.left||point.x>area.right||point.y<area.top||point.y>area.bottom)return;const delta=Math.hypot(x-point.x,y-point.y);if(delta<=Math.max(10,point.options.radius+4)&&delta<distance){distance=delta;nearest=i;}});
 if(nearest!==null)select([dataset.pointNames[nearest]]);
 };
 const rows=[...root.querySelectorAll('tbody tr')];for(const row of rows){const name=row.cells[0]?.textContent.trim();if(q.states.some(s=>s.name===name)){row.dataset.studyRow=name;const b=document.createElement('button');b.textContent=name;b.onclick=()=>select([name]);row.cells[0].replaceChildren(b);}}
 addStudyViewer(container.querySelector('.study-chart'));
 const original=$('cycle-chart-kind').onchange;$('cycle-chart-kind').onchange=()=>{original();select([...selected],inspector.querySelector('h3').textContent);};
 select([q.states[0].name]);
}
function addStudyViewer(view){
 const text=(uk,en)=>featureText(uk,en),box=document.createElement('section');box.className='study-viewer';view.before(box);const tools=document.createElement('div');tools.className='feature-actions';const status=document.createElement('p');status.className='study-viewer-state';status.dataset.i18nIgnore='';status.setAttribute('aria-live','polite');box.append(tools,status,view);
 const expand=document.createElement('button');expand.textContent=text('Розгорнути','Expand');expand.setAttribute('aria-expanded','false');let previousFocus;
 const close=()=>{box.classList.remove('study-expanded');expand.textContent=text('Розгорнути','Expand');expand.setAttribute('aria-expanded','false');previousFocus?.focus();};
 expand.onclick=()=>{if(box.classList.contains('study-expanded'))close();else{document.querySelectorAll('.study-expanded').forEach(v=>v.querySelector('[aria-expanded=true]')?.click());previousFocus=document.activeElement;box.classList.add('study-expanded');expand.textContent=text('Згорнути (Esc)','Collapse (Esc)');expand.setAttribute('aria-expanded','true');}};
 box.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation();}if(e.key==='Tab'&&box.classList.contains('study-expanded')){const focusable=[...box.querySelectorAll('button,input,[tabindex="0"]')],first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});tools.append(expand);
}
initializeToolNavigation();
