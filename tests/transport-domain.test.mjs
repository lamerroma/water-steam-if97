import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {initialize,calculate} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const ref=JSON.parse(fs.readFileSync(new URL('fixtures/water-conformance.json',import.meta.url)));
for(const model of ['IF97','IAPWS-95'])test(`Independent ${model} transport domain`,()=>{
 let checked=0;for(const r of ref.states.filter(r=>r.model===model&&r.mode==='pt')){const q=calculate('pt',r.a,r.b,model).state;
 for(const key of ['mu','lambda']){if(q[key]==null){assert.ok(r.a>100||r.b>1173||r.b<273.15,`${model}: unexpected unavailable transport at ${r.a}, ${r.b}`);continue;}const want=r.fundamental[key];assert.ok(Number.isFinite(want));assert.ok(Math.abs(q[key]-want)/Math.abs(want)<=2e-6,`${key} ${r.a} ${r.b}`);checked++;}}
 assert.ok(checked>100);
});
