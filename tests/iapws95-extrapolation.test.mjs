import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {extrapolate95,extrapolation95MinimumT} from '../src/iapws95-extrapolation.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const rel=(a,b,t)=>assert.ok(Math.abs(a-b)<=t*Math.abs(b),`${a} vs ${b}`);

test('inside the validated range the ordinary IAPWS-95 solution is returned',()=>{
 const q=extrapolate95(10,600),r=calculate('pt',10,600,'IAPWS-95').state;assert.equal(q.extrapolated,false);assert.equal(q.rho,r.rho);
});
test('extrapolated states are continuous with the validated range at its edges',()=>{
 for(const [p,T,p2,T2] of [[50,1273,50,1273.001],[1000,800,1000.001,800],[1000,1273,1000.001,1273.001]]){
  const a=calculate('pt',p,T,'IAPWS-95').state,b=extrapolate95(p2,T2);assert.equal(b.extrapolated,true);
  rel(b.rho,a.rho,1e-5);rel(b.h,a.h,1e-5);rel(b.s,a.s,1e-5);rel(b.w,a.w,1e-4);
 }
});
test('extrapolation is physically sane and rejects ice and out-of-range input',()=>{
 const gas=extrapolate95(.1,5000);rel(gas.Z,1,0.02);assert.ok(gas.notes[0].includes('Екстраполяція'));
 const dense=extrapolate95(100000,5000);assert.ok(dense.rho>2000&&dense.rho<5000&&dense.cp>0&&dense.w>0);
 for(const p of [2000,5000,20000,50000]){const q=extrapolate95(p,1500);assert.ok(q.drhodp>0);}
 const Tm=extrapolation95MinimumT(5000);assert.ok(Tm>355&&Tm<715);assert.throws(()=>extrapolate95(5000,Tm-1));assert.ok(extrapolate95(5000,Tm+5).rho>1000);
 assert.throws(()=>extrapolate95(100001,1000));assert.throws(()=>extrapolate95(1,5001));assert.throws(()=>extrapolate95(1500,260));
});
