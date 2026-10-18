import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p));
const a=await read('docs/STEAMTABLES_P06_ACCEPTANCE.json');
assert.equal((await read('package.json')).version,a.version);assert.equal(a.bounded_delivery_accepted,true);assert.equal(a.full_sprint_accepted,false);assert.equal(a.reference_parity_verified,0);assert.equal(a.new_reference_site_numeric_responses,0);
for(const [p,hash]of Object.entries(a.artifact_sha256))assert.equal(sha(await readFile(p)),hash,'Artifact changed: '+p);
for(const [p,hash]of Object.entries(a.sourceManifest))assert.equal(sha(await readFile('src/'+p)),hash,'Source changed: '+p);
let rawPresent=0;for(const [p,hash]of Object.entries(a.raw_evidence_sha256)){let bytes;try{bytes=await readFile(p);}catch(e){if(e.code==='ENOENT')continue;throw e;}assert.equal(sha(bytes),hash,'Raw evidence changed: '+p);rawPresent++;}
const fixture=await read('tests/fixtures/steam97-p06-reference.json');assert.equal(sha(await readFile('scripts/generate-steam97-p06.py')),fixture.generator_sha256);assert.equal(fixture.records.length,49);
const plan=await read('docs/STEAMTABLES_PARITY_SPRINTS.json'),tasks=await read('docs/steam97-p06/tasks.json'),sprint=plan.sprints.find(s=>s.id==='P06'),matrix=await read('docs/STEAMTABLES_PARITY_MATRIX.json');
assert.deepEqual([...tasks.requirement_ids].sort(),[...sprint.requirement_ids].sort());assert.equal(sprint.bounded_delivery.full_sprint_accepted,false);
for(const id of sprint.requirement_ids){const row=matrix.rows.find(r=>r.id===id);assert.equal(row.implementation,'present');assert.equal(row.parity,'requires_reference_cases');assert.equal(row.p06.reference_parity_verified,false);}
assert.deepEqual(a.summary.numeric,{queries:97,passed:97,failed:0});assert.equal(a.summary.unit_tests,1478);assert.equal(a.summary.core_checks,14);assert.equal(a.summary.affected_regression_checks,7);
for(const name of ['chromium','firefox']){assert.equal(a.summary.browsers[name].groups,7);assert.equal(a.summary.browsers[name].calculations,45);assert.equal(a.summary.pwa.browsers[name].checks.length,7);}
console.log(JSON.stringify({status:a.status,build:a.build,queries:a.summary.numeric,unitTests:a.summary.unit_tests,artifacts:Object.keys(a.artifact_sha256).length,rawPresent},null,2));
