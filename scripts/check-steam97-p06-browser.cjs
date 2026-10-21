const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool,chooseModel,openUnits,closeUnits}=require('./browser-tools.cjs');
function csvRows(text){text=text.replace(/^\ufeff/,'');const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){
 const s=text,c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
 else if(!quoted&&(c===';'||c==='\r'||c==='\n')){row.push(cell);cell='';if(c!==';'){if(c==='\r'&&s[i+1]==='\n')i++;rows.push(row);row=[];}}else cell+=c;
 }if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
(async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),name=process.env.BROWSER_NAME||'chromium';
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true});
 const dir=process.env.P06_BROWSER_DIR||'.release/steam97-p06/'+name;await fs.mkdir(dir,{recursive:true});
 const ref=JSON.parse(await fs.readFile('tests/fixtures/steam97-p06-reference.json')),report={browser:name,status:'running',checks:[],records:[],errors:[]};
 let page=await context.newPage(),gauge=false;page.on('pageerror',e=>report.errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#calculate').disabled,{},{timeout:120000});
 const processSettled=()=>page.waitForFunction(()=>document.querySelector('#process-form')?.getAttribute('aria-busy')!=='true',null,{timeout:120000});
 const near=(actual,wanted,key)=>assert.ok(Math.abs(actual-wanted)<=Math.max(key==='T'?ref.policy.temperature_absolute:key==='s'?ref.policy.entropy_absolute:ref.policy.energy_absolute,Math.abs(wanted)*ref.policy.relative),`${key}: ${actual} != ${wanted}`);
 const selectCase=(model,kind,p1,T1)=>ref.records.find(c=>c.model===model&&c.kind===kind&&c.input.p1===p1&&c.input.T1===T1);
 const lb=.45359237,btu=1055.05585262,psi=lb*9.80665/(.3048/12)**2;
 const pressure=p=>(p-(gauge ? .101325 : 0)),toP=(p,en)=>en?pressure(p)*1e6/psi:pressure(p),toT=(t,en)=>en?(t-273.15)*1.8+32:t-273.15;
 async function download(action){const [d]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await d.path(),'utf8');}
 async function readCSV(c,en){
  const text=await download(()=>page.click('#process-csv')),rows=csvRows(text),e=c.expected;
  for(const field of ['inlet',...(c.kind==='turbine'?['ideal']:[]),'outlet']){
   const line=rows.find(r=>r[0]===c.kind&&r[1]===(field==='ideal'?'isentropic_outlet':field));assert(line,field);
   for(const [j,k] of [[2,'p'],[3,'T'],[4,'h'],[5,'s']]){
    const actual=Number(line[j]),canonical=!en?actual:k==='p'?actual*psi/1e6:k==='T'?(actual-32)/1.8+273.15:actual*btu/(1000*lb)*(k==='s'?1.8:1);near(canonical,e[field][k],k);
   }
  }
  for(const k of c.kind==='turbine'?['work','power','flow','consumption','efficiency','inletTsat','outletSuperheat']:['flow','vaporFlow','liquidFlow']){
   const row=rows.find(r=>r[0]===k),wanted=e[k==='consumption'?'specificConsumption':k==='efficiency'?'eta':k];assert(row,k);
   if(wanted===null){assert.equal(row[1],'',k);assert(rows.some(r=>r[0]===k+'_unavailable_reason'));continue;}
   let value=Number(row[1]);if(en)value=k==='work'?value*btu/(1000*lb):k==='power'?value*btu/3600000:k==='flow'||k.endsWith('Flow')||k==='consumption'?value*lb:k==='inletTsat'?(value-32)/1.8+273.15:k==='outletSuperheat'?value/1.8:value;
   near(value,wanted,k);
  }
  if(c.kind==='turbine'){
   assert.equal(rows.find(r=>r[0]==='consumption')[2],en?'lb/(kW·h)':'kg/(kW·h)');near(Number(rows.find(r=>r[0]==='powerMW')[1]),e.power/1000,'powerMW');
   for(const k of ['inletTsat','outletSuperheat']){const text=await page.locator(`[data-process-metric="${k}"] strong`).textContent();if(e[k]===null)assert(text.includes('—'));else {const raw=text.trim().match(/^[+\-\d\s,.\u00a0\u202f]+/)[0],value=Number(raw.replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));near(value,k==='inletTsat'?toT(e[k],en):e[k]*(en?1.8:1),k);}}
  }
  return text;
 }
 async function run(c,mode=c.kind==='turbine'?'power':c.input.flag===1?'saturated':c.input.flag===2?'condensate':'subcooled',en=false,surface='site'){
  await chooseModel(page,c.model);await openTool(page,c.kind);await openUnits(page);await page.selectOption('#output-system',en?'english':'si');await closeUnits(page);
  await page.selectOption('#process-mode',mode);await page.selectOption('#process-pressure',en?'psi':'MPa');await page.selectOption('#ui-unit-process-p2',en?'psi':'MPa');if(mode!=='saturated')await page.selectOption('#process-temperature',en?'F':'C');if(mode!=='flow')await page.selectOption('#process-mass',en?'lbs':'kgs');
  if(c.kind==='turbine'&&mode!=='power')await page.selectOption('#process-power-unit','MW');
  if(c.kind==='turbine'&&mode!=='efficiency')await page.selectOption('#ui-unit-process-eta','percent');
  const i=c.input;for(const [key,value]of [['p1',toP(i.p1,en)],['p2',toP(i.p2,en)]])await page.fill('#process-'+key,String(value));
  if(mode!=='saturated')await page.fill('#process-t1',String(toT(i.T1,en)));
  if(mode!=='flow')await page.fill('#process-flow',String(en?i.flow/lb:i.flow));
  if(c.kind==='turbine'){
   if(mode!=='efficiency')await page.fill('#process-eta',String(i.eta*100));
   if(mode!=='power')await page.fill('#process-power',String(c.expected.power/1000));
  }
  await page.click('#process-form button[type=submit]');await processSettled();assert.equal(await page.locator('#process-error').textContent(),'');
  const csv=await readCSV(c,en);report.records.push({id:c.id,mode,system:en?'English':'SI',surface});return csv;
 }
 const projectExport=()=>download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(e=>e.click()));
 async function check(label,fn){if(process.env.P06_CHECK_FILTER&&!label.includes(process.env.P06_CHECK_FILTER))return;await fn();report.checks.push({label,status:'passed'});console.log(name,label,'passed');}
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8711/');await ready();report.build=await page.locator('#app-build-value').textContent();report.version=await page.locator('#app-version-value').textContent();
  await check('Three turbine modes; both models and unit systems; MW input',async()=>{
   for(const model of ['IF97','IAPWS-95'])for(const en of [false,true])for(const mode of ['power','flow','efficiency'])await run(selectCase(model,'turbine',6,773.15),mode,en);
  });
  await check('Superheated and supercritical exits; temperature difference and null reasons',async()=>{
   for(const model of ['IF97','IAPWS-95'])for(const en of [false,true])for(const [p,T]of [[1,973.15],[30,900]])await run(selectCase(model,'turbine',p,T),'power',en);
  });
  await check('Saturated/subcooled condensate and legacy vapor throttle; both systems',async()=>{
   for(const model of ['IF97','IAPWS-95'])for(const en of [false,true])for(const [flag,p,T]of [[1,3,null],[2,3,450],[0,3,673.15]]){
    const c=ref.records.find(c=>c.kind==='flash'&&c.model===model&&c.input.p1===p&&c.input.flag===flag&&(T===null||c.input.T1===T));await run(c,undefined,en);
   }
  });
  await check('MW conversion, stale outputs and input guards',async()=>{
   const c=selectCase('IF97','turbine',6,773.15);await run(c,'flow');const base=Number(await page.locator('#process-power').inputValue());
   await page.selectOption('#process-power-unit','kW');near(Number(await page.locator('#process-power').inputValue()),base*1000,'power');assert.equal(await page.locator('#process-result').textContent(),'');await page.selectOption('#process-power-unit','Btuh');await page.selectOption('#process-power-unit','MW');near(Number(await page.locator('#process-power').inputValue()),base,'power');
   await page.fill('#process-eta','0');await page.click('#process-form button[type=submit]');await processSettled();assert((await page.locator('#process-error').textContent()).length>0);assert.equal(await page.locator('#process-csv').count(),0);
   const f=selectCase('IF97','flash',3,450);await run(f);await page.fill('#process-t1','400');await page.click('#process-form button[type=submit]');await processSettled();assert.match(await page.locator('#process-error').textContent(),/конденсату/);assert.equal(await page.locator('#process-csv').count(),0);
  });
  await check('Exact JSON/project reload and history for all modes; printable fields',async()=>{
   const cases=[...['power','flow','efficiency'].map(m=>[selectCase('IAPWS-95','turbine',6,773.15),m]),...[1,2].map(flag=>[ref.records.find(c=>c.kind==='flash'&&c.model==='IAPWS-95'&&c.input.p1===3&&c.input.flag===flag),flag===1?'saturated':'condensate'])];
   for(const [c,mode]of cases){await run(c,mode);const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length);await page.click('#process-history');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).history.length),before+2);
    const saved=JSON.parse(await projectExport());assert.equal(saved.workspace.panels[c.kind].inputs['process-mode'],mode);if(c.kind==='turbine'&&mode!=='power')assert.equal(saved.workspace.panels.turbine.inputs['process-power-unit'],'MW');
    await page.fill('#process-p1','9');await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'p06.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
    // Restoring a calculated panel submits it again; its status replaces the
    // transient import message. Observe the restored inputs and result instead.
    await page.waitForFunction(p=>Number(document.querySelector('#process-p1')?.value)===p&&!!document.querySelector('#process-csv'),c.input.p1);
    await readCSV(c,false);await page.reload();await ready();await page.waitForSelector('#process-csv');await readCSV(c,false);
   }
   await run(selectCase('IF97','turbine',1,973.15));const html=await download(()=>page.locator('#file-report').evaluate(e=>e.click()));assert(html.includes('Температура насичення на вході'));assert(html.includes('Перегрів на виході'));
  });
  await check('Gauge pressure, English interface and mobile width',async()=>{
   await openUnits(page);await page.selectOption('#pressure-basis','gauge');await page.click('#pressure-apply');await closeUnits(page);gauge=true;
   await run(selectCase('IF97','turbine',6,773.15),'flow',true);await openUnits(page);await page.selectOption('#pressure-basis','absolute');await page.click('#pressure-apply');await closeUnits(page);gauge=false;
   await page.selectOption('#language-select','en');assert.match(await page.locator('[data-process-metric="outletSuperheat"]').textContent(),/Exhaust superheat/);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:dir+'/mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.selectOption('#language-select','uk');
  });
  await check('Offline PWA with both models',async()=>{
   await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
   await ready();await context.setOffline(true);for(const model of ['IF97','IAPWS-95']){await run(selectCase(model,'turbine',1,973.15),'power',false,'pwa-offline');await run(selectCase(model,'flash',3,450),undefined,false,'pwa-offline');}
  });
  assert.deepEqual(report.errors,[]);report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;report.pageState=await page.evaluate(()=>({error:document.querySelector('#error')?.textContent,status:document.querySelector('#result-status')?.textContent,processError:document.querySelector('#process-error')?.textContent,project:JSON.parse(localStorage.getItem('water-steam-if97-project-v1'))})).catch(()=>null);throw e;}finally{await browser.close();await fs.writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
