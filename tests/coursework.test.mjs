import test from 'node:test';
import assert from 'node:assert/strict';
import {coursework,COURSE_DEFAULTS,courseworkTables,courseworkCSV,courseworkTrianglesSVG,courseworkInput} from '../src/coursework.js';
import {rankine} from '../src/cycles.js';
import {calculate} from '../src/engine.js';
import {readStudyReport,evaluateReportEntry,studyReportHTML} from '../src/study-report.js';
import {readWorkspace,readCalculation} from '../src/workspace.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const run=(kind,patch={},model='IF97')=>coursework({...COURSE_DEFAULTS[kind],...patch},model);

test('Rankine assignment: independently specified reference and heat balance',()=>{
 const q=run('rankine');near(q.metrics.efficiency,.41505,.00002);near(q.metrics.pump,11.6469,.0001);near(q.states[1].x,.7798,.0001);near(q.metrics.balanceResidual,0,1e-9);
 const losses=run('rankine',{etaT:.85});assert.ok(losses.metrics.efficiency<q.metrics.efficiency);assert.ok(losses.states[1].s>q.states[0].s);
 const exact=run('rankine',{pumpMethod:'isentropic',etaT:.85,flow:2});const existing=rankine(9.5,.0055,773.15,.85,.82,2);near(exact.metrics.power,existing.power,1e-8);
});
test('Stage: reference velocities, signed angles, Euler and steady energy balances',()=>{
 const q=run('stage'),m=q.metrics;near(m.power,13219.44,.03);near(m.w1,150.6,.01);near(m.c2,62.26,.01);near(m.beta1,26.42,.01);assert.ok(q.vectors.c2[0]<0);assert.ok(m.alpha2>90);near(m.balanceResidual,0,1e-10);
 const [s0,,s2]=q.states;near(s0.h+q.input.c0**2/2000-s2.h-m.c2**2/2000,m.work,1e-9);assert.ok(s2.s>s0.s);
 for(const reaction of [0,.25,.5])near(run('stage',{reaction}).metrics.balanceResidual,0,1e-9);
 const recovery=run('stage',{recovery:1});near(recovery.metrics.power,m.power);assert.ok(recovery.metrics.recoveredEfficiency>m.efficiency);
 near(run('stage',{flow:580}).metrics.power,2*m.power);
});
test('Core: changing power rebuilds height, nodes, local properties and heat normalisation',()=>{
 const q=run('core'),r=run('core',{thermalMW:1600}),a=r.input;
 near(r.profile[0].z,-r.metrics.height/2);near(r.profile.at(-1).z,r.metrics.height/2);assert.ok(r.metrics.height>q.metrics.height);near(r.metrics.flow/q.metrics.flow,1600/700);
 assert.notEqual(q.profile[3].z,r.profile[3].z);
 for(const n of r.profile){const s=calculate('ph',n.p,n.h).state;near(n.t,s.T-273.15);near(n.mu,s.mu,1e-12);near(n.cladResidual,0,1e-8);assert.ok(n.fuelSurface>n.cladInner&&n.cladInner>n.cladOuter&&n.cladOuter>n.t);}
 near(r.metrics.balanceResidual,0,1e-8);near(r.metrics.fuelPowerResidual,0,1e-5);
 const expectedH=r.states[0].h+a.hotFactor*(r.states[1].h-r.states[0].h);near(r.profile.at(-1).h,expectedH);
 assert.ok(q.warnings.length);assert.ok(q.notes.some(n=>n[1].includes('await additional course materials')));
});
test('Core geometry conventions are explicit; coefficients and grid are inputs',()=>{
 const corrected=run('core'),course=run('core',{areaMethod:'course'});assert.ok(corrected.metrics.waterArea<course.metrics.waterArea);assert.ok(corrected.metrics.hydraulicDiameter<course.metrics.hydraulicDiameter);
 const a=run('core',{points:7,cladMethod:'constant',gapConductivity:.646}),b=run('core',{points:7,cladMethod:'constant'});
 near(a.profile[3].fuelSurface-a.profile[3].cladInner,(b.profile[3].fuelSurface-b.profile[3].cladInner)/2);
 near(a.metrics.height,b.metrics.height);assert.equal(a.profile.length,7);
});
test('IF97 and IAPWS-95 independently produce consistent default coursework',()=>{
 for(const kind of ['rankine','stage','core']){const a=run(kind),b=run(kind,{},'IAPWS-95');const key=kind==='core'?'flow':'power';assert.ok(Math.abs(a.metrics[key]/b.metrics[key]-1)<.003);near(b.metrics.balanceResidual,0,1e-6);}
});
test('Reject malformed input, geometry, nonphysical states and boiling bulk coolant',()=>{
 for(const [kind,patch] of [['rankine',{flow:0}],['rankine',{flow:1e308}],['rankine',{etaT:1.1}],['rankine',{pLow:20}],['stage',{reaction:1}],['stage',{betaOffset:100}],['stage',{recovery:2}],['core',{rods:311}],['core',{points:202}],['core',{gap:4}],['core',{hotFactor:5}],['core',{pressureDrop:16}]])assert.throws(()=>run(kind,patch));
 assert.throws(()=>courseworkInput({...COURSE_DEFAULTS.stage,flow:'290'}));assert.throws(()=>coursework({...COURSE_DEFAULTS.stage},'unknown'));assert.throws(()=>coursework({kind:'__proto__'}));
});
test('Reports retain inputs, recompute results, escape text, and export full steps/profile',()=>{
 for(const kind of ['rankine','stage','core']){
 const input={...COURSE_DEFAULTS[kind],malicious:'<script>bad</script>'};const report=readStudyReport({entries:[{kind:'coursework',input,title:'<script>title</script>',comment:'<img src=x>'}]});assert.equal(report.entries[0].input.malicious,undefined);
 const q=evaluateReportEntry(report.entries[0]);assert.ok(q.tables[0].rows.length>=10);const html=studyReportHTML('Test',report,{language:'en'});assert.ok(html.includes('Substitution'));assert.ok(html.includes('&lt;script&gt;title'));assert.ok(!html.includes('<script>'));if(kind==='stage')assert.ok(html.includes('Velocity triangles'));
 }
 const q=run('core');assert.equal(courseworkTables(q)[2].rows.length,25);assert.ok(courseworkCSV(q).includes('clad'));assert.ok(courseworkTrianglesSVG(run('stage')).includes('c₂'));
});
test('Workspace and calculation JSON support only known coursework fields and choices',()=>{
 const inputs={'cw-kind':'stage','cw-pIn':'17,2','cw-flow':'290'};const q=readCalculation(JSON.stringify({module:'coursework',inputs,model:'IF97'}));assert.deepEqual(q.record.inputs,inputs);
 assert.throws(()=>readWorkspace({active:'coursework',panels:{coursework:{inputs:{'cw-kind':'wrong'},calculated:true}}}));
 assert.throws(()=>readWorkspace({active:'coursework',panels:{coursework:{inputs:{'cw-injected':'1'},calculated:true}}}));
});
