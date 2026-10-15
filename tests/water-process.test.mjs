import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {solveWaterProcess,readWaterProcessInput,waterProcessSVG} from '../src/water-process.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';
import {readWorkspace} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const input={kind:'isobaric',mode:'pt',a:3,b:600,end:'T',value:700,mass:2};
const close=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} ≠ ${b} (±${tol})`);
function balanced(q){assert.ok(q.converged);for(const k of ['residual','flowResidual','heatError','refinement'])assert.ok(Math.abs(q[k])<=q.tolerance,k);close(q.dh,q.du+1000*(q.states[1].p*q.states[1].v-q.states[0].p*q.states[0].v),1e-6);}
test('Isobaric heating, cooling and mass scaling obey independent energy identities',()=>{
 const q=solveWaterProcess(input);balanced(q);close(q.heat,q.dh,q.tolerance);close(q.boundaryWork,3000*(q.states[1].v-q.states[0].v),1e-6);close(q.technicalWork,0,1e-6);close(q.total.heat,2*q.heat,1e-9);assert.ok(q.heat>0&&q.boundaryWork>0);
 const reverse=solveWaterProcess({...input,b:700,value:600});balanced(reverse);close(reverse.heat,-q.heat,1e-6);close(reverse.boundaryWork,-q.boundaryWork,1e-6);
});
test('Constant volume and constant temperature paths satisfy their constraints at every sample',()=>{
 const v=solveWaterProcess({...input,kind:'isochoric'});balanced(v);close(v.boundaryWork,0,1e-6);for(const s of v.path)close(s.v,v.states[0].v,1e-9);
 const q=solveWaterProcess({...input,kind:'isothermal',end:'v',value:.5});balanced(q);close(q.heat,q.states[0].T*q.ds,q.tolerance);assert.ok(q.boundaryWork>0);for(const s of q.path)close(s.T,600,1e-6);
 const reverse=solveWaterProcess({kind:'isothermal',mode:'pt',a:q.states[1].p,b:600,end:'v',value:q.states[0].v});balanced(reverse);close(reverse.boundaryWork,-q.boundaryWork,.005);
});
test('Isentropic expansion and compression conserve entropy and have expected work signs',()=>{
 const q=solveWaterProcess({...input,kind:'isentropic',end:'p',value:.1});balanced(q);close(q.heat,0,q.tolerance);assert.ok(q.boundaryWork>0&&q.technicalWork>0);assert.ok(q.path.length>32);for(const s of q.path)close(s.s,q.states[0].s,1e-7);
 const c=solveWaterProcess({kind:'isentropic',mode:'ps',a:.1,b:q.states[1].s,end:'p',value:3});balanced(c);assert.ok(c.boundaryWork<0&&c.technicalWork<0);
});
test('Both formulations trace latent heat and the saturated vapor anchor without crossing an ambiguous P–T state',()=>{
 for(const model of ['IF97','IAPWS-95']){
  const q=solveWaterProcess({kind:'isobaric',mode:'px',a:.1,b:0,end:'x',value:1},model);balanced(q);close(q.heat,q.dh,q.tolerance);assert.ok(q.states[1].x===1);close(q.ds*q.states[0].T,q.heat,.03);
  const a=solveWaterProcess({kind:'isothermal',mode:'px',a:.1,b:.1,end:'v',value:2},model);balanced(a);assert.ok(a.path.some(s=>s.x===1));assert.ok(a.states[1].p<.1);
 }
});
test('95 model supports all four paths; unchanged endpoint produces zero heat and work',()=>{
 for(const a of [input,{...input,kind:'isochoric'},{...input,kind:'isentropic',end:'p',value:1}])balanced(solveWaterProcess(a,'IAPWS-95'));
 const q=solveWaterProcess({...input,value:600});balanced(q);for(const k of ['heat','dh','du','ds','boundaryWork','technicalWork'])close(q[k],0,1e-8);
});
test('Invalid, nonfinite, ambiguous and incompatible conditions fail explicitly',()=>{
 for(const a of [{...input,mass:0},{...input,mass:Infinity},{...input,value:NaN},{...input,kind:'unknown'},{...input,kind:'isochoric',end:'x'}])assert.throws(()=>readWaterProcessInput(a));
 const T=calculate('satp',3).saturation.T;assert.throws(()=>solveWaterProcess({...input,b:T}),/Ambiguous/);assert.throws(()=>solveWaterProcess({...input,value:100}));assert.throws(()=>solveWaterProcess(input,'bad'));
});
test('Workspace and report round-trip only inputs and recompute numerical results and safe SVG',()=>{
 const w=readWorkspace({active:'water-process',panels:{'water-process':{model:'IF97',calculated:true,inputs:{'wp-kind':'isobaric','wp-mode':'pt','wp-a':'3','wp-b':'600','wp-end':'T','wp-value':'700','wp-mass':'2','wp-model':'IF97'}}}});assert.equal(w.active,'water-process');
 assert.throws(()=>readWorkspace({active:'water-process',panels:{'water-process':{calculated:true,inputs:{'wp-kind':'isochoric','wp-end':'x'}}}}));
 const entry={kind:'water-process',title:'<script>alert(1)</script>',model:'IF97',input,heat:123456,html:'<script>bad</script>'};const report=readStudyReport({entries:[entry]});assert.equal(report.entries[0].heat,undefined);const q=evaluateReportEntry(report.entries[0]).waterProcess;balanced(q);assert.notEqual(q.heat,123456);
 const html=studyReportHTML('Example',report,{language:'en'});assert.ok(html.includes('Specific heat q'));assert.ok(html.includes('Accuracy verified'));assert.ok(!html.includes('<script>'));assert.equal((html.match(/data-process-path=/g)||[]).length,2);
 const svg=waterProcessSVG(q);assert.ok(svg.includes('polyline'));assert.ok(svg.includes('s [kJ/(kg K)]'));assert.throws(()=>waterProcessSVG(q,'bad'));
});

test('Alternative end conditions resolve the same constrained states',()=>{
 const iso=solveWaterProcess({...input,kind:'isochoric'}),q=solveWaterProcess({...input,kind:'isochoric',end:'p',value:iso.states[1].p});balanced(q);close(q.states[1].T,700,1e-5);
 const t=solveWaterProcess({...input,kind:'isothermal',end:'p',value:1});balanced(t);close(t.states[1].p,1,1e-9);
 const x=solveWaterProcess({kind:'isothermal',mode:'px',a:.1,b:0,end:'x',value:1});balanced(x);close(x.states[1].x,1,1e-9);
 const s=solveWaterProcess({...input,kind:'isentropic',end:'p',value:1}),s2=solveWaterProcess({...input,kind:'isentropic',end:'T',value:s.states[1].T});balanced(s2);close(s2.states[1].p,1,1e-6);
});
test('Refinement limit is reported honestly when the tolerance is not achieved',()=>{
 balanced(solveWaterProcess({...input,kind:'isentropic',end:'p',value:.001}));
 const q=solveWaterProcess({fluid:'air',kind:'isothermal',mode:'pt',a:1e90,b:600,end:'p',value:1e-90},'IDEAL-CP');assert.equal(q.converged,false);assert.ok(q.refinement>q.tolerance);assert.ok(q.segments>=4096);
 const html=studyReportHTML('Limit',readStudyReport({entries:[{kind:'water-process',model:q.model,input:q.input}]}),{language:'en'});assert.ok(html.includes('WARNING: tolerance not achieved'));
});
