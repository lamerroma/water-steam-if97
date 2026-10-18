import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate,TC} from '../src/engine.js';
import {diagramSeriesPath} from '../src/diagram-series.js';
import {diagramAxes} from '../src/diagram-coordinates.js';
import {assessDiagramState,assessDiagramCurve} from '../scripts/steam97-p07-common.mjs';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const f=JSON.parse(await readFile(new URL('fixtures/steam97-p07-reference.json',import.meta.url)));
for(const c of f.records)test('Independent P07 state '+c.id,()=>{
 const q=calculate(c.mode,c.a,c.b,c.model).state,checks=assessDiagramState(q,c.expected,f.policy);assert.ok(checks.every(c=>c.passed),JSON.stringify(checks.filter(c=>!c.passed)));
});
for(const c of f.curves)test(`Independent SciPy drawing ${c.kind} ${c.closed?'closed':'open'}`,()=>{
 const range=diagramAxes(c.kind).initial,path=diagramSeriesPath(c.kind,c.states,'spline',{range,width:1280,height:600});assert.equal(path.limited,false);assert.ok(assessDiagramCurve(path.points,c.expected,range,1280,600)<=f.policy.spline_pixel);
});
test('Exact IAPWS-95 critical saturation stays unavailable to diagram controls',()=>{assert.throws(()=>calculate('tx',TC,0,'IAPWS-95'));});
