import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {initializeHumidAir,humidAirScientific,humidAirInputs} from '../src/humid-air-scientific.js';
await initializeHumidAir(fs.readFileSync(new URL('../vendor/coolprop.wasm',import.meta.url)));
const ref=JSON.parse(fs.readFileSync(new URL('fixtures/humid-air-scientific.json',import.meta.url)));
for(const r of ref.states)test(`ASHRAE humid air ${r.p} MPa ${r.T} K RH ${r.rh}`,()=>{
 const q=humidAirScientific(r.p,r.T,r.rh);for(const [key,k,scale] of [['W','W',1],['h','H',1000],['v','V',1],['cp','C',1000],['dew','D',1],['wet','B',1]]){if(r[k]==null||!Number.isFinite(r[k])||r.rh===0&&key==='dew'){assert.equal(q[key],null);continue;}assert.ok(Math.abs(q[key]*scale-r[k])<=Math.max(1e-7,Math.abs(r[k])*1e-9),key);}
 for(const key of ['W','D','B']){if(r[key]==null||r.rh===0&&['D','B'].includes(key))continue;const a=humidAirInputs(r.p,r.T,key,r[key]);assert.ok(Math.abs(a.rh-r.rh)<1e-7,key);}
});
test('Humid air rejects invalid and supersaturated states',()=>{for(const args of [[.1,300,-.1],[.1,300,1.1],[6,300,.5],[.1,180,.5],[NaN,300,.5]])assert.throws(()=>humidAirScientific(...args));assert.throws(()=>humidAirInputs(.1,300,'D',310));});
// Published CoolProp validation reproduction of ASHRAE RP-1485 A.6.1/A.6.2.
// These rounded tables are controls, not a second independent implementation.
for(const [c,W,v,h] of [[-20,.0006373,.7172,-18.542],[20,.0147605,.850,57.56],[50,.0868629,1.042,275.35]])test(`ASHRAE published saturated table ${c} C`,()=>{const q=humidAirScientific(.101325,c+273.15,1);assert.ok(Math.abs(q.W-W)<5e-8);assert.ok(Math.abs(q.v-v)<.0005);assert.ok(Math.abs(q.h-h)<.005);});
test('Oracle-rejected pressure/temperature/humidity combinations remain rejected',()=>{for(const r of ref.excluded)assert.throws(()=>humidAirScientific(r.p,r.T,r.rh),`${r.p} ${r.T} ${r.rh}`);});
