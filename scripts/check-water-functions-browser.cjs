// Browser check of the "Функції" panel: builder, evaluation, series, errors, CSV,
// project persistence after reload and the English interface.
const playwright=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),browserName=process.env.BROWSER_NAME||'chromium',assert=require('node:assert/strict');
(async()=>{const b=await playwright[browserName].launch(browserName==='chromium'?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});try{
 const c=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.CALCULATOR_URL||'http://localhost:8080/');await p.waitForFunction(()=>!document.querySelector('#calculate').disabled);
 await p.click('[role=tab][data-action=functions]');await p.waitForSelector('#fn-form');
 await p.click('#fn-calculate');await p.waitForSelector('#fn-table');
 const text=await p.locator('#fn-results').innerText();assert.match(text,/помилок: 0/);assert.match(text,/2\s?943,2222/);assert.equal(await p.locator('.fn-series tbody tr').count(),5);
 console.log('Default program, variables, expansion and series PASS');
 await p.selectOption('#fn-b-prop','pKw');await p.fill('#fn-b-av','0.101325');await p.fill('#fn-b-bv','25');await p.click('#fn-b-add');
 assert.equal((await p.inputValue('#fn-text')).split('\n').pop(),'pKw(p=0.101325; t=25)');
 await p.selectOption('#fn-b-b','h');assert.equal(await p.locator('#fn-b-bu option').first().textContent(),'кДж/кг');
 assert.equal(await p.locator('#fn-table').count(),0,'editing clears the result');
 await p.fill('#fn-text','pKw(p=0.101325; t=25)\nfoo(p=1)\nnD(p=0.1; t=20; wl=632.8 нм)');await p.selectOption('#fn-model','IAPWS-95');await p.click('#fn-calculate');
 const rows=await p.locator('#fn-table > tbody > tr').allInnerTexts();assert.equal(rows.length,3);assert.match(rows[0],/13,99/);assert.match(rows[1],/Невідома функція «foo»/);assert.match(rows[2],/1,33/);
 const [download]=await Promise.all([p.waitForEvent('download'),p.click('#fn-csv')]);assert.equal(download.suggestedFilename(),'water-functions.csv');
 console.log('Builder, error rows, IAPWS-95 and CSV PASS');
 await p.reload();await p.waitForSelector('#fn-table',{timeout:20000});
 assert.equal(await p.inputValue('#fn-model'),'IAPWS-95');assert.match(await p.inputValue('#fn-text'),/^pKw/);assert.equal(await p.locator('#fn-table > tbody > tr').count(),3);
 console.log('Project persistence and recalculation after reload PASS');
 await p.selectOption('#language-select','en').catch(async()=>{const s=p.locator('select').filter({has:p.locator('option[value=en]')}).first();await s.selectOption('en');});
 await p.waitForFunction(()=>/Water and steam functions/.test(document.querySelector('#process-view h2')?.textContent||''));
 await p.click('#fn-calculate');assert.match(await p.locator('#fn-table').innerText(),/Unknown function “foo”/);
 console.log('English interface PASS');
 assert.deepEqual(errors,[]);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
