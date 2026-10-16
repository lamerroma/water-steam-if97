import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate,TC,PC} from '../src/engine.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const fixture=JSON.parse(await readFile(new URL('fixtures/inverse-boundary-reference.json',import.meta.url),'utf8'));
const pairs={ph:['p','h'],ps:['p','s'],pu:['p','u'],pv:['p','v'],prho:['p','rho'],th:['T','h'],ts:['T','s'],tu:['T','u'],tv:['T','v'],trho:['T','rho'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']};
for(const c of fixture.records)test(`Independent boundary ${c.model} ${c.name}`,()=>{
 const q={...c.expected,p:c.expected.P};
 if(c.name.startsWith('cutoff')){
  const sat=calculate('satt',q.T).saturation,endpoint=q.x===0?sat.liquid:sat.vapor;
  assert.equal(sat.T,623.15);assert.equal(endpoint.region,q.x===0?1:2);
  for(const key of ['rho','h','s','u','cp','cv','w'])assert.ok(Math.abs(endpoint[key]-q[key])<=Math.max(1e-10,Math.abs(q[key])*2e-12),key);
  return;
 }
 let checked=0;
 for(const [mode,keys] of Object.entries(pairs)){
  if(c.name.startsWith('endpoint')&&!['pv','prho','tv','trho'].includes(mode))continue;
  if(c.name.startsWith('triple')&&!['us','vs','hv','uv'].includes(mode))continue;
  if(c.model==='IAPWS-95'&&!['ph','ps','pu','hs'].includes(mode))continue;
  const r=calculate(mode,q[keys[0]],q[keys[1]],c.model),roots=[r.state,...(r.alternatives||[])];
  const match=roots.find(s=>Math.abs(s.p-q.p)<=Math.max(1e-8,q.p*2e-6)&&Math.abs(s.T-q.T)<=2e-4);
  assert.ok(match,`${mode} must include ${q.p} MPa / ${q.T} K; got ${roots.map(s=>`${s.p} / ${s.T}`)}`);
  for(const key of keys)assert.ok(Math.abs(match[key]-q[key])<=Math.max(key==='s'?2e-10:key==='v'?2e-11:2e-7,Math.abs(q[key])*2e-10),`${mode}: ${key} residual`);
  if(c.name.startsWith('endpoint'))assert.equal(match.x,q.x,mode+' exact saturation endpoint');
  if(c.name==='region1-turn'&&mode==='th'){assert.equal(roots.length,2);for(const s of roots)assert.ok(Math.abs(s.h-q.h)<2e-7);}
  checked++;
 }
 assert.ok(checked>0);
});
test('IAPWS-95 exact critical point fails explicitly, nearby stable states remain usable',()=>{
 assert.throws(()=>calculate('pt',PC,TC,'IAPWS-95'),/критична точка.*сингулярні/);
 for(const [p,T] of [[25,TC],[.1,TC],[PC,TC+.001],[25,TC-.001]]){
  const r=calculate('pt',p,T,'IAPWS-95').state;assert.ok(Number.isFinite(r.cp)&&r.cp>0);
 }
});
test('Saturation roundoff snapping preserves genuine wet states',()=>{
 for(const p of [.1,1,10,20])for(const x of [2e-9,1-2e-9]){
  const q=calculate('px',p,x).state;
  for(const mode of ['pv','prho']){const r=calculate(mode,p,q[mode==='pv'?'v':'rho']).state;assert.ok(r.x>0&&r.x<1);assert.ok(Math.abs(r.x-x)<2e-12);}
 }
});
test('Closed-boundary recovery does not extend physical input domains',()=>{
 assert.throws(()=>calculate('th',2273.151,7500));
 assert.throws(()=>calculate('pt',50.0001,1500));
 const top=calculate('pt',200,1273,'IAPWS-95').state;
 for(const [mode,key] of [['ph','h'],['ps','s'],['pu','u']])assert.throws(()=>calculate(mode,200,top[key]+1e-5,'IAPWS-95'),/поза/);
});
