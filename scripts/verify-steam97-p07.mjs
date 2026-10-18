import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p)),a=await read('docs/STEAMTABLES_P07_ACCEPTANCE.json');
assert.equal((await read('package.json')).version,a.version);assert.equal(a.bounded_delivery_accepted,true);assert.equal(a.full_sprint_accepted,false);assert.equal(a.reference_parity_verified,0);assert.equal(a.new_reference_site_numeric_responses,0);assert.equal(a.dedicated_reference_vapor_view_verified,false);
for(const [p,hash]of Object.entries(a.artifact_sha256))assert.equal(sha(await readFile(p)),hash,'Artifact changed: '+p);
for(const [p,hash]of Object.entries(a.sourceManifest))assert.equal(sha(await readFile('src/'+p)),hash,'Source changed: '+p);
let rawPresent=0;for(const [p,hash]of Object.entries(a.raw_evidence_sha256)){let b;try{b=await readFile(p);}catch(e){if(e.code==='ENOENT')continue;throw e;}assert.equal(sha(b),hash,'Raw evidence changed: '+p);rawPresent++;}
const f=await read('tests/fixtures/steam97-p07-reference.json');assert.equal(f.records.length,172);assert.equal(f.curves.length,6);assert.equal(sha(await readFile('scripts/generate-steam97-p07.py')),f.generator_sha256);
const plan=await read('docs/STEAMTABLES_PARITY_SPRINTS.json'),tasks=await read('docs/steam97-p07/tasks.json'),sprint=plan.sprints.find(s=>s.id==='P07'),matrix=await read('docs/STEAMTABLES_PARITY_MATRIX.json');
assert.deepEqual([...sprint.requirement_ids].sort(),[...tasks.requirement_ids].sort());assert.equal(sprint.bounded_delivery.full_sprint_accepted,false);assert.equal(matrix.rows.find(r=>r.id==='diagram-hs-vapor').implementation,'partial');
for(const id of sprint.requirement_ids){const row=matrix.rows.find(r=>r.id===id);assert.equal(row.parity,'requires_reference_cases');assert.equal(row.p07.reference_parity_verified,false);}
assert.equal(a.summary.numeric.failed,0);assert.equal(a.summary.numeric.queries,184);assert.equal(a.summary.unit_tests,1663);assert.equal(a.summary.core_checks,14);assert.equal(a.summary.affected_regression_checks,8);
for(const name of ['chromium','firefox']){assert.equal(a.summary.browsers[name].groups,6);assert.equal(a.summary.browsers[name].anchor_comparisons,48);assert.equal(a.summary.pwa.browsers[name].checks.length,7);}
console.log(JSON.stringify({status:a.status,build:a.build,numeric:a.summary.numeric,unitTests:a.summary.unit_tests,artifacts:Object.keys(a.artifact_sha256).length,rawPresent},null,2));
