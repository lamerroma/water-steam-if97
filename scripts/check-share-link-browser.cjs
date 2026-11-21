// Browser check of calculation links: copy from the main form and from a panel,
// open each link in a fresh profile, and reject a damaged link.
const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),browserName=process.env.BROWSER_NAME||'chromium',assert=require('node:assert/strict');
const url=process.env.CALCULATOR_URL||'http://localhost:8080/';
(async()=>{const b=await playwright[browserName].launch(browserName==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});try{
 const ready=p=>p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 const fresh=async()=>{const c=await b.newContext({viewport:{width:1440,height:1000},...(browserName==='chromium'?{permissions:['clipboard-read','clipboard-write']}:{})}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));return {c,p,errors};};
 const copy=async p=>{await p.evaluate(()=>{window.__shared=null;navigator.clipboard.writeText=async t=>{window.__shared=t;};document.querySelector('#file-share-link').click();});await p.waitForFunction(()=>window.__shared);return p.evaluate(()=>window.__shared);};
 const A=await fresh();await A.p.goto(url);await ready(A.p);
 await A.p.click('[data-quick-mode=pt]');await A.p.fill('#input-a','12.5');await A.p.fill('#input-b','560');await A.p.click('#calculate');await A.p.waitForFunction(()=>/\d,\d+\s*kJ\/kg/.test(document.querySelector('#results')?.innerText||''));
 const general=await copy(A.p);assert.match(general,/#calc=[A-Za-z0-9_-]+$/);assert.match(await A.p.locator('#result-status').innerText(),/скопійовано/);
 const resultA=await A.p.locator('#results').innerText();
 await A.p.click('[role=tab][data-action=functions]');await A.p.waitForSelector('#fn-form');await A.p.fill('#fn-text','h1 = h(p=3; t=400)');
 const panel=await copy(A.p);assert.notEqual(panel,general);
 console.log('Copy link from main form and panel PASS');
 const B=await fresh();await B.p.goto(general);await ready(B.p);await B.p.waitForFunction(()=>location.hash==='');
 assert.equal(await B.p.inputValue('#input-a'),'12.5');assert.equal(await B.p.inputValue('#input-b'),'560');assert.equal(await B.p.inputValue('#mode'),'pt');
 const hOf=t=>(t.match(/[Ее]нтальпія[^\n]*\n?[^\n]*/)||[t.slice(0,200)])[0];await B.p.waitForFunction(()=>/\d,\d+\s*kJ\/kg/.test(document.querySelector('#results')?.innerText||''));const resultB=await B.p.locator('#results').innerText();assert.equal(hOf(resultB),hOf(resultA),resultB.slice(0,300));assert.equal(new URL(B.p.url()).hash,'');
 console.log('Open main form link in a fresh profile, recompute, clear fragment PASS');
 await B.p.close();B.p=await B.c.newPage();B.p.on('pageerror',e=>B.errors.push(e.message));await B.p.goto(panel);await ready(B.p);await B.p.waitForSelector('#fn-form');assert.equal(await B.p.inputValue('#fn-text'),'h1 = h(p=3; t=400)');
 await B.p.waitForSelector('#fn-table');assert.match(await B.p.locator('#fn-results').innerText(),/3\s?231,57/);
 console.log('Open panel link, restore inputs and recompute PASS');
 const C=await fresh();await C.p.goto(url+'#calc=AAAA');await ready(C.p);await C.p.waitForFunction(()=>!document.querySelector('#error').hidden);
 assert.match(await C.p.locator('#error').innerText(),/пошкоджене/);assert.equal(new URL(C.p.url()).hash,'');
 console.log('Damaged link reported and ignored PASS');
 for(const x of [A,B,C])assert.deepEqual(x.errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
