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
import {ppcHrsg,ppcCombined,ppcSteamGenerator} from '../src/pp-ccgt.js';
test('HRSG: pinch definition, energy balances on gas and water sides',()=>{
 const h=ppcHrsg({gasFlow:500,gasT:873.15,cpGas:1.1,p:8,steamT:813.15,feedT:333.15,pinch:10,approach:5});
 close(h.Tpinch-h.Ts,10,1e-9);close(h.Q,500*1.1*(873.15-h.stackT),1e-6);close(h.Qsh+h.Qev,500*1.1*(873.15-h.Tpinch),1e-6);
 close(h.Q,h.steamFlow*(h.steam.h-h.feed.h),1e-6);assert.equal(h.water.at(-1)[1],813.15);assert.ok(h.stackT>333.15);
 assert.throws(()=>ppcHrsg({gasFlow:500,gasT:800,p:8,steamT:813.15,feedT:333.15}),/gasT/);
});
test('Combined cycle: Brayton temperatures and overall balance',()=>{
 const r=ppcCombined({ambientT:288.15,ratio:17,etaC:.88,etaT:.9,tit:1573.15,airFlow:500,p:8,steamT:813.15,pk:.005});
 close(r.T2,288.15*(1+(17**(.4/1.4)-1)/.88),1e-9);close(r.etaGT,r.Ngt/r.Q1,1e-12);close(r.eta,(r.Ngt+r.Nst)/r.Q1,1e-12);
 assert.ok(r.eta>r.etaGT&&r.eta>.5&&r.eta<.65);close(r.hrsg.Q,r.Nst+r.condenser,1e-6);
});
test('VVER-1000 steam generator: about 750 MW and 1470 t/h',()=>{
 const r=ppcSteamGenerator({p1:15.7,T1in:593.15,T1out:563.15,primaryFlow:4400,p2:6.27,Tfw:493.15,x2:.998,blowdown:.005,U:5});
 close(r.Q,750e3,25e3);close(r.D*3.6,1460,60);close(r.Qeco+r.Qev,r.Q,1e-6);assert.ok(r.dPinch>0&&r.dPinch<r.dHot&&r.dPinch<r.dCold);close(r.area,r.UA/5,1e-9);
 assert.throws(()=>ppcSteamGenerator({T1in:553.15,T1out:548.15}),/pinchNegative/);
});
import {ppdHeatingGraph,ppdChpTurbine} from '../src/pp-chp.js';
test('Heating graph: design point, monotonic temperatures and the break point',()=>{
 const g=ppdHeatingGraph({ti:20,toDesign:-22,tau1:150,tau2:70,tau3:95,n:.25,tBreak:70,toStart:8,step:2}),d=g.rows.at(-1);
 assert.equal(d.to,-22);close(d.tau1,150,1e-9);close(d.tau2,70,1e-9);close(d.tau3,95,1e-9);close(g.mixing,2.2,1e-12);
 for(let i=1;i<g.rows.length;i++)assert.ok(g.rows[i].tau1>g.rows[i-1].tau1&&g.rows[i].tau2>g.rows[i-1].tau2);
 assert.ok(g.toBreak>4&&g.toBreak<6);assert.equal(g.rows[0].supply,70);assert.ok(g.rows[0].broken);
 // At 0 °C a 150/70 graph with 95 °C radiators gives about 87 / 49 °C.
 const zero=g.rows.find(r=>r.to===0);close(zero.tau1,86.7,.2);close(zero.tau2,48.6,.2);
});
test('CHP turbine: power and heat balances, W and physical method',()=>{
 const r=ppdChpTurbine({p0:12.75,T0:828.15,G0:130,pt:.15,Gt:60,pk:.005,tSupply:373.15,tReturn:333.15});
 close(r.N,r.Nhp+r.Nlp,1e-9);close(r.W,r.Nt/r.Qt,1e-12);assert.ok(r.utilization>r.etaE&&r.etaEPhysical>r.etaE);
 // Energy balance of the plant: fuel heat = power/ηem + heat + condenser + boiler loss.
 close(r.Qfuel*.92,r.N/.98+r.Qt+r.Qk,r.Qfuel*1e-9);assert.deepEqual(r.notes,[]);
 const none=ppdChpTurbine({p0:12.75,T0:828.15,G0:130,pt:.15,Gt:0,pk:.005,tSupply:373.15,tReturn:333.15});assert.equal(none.Qt,0);assert.equal(none.W,null);
 assert.throws(()=>ppdChpTurbine({p0:12.75,T0:828.15,G0:130,pt:.15,Gt:140,pk:.005,tSupply:373.15,tReturn:333.15}),/extraction/);
});
import {ppkCondenser,ppkCoolingTower,ppkSatEnthalpy,ppkHumidity} from '../src/pp-condenser.js';
test('Psychrometrics: saturated air at 20 °C matches ASHRAE (57.5 kJ/kg, 14.7 g/kg)',()=>{close(ppkSatEnthalpy(20,.101325),57.55,.3);close(ppkHumidity(20,.101325,1),.01475,.0002);});
test('Condenser: heat balance and terminal difference',()=>{
 const r=ppkCondenser({D:140,x:.9,W:8000,tw1:15,k:3,F:15000});
 close(r.Q,8000*r.cw*r.dtw,1e-6);close(r.ts,15+r.dtw+r.dt,1e-6);close(r.Q,r.NTU*8000*r.cw*r.lmtd,1e-3);
 close(calculate('px',r.pk,0).state.T-273.15,r.ts,1e-6);assert.ok(r.pk>.003&&r.pk<.0045);
 const more=ppkCondenser({D:140,x:.9,W:12000,tw1:15,k:3,F:15000});assert.ok(more.pk<r.pk,'more cooling water lowers the pressure');
});
test('Cooling tower: Merkel number grows with closer approach; operating-line check',()=>{
 const base={L:1000,t1:40,G:900,ta:25,phi:.6},r=ppkCoolingTower({...base,t2:28});
 close(r.twb,19.5,.3);close(r.hout-r.hin,r.ratio*4.186*12,1e-9);assert.ok(r.merkel>.8&&r.merkel<2);close(r.evaporationShare,.017,.004);
 assert.ok(ppkCoolingTower({...base,t2:25}).merkel>r.merkel);
 assert.throws(()=>ppkCoolingTower({...base,t2:19}),/approach/);assert.throws(()=>ppkCoolingTower({...base,t2:28,G:200}),/airLine/);
});

import {ppsScheme} from '../src/pp-scheme.js';
const ppsK1000={template:'k1000',p0:5.88,x0:.995,pRh:1.2,Trh:523.15,pk:.004,power:1e6,etaHP:.82,etaLP:.85};
const ppsK300={template:'k300',p0:23.5,T0:813.15,pRh:3.9,Trh:813.15,pk:.0034,power:3e5,etaHP:.84,etaLP:.88};
test('K-1000-60 scheme closes its energy balance and gives VVER-1000 scale numbers',()=>{
 const r=ppsScheme(ppsK1000);
 assert.ok(Math.abs(r.balance)<1e-6*r.qIn,'balance '+r.balance);
 assert.ok(r.eta>.33&&r.eta<.38,'eta '+r.eta);assert.ok(r.D0*3.6>5000&&r.D0*3.6<6200,'D0 '+r.D0);
 assert.ok(r.Q>2600e3&&r.Q<3100e3,'Q '+r.Q);assert.ok(r.TfeedOut-273.15>215&&r.TfeedOut-273.15<235);
 assert.ok(r.alphaRh>0&&r.sepWater>0);assert.ok(r.heaters.every(h=>h.alpha>=0));assert.equal(r.heaters.length,7);
});
test('K-300-240 scheme closes its balance with reheat',()=>{
 const r=ppsScheme(ppsK300);
 assert.ok(Math.abs(r.balance)<1e-6*r.qIn,'balance '+r.balance);
 assert.ok(r.eta>.44&&r.eta<.50,'eta '+r.eta);assert.ok(r.D0*3.6>800&&r.D0*3.6<950,'D0 '+r.D0);
 assert.ok(r.TfeedOut-273.15>260&&r.TfeedOut-273.15<285);assert.equal(r.alphaRh,0);
 // Higher condenser pressure lowers efficiency.
 assert.ok(ppsScheme({...ppsK300,pk:.008}).eta<r.eta);
});
test('Scheme rejects inconsistent pressures',()=>{
 assert.throws(()=>ppsScheme({...ppsK300,template:'x'}),/pp.error.template/);
 assert.throws(()=>ppsScheme({...ppsK300,p0:5}),/pp.error.schemeP0/);
 assert.throws(()=>ppsScheme({...ppsK300,pk:.03}),/pp.error.schemeOrder/);
 assert.throws(()=>ppsScheme({...ppsK1000,pRh:.5}),/pp.error.schemeReheat/);
 assert.throws(()=>ppsScheme({...ppsK300,power:0}),/pp.error.power/);
});
