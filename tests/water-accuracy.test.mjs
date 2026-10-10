import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {initialize,calculate} from '../src/engine.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const oracle=JSON.parse(await readFile(new URL('fixtures/water-conformance.json',import.meta.url),'utf8'));
for(const model of ['IF97','IAPWS-95'])test(`Independent ${model} forward domain and critical grid`,()=>{
 let checked=0;for(const r of oracle.states.filter(r=>r.model===model)){
 const q=calculate(r.mode,r.a,r.b,model).state;assert.ok(q,`${r.mode} ${r.a}, ${r.b}`);
 for(const [key,want] of Object.entries(r.fundamental||r)){if(!['rho','h','s','u','cp','cv','w'].includes(key)||q[key]==null)continue;const e=Math.abs(q[key]-want)/Math.max(Math.abs(want),1e-12);assert.ok(e<=2e-7,`${model} ${r.mode} ${r.a},${r.b} ${key}: relative ${e}`);checked++;}
 }assert.ok(checked>1000);
});
const modes={pv:['p','v'],tv:['T','v'],tu:['T','u'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']};
for(const model of ['IF97','IAPWS-95'])for(const [mode,keys] of Object.entries(modes))test(`Independent ${model} liquid pressure sensitivity ${mode}`,()=>{
 for(const p of [.1,3,50]){const r=oracle.states.find(r=>r.model===model&&r.mode==='pt'&&r.a===p&&r.b===300),target={...r,...r.fundamental,p,T:300};target.v=1/target.rho;const q=calculate(mode,target[keys[0]],target[keys[1]],model);assert.ok([q.state,...(q.alternatives||[])].some(s=>Math.abs(s.p-p)/p<1e-6&&Math.abs(s.T-300)<1e-6),`${model} ${mode} ${p} MPa`);}
});
for(const [model,p,T,selected] of [['IF97',20,640,['tv','tu','th','ts']],['IAPWS-95',22,647,['pv']]])test(`Independent ${model} narrow region interval ${p} MPa ${T} K`,()=>{
 const r=oracle.states.find(r=>r.model===model&&r.mode==='pt'&&r.a===p&&r.b===T),target={...r,...r.fundamental,p,T};target.v=1/target.rho;
 for(const mode of selected){const keys={...modes,th:['T','h'],ts:['T','s']}[mode],q=calculate(mode,target[keys[0]],target[keys[1]],model);assert.ok([q.state,...(q.alternatives||[])].some(z=>Math.abs(z.p-p)/p<1e-6&&Math.abs(z.T-T)<1e-5),mode);}
});
for(const p of [.001,22])test(`Independent IAPWS-95 two-phase pair roots ${p} MPa`,()=>{
 const r=oracle.states.find(r=>r.model==='IAPWS-95'&&r.mode==='px'&&r.a===p&&r.b===.8),target={...r,p};target.v=1/r.rho;
 for(const mode of ['us','vs','hv','uv']){const keys={us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']}[mode],q=calculate(mode,target[keys[0]],target[keys[1]],r.model);assert.ok([q.state,...(q.alternatives||[])].some(z=>Math.abs(z.p-p)/p<1e-6&&Math.abs(z.T-r.T)<1e-5),mode);}
});

for(const model of ['IF97','IAPWS-95'])test(`Independent ${model} near-critical wet steam h-s`,()=>{
 for(const x of [.2,.8]){const r=oracle.states.find(r=>r.model===model&&r.mode==='px'&&r.a===22&&r.b===x),t={...r,...r.fundamental},q=calculate('hs',t.h,t.s,model).state;assert.ok(Math.abs(q.p-22)/22<1e-6);assert.ok(Math.abs(q.T-r.T)<1e-5);assert.ok(Math.abs(q.x-x)<1e-6);}
});
for(const model of ['IF97','IAPWS-95'])test(`Independent ${model} critical and region-boundary inversions`,()=>{
 for(const [p,T] of [[22.064,647.1],[22.1,647.1],[100,623.16],[50,700]]){const r=oracle.states.find(r=>r.model===model&&r.mode==='pt'&&r.a===p&&r.b===T),t={...r,...r.fundamental};
 for(const [mode,key] of [['ph','h'],['ps','s'],['prho','rho']]){const result=calculate(mode,p,t[key],model),roots=[result.state,...(result.alternatives||[])];assert.ok(roots.some(q=>Math.abs(q.T-T)<1e-5),`${mode}: ${p}, ${T}`);for(const q of roots)assert.ok(Math.abs(q[key]-t[key])/Math.abs(t[key])<2e-7);}}
});
