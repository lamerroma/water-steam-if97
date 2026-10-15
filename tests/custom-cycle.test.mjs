import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {solveCustomCycle,customCyclePreset,readCustomCycleInput,readCustomCycleDraft,customCycleSVG,customCycleCSV} from '../src/custom-cycle.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';
import {readWorkspace} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ±${t}`),clone=a=>JSON.parse(JSON.stringify(a));
function accepted(q){assert.ok(q.converged);assert.ok(Math.abs(q.residual)<=q.tolerance);assert.ok(Math.abs(q.flowResidual)<=q.tolerance);assert.ok(q.edges.every(e=>e.result.converged));for(const g of q.closure)if(q.input.closed)assert.ok(Math.abs(g.delta)<=g.tolerance,g.key);}
test('Five-state gas cycle closes with five process paths and independent rectangle work',()=>{
 for(const model of ['IDEAL-CP','IDEAL-NASA7']){const q=solveCustomCycle(customCyclePreset('gas-five'),model);accepted(q);assert.equal(q.states.length,5);assert.equal(q.edges.length,5);assert.equal(q.operation,'engine');close(q.netWork,1000*(.2-.1)*(q.states[3].v-q.states[0].v),1e-7);close(q.heatIn-q.heatOut,q.netWork,q.tolerance);close(q.efficiency,q.netWork/q.heatIn,1e-10);}
});
test('Carnot cycle independently recovers temperature efficiency and reversible work with both cp models',()=>{
 for(const model of ['IDEAL-CP','IDEAL-NASA7']){const q=solveCustomCycle(customCyclePreset('carnot',model),model);accepted(q);close(q.efficiency,1-300/600,2e-5);close(q.netWork,q.states[0].R*(600-300)*Math.log(2),q.tolerance);assert.ok(q.heatOut>0);}
});
test('Five-state water cycles use both formulations and preserve individual constraints',()=>{
 for(const model of ['IF97','IAPWS-95']){const q=solveCustomCycle(customCyclePreset('water-five',model),model);accepted(q);close(q.netWork,1000*(.2-.1)*(q.states[3].v-q.states[0].v),q.tolerance);assert.ok(q.efficiency>0&&q.efficiency<1);for(const e of q.edges)for(const s of e.result.path)if(e.kind==='isochoric')close(s.v,q.states[e.from].v,1e-8);else close(s.p,q.states[e.from].p,1e-8);}
});
test('Incompatible final connection is rejected; open path retains its energy change without engine efficiency',()=>{
 const a=customCyclePreset('gas-five');a.points[4].kind='isentropic';assert.throws(()=>solveCustomCycle(a,'IDEAL-CP'),/5 → 1/);
 a.closed=false;const q=solveCustomCycle(a,'IDEAL-CP');accepted(q);assert.equal(q.edges.length,4);assert.equal(q.efficiency,null);assert.equal(q.operation,'open');close(q.heat-q.netWork,q.states.at(-1).u-q.states[0].u,q.tolerance);assert.ok(q.closure.some(g=>Math.abs(g.delta)>g.tolerance));
 const bad=customCyclePreset('gas-five');bad.points[1].b=700;assert.throws(()=>solveCustomCycle(bad,'IDEAL-CP'),/1 → 2/);
});
test('Reverse cycle consumes work and cannot publish a heat-engine efficiency',()=>{
 const a=customCyclePreset('gas-five'),points=a.points.map((_,i)=>{const j=a.points.length-1-i,p=a.points[j],previous=a.points[(j-1+a.points.length)%a.points.length];return {...p,kind:previous.kind};});const q=solveCustomCycle({...a,points},'IDEAL-CP');accepted(q);assert.ok(q.netWork<0);assert.equal(q.operation,'work-input');assert.equal(q.efficiency,null);
});
test('SVG uses all sampled paths consistently; p-v polygon area matches integrated cycle work',()=>{
 const q=solveCustomCycle(customCyclePreset('gas-five'),'IDEAL-CP');let area=0;for(const e of q.edges)for(let i=1;i<e.result.path.length;i++){const a=e.result.path[i-1],b=e.result.path[i];area+=(a.p+b.p)/2*(b.v-a.v);}close(1000*area,q.netWork,1e-10);
 for(const kind of ['ts','hs','pv']){const svg=customCycleSVG(q,kind,true);assert.equal((svg.match(/data-cycle-path=/g)||[]).length,5);assert.equal((svg.match(/data-custom-state=/g)||[]).length,5);assert.match(svg,/polyline/);}assert.throws(()=>customCycleSVG(q,'bad'));
});
test('Inputs and drafts bound names, count, models and laws without importing computed states',()=>{
 const a=customCyclePreset('gas-five');for(const invalid of [{...a,mass:0},{...a,closed:'true'},{...a,points:a.points.slice(0,2)},{...a,points:Array(13).fill(a.points[0])}])assert.throws(()=>readCustomCycleInput(invalid));
 for(const patch of [{name:a.points[1].name},{mode:'px'},{kind:'constructor'},{kind:'polytropic',n:21},{a:NaN}]){const b=clone(a);Object.assign(b.points[0],patch);assert.throws(()=>readCustomCycleInput(b));}
 const draft={...a,model:'IDEAL-CP',mass:'1',points:a.points.map(p=>({...p,a:String(p.a),b:String(p.b),n:'1.3'}))};assert.equal(readCustomCycleDraft(draft).points.length,5);draft.points[0].a='invalid';assert.equal(readCustomCycleDraft(draft).points[0].a,'invalid');assert.throws(()=>readCustomCycleDraft({...draft,model:'IF97'}));
 const r=readWorkspace({active:'custom-cycle',panels:{'custom-cycle':{inputs:{'cc-data':JSON.stringify(draft)},model:'IDEAL-CP',calculated:false}}});assert.match(r.panels['custom-cycle'].inputs['cc-data'],/invalid/);
});
test('Report re-evaluates canonical inputs, shows three diagrams and escapes user state names',()=>{
 const input=customCyclePreset('gas-five');input.points[0].name='<script>bad</script>';const entry={kind:'custom-cycle',model:'IDEAL-CP',title:'<b>Cycle</b>',input,efficiency:999,html:'<script>bad</script>'},report=readStudyReport({entries:[entry]});assert.equal(report.entries[0].efficiency,undefined);accepted(evaluateReportEntry(report.entries[0]).customCycle);const html=studyReportHTML('Cycle',report,{language:'en'});assert.ok(!html.includes('<script>'));assert.match(html,/Closed cycle/);assert.match(html,/Thermal efficiency/);assert.match(html,/Cycle processes/);assert.equal((html.match(/data-cycle-path=/g)||[]).length,15);assert.match(customCycleCSV(evaluateReportEntry(report.entries[0]).customCycle),/IDEAL-CP/);assert.throws(()=>readStudyReport({entries:[{...entry,model:'bad'}]}));
});

test('Heat reversal within a NASA7 polytrope contributes to both heat-input and heat-rejection totals',async()=>{
 const {processGas}=await import('../src/process-gas.js'),{get}=processGas('air','IDEAL-NASA7'),a=get('pt',.1,300),v=a.v*.02,b=get('pv',.1*50**1.38,v),c=get('tv',300,v),input={fluid:'air',mass:1,closed:true,points:[a,b,c].map((s,i)=>({name:String(i+1),mode:'pt',a:s.p,b:s.T,kind:['polytropic','isochoric','isothermal'][i],...(i===0?{n:1.38}:{})}))};
 const q=solveCustomCycle(input,'IDEAL-NASA7');accepted(q);assert.ok(q.edges[0].heatIn>10&&q.edges[0].heatOut>1);close(q.edges[0].heatIn-q.edges[0].heatOut,q.edges[0].result.heat,1e-8);assert.ok(q.heatIn>q.edges.reduce((sum,e)=>sum+Math.max(e.result.heat,0),0));
 const h=customCyclePreset('carnot','IDEAL-CP');h.points[0].kind='isenthalpic';const r=solveCustomCycle(h,'IDEAL-CP');accepted(r);close(r.efficiency,.5,2e-5);
});

test('KPI 2022 five-process example is reconstructed from givens, not the rounded inconsistent state table',()=>{
 for(const model of ['IF97','IAPWS-95']){const q=solveCustomCycle(customCyclePreset('kpi-five',model),model);accepted(q);assert.deepEqual(q.edges.map(e=>e.kind),['isothermal','isentropic','isobaric','isentropic','isochoric']);const [a,b,c,d,e]=q.states;close(a.p,.1,1e-9);close(a.T,433,1e-5);close(d.p,.4,1e-9);close(e.T,623,1e-5);close(a.v/c.v,3.33,1e-7);close(a.T,b.T,1e-5);close(b.s,c.s,1e-6);close(d.s,e.s,1e-6);close(e.v,a.v,1e-8);close(c.s,7.38186,.001);assert.ok(Math.abs(c.s-7.48)>.09);close(q.efficiency,.23538,5e-5);
  const exact=a.T*(b.s-a.s)+(d.h-c.h)+(a.u-e.u);close(q.netWork,exact,q.tolerance);close(q.heatIn,d.h-c.h,q.tolerance);
 }
});
