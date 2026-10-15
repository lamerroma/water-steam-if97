import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {buildLibraryCycle,compareLibraryCycles,defaultCycleBuilder,readCycleBuilderDraft} from '../src/cycle-library.js';
import {solveCustomCycle,readCustomCycleInput,customCycleCSV,customCycleNotes} from '../src/custom-cycle.js';
import {rankineCycleDetails,rankineCycleTables,idealRankineConfig} from '../src/rankine-library.js';
import {customCycleSVG} from '../src/cycle-chart.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const refs=JSON.parse(fs.readFileSync(new URL('fixtures/rankine-actual-reference.json',import.meta.url))),close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`),base=refs.records[0].input;
for(const r of refs.records)test(`Independent adiabatic reference ${r.model}: ${r.name}`,()=>{
 const q=buildLibraryCycle(r.input).result,d=rankineCycleDetails(q);assert.ok(q.converged&&d.actual);assert.equal(q.basis,'steady-flow');
 for(let i=0;i<q.states.length;i++)for(const [k,t]of Object.entries({p:1e-7,T:.0001,h:.0005,s:2e-6,v:2e-6})){close(q.states[i][k],r.states[i][k],t);}for(const [k,v]of Object.entries(r.metrics))close(d[k],v,k==='efficiency'?2e-7:.002);
 close(q.efficiency,r.metrics.efficiency,2e-5);close(q.netWork,r.metrics.net,q.tolerance);assert.ok(Math.abs(q.flowResidual)<=q.tolerance);assert.ok(q.efficiency>0&&q.efficiency<1);
 for(const e of q.edges.filter(e=>e.kind==='adiabatic')){const a=q.states[e.from],b=q.states[e.to],z=e.result;assert.equal(z.heat,0);assert.equal(e.heatIn,0);assert.equal(e.heatOut,0);assert.equal(z.boundaryWork,null);assert.equal(z.path.length,2);assert.ok(z.entropyGeneration>=-2e-7);close(z.technicalWork,z.states[0].h-z.states[1].h,1e-12);
 // A mixture reports the solved saturation pressure (inverse tolerance 2e-11 MPa).
 // Re-solving at that pressure can shift enthalpy by a few 1e-7 kJ/kg across V8 versions.
 // Keep the exact component identity above, and bound canonical endpoint agreement separately.
 close(z.states[1].h,b.h,1e-6);close(z.technicalWork,a.h-b.h,1e-6);close(z.compression?(z.ideal.h-a.h)/(b.h-a.h):(a.h-b.h)/(a.h-z.ideal.h),z.eta,1e-7);}
 assert.equal(q.states.at(-1).x===null,r.states.at(-1).x===null);if(r.states.at(-1).x!==null)close(q.states.at(-1).x,r.states.at(-1).x,2e-6);
});
test('Unity efficiencies reproduce ideal endpoints and total cycle; no fake reversible heat or p-v work',()=>{
 const actual=buildLibraryCycle({...base,etaPump:1,etaHP:1}).result,ideal=buildLibraryCycle({...base,equipment:'ideal'}).result;
 for(let i=0;i<4;i++)for(const k of ['p','T','h','s','v'])close(actual.states[i][k],ideal.states[i][k],1e-8);close(actual.efficiency,ideal.efficiency,2e-5);close(actual.netWork,ideal.netWork,actual.tolerance+ideal.tolerance);
 const unity95=buildLibraryCycle({...base,model:'IAPWS-95',etaPump:1,etaHP:1}).result,ideal95=buildLibraryCycle({...base,model:'IAPWS-95',equipment:'ideal'}).result;for(let i=0;i<4;i++)for(const k of ['p','T','h','s','v'])close(unity95.states[i][k],ideal95.states[i][k],1e-6);close(unity95.efficiency,ideal95.efficiency,2e-5);
 assert.ok(customCycleNotes(actual,true).some(s=>s.includes('not its heat')));assert.match(customCycleCSV(actual),/eta_s/);const tables=rankineCycleTables(actual,true);for(const row of tables.find(t=>t.className==='rankine-components').rows.filter((_,i)=>i%2===0)){assert.equal(row[4],null);assert.equal(row[5],null);}
});
test('Losses change work, efficiency and moisture; ideal comparison is regenerated from current states',()=>{
 const q=buildLibraryCycle(base).result,i=buildLibraryCycle(idealRankineConfig(q)).result,a=rankineCycleDetails(q),b=rankineCycleDetails(i);assert.ok(a.pump>b.pump&&a.hp<b.hp&&a.efficiency<b.efficiency);assert.ok(a.outlets[0].x>b.outlets[0].x);
 const input={slots:[{name:'Ideal',model:i.model,input:i.input},{name:'Actual',model:q.model,input:q.input}]},comparison=compareLibraryCycles(input);for(const k of ['ts','hs','pv','pt','ps','tv']){const svg=customCycleSVG(q,k,true);assert.match(svg,/data-machine-schematic="true"/);assert.match(svg,/internal path unknown/);}
 const report=readStudyReport({entries:[{kind:'cycle-comparison',model:q.model,input:comparison.input}]});for(const language of ['uk','en']){const html=studyReportHTML('Machines',report,{language});assert.match(html,/eta_s=|ηₛ|eta_s =|eta_s/);assert.match(html,/sgen/);assert.match(html,/data-machine-schematic/);}
 const single=studyReportHTML('Actual',readStudyReport({entries:[{kind:'custom-cycle',model:q.model,input:q.input}]}),{language:'en'});assert.match(single,/Steady-flow balance/);assert.match(single,/eta_s/);
 assert.deepEqual(solveCustomCycle(JSON.parse(JSON.stringify(q.input)),q.model).states,q.states);
});
test('Invalid efficiencies, state tampering, low-work recipes and incompatible fluids fail; old drafts stay ideal',()=>{
 for(const eta of [0,-.1,1.01,NaN,Infinity,'0.8'])for(const k of ['etaPump','etaHP'])assert.throws(()=>buildLibraryCycle({...base,[k]:eta}));
 assert.throws(()=>buildLibraryCycle({...base,kind:'rankine-reheat',pReheat:2,Treheat:773.15,etaLP:0}));assert.throws(()=>buildLibraryCycle({...base,etaPump:.0001}));
 const q=buildLibraryCycle(base).result,bad=structuredClone(q.input);bad.points[1].b+=10;assert.throws(()=>solveCustomCycle(bad,q.model),/End state/);assert.throws(()=>readCustomCycleInput({...q.input,fluid:'air'}));
 const unity=buildLibraryCycle({...base,etaPump:1,etaHP:1}).input,tampered=structuredClone(unity);tampered.points[1]={...tampered.points[1],mode:'ps',b:solveCustomCycle(unity,'IF97').states[0].s-1e-6};assert.throws(()=>solveCustomCycle(tampered,'IF97'),/entropy cannot decrease/);
 const draft=defaultCycleBuilder();for(const k of ['equipment','etaPump','etaHP','etaLP'])delete draft[k];assert.equal(readCycleBuilderDraft(draft).equipment,'ideal');assert.equal(buildLibraryCycle({...base,equipment:'ideal',etaPump:'unfinished'}).input.points[0].kind,'isentropic');
});
