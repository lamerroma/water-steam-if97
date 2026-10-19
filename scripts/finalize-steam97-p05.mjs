import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p)),raw='.release/steam97-p05',dir='docs/steam97-p05';
const corePath=process.argv[2];if(!corePath)throw Error('Pass the successful core release report path.');
const [numeric,baseline,p02,regression,core]=await Promise.all([`${raw}/numeric.json`,`${raw}/baseline.json`,`${raw}/p02-regression.json`,`${raw}/regression/full.json`,corePath].map(read));
assert.equal(numeric.summary.total,435);assert.equal(numeric.summary.failed,0);assert.equal(baseline.summary.total,435);assert.equal(baseline.summary.failed,321);
assert.equal(p02.summary.passed,745);assert.equal(p02.summary.failed,0);assert.equal(regression.summary.passed,4657);assert.equal(regression.summary.failed,0);assert.equal(regression.summary.different,0);
assert.equal(core.status,'passed');assert.equal(core.build.version,'1.35.6');assert(core.checks.every(c=>c.status==='passed'));
for(const manifest of [numeric.sources,p02.sources,regression.sourceManifest])for(const [path,hash]of Object.entries(manifest))assert.equal(sha(await readFile(path.startsWith('src/')?path:'src/'+path)),hash,'Source changed: '+path);
for(const [path,value]of Object.entries(core.artifacts))assert.equal(sha(await readFile(path)),typeof value==='string'?value:value.sha256,path);
const unitLog=await readFile(core.checks.find(c=>c.name==='unit').log,'utf8'),unitTests=Number(unitLog.match(/^# tests (\d+)$/m)?.[1]);assert.equal(unitTests,1376);
await mkdir(dir,{recursive:true});
const compact=async(name,payload)=>{const {records,...header}=payload;await writeFile(`${dir}/${name}`,JSON.stringify(header,null,2).slice(0,-2)+`,\n  "records": [\n`+records.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n');};
await compact('numeric-results.json',numeric);await compact('baseline-results.json',{...baseline,retained_scope:'All 321 failures retained; full baseline has 435 records.',records:baseline.records.filter(r=>!r.passed)});await compact('p02-regression.json',p02);
const roots=regression.records.flatMap(r=>r.rootChecks||[]),rootSummary={checked:roots.length,invalid:roots.filter(r=>!r.valid).length};assert.equal(rootSummary.invalid,0);
await compact('regression-results.json',{runtime:regression.runtime,sourceManifest:regression.sourceManifest,fixtureSha256:regression.fixtureSha256,summary:regression.summary,rootSummary,
 records:regression.records.map(r=>({id:r.id,model:r.model,mode:r.mode,status:r.status,actual:r.actual,errors:r.errors,tolerances:r.tolerances,roots:r.rootChecks.length,maxInputResidualRatio:Math.max(...r.rootChecks.flatMap(q=>q.residuals.map(v=>v.error/v.tolerance)))}))});
await writeFile(`${dir}/core-results.json`,JSON.stringify(core,null,2)+'\n');
const browsers={},pwa={scope:'Current 1.35.6 build; synthetic 1.35.7 update only, no live deployment',browsers:{}};
for(const name of ['chromium','firefox']){
 const focused=await read(`${raw}/${name}/report.json`),previous=await read(`${raw}/p02-${name}/report.json`);
 for(const r of [focused,previous]){assert.equal(r.status,'passed');assert.equal(r.build,core.build.id);assert.deepEqual(r.errors,[]);}
 assert.equal(focused.checks.length,5);assert.equal(previous.checks.length,7);assert.equal(previous.records.length,80);
 await compact(`${name}.json`,focused);await compact(`p02-${name}.json`,previous);
 browsers[name]={status:'passed',p05:{calculations:focused.records.length,groups:focused.checks.length,offlineMode:focused.offlineMode},p02:{calculations:previous.records.length,groups:previous.checks.length,offlineMode:previous.offlineMode}};
 const log=await readFile(`${raw}/pwa-${name}.log`,'utf8'),checks=log.trim().split('\n').filter(l=>l.endsWith(' PASS'));assert.equal(checks.length,7,name);
 pwa.browsers[name]={status:'passed',checks,log_sha256:sha(Buffer.from(log))};
}
await writeFile(`${dir}/pwa-results.json`,JSON.stringify(pwa,null,2)+'\n');
const buildFiles=['index.html','service-worker.js','manifest.webmanifest','assets/app.js','assets/calculator-worker.js','assets/styles.css','assets/coolprop.wasm','assets/icon-192.png','assets/icon-512.png'];
const buildHashes=Object.fromEntries(await Promise.all(buildFiles.map(async p=>[p,sha(await readFile('dist/'+p))])));await writeFile(`${dir}/browser-build-sha256.json`,JSON.stringify(buildHashes,null,2)+'\n');
const files=['package.json','README.md','CHANGELOG.md','.github/workflows/release-checks.yml','scripts/build.mjs','scripts/verify-release.mjs','scripts/generate-steam97-p05.py','scripts/audit-steam97-p05.mjs','scripts/check-steam97-p05-browser.cjs','scripts/finalize-steam97-p05.mjs','scripts/verify-steam97-p05.mjs','scripts/inverse-precision-common.mjs','scripts/audit-inverse-precision.mjs','scripts/audit-steam97-p02.mjs','scripts/check-steam97-p02-browser.cjs','scripts/browser-tools.cjs','scripts/check-pwa-browser.cjs','vendor/seuif97_bg.wasm','vendor/seuif97.js','src/styles.css','tests/steam97-p05.test.mjs','tests/smart-input.test.mjs','tests/project.test.mjs','tests/fixtures/steam97-p05-reference.json','tests/fixtures/inverse-precision-reference.json','tests/fixtures/steam97-p02-reference.json','src/locales/uk.json','src/locales/en.json','src/template.html','docs/STEAMTABLES_P05_UK.md','docs/PRODUCT_STRATEGY_UK.md','docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json','docs/STEAMTABLES_PARITY_SPRINTS_UK.md',
 ...['tasks.json','validity-map.json','numeric-results.json','baseline-results.json','p02-regression.json','regression-results.json','core-results.json','chromium.json','firefox.json','p02-chromium.json','p02-firefox.json','pwa-results.json','browser-build-sha256.json'].map(p=>dir+'/'+p),...buildFiles.map(p=>'dist/'+p),...Object.keys(core.artifacts).filter(p=>!p.endsWith('.zip'))];
const rawPaths=[`${raw}/numeric.json`,`${raw}/baseline.json`,`${raw}/p02-regression.json`,`${raw}/regression/full.json`,corePath,...['chromium','firefox','p02-chromium','p02-firefox'].map(p=>`${raw}/${p}/report.json`),`${raw}/pwa-chromium.log`,`${raw}/pwa-firefox.log`,'dist/water-steam-calculator.zip'];
const acceptance={schema_version:1,date:'2026-10-18',sprint:'P05',version:'1.35.6',build:core.build,baseline_commit:'8f85659',status:'scientific_bounded_delivery_complete_reference_acceptance_blocked',bounded_delivery_accepted:true,full_sprint_accepted:false,reference_inventory_complete:false,reference_parity_verified:0,new_reference_site_numeric_responses:0,pushed:false,published:false,resolved_local_findings:['N03','N04'],open_reference_blockers:['B01','B03','B06'],summary:{numeric:numeric.summary,baseline:baseline.summary,p02:p02.summary,regression:regression.summary,root_checks:rootSummary,core_checks:core.checks.length,unit_tests:unitTests,browsers,pwa},sourceManifest:numeric.sources,
 artifact_sha256:Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async p=>[p,sha(await readFile(p))]))),raw_evidence_sha256:Object.fromEntries(await Promise.all(rawPaths.map(async p=>[p,sha(await readFile(p))]))),
 limitations:['Finite independent same-EOS checks are numerical evidence, not measurement uncertainty or full Steam97Web parity.','Core plus focused P05/P02 Chromium/Firefox and offline/PWA checks; unrelated browser suites not repeated.','Raw full audit/logs in .release; complete per-query receipts and hashes retained in docs. Historical P01/P02 evidence remains unchanged at its recorded baseline.']};
await writeFile('docs/STEAMTABLES_P05_ACCEPTANCE.json',JSON.stringify(acceptance,null,2)+'\n');console.log(JSON.stringify({build:core.build,...acceptance.summary},null,2));
