import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pipeFlow,pipeHydraulics} from '../src/flow.js';
import {pipeVerificationPayload,comparePipeVerification,PIPE_VERIFICATION_UNITS} from '../src/pipe-verification.js';
import {readCalculation} from '../src/workspace.js';
const fixture=JSON.parse(readFileSync(new URL('fixtures/fluids-pipe-reference.json',import.meta.url)));
test('A specified velocity does not cross an exact Reynolds boundary through a mass-flow round trip',()=>{
 const q=pipeFlow({kind:'velocity',value:4000,diameter:1,rho:1,viscosity:1});assert.equal(q.velocity,4000);assert.equal(q.Re,4000);assert.equal(pipeHydraulics(q,{length:10}).method,'colebrook');
});
test('Native pipe controls agree with independent Decimal equations over the checked domain',()=>{
 for(const c of fixture.cases){const p=c.input,q=pipeFlow({kind:'velocity',value:p.velocity,diameter:p.diameter,rho:p.rho,viscosity:p.mu}),h=pipeHydraulics(q,p);
  const comparison=comparePipeVerification(q,h,c.expected);assert.equal(comparison.passed,true,c.id+': '+JSON.stringify(comparison.rows.filter(row=>!row.passed)));
  assert.deepEqual(pipeVerificationPayload(q,h,p.frictionMethod),{...p,velocity:q.velocity});
 }
});
test('Comparison exposes unavailable, mismatched and malformed quantities without relabeling missing units',()=>{
 const c=fixture.cases[0],q=pipeFlow({kind:'velocity',value:c.input.velocity,diameter:c.input.diameter,rho:c.input.rho,viscosity:c.input.mu}),h=pipeHydraulics(q,c.input);
 assert.equal(comparePipeVerification(q,h,{...c.expected,lossPressure:c.expected.lossPressure+1}).passed,false);
 assert.equal(comparePipeVerification(q,h,{...c.expected,factor:null}).passed,false);
 assert.throws(()=>comparePipeVerification(q,h,{...c.expected,Re:undefined}),/Invalid pipe/);
 assert.throws(()=>pipeVerificationPayload(q,h,'unknown'),/Unknown/);assert.equal(PIPE_VERIFICATION_UNITS.lossPressure,'Pa');
});
test('Pipe comparison selection survives input-only projects while forged outputs are ignored',()=>{
 for(const method of ['off','Clamond','Colebrook']){const p=readCalculation(JSON.stringify({module:'flow',inputs:{'flow-verification':method},result:{fluidsVerification:{comparison:{passed:true}}}}));assert.equal(p.record.inputs['flow-verification'],method);assert.equal(p.record.result,undefined);}
 assert.throws(()=>readCalculation(JSON.stringify({module:'flow',inputs:{'flow-verification':'unknown'}})));
});
