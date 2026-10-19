const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {openUnits,closeUnits,openAppMenu,openTool}=require('./browser-tools.cjs');
(async()=>{
 const name=process.env.BROWSER_NAME||'chromium',pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
 const browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
 const dir=path.resolve('.release/steam97-p09/'+name);await fs.mkdir(dir,{recursive:true});
 const version=JSON.parse(await fs.readFile('package.json')).version;
 // The browser uses Python Decimal controls, never JS conversion factors.
 const controls=JSON.parse(await fs.readFile('.release/steam97-p09/unit-controls.json'));
 let context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow',viewport:{width:1440,height:1000}}),page=await context.newPage();
 const report={browser:name,browserVersion:browser.version(),playwrightVersion:require(path.join(path.dirname(require.resolve(process.env.PLAYWRIGHT_MODULE_PATH||'playwright')),'package.json')).version,version,status:'running',files:[],groups:[],errors:[]};
 const listen=()=>page.on('pageerror',e=>report.errors.push(e.message));listen();
 const ready=()=>page.waitForFunction(()=>document.querySelector('#calculate')?.disabled===false,{},{timeout:120000});
 const groups=['dynamicViscosity','kinematicViscosity','surfaceTension'];
 const choices=[['Pas','m2s','Nm'],['uPas','mm2s','mNm'],['lb_fts','ft2s','lbf_ft'],['lb_fth','ft2h','mNm']];
 function checks(model,units){return ['mu','nu','diffusivity','sigma'].flatMap(key=>{const unit=units[key==='mu'?0:key==='sigma'?2:1],r=controls.find(r=>r.model===model&&r.mode==='px'&&r.a===1&&r.b===0&&r.key===key&&r.unit===unit);assert.ok(r,key);return [{sheet:'Properties',prefix:['state',key],column:2,value:r.expected,relative_tolerance:2e-14,absolute_tolerance:0},{sheet:'Properties',prefix:['state',key],column:3,value:r.label}];});}
 async function prepare(model){
  const project={format:'water-steam-if97',version:1,title:'P09 одиниці',history:[],form:{model,mode:'px',a:'1',b:'0',ua:'MPa',ub:'fraction',calculated:false},workspace:{active:'general',panels:{}},system:'si'};
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'units.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelector('#result-status').textContent.includes('Проєкт імпортовано'));
  await closeUnits(page);await page.click('#calculate');await page.waitForSelector('#state-spreadsheet-save');
 }
 async function select(units){await openUnits(page);for(let i=0;i<3;i++)await page.selectOption('#preferred-'+groups[i],units[i]);await closeUnits(page);}
 async function download(tag,c){for(const format of ['xlsx','ods','xls','csv']){
  await page.selectOption('#state-spreadsheet-format',format);const [d]=await Promise.all([page.waitForEvent('download'),page.click('#state-spreadsheet-save')]);const file=path.join(dir,tag+'.'+format);await d.saveAs(file);report.files.push({file,format,checks:c});if(name==='chromium')await page.waitForTimeout(150);
 }}
 async function table(c){for(const key of ['mu','nu','diffusivity','sigma']){const row=page.locator('#results [data-property="'+key+'"]'),v=c.find(r=>r.prefix[1]===key&&r.column===2).value,u=c.find(r=>r.prefix[1]===key&&r.column===3).value;
  assert.equal((await row.locator('td').nth(5).textContent()).trim(),u);const text=(await row.locator('td').nth(4).textContent()).trim().replace(/[Ее]/g,'e').replace(/\s/g,'').replace(',','.');assert.ok(Math.abs(Number(text)-v)<=1e-5*Math.abs(v),`${key}: ${text} vs ${v}`);
 }}
 try{
  await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();report.buildId=await page.locator('#app-build-value').textContent();
  for(const model of ['IF97','IAPWS-95']){
   await prepare(model);for(let i=0;i<choices.length;i++){const units=choices[i],c=checks(model,units);await select(units);await table(c);await download(model+'-'+i,c);}
   // Explicitly selected units override English system defaults too.
   await openUnits(page);await page.selectOption('#output-system','english');await closeUnits(page);await select(choices[3]);await table(checks(model,choices[3]));await download(model+'-english',checks(model,choices[3]));
   const [csv]=await Promise.all([page.waitForEvent('download'),page.click('#export-csv')]);const csvPath=path.join(dir,model+'-legacy.csv');await csv.saveAs(csvPath);const legacy=await fs.readFile(csvPath,'utf8');for(const c of checks(model,choices[3]).filter(c=>c.column===3))assert.ok(legacy.includes('"'+c.prefix[1]+'",')&&legacy.includes('"'+c.value+'"'));
   await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.p09Clipboard=text;}}});});
   await page.locator('#calculator-copy-units').check();await page.locator('[data-copy="mu"]').first().evaluate(e=>e.click());await page.waitForFunction(()=>!!window.p09Clipboard);assert.ok((await page.evaluate(()=>window.p09Clipboard)).includes('lb/(ft·h)'));

   await openAppMenu(page);const menu=page.locator('.menubar details').first();if(!await page.locator('#file-project-export').isVisible())await menu.locator('summary').click();
   const [d]=await Promise.all([page.waitForEvent('download'),page.click('#file-project-export')]);const file=path.join(dir,model+'-project.json');await d.saveAs(file);const p=JSON.parse(await fs.readFile(file));for(let i=0;i<3;i++)assert.equal(p.uiUnits[groups[i]],choices[3][i]);
   await page.reload();await ready();await page.waitForFunction(()=>document.querySelector('#result-status').textContent.includes('Відновлено результат проєкту'));await table(checks(model,choices[3]));for(let i=0;i<3;i++)assert.equal(await page.locator('#preferred-'+groups[i]).inputValue(),choices[3][i]);
  }
  await select(['auto','auto','auto']);await openTool(page,'flow');await page.fill('#flow-rho','1000');await page.fill('#flow-viscosity','0.001');await page.click('#flow-calculate');assert.equal(await page.locator('#flow-error').isHidden(),true);
  const flowNu=page.locator('#flow-results tbody tr').filter({hasText:'Кінематична'});assert.ok((await flowNu.locator('td').nth(1).textContent()).includes('Е'));
  await select(['uPas','mm2s','auto']);assert.equal(await flowNu.locator('td').nth(1).textContent(),'1');assert.equal(await flowNu.locator('td').nth(2).textContent(),'mm²/s');await select(['auto','auto','auto']);assert.equal(await flowNu.locator('td').nth(2).textContent(),'м²/с');
  await openTool(page,'general');report.groups.push('Ukrainian scientific exponent in small transport table values and reversible preference changes');
  report.groups.push('Both models: all selectable transport units, SI/English overrides, actual four-format downloads, JSON persistence and reload');
  await page.selectOption('#language-select','en');assert.equal(await page.locator('#preferred-surfaceTension option[value=auto]').textContent(),'By unit system');
  for(const width of [320,390]){await page.setViewportSize({width,height:900});await openUnits(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(dir,'units-'+width+'.png')});await closeUnits(page);}
  report.groups.push('English captions and settings layout at 320/390 px');
  await context.close();context=await browser.newContext({acceptDownloads:true,serviceWorkers:'allow'});page=await context.newPage();listen();
  await require('./browser-tools.cjs').openOfflineApp(page);report.offlineMode='pwa-offline-reload';
  await ready();for(const model of ['IF97','IAPWS-95']){await prepare(model);await select(choices[3]);await download(model+'-offline',checks(model,choices[3]));}
  report.groups.push('PWA offline, both models, four formats with preferred units');
  await context.close();context=await browser.newContext({acceptDownloads:true});page=await context.newPage();listen();await page.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await ready();await page.waitForFunction(()=>/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),{},{timeout:120000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await ready();for(const model of ['IF97','IAPWS-95']){await prepare(model);await select(choices[3]);await download(model+'-pwa-offline',checks(model,choices[3]));}
  report.groups.push('Installed PWA offline reload, both models, four formats with preferred units');
  const manifest=path.join(dir,'manifest.json');await fs.writeFile(manifest,JSON.stringify({...report,browser:name},null,2));
  const r=spawnSync(process.env.P09_PYTHON||'python3',['scripts/reference/spreadsheet_readers.py',manifest],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stderr);report.readers=JSON.parse(await fs.readFile(path.join(dir,'reader-report.json')));assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify({browser:name,status:report.status,files:report.files.length,checks:report.readers.checks,offlineMode:report.offlineMode}));
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
