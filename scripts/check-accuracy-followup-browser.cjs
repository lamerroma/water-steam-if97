// Real UI/Worker values against the independent reference fixture, plus chart
// coordinates and the same calculations after the browser network is disabled.
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const{openTool,chooseModel}=require('./browser-tools.cjs');
(async()=>{
 const engine=process.env.BROWSER_NAME||'chromium',pw=require('playwright'),browser=await pw[engine].launch(engine==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{}),folder=process.env.ACCURACY_DIR||'.release/accuracy-followup',fixture=JSON.parse(await fs.readFile(folder+'/reference.json')),report={engine,records:[],errors:[]};
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8080/');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);report.build=await page.locator('#app-build-value').textContent();
  const requests=[];
  for(const model of ['IF97','IAPWS-95'])for(const[mode,a,b]of[['satp',.1,null],['satp',22.0638,null],['satp',22.06399,null],['satp',22.06399999,null],['satt',647.0959,null],['satt',647.095999999,null],['pt',22.064,647.095999999],['pt',22.064,647.096000001]])requests.push({model,mode,a,b});
  async function run(r,offline=false){
   await openTool(page,'general');await chooseModel(page,r.model);if(!await page.locator('#mode').isVisible())await page.click('#input-style-toggle');await page.selectOption('#mode',r.mode);await page.selectOption('#unit-a',r.mode==='satt'?'K':'MPa');await page.fill('#input-a',String(r.a));if(r.mode==='pt'){await page.selectOption('#unit-b','K');await page.fill('#input-b',String(r.b));}
   await page.click('#calculate');await page.waitForFunction(()=>!document.querySelector('#calculate').disabled);const row={...r,offline};const refs=fixture.records.filter(q=>q.model===r.model&&q.mode===r.mode&&q.a===r.a&&q.b===r.b);
   if(!refs.length){assert.ok(fixture.limits.some(q=>q.model===r.model&&q.mode===r.mode&&q.a===r.a));assert.equal(await page.locator('#error').isVisible(),true);row.status='model-limit';row.message=await page.locator('#error').textContent();assert.match(row.message,/стабільній гілці.*неузгодженими/);}
   else{
    assert.equal(await page.locator('#error').isVisible(),false);await page.evaluate(()=>{window.accuracyCopy=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.accuracyCopy=text}});});await page.click('#copy-result-json');await page.waitForFunction(()=>!!window.accuracyCopy);const result=await page.evaluate(()=>JSON.parse(window.accuracyCopy).result);row.checks=[];
    for(const ref of refs){const q=ref.phase===null?result.state:ref.phase===0?result.saturation.liquid:result.saturation.vapor;assert.ok(q);for(const[key,want]of Object.entries(ref.expected)){const value=q[key],difference=Math.abs(value-want),floor={p:1e-12,h:2e-8,s:2e-11,u:2e-8,rho:1e-9,w:1e-7}[key]||1e-12,tolerance=key==='T'&&r.mode==='satp'&&r.a>22.0611?2e-12:Math.max(floor,Math.abs(want)*2e-9);assert.ok(Number.isFinite(value)&&difference<=tolerance,`${engine} ${r.mode} ${r.a} ${key}: ${value} vs ${want}`);row.checks.push({phase:ref.phase,key,value,reference:want,relative:difference/Math.max(Math.abs(want),1e-30)});}}
    row.status='passed';
    if(r.mode==='pt'&&!offline){const q=result.state;row.charts=[];for(const[tool,xkey,ykey]of[['ts','s','T'],['hsdiagram','s','h'],['phdiagram','h','p']]){await openTool(page,tool);await page.waitForFunction(()=>Chart.getChart('steam-diagram')&&!document.querySelector('#diagram-save').disabled);const p=await page.evaluate(()=>{const c=Chart.getChart('steam-diagram');return {states:c.data.datasets.filter(d=>d.role==='states').flatMap(d=>d.data),scale:c.scales.y.type};});const x=q[xkey],y=q[ykey]-(ykey==='T'?273.15:0);assert.ok(p.states.some(p=>Math.abs(p.x-x)<1e-8*Math.max(1,Math.abs(x))&&Math.abs(p.y-y)<1e-8*Math.max(1,Math.abs(y))));assert.equal(p.scale,tool==='phdiagram'?'logarithmic':'linear');row.charts.push(tool);}}
   }
   report.records.push(row);console.log(engine,r.model,r.mode,r.a,row.status,offline?'offline':'');
  }
  for(const r of requests)await run(r);
  // The app and Worker are already loaded. Block all network before repeat
  // calculations, checking that no precision library depends on a remote API.
  await context.setOffline(true);for(const r of requests.filter(r=>r.model==='IAPWS-95'&&r.mode==='satp'&&r.a===22.06399999))await run(r,true);
  assert.deepEqual(report.errors,[]);report.status='passed';
 }finally{await browser.close();await fs.mkdir(folder+'/'+engine,{recursive:true});await fs.writeFile(folder+'/'+engine+'/report.json',JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
