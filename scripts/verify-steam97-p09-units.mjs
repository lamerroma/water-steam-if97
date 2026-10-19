import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const r=JSON.parse(await readFile('docs/STEAMTABLES_P09_UNITS_ACCEPTANCE.json','utf8'));
assert.equal(r.status,'bounded_delivery_passed');assert.equal(r.full_sprint_accepted,false);assert.equal(r.full_reference_parity_verified,false);assert.equal(r.reference.newNumericalCases,0);assert.equal(r.reference.openBlockers.length,9);
assert.equal(JSON.parse(await readFile('package.json','utf8')).version,r.version);
for(const {path,sha256} of [...r.artifacts,...r.evidence])assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),sha256,path);
console.log('P09-01 snapshot verified:',r.version,r.build.id,r.artifacts.length+r.evidence.length,'files; full reference acceptance remains open.');
