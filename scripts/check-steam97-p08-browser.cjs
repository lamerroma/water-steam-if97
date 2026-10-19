const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),name=process.env.BROWSER_NAME||'chromium';
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 let context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'allow',acceptDownloads:true}),page=await context.newPage();
 const dir=path.resolve(process.env.P08_BROWSER_DIR||'.release/steam97-p08/'+name);await fs.mkdir(dir,{recursive:true});
 const version=JSON.parse(await fs.readFile('package.json')).version,report={browser:name,version,status:'running',groups:[],files:[],errors:[],offlineMode:null};
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/steam97-p07-reference.json'));
 const sample=model=>fixture.records.find(c=>c.model===model&&c.mode==='pt'&&c.a===3&&c.b===673.15);
 const ready=()=>page.waitForFunction(()=>document.querySelector('#calculate')?.disabled===false,{},{timeout:120000});
 const listen=()=>page.on('pageerror',e=>report.errors.push(e.message));listen();
 async function prepare(model){const c=sample(model);await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'p08.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'water-steam-if97',version:1,title:'P08',history:[{p:c.expected.p,h:c.expected.h,model,name:'=1+1 Україна',source:{mode:'pt',a:3,b:673.15}}],form:{model,mode:'pt',a:'3',b:'673.15',ua:'MPa',ub:'K',calculated:false},workspace:{active:'general',panels:{}},system:'si'}))});await page.waitForFunction(()=>document.querySelector('input[type=file][accept=".json,application/json"]').value===''&&document.querySelector('#result-status').textContent.includes('Проєкт імпортовано'));await page.click('#calculate');await page.waitForSelector('#state-spreadsheet-save');return c;}
 async function download(id,checks,tag,formats=['xlsx','ods','xls','csv']){
  for(const format of formats){await page.selectOption('#'+id+'-format',format);const [d]=await Promise.all([page.waitForEvent('download'),page.click('#'+id+'-save',{timeout:10000})]);assert.equal(d.suggestedFilename(),id+'.'+format);const file=path.join(dir,tag+'.'+format);await d.saveAs(file);report.files.push({file,format,checks});
   // Chromium suppresses bursts of >10 downloads/s. Pace the automated clicks.
   if(name==='chromium')await page.waitForTimeout(150);
  }console.log('Downloaded '+tag+': '+formats.join(', '));
 }
 const properties=c=>['p','T','h','s'].map(k=>({sheet:'Properties',prefix:['state',k],column:2,value:c.expected[k]}));
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/index.html');await ready();report.buildId=await page.locator('#app-build-value').textContent();
  for(const model of ['IF97','IAPWS-95']){const c=await prepare(model);await download('state-spreadsheet',properties(c),'state-'+model);}
  report.groups.push('State, both models and four formats');
  const c=await prepare('IF97');
  await download('history-spreadsheet',[{sheet:'Properties',prefix:['=1+1 Україна','state','h'],column:3,value:c.expected.h}],'history');
  await openTool(page,'satgrid');await page.locator('#satgrid-form button[type=submit]').click();await page.waitForSelector('#saturation-spreadsheet-save');
  await download('saturation-spreadsheet',[{sheet:'Saturation',prefix:[50],column:0,value:50}],'saturation');
  // Editing invalidates old exports; the filename cannot relabel stale table data.
  await page.selectOption('#satgrid-basis','pressure');assert.equal(await page.locator('#saturation-spreadsheet-save').count(),0);
  await openTool(page,'turbine');await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-spreadsheet-save');
  await download('process-spreadsheet',[{sheet:'Properties',prefix:[1,'state','h'],column:3,value:c.expected.h}],'turbine');
  await openTool(page,'flash');await page.locator('#process-form button[type=submit]').click();await page.waitForSelector('#process-spreadsheet-save');
  await download('process-spreadsheet',[],'flash');
  await openTool(page,'batch');await page.locator('#batch-form button:not([type=button])').click();await page.waitForSelector('#batch-spreadsheet-save');await download('batch-spreadsheet',[],'batch');
  await openTool(page,'phdiagram');await page.waitForSelector('#diagram-spreadsheet-save');
  await download('diagram-spreadsheet',[{sheet:'Properties',prefix:['=1+1 Україна','state','h'],column:3,value:c.expected.h}],'diagram');
  report.groups.push('History, saturation invalidation, turbine, flash and diagram');
  await page.selectOption('#language-select','en');assert.equal(await page.locator('#diagram-spreadsheet-save').textContent(),'Save spreadsheet');
  for(const width of [320,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(dir,'mobile-'+width+'.png')});}
  report.groups.push('English and 320/390px layout');
  await context.close();context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'allow',acceptDownloads:true});page=await context.newPage();listen();
  await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
  await ready();for(const model of ['IF97','IAPWS-95']){const c=await prepare(model);await download('state-spreadsheet',properties(c),'offline-'+model);}
  report.groups.push('PWA offline, both models and four formats');
  await context.close();context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});page=await context.newPage();listen();
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/index.html');await ready();
  await page.waitForFunction(()=>/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),{},{timeout:120000});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await ready();
  for(const model of ['IF97','IAPWS-95']){const c=await prepare(model);await download('state-spreadsheet',properties(c),'pwa-offline-'+model);}
  report.groups.push('Installed PWA offline reload, both models and four formats');
  const manifest=path.join(dir,'manifest.json');await fs.writeFile(manifest,JSON.stringify({browser:name,version,buildId:report.buildId,files:report.files},null,2));
  const r=spawnSync(process.env.P08_PYTHON||'python3',['scripts/reference/spreadsheet_readers.py',manifest],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr);report.independentReaders=JSON.parse(await fs.readFile(path.join(dir,'reader-report.json')));
  assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify({browser:name,status:report.status,groups:report.groups.length,files:report.files.length,offlineMode:report.offlineMode,independent:report.independentReaders}));
 }catch(e){report.status='failed';report.error=e.stack;report.errorStatus=await page.locator('#result-status').textContent().catch(()=>null);console.error('Export status:',report.errorStatus);throw e;}
 finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
