import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {steamHeat,condensateLoad,separatorDryness,airInSteam,steamCost,boilerEfficiency,condensateRecovery} from '../src/steam-plant.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const rel=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
const sat=(p,x)=>calculate('px',p,x).state;

test('dry saturated steam gives up its latent heat; superheat and subcooling add heat',()=>{
 const a=steamHeat({p:1});rel(a.q,sat(1,1).h-sat(1,0).h);assert.ok(a.q>2000&&a.q<2020);
 assert.ok(steamHeat({p:1,T:523.15}).q>a.q);assert.ok(steamHeat({p:1,subcooling:20}).q>a.q);
 assert.ok(steamHeat({p:1,x:.95}).q<a.q);assert.throws(()=>steamHeat({p:1,T:300}));
});

test('condensate loads follow the energy balances',()=>{
 const steam={p:.5},q=steamHeat(steam).q,Ts=steamHeat(steam).Tsat;
 rel(condensateLoad('duty',{steam,heat:100}).condensate,100/q);
 rel(condensateLoad('exchanger',{steam,flow:2,T1:283.15,T2:333.15}).heat,2*4.19*50);
 rel(condensateLoad('tank',{steam,mass:1000,T1:283.15,T2:343.15,time:3600}).heat,1000*4.19*60/3600);
 const w=condensateLoad('warmup',{steam,massPerMetre:10,length:100,T0:283.15,time:1800});rel(w.energy,10*100*.49*(Ts-283.15));rel(w.condensate,w.energy/1800/q);
 const air=condensateLoad('air-heater',{steam,volumeFlow:1,T1:273.15,T2:313.15});rel(air.airDensity,101.325/(.287047*273.15));
 const d=condensateLoad('duty',{steam,heat:100,safetyFactor:2});rel(d.design,2*d.condensate);
 assert.throws(()=>condensateLoad('tank',{steam,mass:1,T1:300,T2:Ts+1,time:1}));assert.throws(()=>condensateLoad('duty',{steam,heat:1,safetyFactor:.5}));
});

test('insulation cuts pipe heat loss and matches the cylindrical resistance',()=>{
 const steam={p:1},Ts=steamHeat(steam).Tsat,D=.1143,L=100;
 const bare=condensateLoad('pipe-loss',{steam,outerDiameter:D,length:L,Tamb:293.15,surfaceCoefficient:12});
 rel(bare.perMetre,(Ts-293.15)*Math.PI*D*12/1000);
 const ins=condensateLoad('pipe-loss',{steam,outerDiameter:D,length:L,Tamb:293.15,insulationThickness:.05,insulationConductivity:.04,surfaceCoefficient:10});
 const r1=D/2,r2=r1+.05,R=Math.log(r2/r1)/(2*Math.PI*.04)+1/(2*Math.PI*r2*10);rel(ins.perMetre,(Ts-293.15)/R/1000);
 assert.ok(ins.heat<bare.heat/5);assert.ok(ins.surfaceTemperature>293.15&&ins.surfaceTemperature<313.15);
});

test('separator raises dryness and conserves steam',()=>{
 const r=separatorDryness({p:1,x:.95,efficiency:.9,massFlow:1});rel(r.removed,.045);rel(r.x2*r.outFlow,.95);assert.ok(r.x2>.99&&r.x2<1);assert.ok(r.heatGainPerKg>0);
 rel(separatorDryness({p:1,x:.9,efficiency:1}).x2,1);
});

test('air in steam lowers the condensing temperature by Dalton law',()=>{
 const r=airInSteam({p:.2,airFraction:.1});rel(r.steamPartialPressure,.18);rel(r.Tmix,sat(.18,1).T);assert.ok(r.temperatureDrop>2&&r.temperatureDrop<5);
 rel(airInSteam({p:.2,airFraction:0}).temperatureDrop,0);
});

test('steam cost, boiler efficiency and condensate recovery are mutually consistent',()=>{
 const base={p:1,feedT:353.15,efficiency:.85,fuelPrice:.4,lhv:35000};
 const c=steamCost(base),dh=sat(1,1).h-calculate('pt',1,353.15).state.h;rel(c.dh,dh);rel(c.fuelPerTonne,1000*dh/(.85*35000));
 const b=boilerEfficiency({p:1,feedT:353.15,steamFlow:1,fuelFlow:dh/(.85*35000),lhv:35000});rel(b.efficiency,.85);
 assert.ok(boilerEfficiency({p:1,feedT:353.15,steamFlow:1,fuelFlow:dh/(.85*35000),lhv:35000,blowdown:.05}).efficiency>.85);
 assert.throws(()=>boilerEfficiency({p:1,feedT:353.15,steamFlow:1,fuelFlow:.001,lhv:35000}));
 const r=condensateRecovery({p:1,condensateFlow:1,condensateT:363.15,makeupT:288.15,efficiency:.85,fuelPrice:.4,lhv:35000,waterCost:2,hours:8000,investment:10000});
 rel(r.tonnesPerYear,28800);rel(r.annualSaving,r.fuelSaving+r.waterSaving);rel(r.paybackYears,10000/r.annualSaving);
});
