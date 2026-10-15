import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {buildLibraryCycle,compareLibraryCycles,cycleComparisonTable,readCycleBuilderDraft,defaultCycleBuilder} from '../src/cycle-library.js';
import {regenerationConfig,noBleedDetails} from '../src/rankine-regeneration.js';
import {solveCustomCycle,readCustomCycleInput,customCycleCSV} from '../src/custom-cycle.js';
import {idealRankineConfig} from '../src/rankine-library.js';
import {customCycleSVG} from '../src/cycle-chart.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const refs=JSON.parse(fs.readFileSync(new URL('fixtures/rankine-regeneration-reference.json',import.meta.url))),close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`),base=refs.records.find(r=>r.name==='actual'&&r.input.model==='IF97').input;
for(const r of refs.records)test(`Independent open-heater ${r.input.model}: ${r.name}`,()=>{
 const q=buildLibraryCycle(r.input).result,d=q.regeneration;assert.ok(q.converged);assert.equal(q.states.length,7);assert.equal(q.edges.length,8);assert.equal(q.input.topology,'open-heater');
 for(let i=0;i<7;i++){for(const [k,t]of Object.entries({p:1e-7,T:.0001,h:.0005,s:2e-6,v:2e-6}))close(q.states[i][k],r.states[i][k],t);if(r.states[i].x===null)assert.equal(q.states[i].x,null);else close(q.states[i].x,r.states[i].x,2e-6);}
 for(const [k,v]of Object.entries(r.metrics).filter(([k])=>!k.startsWith('baseline')))close(d[k],v,['y','efficiency','mixerEntropy'].includes(k)?2e-7:.003);
 close(q.netWork,r.metrics.net,q.tolerance);close(q.heatIn,r.metrics.boiler,q.tolerance);close(q.heatOut,r.metrics.condenser,q.tolerance);close(q.efficiency,r.metrics.efficiency,2e-5);
 assert.ok(d.y>0&&d.y<1&&d.mixerEntropy>=0);assert.ok(d.massResiduals.every(x=>Math.abs(x)<1e-12));close(d.mixerResidual,0,1e-7);assert.ok(Math.abs(q.flowResidual)<=q.tolerance);
 for(const e of q.edges){assert.ok(e.flow>0&&e.flow<=1);if(e.kind==='mixing'){assert.equal(e.result.heat,0);assert.equal(e.result.technicalWork,0);assert.equal(e.result.flowResidual,null);}if(e.kind==='adiabatic'){assert.equal(e.result.heat,0);assert.ok(e.result.entropyGeneration>=-2e-7);close(e.result.technicalWork,e.result.states[0].h-e.result.states[1].h,1e-12);}}
 const b=buildLibraryCycle(regenerationConfig(q,false,true)).result,bd=noBleedDetails(b);assert.ok(bd);close(bd.boiler,r.metrics.baselineHeat,.003);close(bd.net,r.metrics.baselineWork,.003);close(b.efficiency,r.metrics.baselineEfficiency,2e-5);
 // The control has identical stages, pressures, boiler-steam conditions and all four efficiencies.
 for(const [i,j]of [[0,0],[1,1],[2,3],[3,4],[4,5],[5,6]])if(i!==2)close(b.states[i].h,q.states[j].h,1e-6);
 assert.deepEqual([b.input.points[0].eta,b.input.points[1].eta,b.input.points[3].eta,b.input.points[4].eta],[q.input.points[0].eta,q.input.points[2].eta,q.input.points[4].eta,q.input.points[5].eta]);
});
test('Mass scaling, extraction accounting and comparison use boiler steam basis, not equal stream flows',()=>{
 const q=buildLibraryCycle(base).result,b=buildLibraryCycle(regenerationConfig(q,false,true)).result,m=buildLibraryCycle({...base,mass:3}).result,d=q.regeneration;
 close(m.total.netWork,3*q.total.netWork,1e-7);close(m.efficiency,q.efficiency,1e-12);assert.ok(q.efficiency>b.efficiency);assert.ok(q.heatIn<b.heatIn);assert.ok(d.lp<(q.states[5].h-q.states[6].h));close(d.lp,(1-d.y)*(q.states[5].h-q.states[6].h),1e-9);
 const c=compareLibraryCycles({slots:[{name:'No extraction',model:b.model,input:b.input},{name:'Heater',model:q.model,input:q.input}]});const y=cycleComparisonTable(c,true).rows.find(r=>r[0]==='y');close(y[2],d.y,1e-12);close(y[3],d.y,1e-12);
});
test('Canonical input/project/report/CSV retain topology; imported result fractions are ignored',()=>{
 const q=buildLibraryCycle(base).result,raw=JSON.parse(JSON.stringify({...q.input,y:.99,regeneration:{y:.99},edges:[]}));const clean=readCustomCycleInput(raw);assert.equal(clean.y,undefined);assert.equal(clean.edges,undefined);assert.equal(solveCustomCycle(clean,q.model).regeneration.y,q.regeneration.y);
 const report=readStudyReport({entries:[{kind:'custom-cycle',model:q.model,input:raw}]});for(const language of ['uk','en']){const html=studyReportHTML('Open heater',report,{language});assert.match(html,/2 \+ 6 → 3/);assert.match(html,/kg boiler|kg пари котла/);assert.match(html,/data-flow-fraction/);}
 const csv=customCycleCSV(q);assert.match(csv,/open-heater/);assert.match(csv,/flow_fraction/);assert.match(csv,/schematic endpoints/);for(const k of ['ts','hs','pv','pt','ps','tv'])assert.equal((customCycleSVG(q,k,true).match(/data-cycle-path=/g)||[]).length,8);
 const svg=customCycleSVG(q,'ts',true),labels=[...svg.matchAll(/<text x="([^"]+)" y="([^"]+)">([1-7])<\/text>/g)].map(m=>({x:+m[1],y:+m[2],name:m[3]}));for(const [a,b]of [['1','2'],['3','4']]){const x=labels.find(l=>l.name===a),y=labels.find(l=>l.name===b);assert.ok(Math.abs(x.y-y.y)>=14||Math.abs(x.x-y.x)>=20,'Pump-state labels must remain distinguishable');}
 const ideal=buildLibraryCycle(idealRankineConfig(q)).result;assert.ok(ideal.input.points.filter(p=>p.kind==='adiabatic').every(p=>p.eta===1));assert.ok(ideal.regeneration.mixerEntropy>0);const noBleed=buildLibraryCycle(regenerationConfig(q,false,true)).result;assert.ok(buildLibraryCycle(idealRankineConfig(noBleed)).result.converged);
});
test('Invalid pressure/efficiency/phase/topology and incompatible input fail without trusting network labels',()=>{
 for(const patch of [{pBleed:.001},{pBleed:10},{pBleed:NaN},{etaPumpHigh:0},{etaLP:1.1},{etaPump:.00001},{Tsteam:400}])assert.throws(()=>buildLibraryCycle({...base,...patch}));
 const q=buildLibraryCycle(base).result;for(const patch of [{closed:false},{fluid:'air'},{topology:'other'},{points:q.input.points.slice(1)}])assert.throws(()=>readCustomCycleInput({...q.input,...patch}));const bad=structuredClone(q.input);bad.points[1].kind='isobaric';assert.throws(()=>readCustomCycleInput(bad));
 const edited=structuredClone(q.input);edited.points[2].b=.1;assert.throws(()=>solveCustomCycle(edited,q.model));const mismatch=structuredClone(q.input);mismatch.points[5].eta=.7;assert.throws(()=>solveCustomCycle(mismatch,q.model),/Outlet/);
 const draft=defaultCycleBuilder();delete draft.pBleed;delete draft.etaPumpHigh;assert.equal(readCycleBuilderDraft(draft).pBleed,'1');assert.ok(buildLibraryCycle({...base,equipment:'ideal',etaPumpHigh:'unfinished'}).result.converged);
});
