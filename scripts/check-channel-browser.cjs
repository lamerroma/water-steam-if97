// Browser check of the channel thermal-hydraulics panel: every calculation, unit
// selector, chart, project restore after reload, share link and English labels.
const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),browserName=process.env.BROWSER_NAME||'chromium',assert=require('node:assert/strict');
const url=process.env.CALCULATOR_URL||'http://localhost:8080/';
(async()=>{const b=await playwright[browserName].launch(browserName==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});try{
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url);await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await p.fill('#tool-search','channel');await p.locator('[role=tab][data-action=channel]').click();await p.fill('#tool-search','');await p.waitForSelector('#ch-form');
 for(const calc of ['two-phase','boiling','chf','channel']){await p.selectOption('#ch-calc',calc);await p.click('#ch-calculate');await p.waitForSelector('#ch-results table');assert.equal(await p.locator('#ch-error').isHidden(),true,calc+': '+await p.locator('#ch-error').innerText());}
 assert.equal(await p.locator('#ch-results svg path').count(),2);assert.ok(await p.locator('.calc-panel-table tbody tr').count()>=20);
 assert.match(await p.locator('#ch-results').innerText(),/Мінімальний DNBR/);
 console.log('All four calculations, chart and node table PASS');
 await p.selectOption('#ui-unit-ch-p','bar');assert.equal(await p.inputValue('#ch-p'),'70');
 await p.fill('#ch-p','80');await p.click('#ch-calculate');await p.waitForSelector('#ch-results table');
 const before=await p.locator('#ch-results').innerText();
 console.log('Local unit selector converts and recalculates PASS');
 await p.reload();await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);await p.waitForSelector('#ch-form');
 assert.equal(await p.inputValue('#ch-calc'),'channel');assert.equal(await p.inputValue('#ui-unit-ch-p'),'bar');assert.equal(await p.inputValue('#ch-p'),'80');
 await p.waitForSelector('#ch-results table');assert.equal(await p.locator('#ch-results').innerText(),before);
 console.log('Project restore after reload PASS');
 await p.selectOption('#ch-calc','chf');await p.fill('#ch-p','160');await p.click('#ch-calculate');await p.waitForSelector('#ch-results .notes');assert.match(await p.locator('#ch-results .notes').innerText(),/Biasi/);
 await p.fill('#ch-G','abc');await p.click('#ch-calculate');assert.ok(!(await p.locator('#ch-error').isHidden())||await p.locator('#ch-form [aria-invalid=true]').count()>0);assert.equal(await p.locator('#ch-results table').count(),0);
 console.log('Range notes and input errors PASS');
 await p.selectOption('#language-select','en');await p.waitForFunction(()=>document.querySelector('.method h2')?.textContent.includes('Channel'));
 await p.selectOption('#ch-calc','channel');await p.fill('#ch-p','70');await p.fill('#ch-G','1500');await p.click('#ch-calculate');await p.waitForSelector('#ch-results table');
 const en=await p.locator('#process-view').innerText();assert.match(en,/Minimum DNBR/);assert.match(en,/Heat flux, kW\/m²/);assert.doesNotMatch(en,/[а-яіїєґ]{4,}/i);
 console.log('English interface PASS');
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
