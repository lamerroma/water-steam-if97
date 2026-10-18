import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {DIAGNOSTIC_PAIRS,diagnosticGradient,diagnoseCalculation,selectCalculatedAlternative,sensitivityDigits} from '../src/inverse-diagnostics.js';
import {typedRounding} from '../src/input-rounding.js';
import {inverseAuditTasks} from '../scripts/inverse-audit-selection.mjs';
import {assessAllRoots} from '../scripts/inverse-precision-common.mjs';
import {exportCSV} from '../src/export.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const reference=JSON.parse(await readFile(new URL('fixtures/input-sensitivity-reference.json',import.meta.url)));
const inverse=JSON.parse(await readFile(new URL('fixtures/inverse-precision-reference.json',import.meta.url)));

test('Typed rounding preserves decimal zeroes, exponent, comma and affine unit increments',()=>{
 for(const [text,unit,half] of [['100','K',.5],['100.00','C',.005],['1.20e3','Pa',5e-6],['1,200','bar',.00005],['.00100','m3kg',.000005],['212.0','F',.05/1.8],['1e-2','Jkg',.000005],['2.0','percent',.0005],['1.00','Btulb',.01163]])assert.ok(Math.abs(typedRounding(text,unit).halfWidth/half-1)<1e-12,`${text} ${unit}`);
 for(const s of ['1e999','1e-999','NaN','1/2','1 000','<script>',''])assert.equal(typedRounding(s,'K'),null);
 assert.equal(typedRounding('1','unknown'),null);
});

for(const c of reference.records)test(`Independent finite-difference Jacobian and propagated rounding ${c.model} ${c.expected.p} MPa / ${c.expected.T} K`,()=>{
 const q=calculate('pt',c.expected.p,c.expected.T,c.model).state;
 for(const [key,g] of Object.entries(c.gradients))for(let i=0;i<2;i++){
  const value=diagnosticGradient(q,key)[i],stepError=c.convergence[key+':'+i];
  assert.ok(stepError<=Math.max(1e-8,Math.abs(g[i])*1e-4),'reference step convergence');
  assert.ok(Math.abs(value-g[i])<=4*stepError+Math.max(1e-8,Math.abs(g[i])*2e-7),`${key}/${i}: ${value} vs ${g[i]}`);
 }
 for(const [mode,keys] of Object.entries(DIAGNOSTIC_PAIRS)){
  const halves=keys.map(k=>Math.max(Math.abs(q[k]),k==='v'?.001:1)*1e-9),options={inputRounding:halves.map((halfWidth,i)=>({halfWidth,unit:keys[i]}))};
  const r=diagnoseCalculation({state:q},mode,q[keys[0]],q[keys[1]],options),s=r.state.inputSensitivity;
  assert.equal(s.status,'local',mode);
  const [a,b]=c.gradients[keys[0]],[d,e]=c.gradients[keys[1]],det=a*e-b*d;
  for(const [key,[g,h]] of Object.entries(c.gradients)){
   const estimated=keys.includes(key)?halves[keys.indexOf(key)]:Math.abs((g*e-h*d)/det)*halves[0]+Math.abs((-g*b+h*a)/det)*halves[1];
   const actual=s.response[key];assert.ok(Math.abs(actual-estimated)<=Math.max(1e-10,Math.abs(estimated)*5e-5),`${mode}/${key}: ${actual} vs ${estimated}`);
  }
 }
});

test('Poorly conditioned cold liquid u-s duplicates collapse without changing inputs',()=>{
 const c=inverse.records.find(c=>c.id==='IAPWS-95-2066'),r=calculate('us',c.expected.u,c.expected.s,c.model);
 assert.equal(r.diagnostics.roots,1);assert.ok(r.diagnostics.merged>0);assert.equal(r.alternatives,undefined);const diagnostic=calculate('us',c.expected.u,c.expected.s,c.model,{inputRounding:[typedRounding(String(c.expected.u),'kJkg'),typedRounding(String(c.expected.s),'kJkgK')]}).state.inputSensitivity;assert.ok(diagnostic.numericalResponse.p>diagnostic.response.p);assert.ok(sensitivityDigits(r.state.p,diagnostic.response.p+diagnostic.numericalResponse.p)<=4);
 assert.equal(assessAllRoots(r,[c.expected.u,c.expected.s],['u','s'])[0].valid,true);
 // Changing the user's spelling cannot affect computational deduplication.
 const rounded=calculate('us',c.expected.u,c.expected.s,c.model,{inputRounding:[typedRounding('38.6','kJkg'),typedRounding('.14','kJkgK')]});
 assert.equal(rounded.state.p,r.state.p);assert.equal(rounded.diagnostics.merged,r.diagnostics.merged);assert.equal(rounded.state.inputSensitivity.status,'limited');
});

test('Turning-point branches and region-2/5 overlap remain separate, manual selection keeps provenance',()=>{
 const turn=JSON.parse(readFileSyncFixture('inverse-boundary-reference.json')).records.find(c=>c.name==='region1-turn');
 const r=calculate('th',turn.expected.T,turn.expected.h);assert.equal(r.diagnostics.roots,2);
 const c=inverse.records.find(c=>c.id==='IF97-0042'),options={inputRounding:[typedRounding('40.000000','MPa'),typedRounding(c.expected.v.toFixed(12),'m3kg')]};
 const overlap=calculate('pv',c.expected.p,c.expected.v,c.model,options),roots=[overlap.state,...overlap.alternatives];
 assert.deepEqual(roots.map(q=>q.region).sort(),[2,5]);assert.equal(overlap.state.region,5,'best residual can select the higher temperature');
 assert.ok(roots.every(q=>assessAllRoots({state:q},[c.expected.p,c.expected.v],['p','v'])[0].valid));
 const chosen=selectCalculatedAlternative(overlap,0);assert.equal(chosen.state,overlap.alternatives[0]);assert.equal(chosen.alternatives[0],overlap.state);assert.deepEqual(chosen.diagnostics.roundingScenario,overlap.diagnostics.roundingScenario);assert.equal(chosen.diagnostics.selection,'manual');assert.equal(overlap.diagnostics.selection,'stability-then-normalized-input-residual');assert.equal(selectCalculatedAlternative(chosen,-1),chosen);
});
import {readFileSync} from 'node:fs';
function readFileSyncFixture(name){return readFileSync(new URL('fixtures/'+name,import.meta.url),'utf8');}

test('Boundary near-miss with a bad original volume residual is rejected, not offered as another state',()=>{
 const c=inverse.records.find(c=>c.id==='IF97-0000'),r=calculate('pv',c.expected.p,c.expected.v,c.model);
 assert.equal(r.diagnostics.rejected,1);assert.equal(r.diagnostics.roots,1);assert.equal(r.state.region,2);
});

test('Mixtures and singular Jacobians report unavailable; large scenarios do not claim reliable digits',()=>{
 const mix=calculate('px',1,.5).state,options={inputRounding:[{halfWidth:.00001,unit:'MPa'},{halfWidth:.01,unit:'kJkg'}]};
 for(const state of [mix,calculate('px',1,0).state,calculate('px',1,1).state])assert.equal(diagnoseCalculation({state},'ph',state.p,state.h,options).state.inputSensitivity.reason,'phase-coexistence');
 const q=calculate('pt',3,400).state,singular={...q,cp:0,dvdt:0,alpha:0};
 assert.equal(diagnoseCalculation({state:singular},'hs',singular.h,singular.s,options).state.inputSensitivity.status,'unavailable');
 const r=calculate('pt',3,400,'IF97',{inputRounding:[{halfWidth:10,unit:'MPa'},{halfWidth:5,unit:'K'}]});assert.equal(r.state.inputSensitivity.status,'limited');assert.ok(!JSON.stringify(r).includes('NaN'));
 assert.equal(sensitivityDigits(.005,1e-6,8),4);assert.equal(sensitivityDigits(100,10,8),2);assert.equal(sensitivityDigits(0,1,8),1);
 for(const inputRounding of [null,[],[{halfWidth:NaN,unit:'K'}],[{halfWidth:-1,unit:'MPa'},{halfWidth:1,unit:'K'}]])assert.equal(calculate('pt',3,400,'IF97',{inputRounding}).state.inputSensitivity,undefined);
});

test('CSV preserves raw state numbers and explicitly labels canonical scenario responses',()=>{
 const r=calculate('pt',3,400,'IF97',{inputRounding:[typedRounding('3.000','MPa'),typedRounding('400.00','K')]});
 const csv=exportCSV(r,'J',null,'english');assert.ok(csv.includes('rounding_response_T'));assert.ok(csv.includes('input_half_step_p'));assert.ok(csv.includes('not measurement uncertainty'));
 const si=exportCSV(r);assert.ok(si.includes('"state","h","'+r.state.h+'"'));assert.ok(si.includes('"state","rounding_response_p","0.0005","MPa"'));
});

test('Quick independent CI audit covers all inverse modes in both models and the known duplicate case',()=>{
 const tasks=inverseAuditTasks(inverse,true);assert.equal(new Set(tasks.map(t=>t.c.id+':'+t.mode)).size,tasks.length);
 for(const model of ['IF97','IAPWS-95'])for(const mode of Object.keys(inverse.modes))assert.ok(tasks.some(t=>t.c.model===model&&t.mode===mode),model+'/'+mode);
 assert.ok(tasks.some(t=>t.c.id==='IAPWS-95-2066'&&t.mode==='us'));assert.ok(tasks.length<200);assert.equal(inverseAuditTasks(inverse).length,4657);
});
