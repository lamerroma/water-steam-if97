import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const data=JSON.parse(fs.readFileSync(new URL('fixtures/independent-iapws.json',import.meta.url)));
test('96 independent Python iapws 1.5.5 reference states',()=>{assert.equal(data.records.length,96);for(const r of data.records){const q=calculate(r.mode,r.a,r.b).state;for(const k of ['h','s','v','cp','cv','w'])if(r[k]!=null)assert.ok(Math.abs(q[k]-r[k])<=2e-7*Math.max(Math.abs(r[k]),1e-12),`${r.mode} ${r.a},${r.b}: ${k}`);}});
