import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLibraryCycle,defaultCycleBuilder,readCycleBuilderDraft,readLibraryCycleConfig,readCycleTemplate,readCycleLibraryWorkspace,compareLibraryCycles,cycleComparisonTable,cycleComparisonSVG} from '../src/cycle-library.js';
import {processGas} from '../src/process-gas.js';
import {readCustomCycleDraft} from '../src/custom-cycle.js';
import {readWorkspace} from '../src/workspace.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`);
const config=(kind,model='IDEAL-CP')=>({kind,fluid:'air',model,p1:.1,T1:kind==='carnot'?600:300,Tlow:300,mass:1,ratio:kind==='carnot'?2:8,heatMode:'temperature',Tmax:1500});
const template=(q,name='Cycle')=>({name,model:q.model,input:q.input});
test('All four constant-cp cycles agree with independent textbook efficiency and heat/work formulas',()=>{
 for(const kind of ['carnot','otto','diesel','brayton']){const {result:q}=buildLibraryCycle(config(kind)),[a,b,c,d]=q.states,k=a.gamma;let eta,qi,qo;
  if(kind==='carnot'){eta=1-d.T/a.T;qi=a.R*a.T*Math.log(b.v/a.v);qo=a.R*d.T*Math.log(b.v/a.v);}
  else if(kind==='otto'){eta=1-1/8**(k-1);qi=a.cv*(c.T-b.T);qo=a.cv*(d.T-a.T);close(b.T/a.T,8**(k-1),1e-8);}
  else if(kind==='diesel'){const rho=c.v/b.v;eta=1-(rho**k-1)/(k*(rho-1)*8**(k-1));qi=a.cp*(c.T-b.T);qo=a.cv*(d.T-a.T);assert.ok(rho>1&&rho<8);}
  else{eta=1-1/8**((k-1)/k);qi=a.cp*(c.T-b.T);qo=a.cp*(d.T-a.T);close(b.p/a.p,8,1e-10);}
  assert.ok(q.converged);close(q.efficiency,eta,2e-5);close(q.heatIn,qi,q.tolerance);close(q.heatOut,qo,q.tolerance);close(q.netWork,qi-qo,q.tolerance);for(const gap of q.closure)assert.ok(Math.abs(gap.delta)<=gap.tolerance);
 }
});
test('Heat-specified cycles recover the requested heat input with both caloric models',()=>{
 for(const model of ['IDEAL-CP','IDEAL-NASA7'])for(const kind of ['otto','diesel','brayton']){const q=buildLibraryCycle({...config(kind,model),heatMode:'heat',heat:600}).result;close(q.heatIn,600,q.tolerance);assert.ok(q.efficiency>0&&q.efficiency<1);const [a,b,c,d]=q.states;close(a.s,b.s,1e-7);close(c.s,d.s,1e-7);if(kind==='otto')close(b.v,c.v,1e-9);else close(b.p,c.p,1e-9);}
});
test('Variable-cp Carnot retains universal efficiency; NASA7 compression satisfies numerical entropy integral',()=>{
 const c=buildLibraryCycle(config('carnot','IDEAL-NASA7')).result;close(c.efficiency,.5,2e-5);close(c.netWork,c.states[0].R*300*Math.log(2),c.tolerance);
 const q=buildLibraryCycle(config('otto','IDEAL-NASA7')).result,[a,b]=q.states,g=processGas('air','IDEAL-NASA7');
 const integral=(lo,hi)=>{const n=2000,h=(hi-lo)/n;let sum=0;for(let i=0;i<=n;i++){const T=lo+i*h;sum+=(i===0||i===n?1:i%2?4:2)*g.get('pt',.1,T).cp/T;}return h*sum/3;};
 close(integral(a.T,b.T)-a.R*Math.log(b.p/a.p),0,1e-8);assert.ok(Math.abs(q.efficiency-(1-1/8**(a.gamma-1)))>.01);
});
test('All supported gases generate closed cycles; mass scales total work but not efficiency',()=>{
 for(const fluid of ['air','N2','O2','CO2','He','Ar'])for(const model of ['IDEAL-CP','IDEAL-NASA7']){const a=buildLibraryCycle({...config('carnot',model),fluid}),b=buildLibraryCycle({...config('carnot',model),fluid,mass:3});close(a.result.efficiency,.5,2e-5);close(b.result.total.netWork,3*a.result.netWork,1e-9);close(a.result.efficiency,b.result.efficiency,1e-12);}
});
test('Invalid bounds, ineffective heat input and impossible Diesel cutoff are rejected',()=>{
 for(const patch of [{ratio:1},{ratio:1001},{p1:0},{mass:0},{T1:100},{Tmax:7000},{Tmax:400},{heatMode:'heat',heat:-1},{fluid:'water'},{model:'IF97'},{kind:'constructor'}])assert.throws(()=>buildLibraryCycle({...config('otto'),...patch}));
 assert.throws(()=>buildLibraryCycle({...config('carnot'),Tlow:600}));assert.throws(()=>buildLibraryCycle({...config('diesel'),ratio:2,Tmax:1500}),/cutoff/);assert.throws(()=>buildLibraryCycle({...config('otto'),heatMode:'heat',heat:1e8}),/range/);
 assert.equal(readLibraryCycleConfig({...config('carnot'),heatMode:'bad',Tmax:NaN}).heatMode,undefined);
});
test('Bounded project library retains invalid builder drafts and strips imported results',()=>{
 const q=buildLibraryCycle(config('otto')),builder=defaultCycleBuilder();builder.p1='unfinished';assert.equal(readCycleBuilderDraft(builder).p1,'unfinished');
 const state=readCycleLibraryWorkspace({builder,templates:[{...template(q),html:'<script>',efficiency:999}],slots:[template(q,'A'),null]});assert.equal(state.templates[0].html,undefined);assert.equal(state.templates[0].efficiency,undefined);
 const draft={...q.input,model:q.model,mass:'1',points:q.input.points.map(p=>({...p,a:String(p.a),b:String(p.b),n:'1.3'})),library:state};assert.equal(readCustomCycleDraft(draft).library.builder.p1,'unfinished');
 const workspace=readWorkspace({active:'custom-cycle',panels:{'custom-cycle':{inputs:{'cc-data':JSON.stringify(draft)},model:q.model,calculated:false}}});assert.equal(JSON.parse(workspace.panels['custom-cycle'].inputs['cc-data']).library.templates.length,1);
 for(const value of [{templates:Array(9).fill(template(q))},{templates:[template(q),template(q)]},{slots:[]},{kind:'bad'},{builder:{...builder,p1:'a'.repeat(81)}}])assert.throws(()=>readCycleLibraryWorkspace(value));assert.throws(()=>readCycleTemplate({...template(q),model:'IF97'}));assert.throws(()=>readCycleTemplate({...template(q),input:{...q.input,closed:false}}));
});
test('Comparison uses frozen canonical inputs, common fluid, percentage-point efficiency delta and six overlay projections',()=>{
 const a=buildLibraryCycle(config('otto')),b=buildLibraryCycle({...config('otto'),ratio:10}),source=structuredClone(template(a,'A <x>')),q=compareLibraryCycles({slots:[source,template(b,'B')],kind:'pv'});const row=cycleComparisonTable(q,true).rows.find(r=>r[0]==='η');close(row[3],100*(b.result.efficiency-a.result.efficiency),1e-12);
 for(const kind of ['ts','hs','pv','pt','ps','tv']){const svg=cycleComparisonSVG(q,kind,true);assert.equal((svg.match(/data-cycle-series="A"/g)||[]).length,4);assert.equal((svg.match(/data-cycle-series="B"/g)||[]).length,4);assert.match(svg,/stroke-dasharray="8 4"/);assert.ok(!svg.includes('role="button"'));assert.ok(!/NaN|Infinity/.test(svg));}
 source.input.points[0].a=999;assert.equal(q.input.slots[0].input.points[0].a,.1);assert.throws(()=>compareLibraryCycles({slots:[null,template(b)]}));assert.throws(()=>compareLibraryCycles({slots:[template(b),{...template(b),input:{...b.input,fluid:'He'}}]}),/same fluid/);
});
test('Comparison report recomputes both models, escapes names and retains canonical source for reopening',()=>{
 const a=buildLibraryCycle(config('otto')),b=buildLibraryCycle(config('otto','IDEAL-NASA7')),input={slots:[template(a,'<script>alert(1)</script>'),template(b,'NASA7')],kind:'ps'},report=readStudyReport({entries:[{kind:'cycle-comparison',model:a.model,input,html:'<script>',rows:[999]}]});assert.equal(report.entries[0].html,undefined);assert.ok(evaluateReportEntry(report.entries[0]).cycleComparison.results.every(q=>q.converged));
 for(const language of ['uk','en']){const html=studyReportHTML('Compare',report,{language});assert.match(html,/data-cycle-chart="ps"/);assert.match(html,/IDEAL-NASA7/);assert.equal((html.match(/data-cycle-series=/g)||[]).length,8);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Δ B − A/);}
});

test('Cycles at the lower model boundary tolerate only floating-point roundoff',()=>{
 for(const fluid of ['air','N2','O2','CO2','He','Ar']){const q=buildLibraryCycle({...config('carnot'),fluid,T1:300,Tlow:200,ratio:8}).result;close(q.efficiency,1-200/300,2e-5);assert.ok(q.states.every(s=>s.T>=200));}
 assert.throws(()=>processGas('air','IDEAL-CP').get('pt',.1,200-1e-6));assert.throws(()=>processGas('air','IDEAL-CP').get('pt',.1,6000+1e-6));
});
