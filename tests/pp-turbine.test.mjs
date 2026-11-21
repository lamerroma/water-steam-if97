import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {pptStagnation,pptNozzle,pptStage,pptStageSweep,pptBaumann} from '../src/pp-turbine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
test('Stagnation state adds c0²/2 at constant entropy',()=>{const s=pptStagnation(9,808.15,200);close(s.h-s.static.h,20,1e-9);assert.ok(s.p>9&&s.T>808.15);});
test('Critical pressure ratio: ≈0.546 superheated, ≈0.58 dry saturated (equilibrium)',()=>{
 const sh=pptNozzle({p0:9,T0:808.15,p1:3,m:10});close(sh.critical.ratio,.546,.006);
 const Ts=calculate('px',1,1).state.T,sat=pptNozzle({p0:1,T0:Ts+.01,p1:.2,m:1});close(sat.critical.ratio,.577,.01);
 // The critical velocity equals the local speed of sound for superheated steam.
 const st=calculate('pt',sh.critical.p,sh.critical.T).state;close(sh.critical.c,st.w,st.w*.005);
});
test('Nozzle type, continuity and losses',()=>{
 const lav=pptNozzle({p0:9,T0:808.15,p1:3,m:10,phi:.97,mu:1});assert.equal(lav.converging,false);assert.ok(lav.areaRatio>1);assert.ok(lav.notes.includes('pp.note.laval'));
 close(lav.throatArea*lav.critical.G,10,1e-9);close(lav.exitArea*lav.exit.rho*lav.exit.c,10,1e-9);close(lav.exit.c,.97*lav.exit.cIdeal,1e-9);close(lav.loss,(1-.97**2)*lav.exit.cIdeal**2/2000,1e-9);
 const conv=pptNozzle({p0:9,T0:808.15,p1:6,m:10});assert.equal(conv.converging,true);close(conv.areaRatio,1,1e-12);
 assert.throws(()=>pptNozzle({p0:9,T0:808.15,p1:10,m:10}),/backPressure/);
});
test('Stage: Euler work equals the kinetic-energy balance; efficiency peaks near the optimum u/cf',()=>{
 const input={p0:9,T0:808.15,p2:7.5,reaction:.05,alpha1:13,d:1,n:3000,phi:.96,psi:.92,dBeta:3},r=pptStage(input);
 close(r.work*1e3,(r.c1**2-r.c2**2)/2+(r.w2**2-r.w1**2)/2,1e-6);
 close(r.c1u,r.c1*Math.cos(13*Math.PI/180),1e-9);close(r.u,Math.PI*3000/60,1e-9);
 assert.ok(Math.abs(r.balance)<.05*r.H0,'losses + work ≈ H0');assert.ok(r.efficiency>.8&&r.efficiency<.9);
 const sweep=pptStageSweep(input),best=sweep.reduce((a,b)=>b[1]>a[1]?b:a);close(best[0],r.uRatioOpt,.05);
 const impulse=pptStage({...input,reaction:0});close(impulse.p1,7.5,1e-12);close(impulse.w2,.92*impulse.w1,1e-9);
 assert.throws(()=>pptStage({...input,reaction:1}),/reaction/);
});
test('Baumann: a = 0 reproduces the uncorrected line; moisture lowers the efficiency',()=>{
 const T=calculate('px',6.3,1).state.T+.01,base={p0:6.3,T0:T,pk:.005,eta:.85,steps:30};
 const zero=pptBaumann({...base,a:0});close(zero.work,zero.workDry,1e-9);assert.ok(zero.etaDryOverall>.85,'reheat factor > 1');
 const wet=pptBaumann({...base,a:1});assert.ok(wet.work<wet.workDry&&wet.xk>wet.xks);close(wet.etaOverall,wet.work/wet.Hs,1e-12);
 const sh=pptBaumann({p0:9,T0:808.15,pk:1,eta:.85,a:1,steps:20});close(sh.work,sh.workDry,1e-9);
});
