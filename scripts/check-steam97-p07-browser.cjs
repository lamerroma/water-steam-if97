const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool,openUnits,closeUnits}=require('./browser-tools.cjs');
function csvRows(text){text=text.replace(/^\ufeff/,'');const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===';'||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==';'){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
(async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),browserName=process.env.BROWSER_NAME||'chromium',browser=await pw[browserName].launch(browserName==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 let context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true}),page=await context.newPage();
 const dir=process.env.P07_BROWSER_DIR||'.release/steam97-p07/'+browserName;await fs.mkdir(dir,{recursive:true});
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/steam97-p07-reference.json')),report={browser:browserName,status:'running',checks:[],records:[],errors:[]};let current;
 const listen=()=>page.on('pageerror',e=>report.errors.push(e.message));listen();
 const ready=()=>page.waitForFunction(()=>document.querySelector('#calculate')?.disabled===false,{},{timeout:120000});
 const chart=()=>page.evaluate(()=>{const c=Chart.getChart('steam-diagram');return {width:c.width,height:c.height,range:{xmin:c.scales.x.min,xmax:c.scales.x.max,ymin:c.scales.y.min,ymax:c.scales.y.max},titles:[c.scales.x.options.title.text,c.scales.y.options.title.text],datasets:c.data.datasets.map((d,i)=>({role:d.role,name:d.seriesName,kind:d.seriesKind,color:d.borderColor,width:d.borderWidth,radius:d.pointRadius,pointColors:d.pointBackgroundColor,hidden:!c.isDatasetVisible(i),data:d.data,points:c.getDatasetMeta(i).data.map(p=>({x:p.x,y:p.y,skip:p.skip}))}))};});
 const near=(v,w,k)=>assert.ok(Math.abs(v-w)<=Math.max(fixture.policy[k+'_absolute']||2e-5,Math.abs(w)*fixture.policy.relative),`${k}: ${v} != ${w}`);
 const selectCases=model=>[
  fixture.records.find(c=>c.model===model&&c.mode==='pt'&&c.a===3&&c.b===673.15),
  fixture.records.find(c=>c.model===model&&c.mode==='tx'&&c.a===473.15&&c.b===.5),
  fixture.records.find(c=>c.model===model&&c.mode==='pt'&&c.a===100&&c.b===1073.15),
  fixture.records.find(c=>c.model===model&&c.mode==='tx'&&c.a===640&&c.b===0),
  fixture.records.find(c=>c.model===model&&c.mode==='tx'&&c.a===647.0959&&c.b===1),
  fixture.records.find(c=>c.model===model&&c.mode==='tx'&&c.a===300&&c.b===0),
  ...(model==='IAPWS-95'?[fixture.records.find(c=>c.model===model&&c.mode==='pt'&&c.a===200&&c.b===260)]:[])
 ];
 async function download(action){const [d]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await d.path(),'utf8');}
 async function importProject(p){await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'p07.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value===''&&document.querySelector('#result-status').textContent.includes('Проєкт імпортовано'));}
 async function prepare(model){current=selectCases(model);assert.ok(current.every(Boolean));
  await importProject({format:'water-steam-if97',version:1,title:'P07',history:current.map(c=>({p:c.expected.p,h:c.expected.h,model,source:{mode:c.mode,a:c.a,b:c.b}})),form:{model,mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C',calculated:false},workspace:{active:'general',panels:{}},system:'si'});
  await openTool(page,'hsdiagram');await page.waitForSelector('#steam-diagram');await page.locator('.diagram-drawing > summary').click();
  await points(current.slice(0,4).map((_,i)=>current.length-i).join(';'),'A; B; C; D');
 }
 async function points(ids,labels){await page.fill('#diagram-point-ids',ids);await page.fill('#diagram-point-labels',labels);await page.click('#diagram-points-apply');assert.equal(await page.locator('#diagram-drawing-error').textContent(),'');}
 async function series(name,kind,labels,selected=''){await page.selectOption('#diagram-series-select',selected);await page.fill('#diagram-series-name',name);await page.selectOption('#diagram-series-kind',kind);await page.fill('#diagram-series-labels',labels);await page.click('#diagram-series-save');assert.equal(await page.locator('#diagram-drawing-error').textContent(),'');}
 async function style(){await page.fill('#diagram-point-radius','9');await page.selectOption('#diagram-point-color-mode','custom');await page.locator('#diagram-point-color').evaluate(e=>{e.value='#245678';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.fill('#diagram-series-width','3.2');await page.locator('#diagram-series-color').evaluate(e=>{e.value='#005533';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#diagram-style-apply');assert.equal(await page.locator('#diagram-drawing-error').textContent(),'');}
 async function visibleSettings(){if(!await page.locator('#diagram-system').isVisible())await page.locator('.diagram-settings > summary').click();}
 async function waitExport(){await page.waitForFunction(()=>!document.querySelector('#diagram-save').disabled,{},{timeout:120000});}
 async function verifyExports(kind,english){
  await waitExport();const c=await chart(),states=c.datasets.find(d=>d.role==='states');assert.equal(states.data.length,4);assert.deepEqual(states.radius,[9,9,9,9]);assert.ok(states.pointColors.every(x=>x==='#245678'));
  for(let i=0;i<4;i++){const q=current[i].expected;near(states.data[i].x,kind==='phdiagram'?q.h:q.s,kind==='phdiagram'?'h':'s');near(states.data[i].y,kind==='phdiagram'?q.p:kind==='ts'?q.T-273.15:q.h,kind==='phdiagram'?'p':kind==='ts'?'T':'h');}
  const csv=csvRows(await download(()=>page.click('#diagram-csv'))),rows=csv.filter(r=>r[2]==='history');assert.equal(rows.length,4);
  const lb=.45359237,btu=1055.05585262,psi=lb*9.80665/(.3048/12)**2;
  for(let i=0;i<4;i++){assert.equal(rows[i][1],['A','B','C','D'][i]);for(const [j,k]of [[4,'p'],[5,'T'],[6,'h'],[7,'s']]){
   let value=Number(rows[i][j]);if(english)value=k==='p'?value*psi/1e6:k==='T'?(value-32)/1.8+273.15:value*btu/(1000*lb)*(k==='s'?1.8:1);else if(k==='T')value+=273.15;near(value,current[i].expected[k],k);
  }}assert.ok(csv.some(r=>r[0]==='drawing_interpolation'));assert.equal(csv.filter(r=>r[0]==='Цикл <α>'||r[0]==='Крива & β').length,2);
  // Observe after the application's synchronous SVG handler, in the same
  // click task. Later resize/refinement frames must not change this snapshot.
  await page.locator('#diagram-save').evaluate(button=>{window.p07ExportFrame=null;button.addEventListener('click',()=>{
   const c=Chart.getChart('steam-diagram');window.p07ExportFrame=structuredClone({width:c.width,height:c.height,range:{xmin:c.scales.x.min,xmax:c.scales.x.max,ymin:c.scales.y.min,ymax:c.scales.y.max},datasets:c.data.datasets.map((d,i)=>({role:d.role,name:d.seriesName,kind:d.seriesKind,color:d.borderColor,width:d.borderWidth,radius:d.pointRadius,pointColors:d.pointBackgroundColor,hidden:!c.isDatasetVisible(i),data:d.data,points:c.getDatasetMeta(i).data.map(p=>({x:p.x,y:p.y,skip:p.skip}))}))});
  },{once:true});});
  const svg=await download(()=>page.click('#diagram-save')),data=await page.evaluate(s=>{const d=new DOMParser().parseFromString(s,'image/svg+xml');return {errors:d.querySelectorAll('parsererror').length,markers:[...d.querySelectorAll('[data-point]')].map(n=>({position:n.getAttribute('transform').match(/[-+]?\d+(?:\.\d+)?/g).map(Number),radius:Number(n.querySelector('circle').getAttribute('r'))})),series:[...d.querySelectorAll('path[data-role="series"]')].map(n=>({index:Number(n.getAttribute('data-dataset')),name:n.getAttribute('data-series-name'),points:[...n.getAttribute('d').matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}))}))};},svg);
  // SVG export intentionally stops animation and updates the Canvas. Compare
  // with that settled Canvas, rather than an earlier animation frame.
  const exportedChart=await page.evaluate(()=>window.p07ExportFrame);assert.ok(exportedChart,'Capture the Canvas in the export click task');const exportedStates=exportedChart.datasets.find(d=>d.role==='states');
  const physicalData=scene=>scene.datasets.filter(d=>['states','series'].includes(d.role)).map(({role,name,kind,data})=>({role,name,kind,data}));
  assert.deepEqual(physicalData(exportedChart),physicalData(c),'Export must not change scientific points or named-series data');
  const compact=scene=>({width:scene.width,height:scene.height,range:scene.range,datasets:scene.datasets.filter(d=>['states','series'].includes(d.role))});
  await fs.writeFile(dir+'/geometry-'+current[0].model+'-'+kind+'-'+(english?'english':'si')+'.json',JSON.stringify({build:report.build,pixelTolerance:.0011,before:compact(c),after:compact(exportedChart),svg:data},null,2)+'\n');
  assert.equal(data.errors,0);assert.equal(data.series.length,2);assert.equal(data.markers.length,4);
  for(let i=0;i<4;i++){assert.equal(data.markers[i].radius,9);for(const [k,j]of [['x',0],['y',1]])assert.ok(Math.abs(data.markers[i].position[j]-exportedStates.points[i][k])<.0011);}
  for(const s of data.series){const d=exportedChart.datasets[s.index];assert.equal(d.role,'series');assert.equal(d.name,s.name);assert.equal(s.points.length,d.points.length);assert.equal(d.width,3.2);assert.equal(d.color,'#005533');for(let i=0;i<s.points.length;i++)for(const k of ['x','y'])assert.ok(Math.abs(s.points[i][k]-d.points[i][k])<.0011,`${kind} ${s.name} point ${i} ${k}: SVG ${s.points[i][k]} vs settled Canvas ${d.points[i][k]}`);}
  const html=await download(()=>page.click('#diagram-report'));assert.ok(html.includes('Іменовані серії')||html.includes('Named series'));assert.ok(html.includes('Цикл &lt;α&gt;'));assert.ok(!html.includes('<canvas'));assert.ok(c.titles.join(' ').includes(english?'Btu':'kJ')||!english&&c.titles.join(' ').includes('кДж'));report.records.push({model:current[0].model,kind,system:english?'English':'SI',points:4,series:2});
 }
 async function check(label,fn){await fn();report.checks.push({label,status:'passed'});console.log(browserName,label,'passed');}
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8711/');await ready();report.version=await page.locator('#app-version-value').textContent();report.build=await page.locator('#app-build-value').textContent();
  await check('Two models, three diagrams, units, named lines/splines, SVG/CSV/print',async()=>{
   for(const model of ['IF97','IAPWS-95']){
    await prepare(model);await series('Цикл <α>','line','A; B; C');await series('Крива & β','spline','A; B; C; A');await style();
    for(const kind of ['ts','hsdiagram','phdiagram'])for(const english of [false,true]){await openTool(page,kind);await visibleSettings();await page.selectOption('#diagram-system',english?'english':'si');await closeUnits(page);await verifyExports(kind,english);}
   }
  });
  await page.locator('#steam-diagram').scrollIntoViewIfNeeded();
  await page.screenshot({path:dir+'/desktop.png',fullPage:true});
  await check('Atomic guards and label edits preserve existing series references',async()=>{
   await openTool(page,'hsdiagram');await page.locator('.diagram-drawing > summary').click();await waitExport();const saved=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).diagram));
   await page.fill('#diagram-point-labels','A; B');await page.click('#diagram-points-apply');assert((await page.locator('#diagram-drawing-error').textContent()).length>0);assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).diagram)),saved);
   await points(current.slice(0,4).map((_,i)=>current.length-i).join(';'),'Вхід; B<script>; C; D');await series('Оновлено','line','Вхід; B<script>; C','0');assert.equal(await page.locator('#diagram-series-name').inputValue(),'Оновлено');assert.equal(await page.locator('#process-view script').count(),0);
   await page.selectOption('#language-select','en');assert((await page.locator('#diagram-point').textContent()).includes('Вхід'));assert((await page.locator('#diagram-series-select').textContent()).includes('Оновлено'));await page.selectOption('#language-select','uk');
  });
  await check('Steam viewport, isobar visibility, exact project import and restart',async()=>{
   await page.selectOption('#diagram-viewport','vapor');await visibleSettings();await page.check('#diagram-isobars');await page.click('[data-isobar="0"]');await page.click('#diagram-in');await waitExport();
   const before=await chart(),text=await download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(e=>e.click())),saved=JSON.parse(text);
   assert.equal(saved.diagram.views['IAPWS-95:hsdiagram'].preset,'vapor');assert.deepEqual(saved.diagram.views['IAPWS-95:hsdiagram'].hiddenIsobars,[0]);assert.equal(saved.diagram.series.length,2);
   await page.selectOption('#diagram-viewport','full');await importProject(saved);await page.waitForSelector('#steam-diagram');await waitExport();await page.reload();await ready();await page.waitForSelector('#steam-diagram');await waitExport();const after=await chart();assert.equal(await page.locator('#diagram-viewport').inputValue(),'vapor');assert.deepEqual(after.range,before.range);assert.deepEqual(after.datasets.filter(d=>d.role==='isobar').map(d=>d.hidden),before.datasets.filter(d=>d.role==='isobar').map(d=>d.hidden));assert.equal(after.datasets.filter(d=>d.role==='series').length,2);
   const invalid=structuredClone(saved);invalid.diagram.pointSets['IAPWS-95'][0].historyIndex=9999;const stored=await page.evaluate(()=>localStorage.getItem('water-steam-if97-project-v1'));
   await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('Імпорт:'));assert.equal(await page.evaluate(()=>localStorage.getItem('water-steam-if97-project-v1')),stored);
  });
  await check('Series deletion and clearing displayed points leave history intact',async()=>{
   await page.locator('.diagram-drawing > summary').click();const count=await page.locator('#history-body tr').count();for(let i=0;i<2;i++){await page.selectOption('#diagram-series-select','0');await page.click('#diagram-series-delete');}
   await points('','');assert.equal((await chart()).datasets.find(d=>d.role==='states').data.length,0);await page.click('#diagram-points-all');assert.equal((await chart()).datasets.find(d=>d.role==='states').data.length,count);assert.equal(await page.locator('#history-body tr').count(),count);
  });
  await check('Mobile 320/390 px and English controls',async()=>{
   await page.selectOption('#language-select','en');assert((await page.locator('.diagram-drawing > summary').textContent()).includes('Points and named series'));
   for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:dir+`/mobile-${width}.png`,fullPage:true});}
  });
  await check('Offline PWA: both models, labels and spline exports',async()=>{
   await context.close();context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true});page=await context.newPage();listen();
   await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
   await ready();await context.setOffline(true);for(const model of ['IF97','IAPWS-95']){await prepare(model);await series('Офлайн','spline','A; B; C');await waitExport();assert.equal((await chart()).datasets.filter(d=>d.role==='series').length,1);assert((await download(()=>page.click('#diagram-save'))).includes('data-series-kind="spline"'));assert.ok(page.workers().some(w=>w.url().includes('assets/calculator-worker.js?v=')));}
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;report.pageState=await page.evaluate(()=>({status:document.querySelector('#result-status')?.textContent,error:document.querySelector('#error')?.textContent,drawingError:document.querySelector('#diagram-drawing-error')?.textContent,project:JSON.parse(localStorage.getItem('water-steam-if97-project-v1')),ids:document.querySelector('#diagram-point-ids')?.value})).catch(()=>null);throw e;}
 finally{await browser.close();await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
