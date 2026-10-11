import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate,TC} from '../src/engine.js';
import {saturationGrid,saturationCell,saturationCSV} from '../src/saturation-grid.js';
import {diagramAxes,diagramPoint} from '../src/diagram-coordinates.js';
import {readDiagramWorkspace,diagramWorkspaceSnapshot} from '../src/diagram-workspace.js';
import {readWorkspace} from '../src/workspace.js';
import {flash} from '../src/processes.js';
import {resultJSON,resultMarkdown} from '../src/result-copy.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('saturation grid has paired phases and conserves latent heat at 100 C',()=>{
 const rows=saturationGrid({basis:'temperature',unit:'C',start:50,end:100,step:10});assert.equal(rows.length,6);
 const s=rows.at(-1).saturation;near(s.p,.1014179779213);near(s.liquid.T,373.15);near(s.vapor.T,373.15);near(s.latentHeat,s.vapor.h-s.liquid.h);
 near(saturationCell('r',s)[0],s.latentHeat);near(saturationCell('hl',s,'si','J')[0],s.liquid.h*1000);near(saturationCell('T',s,'english')[0],212);
 assert.match(saturationCSV(rows),/pressure_basis.*absolute/);assert.ok(saturationCSV(rows).includes(String(s.latentHeat)));
});
test('pressure and Fahrenheit grids agree and do not append an off-step endpoint',()=>{
 const p=saturationGrid({basis:'pressure',unit:'bar',start:1,end:3,step:1});near(p[0].saturation.p,.1);assert.equal(p.length,3);
 const f=saturationGrid({basis:'temperature',unit:'F',start:212,end:248,step:18});near(f[1].saturation.T,383.15);
 assert.equal(saturationGrid({basis:'temperature',unit:'C',start:50,end:65,step:10}).length,2);
 assert.equal(saturationGrid({basis:'temperature',unit:'C',start:100,end:100,step:10}).length,1);
});
test('grid rejects invalid ranges and oversized work before solving; critical phases merge',()=>{
 const base={basis:'temperature',unit:'C',start:50,end:200,step:10};
 for(const patch of [{step:0},{step:-1},{step:NaN},{end:40},{end:400},{start:-1},{step:.01},{unit:'MPa'},{start:Infinity}])assert.throws(()=>saturationGrid({...base,...patch}));
 const q=saturationGrid({basis:'temperature',unit:'K',start:TC,end:TC,step:1})[0].saturation;assert.ok(q.critical);near(q.latentHeat,0);
 assert.throws(()=>saturationGrid({basis:'temperature',unit:'K',start:TC,end:TC,step:1},'IAPWS-95'));
 const q95=saturationGrid({basis:'temperature',unit:'C',start:100,end:100,step:10},'IAPWS-95')[0].saturation;near(q95.p,.10141799666,1e-6);
});
test('P-h geometry gives a vertical throttle and uniform decades of pressure',()=>{
 const r=flash(3,473.15,.1);const a=diagramPoint('phdiagram',r.inlet),b=diagramPoint('phdiagram',r.outlet);near(a.x,b.x);near(a.y-b.y,Math.log10(30));
 near(diagramPoint('phdiagram',{p:1,h:100}).y-diagramPoint('phdiagram',{p:.1,h:100}).y,1);
 assert.ok(Number.isNaN(diagramPoint('phdiagram',{p:0,h:100}).y));
 near(diagramPoint('ts',r.inlet).x,r.inlet.s);near(diagramPoint('hsdiagram',r.inlet).y,r.inlet.h);
});
test('P-h views and saturation inputs round-trip through workspace with validation',()=>{
 const states=[calculate('pt',3,300).state];const data={views:{'IF97:phdiagram':{range:diagramAxes('phdiagram').initial,historyIndex:0}}};
 const plan=readDiagramWorkspace(data,states),snap=diagramWorkspaceSnapshot(plan,states);assert.deepEqual(readDiagramWorkspace(snap,states),plan);
 const workspace={active:'satgrid',panels:{satgrid:{inputs:{'satgrid-basis':'temperature','satgrid-unit':'C','satgrid-start':'50','satgrid-end':'200','satgrid-step':'10'},calculated:true,model:'IF97'}}};assert.deepEqual(readWorkspace(workspace),workspace);
 assert.equal(readWorkspace({active:'phdiagram',panels:{}}).active,'phdiagram');
 assert.throws(()=>readWorkspace({...workspace,panels:{satgrid:{...workspace.panels.satgrid,inputs:{'satgrid-basis':'pressure','satgrid-unit':'C'}}}}));
 assert.throws(()=>readDiagramWorkspace({views:{'IF97:phdiagram':{range:{xmin:0,xmax:1e6,ymin:-3,ymax:2}}}},states));
});
test('copy JSON preserves canonical numbers and nulls; Markdown escapes cells',()=>{
 const r=calculate('px',.1,.5);const units={p:'MPa',T:'K',h:'kJ/kg'};
 const json=JSON.parse(resultJSON(r,{version:'1.2.0',id:'abc'},{p:.1,T:298.15},units));assert.equal(json.pressure_basis,'absolute');assert.equal(json.result.state.h,r.state.h);assert.equal(json.result.state.cp,null);assert.deepEqual(json.units,units);
 const md=resultMarkdown([{title:'A | B',rows:[['name|x','<script>\nnext',1,'MPa']]}],['Property','Symbol','Value','Unit']);assert.ok(md.includes('A \\| B'));assert.ok(md.includes('name\\|x'));assert.ok(md.includes('<script> next'));
});
