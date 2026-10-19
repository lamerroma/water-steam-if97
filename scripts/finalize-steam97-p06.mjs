import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p));
const raw='.release/steam97-p06',dir='docs/steam97-p06',corePath=process.argv[2];
if(!corePath)throw Error('Pass the successful core release report path.');
const [numeric,baseline,core,regression,fixture]=await Promise.all([raw+'/numeric.json',raw+'/baseline.json',corePath,raw+'/regression.json','tests/fixtures/steam97-p06-reference.json'].map(read));
assert.deepEqual(numeric.summary,{queries:97,passed:97,failed:0});assert.deepEqual(baseline.summary,{queries:97,passed:12,failed:85});
assert.equal(sha(await readFile('tests/fixtures/steam97-p06-reference.json')),numeric.reference_sha256);assert.equal(sha(await readFile('scripts/generate-steam97-p06.py')),fixture.generator_sha256);
assert.equal(core.status,'passed');assert.equal(core.build.version,'1.35.7');assert.equal(core.checks.length,14);assert(core.checks.every(c=>c.status==='passed'));
assert.equal(regression.status,'passed');assert.equal(regression.checks.length,7);assert.deepEqual(regression.build,core.build);
for(const [p,hash]of Object.entries(numeric.sources))assert.equal(sha(await readFile('src/'+p)),hash,'Source changed: '+p);
for(const [p,v]of Object.entries(core.artifacts))assert.equal(sha(await readFile(p)),typeof v==='string'?v:v.sha256,'Build changed: '+p);
const unitLog=await readFile(core.checks.find(c=>c.name==='unit').log,'utf8'),unitTests=Number(unitLog.match(/^# tests (\d+)$/m)?.[1]);assert.equal(unitTests,1478);
await mkdir(dir,{recursive:true});
const save=async(name,value)=>writeFile(`${dir}/${name}`,JSON.stringify(value,null,2)+'\n');
const compact=async(name,payload)=>{const {records,...header}=payload;await writeFile(`${dir}/${name}`,JSON.stringify(header,null,2).slice(0,-2)+`,\n  "records": [\n`+records.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n');};
await compact('numeric-results.json',numeric);
await compact('baseline-results.json',{...baseline,retained_scope:'All 85 failures retained. Missing new fields/modes count as failures; this is not a claim of 85 old physical calculation errors.',records:baseline.records.filter(r=>!r.passed)});
await save('core-results.json',core);
const browsers={},pwa={scope:'Local 1.35.7; synthetic 1.35.8 update only, no live deployment',browsers:{}};
for(const name of ['chromium','firefox']){
 const r=await read(`${raw}/${name}/report.json`);assert.equal(r.status,'passed');assert.equal(r.build,core.build.id);assert.equal(r.version,core.build.version);assert.equal(r.checks.length,7);assert.equal(r.records.length,45);assert.deepEqual(r.errors,[]);
 await compact(name+'.json',r);browsers[name]={status:r.status,groups:r.checks.length,calculations:r.records.length,offlineMode:r.offlineMode};
 const log=await readFile(`${raw}/pwa-${name}.log`,'utf8'),checks=log.trim().split('\n').filter(l=>l.endsWith(' PASS'));assert.equal(checks.length,7);pwa.browsers[name]={status:'passed',checks,log_sha256:sha(Buffer.from(log))};
}
await save('pwa-results.json',pwa);
const retainedRegression={...regression,checks:[]};
for(const c of regression.checks){const bytes=await readFile(c.log);assert.equal(c.status,'passed');assert.equal(sha(bytes),c.sha256);retainedRegression.checks.push({...c,output:bytes.toString()});}
await save('regression-results.json',retainedRegression);
const buildFiles=['index.html','service-worker.js','manifest.webmanifest','assets/app.js','assets/calculator-worker.js','assets/styles.css','assets/coolprop.wasm','assets/icon-192.png','assets/icon-512.png'];
const buildHashes=Object.fromEntries(await Promise.all(buildFiles.map(async p=>[p,sha(await readFile('dist/'+p))])));await save('browser-build-sha256.json',buildHashes);
for(const p of buildFiles)assert.equal(sha(await readFile(p)),buildHashes[p],'Root/dist differ: '+p);
const files=['package.json','README.md','CHANGELOG.md','.github/workflows/release-checks.yml','scripts/build.mjs','scripts/verify-release.mjs','scripts/generate-steam97-p06.py','scripts/audit-steam97-p06.mjs','scripts/steam97-p06-common.mjs','scripts/check-steam97-p06-browser.cjs','scripts/check-steam97-p06-regression.mjs','scripts/finalize-steam97-p06.mjs','scripts/verify-steam97-p06.mjs','scripts/browser-tools.cjs','scripts/check-pwa-browser.cjs',
 'vendor/seuif97_bg.wasm','vendor/seuif97.js','src/styles.css','src/locales/uk.json','src/locales/en.json','src/template.html','tests/steam97-p06.test.mjs','tests/fixtures/steam97-p06-reference.json',
 'docs/STEAMTABLES_P06_UK.md','docs/PRODUCT_STRATEGY_UK.md','docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json','docs/STEAMTABLES_PARITY_SPRINTS_UK.md',
 ...['tasks.json','numeric-results.json','baseline-results.json','core-results.json','chromium.json','firefox.json','regression-results.json','pwa-results.json','browser-build-sha256.json'].map(p=>dir+'/'+p),...buildFiles,...buildFiles.map(p=>'dist/'+p)];
const rawPaths=[raw+'/numeric.json',raw+'/baseline.json',corePath,raw+'/regression.json',...['chromium','firefox'].map(p=>`${raw}/${p}/report.json`),...regression.checks.map(c=>c.log),...core.checks.filter(c=>c.log).map(c=>c.log),'dist/water-steam-calculator.zip'];
const acceptance={schema_version:1,date:'2026-10-18',sprint:'P06',version:'1.35.7',build:core.build,baseline_commit:'f6eb456dc9c8b0edec0a0a497374d8a56761b90b',previous_delivery_push:{remote:'origin/main',commit:'f6eb456dc9c8b0edec0a0a497374d8a56761b90b',verified:true},
 status:'bounded_delivery_complete_reference_acceptance_blocked',bounded_delivery_accepted:true,full_sprint_accepted:false,reference_inventory_complete:false,reference_parity_verified:0,new_reference_site_numeric_responses:0,pushed:false,published:false,open_reference_blockers:['B01','B03'],
 summary:{independent_states:fixture.records.length,numeric:numeric.summary,baseline:baseline.summary,core_checks:core.checks.length,unit_tests:unitTests,browsers,affected_regression_checks:regression.checks.length,pwa},sourceManifest:numeric.sources,
 artifact_sha256:Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async p=>[p,sha(await readFile(p))]))),raw_evidence_sha256:Object.fromEntries(await Promise.all([...new Set(rawPaths)].sort().map(async p=>[p,sha(await readFile(p))]))),
 limitations:['Independent finite same-EOS checks establish numerical agreement, not measurement uncertainty or direct Steam97Web parity.','Wet/supercritical display rules are explicit local choices pending direct reference examples.','Previous P05 full inverse audit remains historical; unrelated browser suites and live deployment not repeated.','All numeric current records, baseline failures, browser records and regression outputs retained in docs; optional full logs/reports remain in .release.']};
await writeFile('docs/STEAMTABLES_P06_ACCEPTANCE.json',JSON.stringify(acceptance,null,2)+'\n');console.log(JSON.stringify({build:core.build,...acceptance.summary},null,2));
