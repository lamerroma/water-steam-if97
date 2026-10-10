import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initializeHumidAir,getCoolPropBackend} from '../src/humid-air-scientific.js';
import {realGasState} from '../src/real-gases.js';
await initializeHumidAir(fs.readFileSync(new URL('../vendor/coolprop.wasm',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/real-gases.json',import.meta.url)));
for(const r of fixture.states)test(`HEOS ${r.id} P=${r.p} T=${r.T}: properties and inverse inputs`,()=>{
 const q=realGasState(r.id,r.p,r.T);
 for(const k of ['rho','h','s','cp','cv','w','Z','mu','lambda']){if(r[k]==null){assert.equal(q[k],null);continue;}assert.ok(Math.abs(q[k]-r[k])<=Math.max(1e-12,Math.abs(r[k])*1e-8),k);}
 for(const [mode,k] of [['ph','h'],['ps','s']]){const v=realGasState(r.id,r.p,q[k],mode);assert.ok(Math.abs(v.T-r.T)<1e-5);assert.ok(Math.abs(v.rho-q.rho)<1e-7*Math.max(1,q.rho));}
 assert.ok(Math.abs(q.h-q.u-q.p*1000/q.rho)<1e-8);
});
test('Real fluid rejects unsupported species, extrapolation and ambiguous saturation',()=>{
 for(const a of [['NO',.1,300],['N2',-1,300],['N2',.1,10],['N2',1e9,300],['N2',.1,NaN]])assert.throws(()=>realGasState(...a));
 const cp=getCoolPropBackend(),T=cp.PropsSI('T','P',1e6,'Q',0,'Water');assert.throws(()=>realGasState('H2O',1,T));
});
test('Wet steam inverse preserves quality and suppresses undefined mixture response properties',()=>{
 const cp=getCoolPropBackend(),h=cp.PropsSI('Hmass','P',1e6,'Q',.4,'Water')/1000,q=realGasState('H2O',1,h,'ph');assert.ok(Math.abs(q.quality-.4)<1e-8);for(const k of ['cp','cv','w','mu','lambda','gamma'])assert.equal(q[k],null);
});
