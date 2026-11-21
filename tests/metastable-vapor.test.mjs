import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {metastableVaporGibbs,metastableVapor} from '../src/metastable-vapor.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
// IAPWS R7-97(2012) Table 18 verification values.
const table=[[1,450,{v:.192516540,h:.276881115e4,u:.257629461e4,s:.656660377e1,cp:.276349265e1,w:.498408101e3}],
 [1,440,{v:.186212297,h:.274015123e4,u:.255393894e4,s:.650218759e1,cp:.298166443e1,w:.489363295e3}],
 [1.5,450,{v:.121685206,h:.272134539e4,u:.253881758e4,s:.629170440e1,cp:.362795578e1,w:.481941819e3}]];
test('metastable-vapor equation reproduces the IF97 verification table',()=>{
 for(const [p,T,ref] of table){const q=metastableVaporGibbs(p,T);for(const [k,v] of Object.entries(ref))assert.ok(Math.abs(q[k]-v)<=5e-9*Math.abs(v),`${p} ${T} ${k}: ${q[k]} vs ${v}`);}
});
test('domain: below saturation, above the 5 % moisture line, p ≤ 10 MPa',()=>{
 const q=metastableVapor(1,440);assert.ok(q.subcooling>0);assert.ok(q.equilibriumQuality>.95&&q.equilibriumQuality<1);
 assert.throws(()=>metastableVapor(1,500));assert.throws(()=>metastableVapor(1,380));assert.throws(()=>metastableVapor(12,580));
});
