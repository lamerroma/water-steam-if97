from pathlib import Path
import hashlib,json

root=Path.cwd(); out=root/'.release/publication-1.41.0'
commit='5dc609c92fe80a7ffe050b4cc0696d6876628ac2'
records=[]
def adapt(source,target,changes):
    raw=(root/source).read_bytes(); text=raw.decode('utf-8')
    for old,new in changes:
        assert old in text,(source,old)
        text=text.replace(old,new)
    dest=out/target; dest.write_bytes(text.replace('\r\n','\n').encode())
    records.append({'source':source,'sourceSHA256':hashlib.sha256(raw).hexdigest(),'driver':target,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'changes':changes})

adapt('docs/release-1.40.1/verify-publication-bytes.py','verify-publication-bytes.py',[
    ('.release/functional-restore/publication-1.40.1','.release/publication-1.41.0'),
    ('9a158c0cf62d1e192cc7bb8853a8405907e3c1b1',commit),('5b5173c2a5cf','a8e94fb1e643')])

for kind in ['legacy-parity','legacy-project','diagram-navigation']:
    changes=[("require('./browser-tools.cjs')","require(path.join(process.cwd(),'scripts/browser-tools.cjs'))")]
    if kind=='legacy-parity':
        changes.extend([
            ('await page.goto(url)','await page.goto(url,{waitUntil:"domcontentloaded",timeout:120000})'),
            ('page.click(item.button,{timeout:20000})','page.click(item.button,{timeout:120000})'),
            ("target.build=await page.locator('#app-version').textContent();", "target.build=await page.locator('#app-version').textContent();if(targetName!=='baseline'){await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),null,{timeout:300000});target.waitedForCompletePublicOfflineCache=true;assert.match(target.build,/1\\.41\\.0/);}")])
    else:
        changes.append(('await page.goto(url)','await page.goto(url,{waitUntil:"domcontentloaded",timeout:120000})'))
        if kind=='diagram-navigation':
            changes.append(("report.build=await page.locator('#app-build-value').textContent();await forceCancellation", "report.build=await page.locator('#app-build-value').textContent();await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''),null,{timeout:300000});report.waitedForCompletePublicOfflineCache=true;await forceCancellation"))
    adapt('scripts/check-'+kind+'-browser.cjs','check-'+kind+'-public.cjs',changes)

adapt('scripts/check-library-recipes-browser.cjs','check-library-recipes-public.cjs',[
    ("require('./browser-tools.cjs')","require(path.join(process.cwd(),'scripts/browser-tools.cjs'))"),
    ("const url='http://127.0.0.1:'+server.address().port+'/water-steam-if97/'","const url='https://lamerroma.github.io/water-steam-if97/'"),
    ("{headless:true,viewport:{width:1440,height:1000}}","{headless:true,viewport:{width:1440,height:1000},...(disconnected?{proxy:{server:'http://127.0.0.1:9'}}:{})}"),
    ('await page.goto(url)','await page.goto(url,{waitUntil:"domcontentloaded",timeout:120000})'),
    ('{timeout:120000}','{timeout:300000}'),
    ("await page.waitForFunction(()=>document.querySelector('#py-run')?.disabled===false,null,{timeout:300000});await page.click('#py-recipe-example');", "await page.waitForFunction(()=>document.querySelector('#py-run')?.disabled===false||!document.querySelector('#py-error').hidden,null,{timeout:600000});if(await page.locator('#py-error').isVisible()){report.packagePreparationError=await page.locator('#py-error').textContent();await page.screenshot({path:path.join(out,'package-preparation-error.png'),fullPage:true});throw Error(report.packagePreparationError);}await page.click('#py-recipe-example');"),
    ("profile=await fs.mkdtemp(path.join(os.tmpdir(),'thermo-recipe-'))", "profile=process.env.LIBRARY_RECIPES_PROFILE||await fs.mkdtemp(path.join(os.tmpdir(),'thermo-recipe-'))"),
    ("await ready(page);report.build=", "await publicReady(page);report.profile=profile;report.preparationProfileReuse=!!process.env.LIBRARY_RECIPES_PROFILE;report.build="),
    (" try{\n  context=await launch();", " async function publicReady(page){await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')||!document.querySelector('#pwa-retry').hidden,null,{timeout:300000});if(!await page.evaluate(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||''))){report.coreDownloadRetry={status:await page.locator('#pwa-status').textContent()};await page.screenshot({path:path.join(out,'core-download-retry.png'),fullPage:true});if(await page.locator('#pwa-panel').getAttribute('open')===null)await page.locator('#pwa-panel summary').click();await page.click('#pwa-retry');await page.waitForFunction(()=>navigator.serviceWorker.controller&&/готова|ready offline/.test(document.querySelector('#pwa-status')?.textContent||'')||!document.querySelector('#pwa-update').hidden,null,{timeout:300000});if(await page.locator('#pwa-update').isVisible())await page.click('#pwa-update');}await ready(page);report.preparedCompletePublicCoreCache=true;}\n try{\n  context=await launch();"),
    ("report.build=await page.locator('#app-build-value').textContent();","report.url=url;report.build=await page.locator('#app-build-value').textContent();assert.equal(report.build,'a8e94fb1e643');"),
    ('Closed profile/server disconnected/offline:','Public GitHub Pages origin, closed profile/dead proxy/offline:'),
    ('Input/replay/project/offline integration and elementary cylinder geometry only;', 'Actual public GitHub Pages input/replay/project/offline integration and elementary cylinder geometry only;')])

(out/'drivers.json').write_bytes((json.dumps({'acceptedCommit':commit,'scope':'Public-URL adapters of existing audited browser scenarios. Navigation waits use DOMContentLoaded/120s rather than local-server load/30s. Recipe offline launch also has an unreachable proxy. App/Worker calculations are unchanged.','drivers':records},ensure_ascii=False,indent=2)+'\n').encode())
print('Prepared',len(records),'public acceptance drivers')
