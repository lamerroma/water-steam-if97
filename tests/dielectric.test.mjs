import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {dielectric} from '../src/dielectric.js';import {initialize,calculate} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
// R8-97 Table 4: supplied MOLAR density in mol/dm3, not IF97 P-T density.
for(const [T,mol,eps] of [[240,54.33701,104.34982],[300,55.31735,77.74735],[300,55.56148,78.11269],[300,68.69265,103.69632],[650,2.24692,1.26715],[650,40.31090,17.71733],[650,52.58636,26.62132],[870,1.45275,1.12721],[870,20.98927,4.98281],[870,45.01376,15.09746]])test(`R8-97 Table 4 ${T} K ${mol} mol/dm3`,()=>{assert.ok(Math.abs(dielectric(T,mol*1000*.018015268)-eps)<.00006);});
test('dielectric domain and phase handling',()=>{assert.equal(dielectric(874,1000),null);assert.equal(dielectric(237,1000),null);assert.equal(dielectric(300,0),1);assert.equal(calculate('px',.1,.5).state.dc,null);assert.ok(calculate('satp',.1).saturation.liquid.dc>1);assert.equal(calculate('pt',1,900).state.dc,null);});
