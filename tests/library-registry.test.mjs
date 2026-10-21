import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkManagedLibraryRegistry,validateLibraryRegistry,validateLibraryControls,validateReviewedLibraryContracts,validateLibraryCodec,validateOptionalLibraryPolicy} from '../scripts/check-library-registry.mjs';
const load=async name=>JSON.parse(await readFile(new URL('../docs/library-registry/'+name,import.meta.url),'utf8'));
const surface=await load('surface.json'),profiles=await Promise.all(['native','pyodide'].map(name=>load('runtime-signatures-'+name+'.json')));

test('Pinned recursive inventory has explicit scope, source identities and both runtime signature profiles',async()=>{
 assert.deepEqual(await checkManagedLibraryRegistry(),{records:2966,paths:3494,knownDiscrepancyRecords:5});
 assert.equal(Object.keys(surface.sourceFiles).length,71);
 assert.equal(surface.packages.reduce((n,p)=>n+p.unavailableModules.length,0),6);
});
test('Discovery cannot be relabeled numerical acceptance or dimensionless by default',()=>{
 const forged=structuredClone(surface);forged.summary.globalNumericalCoveragePercent=100;
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/global numerical/);
 forged.summary.globalNumericalCoveragePercent=null;forged.records[0].stages.units='accepted';
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/Unjustified acceptance/);
});
test('Duplicate identities and missing aliases cannot silently change the denominator',()=>{
 const forged=structuredClone(surface);forged.records.push(forged.records[0]);
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/Duplicate record/);
 forged.records.pop();delete forged.pathIndex[Object.keys(forged.pathIndex)[0]];
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/Public path count/);
});
test('Source drift and circular adapter inheritance are rejected',()=>{
 const forged=structuredClone(surface),source=forged.records.find(r=>r.source.status==='pinned-package-source');source.source.sha256='0'.repeat(64);
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/Stale source/);
 source.source.sha256=forged.sourceFiles[source.source.path];const adapter=forged.records.find(r=>r.baseObjectId);adapter.baseObjectId=adapter.id;
 assert.throws(()=>validateLibraryRegistry(forged,profiles),/Cyclic adapter/);
});
test('A missing dependency signature cannot disappear behind a native-only observation',()=>{
 const bad=structuredClone(profiles),key=Object.keys(bad[1].signatures)[0];delete bad[1].signatures[key];
 assert.throws(()=>validateLibraryRegistry(surface,bad),/Missing runtime signature/);
});
test('Known upstream mismatch keeps the mathematical reference distinct and linked to its warning',async()=>{
 const controls=await load('controls.json');validateLibraryControls(controls,surface);
 const forged=structuredClone(controls);forged.cases[0].expected=7;forged.cases[0].observedUpstream=7;
 assert.throws(()=>validateLibraryControls(forged,surface),/hides its reference/);
 forged.cases[0].observedUpstream=[7];forged.cases[0].issueCode='untracked';
 assert.throws(()=>validateLibraryControls(forged,surface),/linked issue/);
});
test('A partial reviewed contract is invalidated by a new upstream source or a false numerical promotion',async()=>{
 const contracts=await load('reviewed-contracts.json');validateReviewedLibraryContracts(contracts,surface);
 const forged=structuredClone(contracts);forged.records[0].sourceSHA256='0'.repeat(64);
 assert.throws(()=>validateReviewedLibraryContracts(forged,surface),/source changed/);
 forged.records[0].sourceSHA256=contracts.records[0].sourceSHA256;forged.records[0].numericalAcceptance='complete';
 assert.throws(()=>validateReviewedLibraryContracts(forged,surface),/cannot grant/);
});
test('Datetime and object-lifetime contracts require current bridge source and real case links',async()=>{
 const codec=await load('argument-codec.json');assert.deepEqual(validateLibraryCodec(codec,surface,surface.inputs.bridgeSHA256),{codecVersion:2,linkedTargets:3});
 const forged=structuredClone(codec);forged.bridgeSHA256='0'.repeat(64);
 assert.throws(()=>validateLibraryCodec(forged,surface,surface.inputs.bridgeSHA256),/Stale argument codec/);
 forged.bridgeSHA256=codec.bridgeSHA256;forged.outputKinds.object.properties.scope.const='persistent';
 assert.throws(()=>validateLibraryCodec(forged,surface,surface.inputs.bridgeSHA256),/lifetime/);
 forged.outputKinds.object.properties.scope.const='worker-session';forged.caseLinks[0].target='fluids.absent';
 assert.throws(()=>validateLibraryCodec(forged,surface,surface.inputs.bridgeSHA256),/target\/test/);
});
test('Optional variants cannot be dropped, silently accepted or assigned a fabricated export denominator',async()=>{
 const policy=await load('optional-policy.json');validateOptionalLibraryPolicy(policy,surface);
 const forged=structuredClone(policy);forged.records.pop();
 assert.throws(()=>validateOptionalLibraryPolicy(forged,surface),/disappear/);
 forged.records=structuredClone(policy.records);forged.records[0].status='accepted';
 assert.throws(()=>validateOptionalLibraryPolicy(forged,surface),/Unjustified/);
 forged.records[0].status='blocked_missing_dependency';forged.globalOptionalExportCount=0;
 assert.throws(()=>validateOptionalLibraryPolicy(forged,surface),/unresolved/);
});
