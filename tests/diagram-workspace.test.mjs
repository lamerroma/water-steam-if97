import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {readProject} from '../src/project.js';
import {readDiagramWorkspace,syncDiagramWorkspace,diagramWorkspaceSnapshot,diagramTable,diagramCSV,diagramReport} from '../src/diagram-workspace.js';
import {tutorialDiagram} from '../src/tutorials.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
test('diagram order survives new states, deletion and JSON round trip',()=>{
 const a={},b={},c={};const plan=readDiagramWorkspace(null,[b,a]);syncDiagramWorkspace(plan,[b,a]);assert.deepEqual(plan.order,[a,b]);plan.order=[b,a];plan.excluded=[a];plan.connectHistory=true;
 syncDiagramWorkspace(plan,[c,b,a]);assert.deepEqual(plan.order,[b,a,c]);const raw=diagramWorkspaceSnapshot(plan,[c,b,a]);const restored=readDiagramWorkspace(JSON.parse(JSON.stringify(raw)),[c,b,a]);assert.deepEqual(restored,plan);
 syncDiagramWorkspace(plan,[c,b]);assert.deepEqual(plan.order,[b,c]);assert.deepEqual(plan.excluded,[]);
});
test('diagram import rejects invalid and duplicate references, defaults older projects',()=>{
 assert.equal(readDiagramWorkspace(undefined,[]).numbers,true);
 for(const data of [{order:[-1]},{order:[1]},{order:[0,0]},{excluded:['0']},{numbers:'yes'},[]])assert.throws(()=>readDiagramWorkspace(data,[{}]));
});
test('tutorial diagrams preserve turbine isentropy and throttling enthalpy',()=>{
 const t=tutorialDiagram('turbine').process.result;assert.ok(Math.abs(t.inlet.s-t.ideal.s)<1e-8);assert.ok(t.outlet.h<t.inlet.h);
 const d=tutorialDiagram('throttle').process;assert.ok(Math.abs(d.result.inlet.h-d.result.outlet.h)<1e-6);assert.ok(Math.abs(d.result.outlet.T-417.692343245)<1e-6);
 const p={format:'water-steam-if97',version:1,history:[],process:{type:d.type,args:d.args,model:d.model},form:{mode:'pt',a:'3',b:'26.85',ua:'MPa',ub:'C'}};
 const restored=readProject(JSON.stringify(p));assert.ok(Math.abs(restored.process.result.outlet.h-d.result.outlet.h)<1e-6);
 assert.equal(tutorialDiagram('saturation').states.length,2);assert.equal(tutorialDiagram('wet').states[0].x,.91);assert.throws(()=>tutorialDiagram('pipe'));
});
test('diagram CSV and report share numbering, pressure basis, units and escaped labels',()=>{
 const q=tutorialDiagram('wet').states[0],entries=[[q,'A;"<script>','history']];const csv=diagramCSV(entries,'si','J');assert.ok(csv.includes('"pressure_basis";"absolute"'));assert.ok(csv.includes('Дж/кг'));assert.ok(csv.includes('"A;""<script>"'));assert.ok(csv.includes(String(q.h*1000)));
 const table=diagramTable(entries,'english');assert.ok(table.includes('psi'));assert.ok(table.includes('&lt;script&gt;'));assert.ok(!table.includes('<script>'));
 const html=diagramReport('<Title>','<svg xmlns="http://www.w3.org/2000/svg"/>',entries,'si','J','<note>');assert.ok(html.includes('&lt;Title&gt;'));assert.ok(html.includes('&lt;note&gt;'));assert.ok(html.includes('схематичні'));assert.ok(html.includes('Дж/кг'));
});
