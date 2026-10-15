import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {buildLibraryCycle,defaultCycleBuilder,readCycleBuilderDraft,readLibraryCycleConfig,compareLibraryCycles,cycleComparisonTable} from '../src/cycle-library.js';
import {rankineCycleDetails,rankineCycleTables} from '../src/rankine-library.js';
import {solveCustomCycle,customCycleTables,customCycleCSV} from '../src/custom-cycle.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const refs=JSON.parse(fs.readFileSync(new URL('fixtures/rankine-library-reference.json',import.meta.url))),close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`),template=(q,name)=>({name,model:q.model,input:q.input});
const base=(kind='rankine',model='IF97')=>({kind,model,fluid:'water',mass:1,pLow:.01,pHigh:10,pReheat:2,Tsteam:773.15,Treheat:773.15,steamMode:'superheated'});
for(const ref of refs.records)test(`Independent Python iapws ${ref.model}: ${ref.name}`,()=>{
 const q=buildLibraryCycle(ref.input).result,d=rankineCycleDetails(q);assert.ok(q.converged);assert.ok(d);assert.equal(q.states.length,ref.states.length);
 for(let i=0;i<q.states.length;i++){const a=q.states[i],b=ref.states[i];for(const [key,t]of Object.entries({p:1e-7,T:.0001,h:.0005,s:2e-6,v:2e-6}))close(a[key],b[key],t);if(b.x===null)assert.equal(a.x,null);else close(a.x,b.x,2e-6);}
 for(const [key,value]of Object.entries(ref.metrics))close(d[key],value,key==='efficiency'?2e-7:.002);
 close(q.netWork,ref.metrics.net,q.tolerance);close(q.heatIn,ref.metrics.heat,q.tolerance);close(q.heatOut,ref.metrics.condenser,q.tolerance);close(q.efficiency,ref.metrics.efficiency,2e-5);
 assert.ok(Math.abs(q.residual)<=q.tolerance&&Math.abs(q.flowResidual)<=q.tolerance);for(const e of q.edges){assert.ok(e.result.converged);assert.ok(Math.abs(e.result.flowResidual)<=e.result.tolerance);if(e.kind==='isentropic')for(const p of e.result.path)close(p.s,q.states[e.from].s,1e-6);else for(const p of e.result.path)close(p.p,q.states[e.from].p,1e-6);}
 for(const c of d.components){const r=q.edges[c.edge].result;close(r.heat,c.heat,r.tolerance);close(r.technicalWork,c.work,r.tolerance);}
});
test('Reheat raises exit quality for the reference example; exact pump is not replaced by v*dp',()=>{
 const a=buildLibraryCycle(base()).result,b=buildLibraryCycle(base('rankine-reheat')).result,ra=rankineCycleDetails(a),rb=rankineCycleDetails(b);assert.ok(rb.outlets.at(-1).x>ra.outlets[0].x);assert.ok(b.efficiency>a.efficiency);assert.ok(Math.abs(ra.pump-1000*a.states[0].v*(10-.01))>.01);close(ra.pump,a.states[1].h-a.states[0].h,1e-9);
 const q=compareLibraryCycles({slots:[template(a,'Simple'),template(b,'Reheat')]});const row=cycleComparisonTable(q,true).rows.find(r=>r[0]==='Final turbine exit moisture');close(row[3],a.states.at(-1).x-b.states.at(-1).x,1e-12);
});
test('Phase modes, heat direction and pressure order are explicit; invalid unused values are ignored',()=>{
 for(const patch of [{pLow:0},{pHigh:22.064},{pHigh:.001},{model:'IDEAL-CP'},{fluid:'air'},{mass:0},{pHigh:NaN},{Tsteam:400},{Tsteam:calculate('px',10,1).state.T}])assert.throws(()=>buildLibraryCycle({...base(),...patch}));
 for(const patch of [{pReheat:10},{pReheat:.005},{Treheat:500}])assert.throws(()=>buildLibraryCycle({...base('rankine-reheat'),...patch}));
 assert.throws(()=>buildLibraryCycle({...base(),pLow:.5,Tsteam:1073.15}),/Ambiguous/);
 const config=readLibraryCycleConfig({...base(),pReheat:NaN,Treheat:'unfinished',Tmax:'unused'});assert.equal(config.pReheat,undefined);assert.equal(config.Tmax,undefined);
 const saturated=readLibraryCycleConfig({...base(),steamMode:'saturated',Tsteam:NaN});assert.equal(saturated.Tsteam,undefined);assert.equal(buildLibraryCycle(saturated).result.states[2].x,1);
});
test('Old gas drafts migrate; water drafts retain inactive invalid strings and enforce model compatibility',()=>{
 const legacy=defaultCycleBuilder();for(const key of ['pLow','pHigh','pReheat','Tsteam','Treheat','steamMode'])delete legacy[key];assert.equal(readCycleBuilderDraft(legacy).pHigh,'10');
 const draft={...defaultCycleBuilder(),kind:'rankine',fluid:'water',model:'IAPWS-95',pReheat:'unfinished',Treheat:'bad',Tmax:'bad gas value'};assert.equal(readCycleBuilderDraft(draft).pReheat,'unfinished');assert.throws(()=>readCycleBuilderDraft({...draft,fluid:'air'}));assert.throws(()=>readCycleBuilderDraft({...draft,model:'IDEAL-CP'}));
});
test('Components are inferred from current states/laws, survive input-only reports, and clear after topology edits',()=>{
 const a=buildLibraryCycle(base()),q=a.result;assert.ok(rankineCycleTables(q,true).some(t=>t.title.includes('component')));assert.match(customCycleCSV(q),/Rankine: component/);
 const report=readStudyReport({entries:[{kind:'custom-cycle',model:a.model,input:a.input,components:[999],title:'Rankine'}]});assert.equal(report.entries[0].components,undefined);assert.ok(rankineCycleDetails(evaluateReportEntry(report.entries[0]).customCycle));
 for(const language of ['uk','en']){const html=studyReportHTML('Rankine',report,{language});assert.match(html,/δq/);assert.match(html,/1−x/);assert.match(html,/ηₕ/);}
 const open=solveCustomCycle({...a.input,closed:false},a.model);assert.equal(rankineCycleDetails(open),null);assert.ok(!customCycleTables(open,true).some(t=>t.title.includes('Rankine')));
 const changed={...q,edges:q.edges.map(e=>({...e,kind:'isothermal'}))};assert.equal(rankineCycleDetails(changed),null);
});
test('Mass scales total energies; superheated exit quality stays undefined in comparison',()=>{
 const r=refs.records.find(r=>r.model==='IF97'&&r.name==='superheated-exit'),q=buildLibraryCycle(r.input).result,large=buildLibraryCycle({...r.input,mass:3}).result;assert.equal(q.states.at(-1).x,null);close(large.total.netWork,3*q.netWork,1e-8);close(large.efficiency,q.efficiency,1e-12);
 const wet=buildLibraryCycle(base()).result,comparison=compareLibraryCycles({slots:[template(wet,'Wet exit'),template(q,'Superheated exit')]});const row=cycleComparisonTable(comparison,true).rows.find(r=>r[0]==='Final turbine exit quality');assert.equal(row[2],null);assert.equal(row[3],null);
 const html=studyReportHTML('Compare',readStudyReport({entries:[{kind:'cycle-comparison',model:'IF97',input:comparison.input}]}),{language:'en'});assert.match(html,/A: Rankine/);assert.match(html,/B: Rankine/);assert.match(html,/Superheated steam; quality undefined/);
});
