import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {turbine,flash,diagramData} from '../src/processes.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('turbine conserves energy and applies isentropic efficiency',()=>{
 const r=turbine(3,673.15,.1,.85,2);close(r.ideal.s,r.inlet.s);close(r.outlet.h,r.inlet.h-r.work);close(r.work/(r.inlet.h-r.ideal.h),.85);close(r.power,2*r.work);assert.ok(r.outlet.s>=r.inlet.s);assert.ok(r.work>0);
 const ideal=turbine(3,673.15,.1,1);close(ideal.outlet.h,ideal.ideal.h);close(ideal.outlet.s,ideal.inlet.s);
});
test('flash conserves enthalpy, total mass, and phase energy',()=>{
 const r=flash(3,473.15,.1,4);close(r.inlet.h,r.outlet.h);assert.ok(r.outlet.x>0&&r.outlet.x<1);close(r.vaporFlow+r.liquidFlow,4);close(r.vaporFlow*r.saturation.vapor.h+r.liquidFlow*r.saturation.liquid.h,4*r.inlet.h,1e-6);
});
test('superheated flash does not invent separation balance',()=>{
 const r=flash(3,673.15,.1);assert.equal(r.outlet.x,null);assert.equal(r.vaporFlow,null);assert.equal(r.liquidFlow,null);
});
test('process inputs reject invalid pressure, efficiency, flow and saturation inlet',()=>{
 for(const eta of [0,-1,1.1,NaN])assert.throws(()=>turbine(3,673.15,.1,eta));
 assert.throws(()=>turbine(3,473.15,.1,.8));assert.throws(()=>flash(3,473.15,3));assert.throws(()=>flash(3,473.15,-1));assert.throws(()=>flash(3,473.15,.1,-1));
 const T=calculate('satp',3).saturation.T;assert.throws(()=>turbine(3,T,.1,.8));
});
test('diagram dome and isobars use finite IF97 states',()=>{
 const d=diagramData();assert.equal(d.isobars.length,7);assert.ok(d.dome[0].filter(Boolean).length>85);
 close(d.dome[0].at(-1).s,d.dome[1].at(-1).s);for(const line of d.isobars){assert.ok(line.points.filter(Boolean).length>95);for(const q of line.points.filter(Boolean)){close(q.p,line.p,1e-6);assert.ok(Number.isFinite(q.h)&&Number.isFinite(q.s));}}
});
