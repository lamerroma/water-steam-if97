import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {initialize} from '../src/engine.js';import {coursework,COURSE_DEFAULTS} from '../src/coursework.js';import {reactorApplyVariant} from '../src/reactor-course.js';import {compareProfileMeshes,analyzeProfileConvergence,profileConvergenceCSV} from '../src/profile-convergence.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const profile=n=>({model:'test',input:{points:n},profile:Array.from({length:n},(_,i)=>{const z=i/(n-1);return {z,t:z*z,cladOuter:z*z,fuelCenter:z*z,qLinear:z*z};})});
test('Comparison independently measures interpolation error for a parabola',()=>{const r=compareProfileMeshes(profile(3),profile(5));assert.equal(r.temperatureChange,.0625);assert.equal(r.peakDifferences.fuelCenter,0);assert.throws(()=>compareProfileMeshes(profile(5),profile(3)));});
for(const variant of [5,28,45])test('Reactor '+variant+' uses nested grids and reports numerical changes',async()=>{
 const q=coursework(reactorApplyVariant(variant,COURSE_DEFAULTS.reactor)),r=await analyzeProfileConvergence(q,coursework);
 assert.equal(r.currentPoints,25);assert.ok(r.rows.length>=2);assert.ok(r.finestPoints<=201);assert.ok(r.rows[0].temperatureChange>r.rows.at(-1).temperatureChange);assert.equal(r.meetsTolerance,true);assert.equal(q.input.points,25);
 assert.ok(profileConvergenceCSV(r).includes('maximum_temperature_difference_K'));
});
test('The finest grid is compared against 101 points and a very small tolerance reports its limit',async()=>{
 const q=coursework({...COURSE_DEFAULTS.reactor,points:201}),r=await analyzeProfileConvergence(q,coursework,{tolerance:1e-12});assert.equal(r.rows[0].coarsePoints,101);assert.equal(r.finestPoints,201);assert.equal(r.limitReached,true);assert.equal(r.meetsTolerance,false);
});
test('Core profiles without fuel-centre temperatures are supported; cancellation and invalid tolerance reject',async()=>{
 const q=coursework(COURSE_DEFAULTS.core),r=await analyzeProfileConvergence(q,coursework);assert.ok(r.rows.length);assert.equal(r.rows[0].differences.fuelCenter,undefined);
 await assert.rejects(()=>analyzeProfileConvergence(q,coursework,{tolerance:NaN}));await assert.rejects(()=>analyzeProfileConvergence(q,coursework,{yieldFrame:()=>{throw Error('cancel')}}),/cancel/);
});
