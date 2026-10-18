// Verify a concrete P02 delivery, never upgrade it to full Steam97 parity.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async p=>JSON.parse(await readFile(p)),sha=b=>createHash('sha256').update(b).digest('hex'),dir='docs/steam97-p02';
const acceptance=await read('docs/STEAMTABLES_P02_ACCEPTANCE.json');
for(const [path,hash] of Object.entries(acceptance.artifact_sha256))assert.equal(sha(await readFile(path)),hash,'Changed artifact: '+path);
for(const [path,hash] of Object.entries(acceptance.sourceManifest))assert.equal(sha(await readFile('src/'+path)),hash,'Changed source: '+path);
let rawPresent=0;for(const [path,hash] of Object.entries(acceptance.raw_evidence_sha256)){
 try{await access(path);}catch{continue;}assert.equal(sha(await readFile(path)),hash,'Changed raw report: '+path);rawPresent++;
}
const [fixture,numeric,baseline,regression,replay,core,tasks,matrix,plan]=await Promise.all([
 'tests/fixtures/steam97-p02-reference.json',`${dir}/numeric-results.json`,`${dir}/baseline-results.json`,`${dir}/regression-results.json`,`${dir}/p01-replay.json`,`${dir}/core-results.json`,`${dir}/tasks.json`,'docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json'
].map(read));
assert.equal(fixture.records.length,132);assert.deepEqual(fixture.precisionDigits,[70,90]);
assert.equal(fixture.generator_sha256,sha(await readFile('scripts/generate-steam97-p02.py')));
assert.equal(fixture.reference_implementation_sha256,sha(await readFile('scripts/generate-accuracy-followup.py')));
for(const c of fixture.records)assert(Math.max(...Object.values(c.convergence))<1e-25);
assert.equal(numeric.policy_sha256,sha(await readFile('docs/steam97-p01/pilot-policy.json')));
assert.equal(numeric.reference_sha256.dense,sha(await readFile('tests/fixtures/steam97-p02-reference.json')));
assert.equal(numeric.reference_sha256.P01,sha(await readFile('docs/steam97-p01/pilot-reference.json')));
assert.equal(numeric.records.length,745);assert.equal(numeric.summary.passed,745);assert(numeric.records.every(r=>r.passed));
assert.equal(new Set(numeric.records.map(r=>r.id+'/'+r.mode)).size,745);
for(const r of numeric.records){if(r.checks)assert(r.checks.every(v=>v.passed));if(r.rootChecks)assert(r.rootChecks.every(v=>v.valid));}
assert.equal(baseline.summary.failed,135);assert.equal(baseline.records.length,135);assert(baseline.records.every(r=>!r.passed));
assert.equal(regression.summary.complete,true);assert.equal(regression.summary.passed,4657);assert.equal(regression.records.length,4657);assert(regression.records.every(r=>r.status==='passed'&&r.maxInputResidualRatio<=1));
assert.deepEqual(regression.rootSummary,{checked:4947,invalid:0});
assert.equal(replay.summary.water.passed,217);assert.equal(replay.summary.units.passed,12);assert.equal(replay.summary.processes.passed,10);assert.equal(replay.summary.historical.passed,7);assert.equal(replay.summary.knownDomainGaps,2);
assert.equal(core.status,'passed');assert.equal(core.checks.length,14);assert(core.checks.every(c=>c.status==='passed'));
assert.equal(core.build.version,'1.35.5');assert.deepEqual(core.build,acceptance.build);assert.equal((await read('package.json')).version,'1.35.5');
for(const name of ['chromium','firefox']){
 const report=await read(`${dir}/${name}.json`);assert.equal(report.status,'passed');assert.equal(report.records.length,80);assert.equal(report.checks.length,7);assert.deepEqual(report.errors,[]);assert(report.build.includes(core.build.id));
 const coverage=new Set(report.records.filter(r=>r.surface==='worker').map(r=>r.model+'/'+r.mode+'/'+r.system));
 for(const [model,modes] of Object.entries(matrix.reference_input_pairs))for(const mode of modes)for(const system of ['SI','English'])assert(coverage.has(model+'/'+mode+'/'+system));
}
const pwa=await read(`${dir}/pwa-results.json`);for(const name of ['chromium','firefox']){assert.equal(pwa.browsers[name].status,'passed');assert.equal(pwa.browsers[name].checks.length,7);}
assert.equal(acceptance.bounded_delivery_accepted,true);assert.equal(acceptance.full_sprint_accepted,false);assert.equal(acceptance.reference_inventory_complete,false);
assert.equal(matrix.evidence.reference_inventory_complete,false);assert.equal(matrix.rows.length,86);assert.equal(matrix.rows.filter(r=>r.parity==='verified').length,0);
assert.equal(plan.sprints.find(s=>s.id==='P02').status,'blocked');
assert.equal(tasks.tasks.filter(t=>t.status==='done').length,2);assert.equal(tasks.tasks.filter(t=>t.status==='blocked').length,2);
console.log(JSON.stringify({status:'P02 bounded scope accepted; direct reference acceptance remains blocked',build:core.build,numeric:745,regression:4657,roots:4947,unitTests:1085,browserCalculations:160,artifacts:Object.keys(acceptance.artifact_sha256).length,rawReportsPresent:rawPresent},null,2));
