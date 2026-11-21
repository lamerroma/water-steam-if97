import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {saturationByProperty,SATURATION_INVERSE_KEYS} from '../src/saturation-inverse.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));

test('every saturation property round-trips to its temperature in both formulations',()=>{
 for(const model of ['IF97','IAPWS-95'])for(const T of [300,373.15,453.15,600])for(const phase of ['liquid','vapor'])for(const key of SATURATION_INVERSE_KEYS){
  const value=calculate('satt',T,undefined,model).saturation[phase][key],roots=saturationByProperty({key,phase,value,model});
  assert.ok(roots.some(r=>Math.abs(r.T-T)<1e-6),`${model} ${phase} ${key} ${T}: ${roots.map(r=>r.T)}`);
  const r=roots.find(r=>Math.abs(r.T-T)<1e-6);assert.ok(Math.abs(r.saturation[phase][key]-value)<=1e-9*Math.max(1,Math.abs(value)));
 }
});
test('latent heat and the two branches of saturated-vapor enthalpy',()=>{
 const r=calculate('satt',453.15).saturation;assert.ok(Math.abs(saturationByProperty({key:'latent',value:r.latentHeat})[0].T-453.15)<1e-6);
 const two=saturationByProperty({key:'h',phase:'vapor',value:2780});assert.equal(two.length,2);assert.ok(two[0].T<two[1].T);
 for(const q of two)assert.ok(Math.abs(q.saturation.vapor.h-2780)<1e-6);
 assert.throws(()=>saturationByProperty({key:'h',phase:'vapor',value:2900}));
 assert.throws(()=>saturationByProperty({key:'x',value:1}));
});
