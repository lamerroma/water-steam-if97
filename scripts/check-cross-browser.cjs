// Main workflows and layout checks in both engines; page data is never translated.
const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const evidence=process.env.UI_EVIDENCE_DIR||'/tmp/water-ui-acceptance';await fs.mkdir(evidence,{recursive:true});
 for(const name of ['chromium','firefox']){
  const browser=await playwright[name].launch({headless:true,...(name==='chromium'?{args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})}:{})});
  try{
   const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.CALCULATOR_URL||'http://localhost:8080/');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
   const calculate=async()=>{await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);};
   const download=async action=>{const [d]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await d.path(),'utf8');};
   await page.fill('#input-a','3');await page.fill('#input-b','100');await calculate();assert.equal(await page.locator('#error').isHidden(),true);
   await page.selectOption('#language-select','en');assert.equal(await page.locator('html').getAttribute('lang'),'en');
   await page.fill('#input-a','-1');await calculate();assert.match(await page.locator('#input-error-a').textContent(),/Pressure in the selected units/);await page.fill('#input-a','3,0');await calculate();assert.equal(await page.locator('#error').isHidden(),true);
   const original=JSON.parse(await download(()=>page.getByRole('button',{name:'Export a JSON project',exact:true,includeHidden:true}).evaluate(e=>e.click())));
   const report=await download(()=>page.locator('#file-report').evaluate(e=>e.click()));assert.match(report,/<html[^>]*lang="en"/);await fs.writeFile(path.join(evidence,name+'-report.html'),report);assert.match(report,/enthalpy/i);assert.ok(!report.includes('Тиск'));
   // User titles and values survive language changes and a project export/import.
   await page.locator('.menubar details').first().locator('summary').click();await page.fill('#project-title','Мій розрахунок / my project');await page.locator('.menubar details').first().locator('summary').click();
   await page.selectOption('#language-select','uk');await page.selectOption('#language-select','en');assert.equal(await page.locator('#project-title').inputValue(),'Мій розрахунок / my project');
   const project=JSON.parse(await download(()=>page.getByRole('button',{name:'Export a JSON project',exact:true,includeHidden:true}).evaluate(e=>e.click())));assert.deepEqual(project.history,original.history);
   await page.fill('#input-a','4');await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.waitForFunction(()=>document.querySelector('#input-a').value==='3,0');await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await page.locator('#project-title').inputValue(),'Мій розрахунок / my project');assert.equal(await page.locator('#language-select').inputValue(),'en');
   // All 28 sections at three widths. Local scrolling is allowed for wide tables.
   const actions=await page.locator('#section-select option').evaluateAll(a=>a.map(e=>e.value));
   for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const action of actions){await openTool(page,action);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,`${name}: ${action} at ${width}px`);}
    await openTool(page,'general');if(width<=700)assert.ok((await page.locator('#calculate').boundingBox()).height>=44);await page.selectOption('#ui-scale','1.3');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.selectOption('#ui-scale','1');await page.screenshot({path:path.join(evidence,`${name}-${width}-general.png`),fullPage:true});
   }
   await page.setViewportSize({width:390,height:844});
   await openTool(page,'npp');assert.ok(!(await page.locator('#npp-form').locator('..').textContent()).includes('Вода двох'));await page.click('#npp-preset');await page.locator('#cycle-chart').waitFor();
   await page.click('[data-study-state=S3]');await page.locator('.study-viewer').first().getByRole('button',{name:'Expand',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.keyboard.press('Escape');assert.equal(await page.locator('.study-expanded').count(),0);assert.equal(await page.locator('.study-inspector .sat-table td').first().evaluate(e=>getComputedStyle(e).whiteSpace),'nowrap');
   await page.screenshot({path:path.join(evidence,`${name}-390-npp.png`),fullPage:true});
   await openTool(page,'ts');await page.locator('#steam-diagram').waitFor();assert.ok(await page.locator('#steam-diagram').evaluate(c=>{const chart=Chart.getChart(c);return chart&&chart.width>200&&chart.height>100;}));
   await page.screenshot({path:path.join(evidence,`${name}-390-diagram.png`),fullPage:true});
   const chartReport=await download(()=>page.click('#diagram-report'));assert.match(chartReport,/<html[^>]*lang="en"/);
   await openTool(page,'laboratory');await page.click('#lab-example');await page.click('#lab-calculate');assert.equal(await page.locator('#lab-error').isHidden(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
   assert.deepEqual(errors,[]);console.log(`${name} ${browser.version()}: calculation, errors, UK/EN, HTML/JSON, restore, all ${actions.length} sections at 320/390/768px, NPP, diagrams and laboratory PASS`);
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
