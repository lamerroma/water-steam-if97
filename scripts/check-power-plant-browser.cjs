// Browser check of the "Енергоблок" panel: every calculation in the selector runs
// with its defaults, charts render, the project restores after reload and the
// English interface has no Ukrainian leftovers.
const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),browserName=process.env.BROWSER_NAME||'chromium',assert=require('node:assert/strict');
const url=process.env.CALCULATOR_URL||'http://localhost:8080/';
(async()=>{const b=await playwright[browserName].launch(browserName==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});try{
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=()=>p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await p.goto(url);await ready();
 await p.fill('#tool-search','power-plant');await p.locator('[role=tab][data-action=power-plant]').click();await p.fill('#tool-search','');await p.waitForSelector('#pp-form');
 const calcs=await p.$$eval('#pp-calc option',o=>o.map(x=>x.value));assert.ok(calcs.length>=3);
 for(const calc of calcs){await p.selectOption('#pp-calc',calc);await p.click('#pp-calculate');await p.waitForSelector('#pp-results table');assert.equal(await p.locator('#pp-error').isHidden(),true,calc+': '+await p.locator('#pp-error').innerText());}
 console.log(`All ${calcs.length} calculations run with defaults PASS`);
 await p.selectOption('#pp-calc','stage');await p.click('#pp-calculate');await p.waitForSelector('#pp-results svg');const before=await p.locator('#pp-results').innerText();
 await p.reload();await ready();await p.waitForSelector('#pp-results svg');assert.equal(await p.inputValue('#pp-calc'),'stage');assert.equal(await p.locator('#pp-results').innerText(),before);
 console.log('Chart and project restore after reload PASS');
 await p.selectOption('#language-select','en');await p.waitForFunction(()=>document.querySelector('.method h2')?.textContent.includes('power plant'));
 for(const calc of calcs){await p.selectOption('#pp-calc',calc);await p.click('#pp-calculate');await p.waitForSelector('#pp-results table');const text=await p.locator('#process-view').innerText();assert.doesNotMatch(text,/[а-яіїєґ]{3,}/i,calc+': '+(text.match(/.{0,40}[а-яіїєґ]{3,}.{0,20}/i)||[''])[0]);}
 console.log('English interface PASS');
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
