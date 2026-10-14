const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browserName=process.env.BROWSER_NAME||'chromium';
if(!['chromium','firefox'].includes(browserName))throw Error('Unsupported browser: '+browserName);
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {openTool}=require('./browser-tools.cjs');
(async()=>{
 const browser=await playwright[browserName].launch(browserName==='chromium'?{...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']}:{});
 try{
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(process.env.CALCULATOR_URL||'http://localhost:8080/');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
  const calculate=async()=>{await p.click('#calculate');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);};
  await p.fill('#input-a','-1');await p.fill('#input-b','2500');await calculate();
  assert.equal(await p.locator('#calculator-error-summary button').count(),2);
  await p.locator('#calculator-error-summary button').last().click();assert.equal(await p.locator('#input-b').evaluate(e=>e===document.activeElement),true);
  await p.fill('#input-a','3');assert.equal(await p.locator('#calculator-error-summary button').count(),1);assert.equal(await p.locator('#input-b').getAttribute('aria-invalid'),'true');
  await p.fill('#input-b','100,5');assert.equal(await p.locator('#calculator-error-summary').isHidden(),true);await calculate();
  assert.equal(await p.locator('#calculator-result-summary button').count(),6);assert.equal(await p.locator('#error').isHidden(),true);
  // Deterministic clipboard seam: exercise both native success and rejected writes.
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedValue=text;}}}));
  await p.click('#calculator-result-summary [data-copy=T]');assert.equal(await p.evaluate(()=>window.copiedValue),'100,5 °C');
  await p.uncheck('#calculator-copy-units');await p.click('#calculator-result-summary [data-copy=T]');assert.equal(await p.evaluate(()=>window.copiedValue),'100,5');
  await p.selectOption('#language-select','en');await p.check('#calculator-copy-units');await p.click('#calculator-result-summary [data-copy=T]');assert.equal(await p.evaluate(()=>window.copiedValue),'100.5 °C');
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));
  await p.click('#calculator-result-summary [data-copy=T]');assert.equal(await p.locator('#copy-result-dialog textarea').inputValue(),'100.5 °C');await p.keyboard.press('Escape');assert.equal(await p.locator('#copy-result-dialog').count(),0);assert.equal(await p.locator('#calculator-result-summary [data-copy=T]').evaluate(e=>e===document.activeElement),true);
  console.log('Validation links, live correction, summary, localized copy and denied-clipboard fallback PASS');
  await p.locator('[data-history-name="0"]').fill('Reference state');await p.locator('[data-history-name="0"]').press('Tab');
  await p.click('[data-quick-mode=ph]');await p.fill('#input-a','1');await p.fill('#input-b','3000');await calculate();
  await p.click('[data-history-report="1"]');await p.click('#calculator-open-report');assert.equal(await p.locator('#study-list fieldset').count(),1);assert.equal(await p.locator('#study-list fieldset input').first().inputValue(),'Reference state');
  await p.click('#study-preview');await p.frameLocator('#study-preview-frame').locator('h1').waitFor();assert.ok((await p.frameLocator('#study-preview-frame').locator('body').textContent()).includes('373.65'));
  await openTool(p,'general');await p.click('[data-history-open="1"]');assert.equal(await p.locator('#mode').inputValue(),'pt');assert.equal(await p.locator('#input-a').inputValue(),'3');assert.equal(await p.locator('#input-b').inputValue(),'100.5');assert.equal(await p.locator('[data-history-open]').count(),2);
  await p.locator('.form-buttons [data-action=clear]').click();assert.equal(await p.locator('#calculator-result-tools').isHidden(),true);assert.equal(await p.locator('[data-history-open]').count(),2);
  await p.click('[data-history-open="1"]');await p.click('#history-clear');assert.equal(await p.locator('[data-history-open]').count(),0);assert.equal(await p.locator('#calculator-result-summary button').count(),6);assert.equal(await p.locator('#history-undo').isVisible(),true);await p.click('#history-undo');assert.equal(await p.locator('[data-history-open]').count(),2);
  await p.reload();await p.waitForFunction(()=>!document.querySelector('#calculate').disabled&&document.querySelector('#input-b').value==='100.5');assert.equal(await p.locator('#mode').inputValue(),'pt');assert.equal(await p.locator('#input-b').inputValue(),'100.5');
  console.log('History source restoration, direct report, preview, separate clearing, undo and reload PASS');
  await p.click('[data-quick-mode=satp]');await p.fill('#input-a','0.1');await calculate();
  await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedValue=text;}}}));
  await p.click('[data-copy-phase=liquid][data-copy=h]');const liquid=await p.evaluate(()=>window.copiedValue);await p.click('[data-copy-phase=vapor][data-copy=h]');const vapor=await p.evaluate(()=>window.copiedValue);assert.notEqual(liquid,vapor);assert.ok(liquid.includes('kJ/kg'));
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.ok((await p.locator('[data-copy-phase=liquid][data-copy=h]').boundingBox()).height>=44);
  await p.click('[data-quick-mode=pt]');await p.fill('#input-a','3');await p.fill('#input-b','100');await calculate();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390);assert.ok((await p.locator('#calculator-result-summary button').first().boundingBox()).height>=44);
  const evidence=path.resolve('.release/calculator-121');await fs.mkdir(evidence,{recursive:true});await p.screenshot({path:path.join(evidence,'mobile.png'),fullPage:true});await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:path.join(evidence,'desktop.png'),fullPage:true});
  console.log('Distinct saturation phase values, mobile overflow and touch targets PASS');
  const off=await ctx.newPage();off.on('pageerror',e=>errors.push(e.message));await ctx.setOffline(true);await off.goto(require('node:url').pathToFileURL(path.resolve('standalone.html')).href);await off.waitForFunction(()=>!document.querySelector('#calculate').disabled);await off.click('#calculate');await off.waitForFunction(()=>!document.querySelector('#calculate').disabled);assert.equal(await off.locator('#calculator-result-summary button').count(),6);await off.click('#calculator-add-report');await off.click('#calculator-open-report');assert.equal(await off.locator('#study-list fieldset').count(),1);assert.deepEqual(errors,[]);console.log('Standalone calculation → report offline PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
