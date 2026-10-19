// Retain complete critical-grid evidence and compact full-regression receipts.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async p=>JSON.parse(await readFile(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const dir='docs/steam97-p02',raw='.release/steam97-p02',corePath=process.argv[2];
if(!corePath)throw Error('Usage: node scripts/finalize-steam97-p02.mjs .release/<core-run>/report.json');
const [current,baseline,replay,regression,core,chromium,firefox,buildHashes]=await Promise.all([
 `${raw}/current.json`,`${raw}/baseline.json`,`${raw}/p01-replay/docs/steam97-p01/pilot-results.json`,`${raw}/regression/full-node22.json`,corePath,`${raw}/chromium/report.json`,`${raw}/firefox/report.json`,`${raw}/browser-build-sha256.json`
].map(read));
assert.equal(current.summary.failed,0);assert.equal(current.summary.queries,745);assert.equal(baseline.summary.failed,135);
assert.equal(replay.summary.water.failed,0);assert.equal(regression.summary.passed,4657);assert.equal(core.status,'passed');
assert.equal(core.build.version,'1.35.5');assert.equal(chromium.status,'passed');assert.equal(firefox.status,'passed');
const unitLog=await readFile(core.checks.find(c=>c.name==='unit').log,'utf8'),unitTests=Number(unitLog.match(/^# tests (\d+)$/m)?.[1]);
assert.equal(unitTests,1085);
for(const [path,hash] of Object.entries(buildHashes))assert.equal(sha(await readFile('dist/'+path)),hash,'Browser snapshot differs from final build: '+path);
for(const [path,value] of Object.entries(core.artifacts))assert.equal(sha(await readFile(path)),typeof value==='string'?value:value.sha256,'Core build/package changed: '+path);
const sourcePath=k=>k.startsWith('src/')?k:'src/'+k;
for(const manifest of [current.sources,replay.sourceManifest,regression.sourceManifest])for(const [k,hash] of Object.entries(manifest))assert.equal(sha(await readFile(sourcePath(k))),hash,'Source changed: '+k);
await mkdir(dir,{recursive:true});
async function compact(name,payload,field='records'){
 const {[field]:records,...header}=payload;
 const text=JSON.stringify(header,null,2).slice(0,-2)+`,\n  "${field}": [\n`+records.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n';
 await writeFile(`${dir}/${name}`,text);
}
await compact('numeric-results.json',current);
await compact('baseline-results.json',{...baseline,records:baseline.records.filter(r=>!r.passed),retained_scope:'All 135 failed query records; aggregate/source hashes for the 745-query baseline, full raw report SHA retained in acceptance.'});
await writeFile(`${dir}/p01-replay.json`,JSON.stringify(replay,null,2)+'\n');
await writeFile(`${dir}/core-results.json`,JSON.stringify(core,null,2)+'\n');
for(const [name,report] of Object.entries({chromium,firefox}))await compact(`${name}.json`,report);
const pwa={scope:'Current 1.35.5 build; local synthetic next-release update, no live deployment',browsers:{}};
for(const name of ['chromium','firefox']){
 const log=await readFile(`${raw}/pwa-${name}.log`,'utf8'),checks=log.trim().split('\n').filter(line=>line.endsWith(' PASS'));
 assert.equal(checks.length,7,`Incomplete PWA log: ${name}`);
 pwa.browsers[name]={status:'passed',checks,log_sha256:sha(Buffer.from(log))};
}
await writeFile(`${dir}/pwa-results.json`,JSON.stringify(pwa,null,2)+'\n');
const roots=regression.records.flatMap(r=>r.rootChecks||[]);
const receipt={runtime:regression.runtime,engine:regression.engine,sourceManifest:regression.sourceManifest,fixtureSha256:regression.fixtureSha256,summary:regression.summary,
 rootSummary:{checked:roots.length,invalid:roots.filter(r=>!r.valid).length},
 records:regression.records.map(r=>({id:r.id,model:r.model,mode:r.mode,status:r.status,actual:r.actual,errors:r.errors,tolerances:r.tolerances,roots:r.rootChecks.length,
  maxInputResidualRatio:Math.max(...r.rootChecks.flatMap(q=>q.residuals.map(v=>v.error/v.tolerance)))}))};
assert.equal(receipt.rootSummary.invalid,0);await compact('regression-results.json',receipt);
await writeFile(`${dir}/browser-build-sha256.json`,JSON.stringify(buildHashes,null,2)+'\n');
const files=['README.md','CHANGELOG.md','package.json','.github/workflows/release-checks.yml','scripts/build.mjs','scripts/verify-release.mjs',
 'scripts/generate-steam97-p02.py','scripts/generate-accuracy-followup.py','scripts/audit-steam97-p02.mjs','scripts/inverse-precision-common.mjs','scripts/check-steam97-p02-browser.cjs','scripts/finalize-steam97-p02.mjs','scripts/verify-steam97-p02.mjs',
 'src/engine.js','src/iapws95.js','src/inverse-phase-bracket.js','tests/steam97-p02.test.mjs','tests/fixtures/steam97-p02-reference.json','tests/fixtures/inverse-precision-reference.json','vendor/seuif97_bg.wasm',
 'docs/PRODUCT_STRATEGY_UK.md','docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json','docs/STEAMTABLES_PARITY_SPRINTS_UK.md','docs/STEAMTABLES_P02_UK.md',
 'docs/steam97-p01/pilot-policy.json','docs/steam97-p01/pilot-reference.json',
 'scripts/check-pwa-browser.cjs',...['tasks.json','numeric-results.json','baseline-results.json','p01-replay.json','core-results.json','regression-results.json','chromium.json','firefox.json','pwa-results.json','browser-build-sha256.json'].map(p=>dir+'/'+p),
 ...Object.keys(buildHashes).map(p=>'dist/'+p),...Object.keys(core.artifacts).filter(p=>!p.endsWith('.zip'))];
const artifact_sha256=Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,sha(await readFile(p))])));
const rawPaths=[`${raw}/current.json`,`${raw}/baseline.json`,`${raw}/regression/full-node22.json`,`${raw}/p01-replay/docs/steam97-p01/pilot-results.json`,corePath,`${raw}/chromium/report.json`,`${raw}/firefox/report.json`,`${raw}/pwa-chromium.log`,`${raw}/pwa-firefox.log`,'dist/water-steam-calculator.zip'];
const acceptance={schema_version:1,date:'2026-10-18',sprint:'P02',version:'1.35.5',build:core.build,
 status:'bounded_delivery_complete_reference_acceptance_blocked',bounded_delivery_accepted:true,full_sprint_accepted:false,reference_inventory_complete:false,reference_parity_verified:0,new_reference_site_numeric_responses:0,
 baseline_commit:'175a98c8ea037b8311f26745a5ce8719142882d6',p01_push_verified:true,p02_pushed:false,p02_published:false,
 completed_tasks:['P02-01','P02-02 (confirmed contract only)'],blocked_tasks:['P02-03','P02-04'],open_reference_blockers:['B01','B02','B03','B07'],remaining_domain_findings:['N03','N04'],resolved_local_findings:['N01','N02'],
 summary:{numeric:current.summary,baseline:baseline.summary,p01_replay:replay.summary,regression:regression.summary,root_checks:receipt.rootSummary,core_checks:core.checks.length,unit_tests:unitTests,browsers:Object.fromEntries([chromium,firefox].map(r=>[r.browser,{status:r.status,groups:r.checks.length,calculations:r.records.length,offlineMode:r.offlineMode}])),pwa},
 sourceManifest:current.sources,raw_evidence_sha256:Object.fromEntries(await Promise.all(rawPaths.map(async p=>[p,sha(await readFile(p))]))),artifact_sha256,
 limitations:['Finite independent same-EOS acceptance; no new direct Steam97 responses or full inventory closure.','Full core plus focused Chromium/Firefox contract scenarios; remaining unrelated browser release suites not rerun locally.','Raw logs/full regression JSON retained in .release; durable per-query receipts, all critical-grid results and hashes committed.']};
await writeFile('docs/STEAMTABLES_P02_ACCEPTANCE.json',JSON.stringify(acceptance,null,2)+'\n');
console.log(JSON.stringify({build:core.build,artifacts:files.length,numeric:current.summary,regression:regression.summary,rootChecks:receipt.rootSummary,browsers:acceptance.summary.browsers},null,2));
