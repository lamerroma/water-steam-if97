import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {CYCLE_CHARTS,readCycleChartView,cycleChartRange,transformCycleChartRange,cycleChartGuides,customCycleSVG} from '../src/cycle-chart.js';
import {customCyclePreset,solveCustomCycle,readCustomCycleDraft} from '../src/custom-cycle.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('Six projections preserve sampled trajectory geometry, all states and canonical axes',()=>{
 const q=solveCustomCycle(customCyclePreset('carnot','IDEAL-CP'),'IDEAL-CP');
 for(const [kind,{x,y}]of Object.entries(CYCLE_CHARTS)){
  const r=cycleChartRange(q,kind),svg=customCycleSVG(q,kind,true),paths=[...svg.matchAll(/data-cycle-path="(\d+)" points="([^"]+)"/g)];
  assert.equal(paths.length,4);assert.equal((svg.match(/data-custom-state=/g)||[]).length,4);assert.ok(!/NaN|Infinity/.test(svg));
  for(const [,index,points]of paths){const xy=points.split(' ').map(p=>p.split(',').map(Number)),path=q.edges[Number(index)].result.path;assert.equal(xy.length,path.length);for(let i=0;i<path.length;i++){close(xy[i][0],100+600*(path[i][x]-r.xmin)/(r.xmax-r.xmin),.00051);close(xy[i][1],325-280*(path[i][y]-r.ymin)/(r.ymax-r.ymin),.00051);}}
 }
 const input=customCyclePreset('gas-five');input.closed=false;const open=solveCustomCycle(input,'IDEAL-CP');for(const kind of Object.keys(CYCLE_CHARTS))assert.equal((customCycleSVG(open,kind).match(/data-cycle-path=/g)||[]).length,4);
});
test('Zoom, pan and fit preserve finite bounds, including degenerate pressure projections',()=>{
 const q=solveCustomCycle(customCyclePreset('gas-five'),'IDEAL-CP'),r=cycleChartRange(q,'pt'),z=transformCycleChartRange(r,.5),p=transformCycleChartRange(z,1,.2,-.3);
 close(z.xmax-z.xmin,(r.xmax-r.xmin)/2);close((z.xmin+z.xmax)/2,(r.xmin+r.xmax)/2);close(p.xmin-z.xmin,.2*(z.xmax-z.xmin));close(p.ymin-z.ymin,-.3*(z.ymax-z.ymin));
 const d=cycleChartRange({states:[q.states[0]],edges:[]},'pt');assert.ok(d.xmax>d.xmin&&d.ymax>d.ymin);assert.throws(()=>transformCycleChartRange(r,0));
 let tiny=r;for(let i=0;i<500;i++)tiny=transformCycleChartRange(tiny,.8);assert.ok(tiny.xmax>tiny.xmin&&tiny.ymax>tiny.ymin);
});
test('Isobars and isotherms follow the selected gas model, independent p-v=RT check',()=>{
 for(const model of ['IDEAL-CP','IDEAL-NASA7']){const q=solveCustomCycle(customCyclePreset('gas-five'),model),guides=cycleChartGuides(q);assert.equal(guides.length,6);for(const line of guides)for(const segment of line.segments)for(const s of segment){close(s[line.family],line.value);close(1000*s.p*s.v,s.R*s.T,1e-7);}assert.match(customCycleSVG({...q,guides},'tv',true,-1,{guides:true}),/data-cycle-guide=/);assert.ok(!customCycleSVG(q).includes('data-cycle-guide='));}
});
test('Water guide segments never bridge invalid or different phases in either formulation',()=>{
 for(const model of ['IF97','IAPWS-95']){const states=[calculate('pt',.1,300,model).state,calculate('pt',.2,600,model).state],guides=cycleChartGuides({input:{fluid:'water'},model,edges:[{result:{path:states}}]});assert.equal(guides.length,6);assert.ok(guides.some(l=>l.segments.length>1),'Water guide must split at boiling');for(const line of guides)for(const segment of line.segments){assert.equal(new Set(segment.map(s=>s.phase)).size,1);for(const s of segment){close(s[line.family],line.value,1e-5);assert.ok(s.p>0&&s.T>0&&s.v>0);}}}
});
test('Project view schema bounds coordinates, ranges and selection; report reproduces chosen view safely',()=>{
 const view={kind:'pt',guides:true,selected:2,ranges:{pt:{xmin:300,xmax:950,ymin:.05,ymax:.25}}};assert.deepEqual(readCycleChartView(view),view);
 for(const bad of [{kind:'__proto__'},{guides:'yes'},{selected:12},{ranges:{pt:{xmin:1,xmax:0,ymin:0,ymax:1}}},{ranges:{pt:{xmin:0,xmax:Infinity,ymin:0,ymax:1}}},{ranges:{pt:{xmin:0,xmax:1e-300,ymin:0,ymax:1}}},{ranges:{bad:{}}}])assert.throws(()=>readCycleChartView(bad));
 const input=customCyclePreset('gas-five'),draft={...input,model:'IDEAL-CP',mass:'1',points:input.points.map(p=>({...p,a:String(p.a),b:String(p.b),n:'1.3'})),chart:view};assert.deepEqual(readCustomCycleDraft(draft).chart,view);
 const entry={kind:'custom-cycle',model:'IDEAL-CP',input,view},report=readStudyReport({entries:[entry]}),html=studyReportHTML('Cycle',report,{language:'en'});assert.equal((html.match(/data-cycle-chart=/g)||[]).length,1);assert.match(html,/data-cycle-chart="pt"/);assert.match(html,/data-cycle-guide=/);assert.ok(!html.includes('role="button"'));assert.throws(()=>readStudyReport({entries:[{...entry,view:{kind:'bad'}}]}));
});
