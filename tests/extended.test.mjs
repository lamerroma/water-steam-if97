import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate,PC,TC} from '../src/engine.js';
import {surfaceTension} from '../src/transport.js';
import {toCanonical,fromCanonical} from '../src/units.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,abs=1e-6)=>assert.ok(Math.abs(a-b)<abs,`${a} != ${b}`);
for(const [p,T] of [[3,300],[80,300],[3,500],[.0035,300],[.0035,700],[30,700],[25.5837018,650],[22.2930643,650],[78.3095639,750],[.5,1500],[30,1500],[30,2000]])test(`h-s recovers official forward state ${p} MPa ${T} K`,()=>{
 const a=calculate('pt',p,T).state,b=calculate('hs',a.h,a.s).state;near(b.p,p,2e-5);near(b.T,T,1e-4);near(b.h,a.h,1e-6);near(b.s,a.s,2e-9);
});
for(const p of [.1,3,20])test(`quality and h-s mixture ${p} MPa`,()=>{
 for(const x of [0,.1,.5,.9,1]){const a=calculate('px',p,x);const b=calculate('tx',a.state.T,x);near(b.state.p,p,1e-8);near(b.state.h,a.state.h,1e-6);const c=calculate('hs',a.state.h,a.state.s).state;near(c.p,p,2e-5);near(c.x,x,2e-6);if(x>0&&x<1){assert.equal(a.state.Pr,null);assert.equal(a.state.alpha,null);assert.equal(a.state.nu,null);}}
});
test('quality errors, critical ambiguity, and percent units',()=>{
 for(const x of [-.01,1.01,NaN])assert.throws(()=>calculate('px',1,x));assert.throws(()=>calculate('px',PC,.5),/критичній/);assert.throws(()=>calculate('tx',TC,.5));assert.equal(toCanonical(50,'percent'),.5);assert.equal(fromCanonical(.5,'percent'),50);
 assert.throws(()=>calculate('hs',NaN,5));assert.throws(()=>calculate('hs',-10000,-100));
});
test('analytic derivatives agree with independent finite differences',()=>{
 for(const [p,T] of [[3,300],[.1,500],[25,650],[30,1500]]){const a=calculate('pt',p,T).state,dt=.001,dp=1e-4;
 near(a.dvdt,(calculate('pt',p,T+dt).state.v-calculate('pt',p,T-dt).state.v)/(2*dt),1e-8);
 const eps=p*1e-5;near(a.dvdp,(calculate('pt',p+eps,T).state.v-calculate('pt',p-eps,T).state.v)/(2*eps),1e-7);
 near(a.cp-a.cv,1000*T*a.v*a.alpha**2/a.kappa,1e-8);
 near(a.jt,(calculate('ph',p+dp,a.h).state.T-calculate('ph',p-dp,a.h).state.T)/(2*dp),1e-4);
 near(a.G,a.h-T*a.s);near(a.A,a.u-T*a.s);if(a.mu!==null){near(a.nu,a.mu/a.rho,1e-15);near(a.Pr,a.mu*a.cp*1000/a.lambda,1e-12);}else{assert.equal(a.nu,null);assert.equal(a.Pr,null);}
 }
});
test('surface tension is restricted to equilibrium saturation curve',()=>{assert.equal(calculate('pt',3,300).state.sigma,null);assert.equal(surfaceTension(273.15),null);assert.equal(surfaceTension(TC),0);assert.ok(calculate('px',.1,.5).state.sigma>0);});

// R1-76(2014), Table 1 column 4, rounded to 0.01 mN/m.
for(const [t,sigma] of [[.01,75.65],[25,71.97],[100,58.91],[200,37.67],[300,14.36],[350,3.67],[370,.39]])test(`R1-76 Table 1 surface tension ${t} C`,()=>near(surfaceTension(t+273.15)*1000,sigma,.0051));
