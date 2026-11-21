import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {ionizationPKw,refractiveIndex,densityDerivatives,saturationSlope,withExtraWaterProperties} from '../src/water-extra-properties.js';
import {propertyUnavailableReason} from '../src/ux-display.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b} (±${tol})`);

test('IAPWS R11-07(2019) ionization constant matches the release check values',()=>{
 // Table 3 of the release: T in K, ρ in g/cm³.
 near(ionizationPKw(300,1000),13.906672,5e-6);
 near(ionizationPKw(600,700),11.147093,5e-6);
 near(ionizationPKw(800,200),14.487671,5e-6);
 // Accepted value for liquid water at 25 °C and 0.1 MPa.
 near(ionizationPKw(298.15,997.047),13.995,2e-3);
 assert.equal(ionizationPKw(260,1000),null);assert.equal(ionizationPKw(1300,100),null);assert.equal(ionizationPKw(500,800,1200),null);
});
test('IAPWS R9-97 refractive index reproduces handbook values at the sodium D line',()=>{
 // Vacuum-referred values: n(air) × 1.000293.
 near(refractiveIndex(273.15,999.84,.58929),1.33395*1.000293,1e-4);
 near(refractiveIndex(293.15,998.2,.58929),1.33299*1.000293,1e-4);
 near(refractiveIndex(298.15,997.047,.58929),1.33250*1.000293,1e-4);
 assert.equal(refractiveIndex(400,0),1);
 assert.ok(refractiveIndex(298.15,997.047,.4)>refractiveIndex(298.15,997.047,.7),'normal dispersion');
 assert.equal(refractiveIndex(800,100),null);assert.equal(refractiveIndex(300,1100),null);assert.equal(refractiveIndex(300,1000,1.5),null);
});
test('density derivatives agree with central differences of the P–h solver',()=>{
 for(const [p,h] of [[10,500],[1,3000],[25,2200]]){
  const q=calculate('ph',p,h).state,rho=(pp,hh)=>calculate('ph',pp,hh).state.rho,dh=1e-2,dp=p*1e-4;
  near(q.drhodh,(rho(p,h+dh)-rho(p,h-dh))/(2*dh),Math.abs(q.drhodh)*1e-6);
  near(q.drhodph,(rho(p+dp,h)-rho(p-dp,h))/(2*dp),Math.abs(q.drhodph)*1e-5);
 }
 const mix=calculate('ph',1,1500).state,rho=hh=>calculate('ph',1,hh).state.rho;
 near(mix.drhodh,(rho(1500.01)-rho(1499.99))/.02,Math.abs(mix.drhodh)*1e-6);
 assert.equal(mix.drhodph,null);assert.equal(mix.pKw,null);assert.equal(mix.nD,null);
 assert.deepEqual(densityDerivatives({rho:1,alpha:null,cp:1}),{drhodh:null,drhodph:null});
});
test('saturation slope follows Clausius–Clapeyron and the saturation-pressure derivative',()=>{
 for(const T of [300,373.124,500,640]){
  const r=calculate('satt',T),dT=1e-3,ps=t=>calculate('satt',t).saturation.p;
  near(r.saturation.dpsdt,(ps(T+dT)-ps(T-dT))/(2*dT),r.saturation.dpsdt*5e-4);// Clausius–Clapeyron from IF97 phases vs the region-4 equation: ~3e-4 near Tc
  assert.equal(r.saturation.liquid.dpsdt,r.saturation.dpsdt);
 }
 assert.equal(calculate('pt',1,400).state.dpsdt,null);
 assert.equal(saturationSlope({critical:true,liquid:{},vapor:{}}),null);
 assert.ok(calculate('px',1,.3).state.dpsdt>0);
});
test('extra properties are added for both IF97 and IAPWS-95 and explained when missing',()=>{
 for(const model of ['IF97','IAPWS-95']){const q=calculate('pt',.101325,298.15,model).state;near(q.pKw,13.995,3e-3);near(q.nD,1.3329,2e-4);assert.ok(q.drhodh<0&&q.drhodph>0);}
 assert.equal(withExtraWaterProperties(null),null);
 const hot=calculate('pt',1,1200).state;assert.equal(hot.nD,null);assert.ok(Number.isFinite(hot.pKw));
 assert.match(propertyUnavailableReason('nD',hot),/R9-97/);assert.match(propertyUnavailableReason('pKw',{T:1300,p:1}),/R11/);assert.match(propertyUnavailableReason('dpsdt',{T:400,p:1}),/насичен/);
});
