import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {solveWaterProcess,readWaterProcessInput,waterProcessSteps} from '../src/water-process.js';
import {processGas} from '../src/process-gas.js';
import {gasState,AIR} from '../src/gases.js';
import {readStudyReport,evaluateReportEntry,studyReportHTML} from '../src/study-report.js';
import {readWorkspace} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ±${t}`),base={kind:'polytropic',mode:'pt',a:3,b:600,end:'p',value:1,n:1.3,mass:2};
function balanced(q){assert.ok(q.converged,`${q.input.kind}: ${q.residual}, ${q.refinement}, ${q.tolerance}`);for(const k of ['residual','flowResidual','heatError','workError','refinement'])if(q[k]!=null)assert.ok(Math.abs(q[k])<=q.tolerance,k);}
test('Water isenthalpic reversible path is not adiabatic throttling; both formulations obey h const',()=>{
 for(const model of ['IF97','IAPWS-95']){const q=solveWaterProcess({...base,kind:'isenthalpic'},model);balanced(q);for(const s of q.path)close(s.h,q.states[0].h,1e-7);close(q.dh,0,1e-7);assert.ok(q.heat>0&&q.ds>0);close(q.heat,q.technicalWork,q.tolerance);assert.equal(q.heatError,null);assert.match(waterProcessSteps(q,true).join(' '),/not throttle heat/);}
 const wet=solveWaterProcess({kind:'isenthalpic',mode:'px',a:1,b:.2,end:'p',value:.1});balanced(wet);assert.ok(wet.states[1].x>0&&wet.states[1].x<1);
});
test('Water polytropes trace pv^n, satisfy analytical work, and reverse expansion signs',()=>{
 for(const model of ['IF97','IAPWS-95']){const q=solveWaterProcess(base,model),a=q.states[0],b=q.states[1];balanced(q);for(const s of q.path)close(s.p*s.v**1.3,a.p*a.v**1.3,1e-8);close(q.boundaryWork,1000*(b.p*b.v-a.p*a.v)/(1-1.3),q.tolerance);close(q.technicalWork,1.3*q.boundaryWork,q.tolerance*2);assert.ok(q.boundaryWork>0);const wet=solveWaterProcess({kind:'polytropic',n:1.3,mode:'px',a:.1,b:.2,end:'p',value:.05},model);balanced(wet);assert.ok(wet.states[1].x>0&&wet.states[1].x<1);}
 const q=solveWaterProcess(base),r=solveWaterProcess({...base,a:q.states[1].p,b:q.states[1].T,value:3});balanced(r);close(r.boundaryWork,-q.boundaryWork,.005);
});
test('n=0, n=1 and near-one work formulas are finite and continuous for water',()=>{
 for(const n of [0,1,1-1e-10,1+1e-10]){const a=calculate('pt',3,600).state,q=solveWaterProcess({...base,end:'v',value:a.v*1.2,n});balanced(q);const w=n===0?3000*(q.states[1].v-a.v):3000*a.v*Math.log(1.2);close(q.boundaryWork,w,n===0?1e-5:q.tolerance);}
 assert.throws(()=>readWaterProcessInput({...base,n:0}));for(const n of [NaN,Infinity,21])assert.throws(()=>readWaterProcessInput({...base,n}));
});
test('Constant-cp helium independently matches ideal-gas analytic processes and signs',()=>{
 const R=8.31446261815324/4.002602,cp=2.5*R,cv=1.5*R,initial={fluid:'He',mode:'pt',a:.2,b:400,mass:3},model='IDEAL-CP';
 const p=solveWaterProcess({...initial,kind:'isobaric',end:'T',value:800},model);balanced(p);close(p.dh,cp*400,1e-8);close(p.du,cv*400,1e-8);close(p.boundaryWork,R*400,1e-8);close(p.heat,cp*400,p.tolerance);
 const v=solveWaterProcess({...initial,kind:'isochoric',end:'T',value:800},model);balanced(v);close(v.boundaryWork,0,1e-8);close(v.heat,cv*400,v.tolerance);
 const t=solveWaterProcess({...initial,kind:'isothermal',end:'p',value:.1},model);balanced(t);close(t.boundaryWork,R*400*Math.log(2),t.tolerance);close(t.du,0,1e-8);
 const s=solveWaterProcess({...initial,kind:'isentropic',end:'p',value:.1},model);balanced(s);close(s.states[1].T,400*(.1/.2)**(.4),1e-7);close(s.heat,0,s.tolerance);
 const h=solveWaterProcess({...initial,kind:'isenthalpic',end:'p',value:.1},model);balanced(h);close(h.states[1].T,400,1e-8);close(h.heat,t.heat,h.tolerance);
 const poly=solveWaterProcess({...initial,kind:'polytropic',n:5/3,end:'p',value:.1},model);balanced(poly);close(poly.heat,0,poly.tolerance);close(poly.total.boundaryWork,3*poly.boundaryWork,1e-8);
});
test('NASA7 processes cross polynomial boundary with variable cp and frozen composition',()=>{
 const initial={fluid:'air',mode:'pt',a:.1,b:700},model='IDEAL-NASA7';
 const q=solveWaterProcess({...initial,kind:'isobaric',end:'T',value:1600},model);balanced(q);close(q.dh,gasState(.1,1600,AIR).h-gasState(.1,700,AIR).h,1e-7);assert.notEqual(q.states[0].cp,q.states[1].cp);assert.ok(q.path.some(s=>Math.abs(s.T-1000)<1e-5));
 for(const kind of ['isochoric','isothermal','isentropic','isenthalpic','polytropic']){const s=solveWaterProcess({...initial,kind,n:1.3,end:kind==='isochoric'?'T':'p',value:kind==='isochoric'?1200:.05},model);balanced(s);assert.deepEqual(s.states[0].composition,s.states[1].composition);}
 const constant=solveWaterProcess({...initial,kind:'isobaric',end:'T',value:1600},'IDEAL-CP');assert.ok(Math.abs(constant.heat-q.heat)>50);
});
test('Ideal-gas input inversions and six available fluids preserve their own state reference',()=>{
 for(const fluid of ['air','N2','O2','CO2','He','Ar'])for(const model of ['IDEAL-CP','IDEAL-NASA7']){const {get}=processGas(fluid,model),q=get('pt',.3,800);close(get('ph',.3,q.h).T,800,1e-7);close(get('ps',.3,q.s).T,800,2e-6);close(get('ps',.3,q.s).s,q.s,1.1e-9);close(get('pv',.3,q.v).T,800,1e-7);close(get('ts',800,q.s).p,.3,1e-9);close(q.h-q.u,1000*q.p*q.v,1e-8);}
});
test('Gas limits, incompatible models/quality, total overflow and non-unique endpoints are rejected',()=>{
 const a={fluid:'air',kind:'isobaric',mode:'pt',a:.1,b:600,end:'T',value:800};
 for(const invalid of [{...a,mode:'px'},{...a,end:'x'},{...a,fluid:'unknown'}])assert.throws(()=>readWaterProcessInput(invalid));
 for(const invalid of [{...a,b:199},{...a,value:6001},{...a,a:0},{...a,mass:1e308}])assert.throws(()=>solveWaterProcess(invalid,'IDEAL-CP'));
 assert.throws(()=>solveWaterProcess(a,'IF97'));assert.throws(()=>solveWaterProcess({...a,fluid:'water'},'IDEAL-CP'));
 assert.throws(()=>processGas('He','IDEAL-CP').get('pt',1e308,600));
});
test('Gas workspace and reports round-trip models, fluid and n without accepting imported results',()=>{
 const input={...base,fluid:'air',a:.1,value:.05},entry={kind:'water-process',model:'IDEAL-NASA7',input,title:'Gas <script>',heat:9999};
 const report=readStudyReport({entries:[entry]});const q=evaluateReportEntry(report.entries[0]).waterProcess;balanced(q);assert.equal(q.input.n,1.3);assert.equal(q.model,'IDEAL-NASA7');assert.equal(report.entries[0].heat,undefined);
 const html=studyReportHTML('Gas report',report,{language:'en'});assert.match(html,/IDEAL-NASA7/);assert.match(html,/air/);assert.match(html,/pvⁿ/);assert.match(html,/Fixed-composition ideal gas/);assert.ok(!html.includes('<script>'));
 const panel={calculated:true,model:'IDEAL-NASA7',inputs:{'wp-fluid':'air','wp-model':'IDEAL-NASA7','wp-kind':'polytropic','wp-mode':'pt','wp-n':'1.3','wp-end':'p','wp-value':'.05'}};assert.equal(readWorkspace({active:'water-process',panels:{'water-process':panel}}).panels['water-process'].model,'IDEAL-NASA7');
 assert.throws(()=>readWorkspace({active:'water-process',panels:{'water-process':{...panel,inputs:{...panel.inputs,'wp-fluid':'water'}}}}));assert.throws(()=>readStudyReport({entries:[{...entry,kind:'state'}]}));
});
