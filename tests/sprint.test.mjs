import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';import {ph,ps} from '../vendor/seuif97.js';import {helmholtz} from '../src/equations.js';
import {raw95,T95C} from '../src/iapws95.js';import {viscosityScientific,conductivity} from '../src/transport.js';
import {gasState,gasInverse,gasComposition,AIR,GAS_DATA} from '../src/gases.js';
import {humidAir} from '../src/humid-air.js';import {rankine,rankineReheat,rankineRegen,brayton} from '../src/cycles.js';import {ice} from '../src/ice.js';import {d2oPT,d2oSaturation,D2O_M} from '../src/d2o.js';import {seawater} from '../src/seawater.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t*Math.max(Math.abs(b),1e-8),`${a} != ${b}`);
const cp=JSON.parse(await readFile(new URL('fixtures/coolprop.json',import.meta.url),'utf8'));
for(const ref of cp.states)test(`CoolProp 8 audit ${ref.model} ${ref.p} MPa ${ref.T} K`,()=>{const q=calculate('pt',ref.p,ref.T,ref.model).state;
 if(ref.model==='IF97'&&q.region===3){
  // CoolProp's backward v(p,T) differs from a refined fundamental root near criticality.
  const atRho=helmholtz(ref.T,ref.rho);for(const key of ['h','s','cp','cv','w'])close(atRho[key],ref[key],2e-8);
  close(atRho.p,ref.p,2e-4);close(q.p,ref.p,1e-12);close(q.rho,ref.rho,.001);close(q.cp,ref.cp,.009);
 }else for(const key of ['rho','h','s','cp','cv','w','mu','lambda'])if(q[key]!=null)close(q[key],ref[key],1e-8);
});
const gases=JSON.parse(await readFile(new URL('fixtures/cantera-gases.json',import.meta.url),'utf8'));
for(const ref of gases.states)test(`Cantera 3.2 NASA7 ${ref.id} ${ref.T} K`,()=>{const q=gasState(ref.p,ref.T,{[ref.id]:1});for(const key of ['cp','cv','h','s','rho','w'])close(q[key],ref[key],2e-12);});
test('Mixture basis, mixing entropy, ideal gas identity and PH/PS',()=>{const q=gasState(.2,1000,AIR);const mass=Object.fromEntries(Object.entries(q.composition).map(([k,x])=>[k,x*GAS_DATA.find(d=>d.id===k).M/q.M]));const m=gasState(.2,1000,mass,'mass');for(const k of ['rho','h','s','cp'])close(q[k],m[k],1e-12);close(q.cp-q.cv,q.R,1e-12);close(q.h-q.u,q.R*q.T,1e-12);for(const k of ['h','s'])close(gasInverse(q.p,q[k],k,AIR).T,1000,1e-9);const pureSum=Object.entries(AIR).reduce((s,[k,x])=>s+x*gasState(.2,1000,{[k]:1}).s*GAS_DATA.find(d=>d.id===k).M/q.M,0);assert.ok(q.s>pureSum);});
test('Gas inputs reject bad composition and extrapolation',()=>{assert.throws(()=>gasComposition({N2:.5}));assert.throws(()=>gasComposition({oops:1}));assert.throws(()=>gasState(.1,299,{SO2:1}));assert.throws(()=>gasState(0,300,AIR));assert.throws(()=>gasInverse(.1,1e8,'h',AIR));});
test('Humid air: dry/saturated endpoints and wet bulb ordering',()=>{const sat=humidAir(.101325,300,1);close(sat.dew,300,1e-9);close(sat.wet,300,1e-9);const dry=humidAir(.101325,300,0);assert.equal(dry.W,0);assert.equal(dry.dew,null);const q=humidAir(.101325,303.15,.5);assert.ok(q.dew<q.wet&&q.wet<q.T);assert.ok(q.W>.01&&q.W<.02);assert.throws(()=>humidAir(.101325,270,.5));});
for(const model of ['IF97','IAPWS-95'])test(`Rankine ${model} energy closure`,()=>{const c=rankine(10,.01,773.15,.85,.8,2,model);close(c.heat-c.rejected,c.net,1e-12);close(c.power,2*c.net,1e-12);assert.ok(c.efficiency>0&&c.efficiency<.5);assert.equal(c.states.length,4);for(const q of c.states)assert.equal(q.model,model);});
test('Brayton variable Cp: isentropic ideal limits and closure',()=>{const c=brayton(.101325,8,300,1400,1,1,3);close(c.states[0].s,c.states[1].s);close(c.states[2].s,c.states[3].s);close(c.heat-c.rejected,c.net,1e-12);assert.ok(c.efficiency>0&&c.efficiency<1);assert.throws(()=>brayton(.1,1,300,1400));assert.throws(()=>rankine(.01,10,700));});
for(const model of ['IF97','IAPWS-95'])test(`Rankine reheat ${model}: energy closure and efficiency gain over simple cycle`,()=>{const base=rankine(10,.01,773.15,.85,.8,1,model);const c=rankineReheat(10,2,.01,773.15,773.15,.85,.8,1,model);close(c.heat-c.rejected,c.net,1e-9);assert.equal(c.states.length,6);assert.ok(c.efficiency>base.efficiency);for(const q of c.states)assert.equal(q.model,model);});
for(const model of ['IF97','IAPWS-95'])test(`Rankine regeneration ${model}: energy closure, mass-balanced FWH and efficiency gain`,()=>{const base=rankine(10,.01,773.15,.85,.8,1,model);const c=rankineRegen(10,1,.01,773.15,.85,.8,1,model);close(c.heat-c.rejected,c.net,1e-8);assert.equal(c.states.length,7);assert.ok(c.efficiency>base.efficiency);for(const q of c.states)assert.equal(q.model,model);});
test('Rankine reheat/regen reject an intermediate pressure outside (pLow, pHigh)',()=>{assert.throws(()=>rankineReheat(10,11,.01,773.15,773.15));assert.throws(()=>rankineReheat(10,.005,.01,773.15,773.15));assert.throws(()=>rankineRegen(10,11,.01,773.15));assert.throws(()=>rankineRegen(10,.005,.01,773.15));});

// IAPWS R10-06(2009) Table 6: triple point, normal-pressure melting point, and 100 K / 100 MPa.
// v's check value is Table 6's (dg/dp)_T, since v = (dg/dp)_T exactly.
const iceTable6=[
 [273.16,611.657,{g:0.611784135,v:0.109085812737e-2,h:-0.333444253966e6,f:-0.554468750e-1,u:-0.333444921197e6,s:-0.122069433940e4,cp:0.209678431622e4,rho:0.916709492200e3,alpha:0.159863102566e-3,beta:0.135714764659e7,kappaT:0.117793449348e-9,kappaS:0.114161597779e-9}],
 [273.152519,101325,{g:0.101342740069e3,v:0.109084388214e-2,h:-0.333354873637e6,s:-0.122076932550e4,cp:0.209671391024e4,rho:0.916721463419e3}],
 [100,100e6,{g:-0.222296513088e6,v:0.106193389260e-2,h:-0.483491635676e6,u:-0.589685024936e6,f:-0.328489902347e6,s:-0.261195122589e4,cp:0.866333195517e3,rho:0.941678203297e3,alpha:0.258495528207e-4,beta:0.291466166994e6,kappaT:0.886880048115e-10,kappaS:0.886060982687e-10}],
];
for(const [T,p,ref] of iceTable6)test(`Ice Ih R10-06 Table 6: T=${T} K, p=${p} Pa`,()=>{const q=ice(T,p);for(const [key,want] of Object.entries(ref))close(q[key],want,1e-6);});
test('Ice Ih rejects out-of-range inputs and matches v with (dg/dp)T sign/scale',()=>{assert.throws(()=>ice(273.17,1e5));assert.throws(()=>ice(0,1e5));assert.throws(()=>ice(200,-1));assert.throws(()=>ice(200,211e6));const q=ice(260,1e6);assert.ok(q.rho>900&&q.rho<920);assert.ok(q.cp>1800&&q.cp<2200);close(q.v,1/q.rho,1e-12);});

// IAPWS R16-17(2018) heavy water: official Tables 7 and 8 (mass-based, converted via M=20.027508 g/mol).
const d2oTable7=[ // [T,p,rho_molar,cv_molar,w,s_molar]
 [300,0.529123711e-1,55.126,0.833839128e2,0.140374625e4,0.673910582e1],
 [500,8.35329492,46.260,0.626885994e2,0.117888631e4,0.495587000e2],
 [643.8,21.6503820,20.000,0.992661842e2,0.256043612e3,0.817656125e2],
 [800,1.64466177,0.25,0.344327932e2,0.639281410e3,0.142125615e3],
];
for(const [T,p,rhoMolar,cv,w,s] of d2oTable7)test(`D2O R16-17 Table 7: T=${T} K, p=${p} MPa`,()=>{const q=d2oPT(p,T);close(q.rho,rhoMolar*D2O_M,1e-6);close(q.cv,cv/D2O_M,1e-6);close(q.w,w,1e-6);close(q.s,s/D2O_M,1e-6);});
const d2oTable8=[ // [T,p,rhoL_molar,rhoV_molar,hL_molar,hV_molar,sL_molar,sV_molar]
 [280,0.823054058e-3,55.2072786,0.353747143e-3,257.444444,46610.6716,0.924406091,166.471646],
 [450,0.921212105,49.2937575,0.264075691,14512.7149,51501.9146,40.6584121,122.856634],
 [625,0.172118129e2,30.6770554,6.94443339,32453.3556,47246.0343,73.1042291,96.7725149],
];
for(const [T,p,rl,rv,hl,hv,sl,sv] of d2oTable8)test(`D2O R16-17 Table 8 saturation: T=${T} K`,()=>{const sat=d2oSaturation(T);close(sat.p,p,1e-6);close(sat.liquid.rho,rl*D2O_M,1e-6);close(sat.vapor.rho,rv*D2O_M,1e-6);close(sat.liquid.h,hl/D2O_M,1e-6);close(sat.vapor.h,hv/D2O_M,1e-6);close(sat.liquid.s,sl/D2O_M,1e-6);close(sat.vapor.s,sv/D2O_M,1e-6);});
test('D2O rejects out-of-range inputs and keeps liquid/vapor density order',()=>{assert.throws(()=>d2oPT(-1,300));assert.throws(()=>d2oPT(1,900));assert.throws(()=>d2oSaturation(276));assert.throws(()=>d2oSaturation(644));const sat=d2oSaturation(350);assert.ok(sat.liquid.rho>sat.vapor.rho);assert.ok(sat.vapor.h>sat.liquid.h);});

// IAPWS R13-08(2008) seawater Table 8: three official check points for the full
// Property-of-seawater column (g=gW+gS), gW reusing the verified IAPWS-95 core.
const SW_SN=0.03516504;
// g=0, h=0, s=0 at point (a) only by construction (Eq. 5/6 reference-state pinning);
// checked against a small absolute floor rather than the shared relative tolerance.
const seawaterTable8=[
 [SW_SN,273.15,101325,{g:0,h:0,u:-0.985548978e2,f:-0.985548978e2,s:0,rho:0.102810720e4,cp:0.398648579e4,w:0.144900246e4,muW:-0.225047137e4}],
 [0.1,353,101325,{g:-0.295243229e5,h:0.294363423e6,u:0.294265035e6,f:-0.296227102e5,s:0.917529024e3,rho:0.102985888e4,cp:0.374507355e4,w:0.396127835e4,muW:-0.547200505e5}],
 [SW_SN,273.15,1e8,{g:0.951294557e5,h:0.907439992e5,u:-0.263309532e4,f:0.175236121e4,s:-0.160551219e2,rho:0.107092645e4,cp:0.377190387e4,w:0.162198998e4,muW:0.953214082e5}],
];
for(const [S,T,p,ref] of seawaterTable8)test(`Seawater R13-08 Table 8: S=${S}, T=${T} K, p=${p} Pa`,()=>{const q=seawater(S,T,p);for(const [key,want] of Object.entries(ref))want===0?assert.ok(Math.abs(q[key])<1e-6,`${key}: ${q[key]} != 0`):close(q[key],want,1e-6);});
test('Seawater reduces to pure water at S=0 and rejects out-of-range inputs',()=>{const q=seawater(0,293.15,101325);close(q.rho,998.207150,1e-6);assert.equal(q.muW,q.g);assert.throws(()=>seawater(-.01,300,1e5));assert.throws(()=>seawater(.13,300,1e5));assert.throws(()=>seawater(.01,200,1e5));assert.throws(()=>seawater(.01,300,-1));assert.throws(()=>seawater(.01,300,2e8));});

// Official R12-08 Table 5 and R15-11 Table 5, scientific critical enhancement.
const viscTable=[[122,25.520677],[222,31.337589],[272,36.228143],[322,42.961579],[372,45.688204],[422,49.436256]];
const lambdaTable=[[1,51.9298924],[122,130.922885],[222,367.787459],[272,757.959776],[322,1443.75556],[372,650.319402],[422,448.883487],[750,600.961346]];
for(const [rho,expected] of viscTable)test(`R12-08 Table 5 scientific viscosity rho=${rho}`,()=>{const q=raw95(647.35,rho),ref=raw95(1.5*T95C,rho).drhodp;close(viscosityScientific(q,ref)*1e6,expected,3e-8);});
for(const [rho,expected] of lambdaTable)test(`R15-11 Table 5 scientific conductivity rho=${rho}`,()=>{const q=raw95(647.35,rho),ref=raw95(1.5*T95C,rho).drhodp,mu=viscosityScientific(q,ref);close(conductivity(q,ref,mu)*1000,expected,7e-9);});
for(const ref of gases.mixtures)test(`Cantera independent ${ref.name} mixture ${ref.T} K`,()=>{const q=gasState(ref.p,ref.T,ref.composition);for(const key of ['cp','cv','h','s','rho','w'])close(q[key],ref[key],2e-12);});

const backwardPH=[[3,500,391.798509],[80,500,378.108626],[80,1500,611.041229],[.001,3000,534.433241],[3,3000,575.373370],[3,4000,1010.77577],[5,3500,801.299102],[5,4000,1015.31583],[25,3500,875.279054],[40,2700,743.056411],[60,2700,791.137067],[60,3200,882.756860]];
const backwardPS=[[3,.5,307.842258],[80,.5,309.979785],[80,3,565.899909],[.1,7.5,399.517097],[.1,8,514.127081],[2.5,8,1039.84917],[8,6,600.484040],[8,7.5,1064.95556],[90,6,1038.01126],[20,5.75,697.992849],[80,5.25,854.011484],[80,5.75,949.017998]];
test('R7-97 Tables 7, 24: all twelve PH backward seed controls',()=>{for(const [p,h,T] of backwardPH)close(ph(p,h,1)+273.15,T,5e-9);});
test('R7-97 Tables 9, 29: all twelve PS backward seed controls',()=>{for(const [p,s,T] of backwardPS)close(ps(p,s,1)+273.15,T,5e-9);});
const backward3PH=[[20,1700,629.3083892],[50,2000,690.5718338],[100,2100,733.6163014],[20,2500,641.8418053],[50,2400,735.1848618],[100,2700,842.0460876]];
const backward3PS=[[20,3.8,628.2959869],[50,3.6,629.7158726],[100,4,705.6880237],[20,5,640.1176443],[50,4.5,716.3687517],[100,5,847.4332825]];
test('SR3-03(2014) Tables 5,12: twelve region 3 backward seed controls',()=>{for(const [p,h,T] of backward3PH)close(ph(p,h,1)+273.15,T,1e-9);for(const [p,s,T] of backward3PS)close(ps(p,s,1)+273.15,T,1e-9);});
