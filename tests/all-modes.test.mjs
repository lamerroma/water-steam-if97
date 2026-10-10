import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';import {batchUnits,calculateBatch} from '../src/batch.js';import {toCanonical,fromCanonical} from '../src/units.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
for(const model of ['IF97','IAPWS-95'])for(const mode of ['pv','pu','tv','tu','us','vs','hv','uv'])test(`${model} ${mode} inverse vapor and mixture`,()=>{
 for(const base of [['pt',.1,500],['px',.1,.4]]){const q=calculate(...base,model).state;const keys={pv:['p','v'],pu:['p','u'],tv:['T','v'],tu:['T','u'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']}[mode];const r=calculate(mode,q[keys[0]],q[keys[1]],model);assert.ok([r.state,...(r.alternatives||[])].some(z=>Math.abs(z.p-q.p)<1e-5&&Math.abs(z.T-q.T)<.002),`${mode} missing original state`);}
});
test('Volume units, batch and invalid volume',()=>{assert.equal(toCanonical(2,'m3kg'),2);assert.ok(Math.abs(fromCanonical(toCanonical(2,'ft3lb'),'ft3lb')-2)<1e-12);assert.deepEqual(batchUnits('vs').a,['m3kg','ft3lb']);const q=calculate('pt',.1,500).state;assert.ok(!calculateBatch([{mode:'hv',a:q.h,b:q.v,ua:'kJkg',ub:'m3kg'}])[0].error);for(const m of ['pv','tv','hv','uv'])assert.throws(()=>calculate(m,3,0));});

// R7-97 official forward control states, inverted using their energy/volume.
for(const [p,T] of [[3,300],[.0035,700],[25.5837018,650],[.5,1500]])test(`IF97 official control inversion ${p} ${T}`,()=>{const q=calculate('pt',p,T).state;for(const m of ['pu','pv','tv','tu']){const keys={pu:['p','u'],pv:['p','v'],tv:['T','v'],tu:['T','u']}[m],r=calculate(m,q[keys[0]],q[keys[1]]);assert.ok([r.state,...(r.alternatives||[])].some(z=>Math.abs(z.T-T)<.001&&Math.abs(z.p-p)<1e-4));}});
