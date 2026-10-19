import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p)),raw='.release/steam97-p07',dir='docs/steam97-p07',corePath=process.argv[2];
if(!corePath)throw Error('Pass the successful final core report path.');
const [numeric,core,regression,fixture]=await Promise.all([raw+'/numeric.json',corePath,raw+'/regression.json','tests/fixtures/steam97-p07-reference.json'].map(read));
assert.deepEqual(numeric.summary,{queries:184,passed:184,failed:0,states:172,background_controls:108,drawing_controls:12});
assert.equal(core.status,'passed');assert.equal(core.build.version,'1.35.8');assert.equal(core.checks.length,14);assert(core.checks.every(c=>c.status==='passed'));
assert.equal(regression.status,'passed');assert.equal(regression.checks.length,8);assert.deepEqual(regression.build,core.build);
assert.equal(sha(await readFile('tests/fixtures/steam97-p07-reference.json')),numeric.reference_sha256);assert.equal(sha(await readFile('scripts/generate-steam97-p07.py')),fixture.generator_sha256);
for(const [p,hash]of Object.entries(numeric.sources))assert.equal(sha(await readFile('src/'+p)),hash,'Source changed: '+p);
for(const [p,v]of Object.entries(core.artifacts))assert.equal(sha(await readFile(p)),typeof v==='string'?v:v.sha256,'Artifact changed: '+p);
const unitLog=await readFile(core.checks.find(c=>c.name==='unit').log,'utf8'),unitTests=Number(unitLog.match(/^# tests (\d+)$/m)?.[1]);assert.equal(unitTests,1663);
await mkdir(dir,{recursive:true});const save=async(name,value)=>writeFile(`${dir}/${name}`,JSON.stringify(value,null,2)+'\n');
const compact=async(name,payload)=>{const {records,...header}=payload;await writeFile(`${dir}/${name}`,JSON.stringify(header,null,2).slice(0,-2)+`,\n  "records": [\n`+records.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n');};
await compact('numeric-results.json',numeric);await save('core-results.json',core);
const browsers={},pwa={scope:'Local 1.35.8; synthetic 1.35.9 update only; no live deployment',browsers:{}};
for(const name of ['chromium','firefox']){
 const r=await read(`${raw}/${name}/report.json`);assert.equal(r.status,'passed');assert.equal(r.build,core.build.id);assert.equal(r.version,core.build.version);assert.equal(r.checks.length,6);assert.equal(r.records.length,12);assert.deepEqual(r.errors,[]);
 await compact(name+'.json',r);browsers[name]={status:r.status,groups:6,model_diagram_unit_combinations:12,anchor_comparisons:48,offlineMode:r.offlineMode};
 const log=await readFile(`${raw}/pwa-${name}.log`,'utf8'),checks=log.trim().split('\n').filter(l=>l.endsWith(' PASS'));assert.equal(checks.length,7);pwa.browsers[name]={status:'passed',checks,log_sha256:sha(Buffer.from(log))};
}
await save('pwa-results.json',pwa);
const retained={...regression,checks:[]};for(const c of regression.checks){const bytes=await readFile(c.log);assert.equal(c.status,'passed');assert.equal(sha(bytes),c.sha256);retained.checks.push({...c,output:bytes.toString()});}await save('regression-results.json',retained);
const buildFiles=['index.html','service-worker.js','manifest.webmanifest','assets/app.js','assets/calculator-worker.js','assets/styles.css','assets/coolprop.wasm','assets/icon-192.png','assets/icon-512.png'];
const buildHashes=Object.fromEntries(await Promise.all(buildFiles.map(async p=>[p,sha(await readFile('dist/'+p))])));await save('browser-build-sha256.json',buildHashes);for(const p of buildFiles)assert.equal(sha(await readFile(p)),buildHashes[p],'Root/dist differ: '+p);
const files=['package.json','README.md','CHANGELOG.md','.github/workflows/release-checks.yml','scripts/build.mjs','scripts/verify-release.mjs','scripts/generate-steam97-p07.py','scripts/audit-steam97-p07.mjs','scripts/steam97-p07-common.mjs','scripts/check-steam97-p07-browser.cjs','scripts/check-steam97-p07-regression.mjs','scripts/finalize-steam97-p07.mjs','scripts/verify-steam97-p07.mjs','scripts/browser-tools.cjs','scripts/check-pwa-browser.cjs',
 'vendor/seuif97_bg.wasm','vendor/seuif97.js','src/styles.css','src/locales/uk.json','src/locales/en.json','src/template.html','tests/diagram-series.test.mjs','tests/steam97-p07.test.mjs','tests/fixtures/steam97-p07-reference.json','docs/STEAMTABLES_P07_UK.md','docs/PRODUCT_STRATEGY_UK.md','docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json','docs/STEAMTABLES_PARITY_SPRINTS_UK.md',
 ...['tasks.json','numeric-results.json','core-results.json','chromium.json','firefox.json','regression-results.json','pwa-results.json','browser-build-sha256.json','managed-file-harness.cjs'].map(p=>dir+'/'+p),...buildFiles,...buildFiles.map(p=>'dist/'+p)];
const rawPaths=[raw+'/numeric.json',corePath,raw+'/regression.json',...['chromium','firefox'].map(p=>`${raw}/${p}/report.json`),...regression.checks.map(c=>c.log),...core.checks.filter(c=>c.log).map(c=>c.log),'dist/water-steam-calculator.zip'];
const acceptance={schema_version:1,date:'2026-10-18',sprint:'P07',version:'1.35.8',build:core.build,baseline_commit:'b1a2c75d0652b32b6ba4ed5fa5101755dbfc5867',status:'bounded_delivery_complete_reference_acceptance_blocked',bounded_delivery_accepted:true,full_sprint_accepted:false,reference_inventory_complete:false,reference_parity_verified:0,new_reference_site_numeric_responses:0,dedicated_reference_vapor_view_verified:false,pushed:false,published:false,open_reference_blockers:['B01','B03','B09'],
 summary:{numeric:numeric.summary,max_spline_pixel_error:Math.max(...numeric.records.map(r=>r.error||0).filter(Number.isFinite)),core_checks:14,unit_tests:unitTests,browsers,affected_regression_checks:8,pwa},sourceManifest:numeric.sources,
 artifact_sha256:Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async p=>[p,sha(await readFile(p))]))),raw_evidence_sha256:Object.fromEntries(await Promise.all([...new Set(rawPaths)].sort().map(async p=>[p,sha(await readFile(p))]))),
 limitations:['Local steam h-s viewport is a viewing preset; dedicated reference bounds/backgrounds and exact interpolation semantics remain open.','Finite independent EOS/geometry controls are numerical evidence, not measurement uncertainty or full Steam97Web parity.','Managed Chromium file navigation is denied; declared loopback/offline and saved-SVG harness used locally. Firefox exercises real standalone file navigation.','Original EOS and inverse search unchanged; prior 4657-query audit remains baseline evidence. Unrelated browser suites and deployment not repeated.']};
await writeFile('docs/STEAMTABLES_P07_ACCEPTANCE.json',JSON.stringify(acceptance,null,2)+'\n');console.log(JSON.stringify({build:core.build,...acceptance.summary},null,2));
