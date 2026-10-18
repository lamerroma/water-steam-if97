// P01 evidence/contract integrity, not a numerical-pass override.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const json=async p=>JSON.parse(await readFile(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const base='docs/steam97-p01',acceptance=await json('docs/STEAMTABLES_P01_ACCEPTANCE.json');
const [matrix,plan,contracts,sources,blockers,findings,fixture,results,policy,tasks]=await Promise.all([
 'docs/STEAMTABLES_PARITY_MATRIX.json','docs/STEAMTABLES_PARITY_SPRINTS.json',`${base}/contracts.json`,`${base}/sources.json`,`${base}/blockers.json`,`${base}/findings.json`,`${base}/pilot-reference.json`,`${base}/pilot-results.json`,`${base}/pilot-policy.json`,`${base}/next-tasks.json`
].map(json));
for(const [path,hash] of Object.entries(acceptance.artifact_sha256))assert.equal(sha(await readFile(path)),hash,`Changed artifact: ${path}`);
for(const [path,hash] of Object.entries(results.sourceManifest))assert.equal(sha(await readFile(path)),hash,`Changed product source: ${path}`);
assert.equal(sha(await readFile(`${base}/pilot-reference.json`)),results.fixture_sha256);
assert.equal(sha(await readFile(`${base}/pilot-policy.json`)),results.policy_sha256);
assert.equal(sha(await readFile('scripts/audit-steam97-p01.mjs')),results.audit_sha256);
assert.equal(sha(await readFile('scripts/generate-steam97-p01.py')),fixture.generator_sha256);
assert.equal(sha(await readFile('docs/COMPARISON.md')),fixture.historical_document_sha256);
assert.equal((await json('package.json')).version,'1.35.4');
assert.equal(matrix.evidence.reference_inventory_complete,false);assert.equal(plan.reference_inventory_complete,false);
assert.equal(contracts.reference_inventory_complete,false);assert.equal(matrix.evidence.coverage_percentage,null);
assert.equal(matrix.rows.length,86);assert.equal(new Set(matrix.rows.map(r=>r.id)).size,86);
assert.equal(matrix.rows.filter(r=>r.parity==='verified').length,0);
const moduleMap=new Map(contracts.modules.map(c=>[c.id,c])),sourceIds=new Set(sources.sources.map(s=>s.id)),blockerIds=new Set(blockers.blockers.map(b=>b.id));
for(const c of contracts.modules){for(const s of c.source_ids)assert(sourceIds.has(s),`${c.id}: unknown source ${s}`);for(const b of c.blocker_ids)assert(blockerIds.has(b),`${c.id}: unknown blocker ${b}`);}
for(const r of matrix.rows){
 assert(moduleMap.has(r.p01.contract_id),`${r.id}: missing contract`);
 assert(r.p01.blocker_ids.length,`${r.id}: no pending reference evidence tracked`);
 for(const s of r.p01.source_ids)assert(sourceIds.has(s));for(const b of r.p01.blocker_ids)assert(blockerIds.has(b));
 const owners=plan.sprints.filter(s=>s.requirement_ids.includes(r.id));assert.equal(owners.length,1,`${r.id}: delivery owner`);
 for(const p of r.local_evidence)await readFile(p);
}
const visit=(id,stack=new Set())=>{assert(!stack.has(id),'Cyclic sprint dependency');const s=plan.sprints.find(s=>s.id===id);assert(s,`Unknown sprint ${id}`);for(const d of s.depends_on)visit(d,new Set([...stack,id]));};
for(const s of plan.sprints){visit(s.id);for(const id of s.requirement_ids)assert(matrix.rows.some(r=>r.id===id));}
assert.equal(plan.sprints[0].completion,'preparation_complete_with_blockers');
assert.equal(moduleMap.get('saturation').enumerated_selector_options,null);
assert.equal(moduleMap.get('gas-dissociation').documented_constraints.T_max_K,2000);
assert.equal(moduleMap.get('gas-fixed').reference_state_h_s,null);
const expectedQueries=new Set(fixture.cases.flatMap(c=>c.modes.map(m=>`${c.id}/${m}`)));
assert.equal(expectedQueries.size,217);assert.equal(results.records.length,217);
assert.equal(new Set(results.records.map(r=>`${r.id}/${r.mode}`)).size,217);
for(const r of results.records)assert(expectedQueries.has(`${r.id}/${r.mode}`));
for(const [model,modes] of Object.entries(matrix.reference_input_pairs)){
 assert.deepEqual(new Set(modes),new Set(fixture.required_modes[model]));
 for(const mode of modes)assert(results.records.some(r=>r.model===model&&r.mode===mode),`${model}/${mode} not exercised`);
}
const count=rows=>({total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length});
for(const [key,rows] of Object.entries({water:results.records,units:results.unitRecords,processes:results.processRecords,historical:results.historical}))assert.deepEqual(count(rows),results.summary[key]);
assert.deepEqual(results.summary.water,{total:217,passed:208,failed:9});
assert.equal(results.summary.units.failed,0);assert.equal(results.summary.processes.failed,0);assert.equal(results.summary.historical.failed,0);
assert.equal(results.summary.newSteam97NumericResponses,0);assert.equal(results.summary.referenceParityVerified,0);
const registeredFailures=new Set(findings.findings.filter(f=>f.type==='confirmed_local_inverse_failure').flatMap(f=>f.case_ids.flatMap(c=>f.modes.map(m=>`${c}/${m}`))));
assert.deepEqual(new Set(results.records.filter(r=>!r.passed).map(r=>`${r.id}/${r.mode}`)),registeredFailures);
assert.equal(results.domainRecords.filter(r=>r.status==='known_gap').length,2);
assert.equal(results.domainRecords.filter(r=>r.status==='unexpected').length,0);
assert.equal(policy.declared_before_first_run,'2026-10-18');assert.equal(acceptance.numerical_pilot_passed,false);
assert.equal(acceptance.preparation_accepted,true);assert.equal(acceptance.reference_inventory_complete,false);
assert.equal(tasks.tasks[0].status,'ready');assert(tasks.tasks[0].finding_ids.includes('N01'));
console.log(JSON.stringify({status:'P01 preparation evidence consistent; numerical defects remain open',requirements:matrix.rows.length,contracts:contracts.modules.length,blockers:blockers.blockers.length,artifacts:Object.keys(acceptance.artifact_sha256).length,numerical:results.summary},null,2));
