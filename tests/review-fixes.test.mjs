import test from 'node:test';
import assert from 'node:assert/strict';
import {d2oSaturation,D2O_TC} from '../src/d2o.js';
import {seawater} from '../src/seawater.js';
import {learningCSV} from '../src/learning-export.js';

for(const T of [643,643.84,643.846,643.8469])test(`D2O stable distinct near-critical phases at ${T} K`,()=>{
 const q=d2oSaturation(T);
 assert.ok(q.liquid.rho>q.vapor.rho);
 assert.ok(q.latentHeat>0);
 for(const z of [q.liquid,q.vapor]){assert.ok(z.cp>0&&z.cv>0&&Number.isFinite(z.w));assert.ok(Math.abs(z.p-q.p)<1e-8);}
 assert.ok(Math.abs((q.vapor.h-T*q.vapor.s)-(q.liquid.h-T*q.liquid.s))<1e-7);
});
test('D2O fails explicitly when phase separation is numerically unresolved',()=>{
 assert.throws(()=>d2oSaturation(D2O_TC-1e-6),/критичної точки/);
});
test('D2O CSV preserves both phases with their actual densities and enthalpies',()=>{
 const q=d2oSaturation(450),csv=learningCSV(q,[['d2o-mode','sat'],['d2o-t','450']],[]);
 assert.ok(csv.includes('phase;quantity;value;unit'));
 for(const [name,z] of [['Насичена рідина',q.liquid],['Насичена пара',q.vapor]]){
  assert.ok(csv.includes(`${name};Густина;${z.rho};кг/м³`));
  assert.ok(csv.includes(`${name};Питома ентальпія;${z.h};кДж/кг`));
 }
});
test('Seawater flags pure-water and saline supercooled liquid by ice equilibrium',()=>{
 for(const S of [0,.035]){const q=seawater(S,265,101325);assert.match(q.phase,/Метастабільна/);assert.ok(q.notes.some(n=>n.includes('Eq. 32')));}
 // Below 0°C does not itself mean frozen: saline water remains liquid at 272 K.
 assert.doesNotMatch(seawater(.035,272,101325).phase,/Метастабільна/);
});
test('Seawater flags extrapolation, region F and unavailable sound speed in exports',()=>{
 const q=seawater(.12,353,101325);assert.equal(q.w,null);assert.equal(q.invalidDerivatives,true);
 assert.ok(q.notes.some(n=>n.includes('Область F')));assert.ok(q.notes.some(n=>n.includes('w²')));
 const csv=learningCSV(q,[],[['Швидкість звуку',q.w,'м/с']]);assert.ok(csv.includes('warning;"Область F'));assert.ok(csv.includes('w²'));
 const normal=seawater(.03516504,283.15,101325);assert.equal(normal.invalidDerivatives,false);assert.ok(normal.w>0);assert.ok(!normal.notes.some(n=>n.includes('екстраполяція поза')));
});
test('CSV quotes notes containing separators and preserves one-phase quantities',()=>{
 const csv=learningCSV({model:'test',notes:['one; two "quoted"']},[],[['rho',1000,'kg/m3']]);
 assert.ok(csv.includes('warning;"one; two ""quoted"""'));assert.ok(csv.includes('rho;1000;kg/m3'));
});
// External oracle only: CoolProp 8.0.0 HEOS HeavyWater, PropsSI(P/D,T,Q).
// Close to Tc the cancellation in equal-p/equal-g limits density precision.
for(const [T,p,rl,rv] of [[640,20.669662918010278,502.74819025767124,219.45799833348337],[643.84,21.659953205257136,368.4857139645284,343.5580610981062],[643.8469,21.66180417202495,357.5049048283335,354.4950850690979]])test(`D2O independent CoolProp near-critical saturation ${T} K`,()=>{
 const q=d2oSaturation(T);
 assert.ok(Math.abs(q.p-p)<1e-8);
 const tolerance=T>643.846?0.001:1e-5;
 assert.ok(Math.abs(q.liquid.rho-rl)<tolerance);
 assert.ok(Math.abs(q.vapor.rho-rv)<tolerance);
});
