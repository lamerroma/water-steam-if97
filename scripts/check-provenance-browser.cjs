const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
 try{
  const page=await browser.newPage({acceptDownloads:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.CALCULATOR_URL||'http://localhost:8080/');
  await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const version=(await page.locator('#app-version-value').textContent()).trim();
  const download=async action=>{const [file]=await Promise.all([page.waitForEvent('download'),action()]);return fs.readFile(await file.path(),'utf8');};
  await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#export-csv').disabled);
  const csv=await download(()=>page.click('#export-csv'));
  assert.ok(csv.includes('export_app_version'));assert.ok(csv.includes(version));assert.ok(csv.includes('state / pt'));
  const html=await download(()=>page.locator('#file-report').evaluate(el=>el.click()));
  assert.ok(html.includes('data-export-provenance'));assert.ok(html.includes(version));
  const project=JSON.parse(await download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(el=>el.click())));
  assert.equal(project.version,1);assert.equal(project.savedWith.appVersion,version);assert.equal(project.exportedWith.appVersion,version);
  const old={appVersion:'1.14.0',buildId:'old-build',method:'project / multiple methods',model:'per result'};
  project.savedWith=old;delete project.exportedWith;
  const fileInput=page.locator('input[type=file][accept=".json,application/json"]');
  await fileInput.setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('water-steam-if97-project-v1')).importedFrom?.buildId==='old-build');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const restored=JSON.parse(await download(()=>page.getByRole('button',{name:'Експорт проєкту JSON',exact:true,includeHidden:true}).evaluate(el=>el.click())));
  assert.deepEqual(restored.importedFrom,old);assert.equal(restored.savedWith.appVersion,version);assert.deepEqual(restored.history,project.history);
  delete project.savedWith;delete project.importedFrom;
  await fileInput.setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await openTool(page,'batch');
  const example=await download(()=>page.click('#batch-example'));
  assert.ok(!example.includes('export_app_version'));
  assert.deepEqual(errors,[]);console.log('CSV, HTML, JSON, old-project import, provenance reload and reusable input CSV PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
