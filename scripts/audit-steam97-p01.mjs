// Read frozen independent fixtures; never use product output to generate expected values.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialize,calculate} from '../src/engine.js';
import {turbine,turbineInverse,flash} from '../src/processes.js';
import {toCanonical,englishProperty} from '../src/units.js';
import {assess,assessAllRoots} from './inverse-precision-common.mjs';
const dir='docs/steam97-p01',fixture=JSON.parse(await readFile(`${dir}/pilot-reference.json`)),policy=JSON.parse(await readFile(`${dir}/pilot-policy.json`));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await initialize(await readFile('vendor/seuif97_bg.wasm'));
const records=[];
function comparisons(actual,expected,relative=policy.forward_relative,absolute=policy.forward_absolute){
 return Object.entries(expected).map(([key,value])=>{const tolerance=Math.max(typeof absolute==='number'?absolute:absolute[key],Math.abs(value)*relative),error=Math.abs(actual[key]-value);return {key,expected:value,actual:actual[key]??null,error:Number.isFinite(error)?error:null,tolerance,passed:actual[key]!=null&&Number.isFinite(error)&&error<=tolerance};});
}
function evaluate(c,mode,values){
 const keys=[...mode].map(k=>k==='t'?'T':k),inputs=values||keys.map(k=>c.expected[k]),result=calculate(mode,...inputs,c.model);
 if(['pt','px','tx'].includes(mode)){
  const checks=comparisons(result.state||{},c.expected);
  return {passed:checks.every(q=>q.passed),checks,roots:1};
 }
 const checks=assess(result,c,keys),roots=assessAllRoots(result,inputs,keys);
 return {passed:checks.status==='passed'&&roots.every(q=>q.valid),assessment:checks,rootChecks:roots};
}
for(const c of fixture.cases)for(const mode of c.modes){
 try{records.push({id:c.id,model:c.model,mode,...evaluate(c,mode)});}catch(e){records.push({id:c.id,model:c.model,mode,passed:false,error:e.message});}
 if(records.length%50===0)console.log(`P01 ${records.length} water queries`);
}
const unitRecords=fixture.unit_cases.map(u=>{
 const c=fixture.cases.find(c=>c.id===u.case_id);
 try{
  const result=evaluate(c,u.mode,u.values.map((v,i)=>toCanonical(v,u.units[i])));
  // Check actual output conversion against an independently defined English value.
  const q=calculate(u.mode,...u.values.map((v,i)=>toCanonical(v,u.units[i])),c.model).state;
  const english=englishProperty('h',q.h)[0],expected=c.expected.h/2.326;
  const output={actual:english,expected,passed:Math.abs(english-expected)<=Math.max(2e-5,Math.abs(expected)*policy.forward_relative)};
  return {...u,...result,output,passed:result.passed&&output.passed};
 }catch(e){return {...u,passed:false,error:e.message};}
});
const processRecords=fixture.process_cases.map(c=>{
 try{
  const i=c.inputs,r=c.kind==='flash'?flash(i.p1,i.T1,i.p2,i.flow,i.saturated,c.model):
   c.mode==='power'?turbine(i.p1,i.T1,i.p2,i.eta,i.flow,c.model):
   turbineInverse(c.mode,i.p1,i.T1,i.p2,c.expected.power,c.mode==='flow'?i.eta:i.flow,c.model);
  const actual={...r,outlet_h:r.outlet.h,outlet_T:r.outlet.T,outlet_x:r.outlet.x,specific_consumption:3600/r.work};
  const checks=comparisons(actual,c.expected,policy.process_relative,policy.process_absolute);
  const balance=c.kind==='turbine'?Math.abs(r.power-r.flow*(r.inlet.h-r.outlet.h)):
   Math.max(Math.abs(r.flow-r.vaporFlow-r.liquidFlow),Math.abs(r.flow*(r.inlet.h-r.outlet.h)));
  const balanceTolerance=policy.process_balance_relative*Math.max(1,r.flow*r.inlet.h);
  return {id:c.id,model:c.model,checks,balance,balanceTolerance,passed:checks.every(q=>q.passed)&&balance<=balanceTolerance};
 }catch(e){return {id:c.id,passed:false,error:e.message};}
});
const domainRecords=fixture.domain_probes.map(c=>{
 try{
  const q=calculate('pt',c.p,c.T,c.model).state;
  return {id:c.id,status:q.mu==null&&q.lambda==null&&c.expected_local_gap==='transport_unavailable'?'known_gap':'unexpected',
   actual:{p:q.p,T:q.T,h:q.h,mu:q.mu,lambda:q.lambda},independent:c.expected,reference_site_result:null};
 }catch(e){return {id:c.id,status:c.expected_local_gap==='temperature_rejected'?'known_gap':'unexpected',error:e.message,independent:c.expected,reference_site_result:null};}
});
const h=fixture.historical,q=calculate('pt',h.inputs.p,h.inputs.T,h.model).state;
const historical=Object.entries(h.printed).map(([key,printed])=>{
 const expected=Number(printed),decimals=printed.split('.')[1].length,tolerance=.5*10**-decimals+64*Number.EPSILON*Math.max(1,Math.abs(expected));
 const independent=h.independent[key],independentError=Math.abs(independent-expected);
 return {key,printed,actual:q[key],independent,error:Math.abs(q[key]-expected),independentError,tolerance,passed:Math.abs(q[key]-expected)<=tolerance&&independentError<=tolerance};
});
const count=rows=>({total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length});
const summary={water:count(records),units:count(unitRecords),processes:count(processRecords),historical:count(historical),
 knownDomainGaps:domainRecords.filter(r=>r.status==='known_gap').length,unexpectedDomainResults:domainRecords.filter(r=>r.status==='unexpected').length,
 newSteam97NumericResponses:0,referenceParityVerified:0};
const sourceManifest=Object.fromEntries(await Promise.all((await readdir('src')).filter(f=>f.endsWith('.js')).sort().map(async f=>[`src/${f}`,sha(await readFile(`src/${f}`))])));
const report={date:'2026-10-18',runtime:{node:process.version,v8:process.versions.v8},
 fixture_sha256:sha(await readFile(`${dir}/pilot-reference.json`)),policy_sha256:sha(await readFile(`${dir}/pilot-policy.json`)),
 audit_sha256:sha(await readFile('scripts/audit-steam97-p01.mjs')),sourceManifest,summary,records,unitRecords,processRecords,domainRecords,historical};
await writeFile(`${dir}/pilot-results.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary,failures:[...records,...unitRecords,...processRecords,...historical].filter(r=>!r.passed)},null,2));
process.exitCode=summary.water.failed+summary.units.failed+summary.processes.failed+summary.historical.failed+summary.unexpectedDomainResults?1:0;
