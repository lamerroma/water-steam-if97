const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const name=process.env.BROWSER_NAME||'chromium',browser=await pw[name].launch(name==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{ });
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.CALCULATOR_URL||'http://127.0.0.1:8080/');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);await openTool(p,'water-process');
  async function run(){await p.click('#wp-calculate');await p.waitForFunction(()=>!!document.querySelector('#wp-report')||!document.querySelector('#wp-error').hidden);assert.equal(await p.locator('#wp-error').isHidden(),true,await p.locator('#wp-error').textContent());assert.match(await p.locator('#wp-status').textContent(),/точність підтверджено|accuracy verified/);assert.equal(await p.locator('[data-process-path]').count(),2);}
  await p.fill('#wp-mass','2,5');await run();assert.match(await p.locator('#wp-results').textContent(),/231/);await p.click('#wp-history-add');assert.equal(await p.locator('#history-body [data-history-open]').count(),2);
  for(const kind of ['isochoric','isothermal','isentropic']){await p.selectOption('#wp-kind',kind);assert.equal(await p.locator('#wp-report').count(),0);await run();}
  await p.selectOption('#wp-model','IAPWS-95');await p.selectOption('#wp-kind','isobaric');await p.selectOption('#wp-mode','px');await p.fill('#wp-a','0.1');await p.fill('#wp-b','0');await p.selectOption('#wp-end','x');await p.fill('#wp-value','1');await run();
  await p.reload();await p.waitForSelector('#wp-report');assert.equal(await p.locator('#wp-model').inputValue(),'IAPWS-95');assert.equal(await p.locator('#wp-mode').inputValue(),'px');assert.equal(await p.locator('#wp-end').inputValue(),'x');
  await p.selectOption('#language-select','en');await p.waitForSelector('#wp-report');assert.match(await p.locator('.water-process-panel h2').textContent(),/Simple water/);assert.match(await p.locator('#wp-results').textContent(),/Specific heat q/);
  const [csv]=await Promise.all([p.waitForEvent('download'),p.click('#wp-csv')]);assert.match(await fs.readFile(await csv.path(),'utf8'),/p_MPa_abs,T_K/);
  const [svg]=await Promise.all([p.waitForEvent('download'),p.click('#wp-svg')]);assert.match(await fs.readFile(await svg.path(),'utf8'),/data-process-path="ts"/);
  await p.click('#wp-report');await openTool(p,'study');assert.equal(await p.locator('#study-list fieldset').count(),1);await p.click('#study-preview');const frame=p.frameLocator('#study-preview-frame');await frame.locator('h1').waitFor();assert.equal(await frame.locator('[data-process-path]').count(),2);assert.match(await frame.locator('body').textContent(),/Accuracy verified/);assert.match(await frame.locator('body').textContent(),/Closed system/);await p.locator('#study-list fieldset').getByRole('button',{name:'Open source calculation',exact:true}).click();await p.waitForSelector('#wp-report');assert.equal(await p.locator('#wp-end').inputValue(),'x');
  // Export the actual project, alter it locally, then restore recomputed results.
  const [project]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>document.querySelector('#file-project-export').click())]);const raw=await fs.readFile(await project.path());
  await p.fill('#wp-mass','-1');await p.click('#wp-calculate');await p.locator('#wp-error').waitFor({state:'visible'});assert.equal(await p.locator('#wp-report').count(),0);
  await p.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'water-process-project.json',mimeType:'application/json',buffer:raw});await p.waitForSelector('#wp-report');assert.equal(Number((await p.locator('#wp-mass').inputValue()).replace(',','.')),2.5);
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);await p.screenshot({path:'/tmp/water-process-'+name+'-mobile.png',fullPage:true});
  await p.setViewportSize({width:1440,height:1000});await p.selectOption('#wp-mode','pt');await p.fill('#wp-a','3');await p.fill('#wp-b','600');await p.selectOption('#wp-kind','isothermal');
  // Submit and cancel synchronously before a worker can deliver a result.
  await p.evaluate(()=>{document.querySelector('#wp-form').requestSubmit();document.querySelector('#wp-cancel').click();});assert.equal(await p.locator('#wp-report').count(),0);assert.match(await p.locator('#wp-status').textContent(),/cancelled/);
  await p.evaluate(()=>{document.querySelector('#wp-form').requestSubmit();const el=document.querySelector('#wp-value');el.value='.6';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await p.locator('#wp-report').count(),0);assert.equal(await p.locator('#wp-calculate').isEnabled(),true);
  await p.evaluate(()=>document.querySelector('#wp-form').requestSubmit());await openTool(p,'general');await p.waitForTimeout(500);assert.equal(await p.locator('#process-view').isHidden(),true);assert.equal(await p.locator('#wp-report').count(),0);await openTool(p,'water-process');assert.equal(await p.locator('#wp-report').count(),0);
  if(name==='firefox'){
   const offline=await browser.newContext({offline:true,serviceWorkers:'block'}),file=await offline.newPage();file.on('pageerror',e=>errors.push(e.message));await file.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../standalone.html')).href);await file.waitForFunction(()=>!document.querySelector('#calculate').disabled);await openTool(file,'water-process');await file.click('#wp-calculate');await file.waitForSelector('#wp-report');assert.match(await file.locator('#wp-status').textContent(),/точність підтверджено/);await offline.close();
  }
  assert.deepEqual(errors,[]);console.log(name+': four processes, 95 phase change, background cancellation/edit/navigation, project restore, report/source, CSV/SVG, English and mobile PASS'+(name==='firefox'?'; standalone offline PASS':''));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
