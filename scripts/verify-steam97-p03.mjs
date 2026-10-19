// Frozen-candidate integrity check; later releases should retain this historical record.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const report=JSON.parse(await readFile('docs/STEAMTABLES_P03_ACCEPTANCE.json','utf8'));
assert.equal(report.status,'bounded_delivery_passed');assert.equal(report.local_implementation_complete,true);assert.equal(report.full_sprint_accepted,false);assert.equal(report.full_reference_parity_verified,false);assert.equal(report.reference.newSteam97WebNumericalCases,0);
assert.equal(report.version,JSON.parse(await readFile('package.json')).version);
for(const file of [...report.evidence,...report.artifacts])assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'),file.sha256,file.path);
const release=JSON.parse(await readFile('docs/steam97-p03/release-report.json','utf8'));if(release.status==='failed'){const retry=JSON.parse(await readFile('docs/steam97-p03/environment-retry.json','utf8'));assert.equal(retry.status,'passed');assert.deepEqual(retry.build,report.build);assert.deepEqual(release.checks.filter(q=>q.status!=='passed').map(q=>q.name),[retry.check]);assert.equal(report.verification.releaseStatus,'passed_after_environment_retry');}else assert.equal(release.status,'passed');
for(const name of ['chromium','firefox'])assert.equal(report.verification.browsers[name].status,'passed');
console.log(JSON.stringify({version:report.version,status:'passed',files:report.evidence.length+report.artifacts.length,referenceParity:false}));
