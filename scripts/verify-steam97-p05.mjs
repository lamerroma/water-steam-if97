import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(p));
const a=await read('docs/STEAMTABLES_P05_ACCEPTANCE.json');
assert.equal((await read('package.json')).version,a.version);assert.equal(a.bounded_delivery_accepted,true);assert.equal(a.full_sprint_accepted,false);assert.equal(a.reference_parity_verified,0);assert.equal(a.new_reference_site_numeric_responses,0);
for(const [p,hash]of Object.entries(a.artifact_sha256))assert.equal(sha(await readFile(p)),hash,'Artifact changed: '+p);
for(const [p,hash]of Object.entries(a.sourceManifest))assert.equal(sha(await readFile('src/'+p)),hash,'Source changed: '+p);
let rawPresent=0;for(const [p,hash]of Object.entries(a.raw_evidence_sha256)){let bytes;try{bytes=await readFile(p);}catch(e){if(e.code==='ENOENT')continue;throw e;}assert.equal(sha(bytes),hash,'Raw report changed: '+p);rawPresent++;}
const fixture=await read('tests/fixtures/steam97-p05-reference.json');assert.equal(sha(await readFile('scripts/generate-steam97-p05.py')),fixture.generator_sha256);assert.equal(fixture.records.length,259);assert.equal(fixture.domain_probes.length,26);
const plan=await read('docs/STEAMTABLES_PARITY_SPRINTS.json'),map=await read('docs/steam97-p05/validity-map.json');
assert.deepEqual(map.property_map.map(r=>r.requirement).sort(),plan.sprints.find(s=>s.id==='P05').requirement_ids.sort());assert.equal(plan.sprints.find(s=>s.id==='P05').bounded_delivery.full_sprint_accepted,false);
assert.equal(a.summary.numeric.failed,0);assert.equal(a.summary.numeric.total,435);assert.equal(a.summary.p02.passed,745);assert.equal(a.summary.regression.passed,4657);assert.equal(a.summary.root_checks.invalid,0);assert.equal(a.summary.unit_tests,1376);
for(const name of ['chromium','firefox']){assert.equal(a.summary.browsers[name].status,'passed');assert.equal(a.summary.pwa.browsers[name].checks.length,7);}
console.log(JSON.stringify({status:a.status,build:a.build,numeric:a.summary.numeric,regression:a.summary.regression.passed,unitTests:a.summary.unit_tests,artifacts:Object.keys(a.artifact_sha256).length,rawPresent},null,2));
