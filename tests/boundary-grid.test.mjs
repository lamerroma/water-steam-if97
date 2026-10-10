import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate,PC,TC,PMIN_SAT,boundary23Pressure} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,t)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);
test('PT grid across all regions and near both sides of boundaries',()=>{
 let count=0;
 for(const p of [.0001,.001,.1,1,10,16.5292,PC,25,50,100])for(const T of [273.15,300,500,623.1499,623.1501,646,647.095,647.097,650,700,863.1499,863.1501,1073.1499,1073.1501,1500,2273.15]){
 if(p>50&&T>1073.15)continue;
 const q=calculate('pt',p,T).state;if(!q)continue;count++;
 assert.ok(q.rho>0&&q.cp>0&&q.cv>0&&q.w>0,`unstable ${p},${T}`);close(q.v*q.rho,1,1e-12);close(q.h-q.u,1000*p*q.v,1e-7);close(q.G,q.h-T*q.s,1e-10);
 }
 assert.equal(count,157);
});
test('critical state and near-critical saturation have no invented mixture derivatives',()=>{
 const c=calculate('pt',PC,TC).state;assert.equal(c.rho,322);assert.equal(c.cp,null);assert.equal(c.x,null);assert.equal(c.lambda,null);
 for(const p of [PMIN_SAT,.1,16.5292,20,22,22.063]){const sat=calculate('satp',p).saturation;assert.ok(sat.liquid.rho>sat.vapor.rho);assert.ok(sat.latentHeat>0);for(const x of [0,.001,.5,.999,1]){const q=calculate('px',p,x).state;close(q.h,sat.liquid.h+x*sat.latentHeat,1e-9);if(x>0&&x<1)for(const k of ['cp','cv','w','mu','lambda','dc'])assert.equal(q[k],null);}}
 assert.throws(()=>calculate('px',PC,.5));
});
test('region23 switches on either side of its official pressure boundary',()=>{for(const T of [623.1501,650,700,800]){const p=boundary23Pressure(T);assert.equal(calculate('pt',p*(1-1e-7),T).state.region,2);assert.equal(calculate('pt',p*(1+1e-7),T).state.region,3);}});
test('PH and PS inversions recover grid state or an explicit boundary alternate',()=>{
 for(const p of [.001,.1,3,20,25,50,100])for(const T of [300,500,623.14,623.16,650,700,863.14,863.16,1073.14,1073.16,1500,2273.15]){
 if(p>50&&T>1073.15)continue;
 const q=calculate('pt',p,T).state;if(!q)continue;
 for(const mode of ['ph','ps']){const r=calculate(mode,p,q[mode==='ph'?'h':'s']);assert.ok([r.state,...(r.alternatives||[])].some(s=>Math.abs(s.T-T)<2e-5),`${mode} ${p},${T}`);}
 }
});
test('HS roundtrips regions 1 2 3 5 and phase endpoints',()=>{
 const states=[[3,300],[.001,700],[30,700],[25,650],[50,1073.16],[.5,1500],[30,2000]].map(([p,T])=>calculate('pt',p,T).state);
 for(const p of [.001,.1,20])for(const x of [0,.5,1])states.push(calculate('px',p,x).state);
 for(const q of states){const r=calculate('hs',q.h,q.s).state;close(r.h,q.h,1e-6);close(r.s,q.s,q.x===0||q.x===1?2e-9:3e-11);close(r.p,q.p,2e-5);}
 for(const [m,a,b] of [['pt',101,300],['pt',51,1100],['ph',3,-1000],['ps',3,-20],['hs',-1000,-20],['tx',700,.5]])assert.throws(()=>calculate(m,a,b));
});
