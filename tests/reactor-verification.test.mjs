import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';import {coursework} from '../src/coursework.js';
import {REACTOR_DEFAULT,reactorApplyVariant} from '../src/reactor-course.js';
import {reactorReferenceChecks,reactorCalculationChecks,reactorReferenceCellInput,reactorVerificationTables} from '../src/reactor-verification.js';
import {REACTOR_CELL_REFERENCE} from '../src/reactor-reference-data.js';
import {reactorBenchmarkCellInput} from '../scripts/reactor-cell-input.mjs';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
test('primary data remains identical to the documented fixture and independent adapter',()=>{
 const ref=JSON.parse(fs.readFileSync(new URL('fixtures/iaea-zr6-cell.json',import.meta.url)));assert.deepEqual(REACTOR_CELL_REFERENCE,ref);
 for(let i=0;i<2;i++){const a=reactorReferenceCellInput(i),b=reactorBenchmarkCellInput(ref,ref.cases[i]);for(const group of ['geometry','material','temperature','options','leakage'])for(const key of Object.keys(b[group])){if(typeof b[group][key]==='number')assert.ok(Math.abs(a[group][key]-b[group][key])<=1e-12*Math.max(1,Math.abs(b[group][key])));else assert.equal(a[group][key],b[group][key]);}}
});
test('nineteen arithmetic checks cannot mask the failed physical screening',()=>{
 const r=reactorReferenceChecks();assert.equal(r.arithmeticStatus,'passed');assert.equal(r.physicalStatus,'physical-screening-failed');assert.equal(r.checks.filter(c=>['analytical','correlation-arithmetic'].includes(c.kind)).length,19);
 assert.equal(r.checks.filter(c=>c.kind==='physical-screening'&&c.status==='failed').length,2);
 const supplemental=r.checks.filter(c=>c.kind==='reconstructed-screening');assert.equal(supplemental.length,2);assert.ok(supplemental.every(c=>c.notes.includes('Not an exact deck replay')));
 for(const row of r.checks){assert.ok(row.formula&&row.substitution&&row.source);assert.ok(Number.isFinite(row.tolerance));}
});
test('all 45 variants satisfy current equation residual tolerances',()=>{for(let i=1;i<=45;i++){const q=coursework(reactorApplyVariant(i,REACTOR_DEFAULT));assert.equal(reactorCalculationChecks(q).status,'passed','variant '+i);}});
test('equation checks detect changed results and unavailable values',()=>{
 const q=coursework(REACTOR_DEFAULT);q.profile[0].cladInner+=1;assert.equal(reactorCalculationChecks(q).checks.find(c=>c.id==='clad').status,'failed');
 q.profile[0].cladInner=NaN;assert.equal(reactorCalculationChecks(q).checks.find(c=>c.id==='clad').status,'unavailable');assert.equal(reactorCalculationChecks(q).status,'failed');
});
test('disabled physics and all contact models retain meaningful checks',()=>{for(const gapMethod of ['guide','constant','contact','perfect']){const q=coursework({...REACTOR_DEFAULT,neutronMethod:'off',chfMethod:'off',gapMethod});const c=reactorCalculationChecks(q);assert.equal(c.status,'passed');assert.ok(!c.checks.some(r=>r.id==='hot-keff'||r.id==='chf-current'));const en=reactorVerificationTables(q,true);assert.ok(en[1].rows.some(r=>r[6]==='Outside tolerance'));}});
test('thin annular pellets do not cause a false residual failure',()=>{
 const diameter=REACTOR_DEFAULT.rodDiameter-2*REACTOR_DEFAULT.cladThickness-2*REACTOR_DEFAULT.gap;
 const q=coursework({...REACTOR_DEFAULT,holeDiameter:diameter*(1-1e-10),neutronMethod:'off'});
 assert.equal(reactorCalculationChecks(q).status,'passed');
});
