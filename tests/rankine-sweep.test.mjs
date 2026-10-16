import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {readRankineSweepInput,readRankineSweepWorkspace,solveRankineSweep,rankineSweepPointConfig,rankineSweepSVG,rankineSweepCSV} from '../src/rankine-sweep.js';
import {buildLibraryCycle,readCycleLibraryWorkspace} from '../src/cycle-library.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const refs=JSON.parse(fs.readFileSync(new URL('fixtures/rankine-sweep-reference.json',import.meta.url))),base=refs.records[0].input,close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`);
for(const model of ['IF97','IAPWS-95'])test(`Independent extraction-pressure grid ${model}`,()=>{
 const records=refs.records.filter(r=>r.input.model===model),q=solveRankineSweep({config:{...base,model},min:.1,max:3,count:5});
 assert.equal(q.points.length,5);assert.deepEqual(q.points.map(p=>p.p),records.map(r=>r.input.pBleed));assert.ok(q.points.every(p=>p.valid));
 for(const [i,p]of q.points.entries()){const r=records[i];close(p.efficiency,r.metrics.efficiency,2e-7);close(p.work,r.metrics.net,.003);close(p.y,r.metrics.y,2e-7);close(p.quality,r.states[6].x,2e-6);close(p.moisture,1-r.states[6].x,2e-6);}
 assert.equal(q.bestIndex,records.reduce((best,r,i)=>r.metrics.efficiency>records[best].metrics.efficiency?i:best,0));
 const config=rankineSweepPointConfig(q,q.bestIndex),single=buildLibraryCycle(config).result;
 const fixed={...config};delete fixed.pBleed;assert.deepEqual(fixed,readRankineSweepInput({config:{...base,model},min:.1,max:3,count:5}).config);
 close(single.regeneration.efficiency,q.points[q.bestIndex].efficiency,1e-12);close(single.regeneration.y,q.points[q.bestIndex].y,1e-12);
});
test('Invalid regimes remain gaps with null values; all-invalid grids have no best point',()=>{
 const q=solveRankineSweep({config:base,min:.01,max:10,count:3});assert.equal(q.points[0].valid,false);assert.equal(q.points[2].valid,false);assert.ok(q.points[1].valid);assert.equal(q.bestIndex,1);
 for(const p of [q.points[0],q.points[2]]){assert.ok(p.error);assert.equal(p.work,null);assert.equal(p.efficiency,null);assert.throws(()=>rankineSweepPointConfig(q,p.index));}
 const all=solveRankineSweep({config:base,min:10,max:20,count:2});assert.equal(all.bestIndex,null);assert.ok(all.points.every(p=>!p.valid));assert.match(rankineSweepSVG(all),/d="" fill="none"/);
 const gap=structuredClone(q);gap.points=[q.points[1],q.points[0],q.points[1]];gap.points[0].p=1;gap.points[2]={...gap.points[2],p:3};assert.equal((rankineSweepSVG(gap).match(/data-sweep-line="efficiency" d="([^"]*)"/)[1].match(/M/g)||[]).length,2);
});
test('Saturated inlet, ideal equipment, undefined superheated quality and reference mass',()=>{
 const ideal={...base,equipment:'ideal',etaPump:'unused'},q=solveRankineSweep({config:ideal,min:.5,max:1.5,count:3}),m=solveRankineSweep({config:{...ideal,mass:3},min:.5,max:1.5,count:3});assert.deepEqual(q.points,m.points);
 const sat=solveRankineSweep({config:{...base,steamMode:'saturated',pHigh:3},min:.2,max:1,count:2});assert.ok(sat.points.every(p=>p.valid&&p.quality!==null));
 const hot=solveRankineSweep({config:{...base,pLow:.5,Tsteam:1000,pBleed:2},min:1,max:3,count:2});assert.ok(hot.points.every(p=>p.valid&&p.quality===null&&p.moisture===null));assert.match(rankineSweepSVG(hot,'moisture',true),/Undefined outside saturation/);assert.equal(rankineSweepSVG(hot,'moisture',true).match(/data-sweep-line="moisture" d="([^"]*)"/)[1],'');
});
test('Bounded canonical inputs reject invalid drafts and strip imported results',()=>{
 const full=solveRankineSweep({config:base,min:.1,max:3,count:41});assert.equal(full.points.length,41);assert.equal(full.points[0].p,.1);assert.equal(full.points[40].p,3);assert.ok(full.points.every(p=>p.valid));
 const valid={config:base,min:.1,max:3,count:5};for(const patch of [{min:0},{max:.1},{count:1},{count:42},{count:2.5},{count:'5'},{selected:5},{selected:-1},{min:NaN},{max:Infinity},{min:1e20,max:1e20+16384,count:41}])assert.throws(()=>readRankineSweepInput({...valid,...patch}));
 assert.throws(()=>readRankineSweepInput({...valid,config:{...base,kind:'rankine-reheat'}}));
 assert.deepEqual(readRankineSweepInput({...valid,config:{...base,pBleed:'unused'}}),readRankineSweepInput(valid));
 const input=readRankineSweepInput({...valid,points:[{efficiency:99}],bestIndex:0});assert.equal(input.points,undefined);assert.equal(input.bestIndex,undefined);
 const state=readCycleLibraryWorkspace({sweep:{input,metric:'work'}});assert.equal(state.sweep.input.count,5);assert.equal(state.sweep.min,'.1');assert.equal(readCycleLibraryWorkspace(null).sweep.input,null);assert.throws(()=>readRankineSweepWorkspace({metric:'invalid'}));
 assert.throws(()=>readStudyReport({entries:[{kind:'rankine-sweep',model:'IAPWS-95',input}]}),/model/);
});
test('CSV, four SVGs and bilingual reports retain fixed inputs, units, statuses and selection',()=>{
 const input={config:base,min:.01,max:10,count:3,selected:1},q=solveRankineSweep(input),csv=rankineSweepCSV(q);assert.match(csv,/kg boiler/);assert.match(csv,/"selected","2"/);assert.match(csv,/not a continuous or global optimum/);assert.match(csv,/extraction/);assert.match(csv,/"ηₕ \[%\]"/);
 for(const k of ['efficiency','work','y','moisture']){const svg=rankineSweepSVG(q,k,true);assert.match(svg,new RegExp(`data-sweep-chart="${k}"`));assert.equal((svg.match(/data-sweep-point=/g)||[]).length,3);assert.doesNotMatch(svg,/NaN|Infinity/);}
 const r=readStudyReport({entries:[{kind:'rankine-sweep',model:'IF97',input:{...input,points:[{efficiency:99}]}}]});assert.equal(r.entries[0].input.points,undefined);
 for(const language of ['uk','en']){const html=studyReportHTML('Pressure study',r,{language});assert.equal((html.match(/data-sweep-chart=/g)||[]).length,4);assert.match(html,/kg boiler/);assert.match(html,/etaPumpHigh/);assert.match(html,/0\.82/);assert.match(html,language==='en'?/not a continuous or global optimum/:/не неперервний чи глобальний оптимум/);}
});
