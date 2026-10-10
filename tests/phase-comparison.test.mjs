import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {meltingPressure,sublimationPressure,meltingTemperature,boundaryCalculation} from '../src/phase-boundaries.js';
import {ice} from '../src/ice.js';import {d2oPT} from '../src/d2o.js';
import {seawater,seawaterFreezingTemperature,seawaterBoilingPressure,seawaterBoundary} from '../src/seawater.js';
import {compareModels} from '../src/comparison.js';import {initialize,calculate} from '../src/engine.js';import {learningCSV} from '../src/learning-export.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,t)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
// Official R14-08(2011) Table 3; published rounding determines tolerance.
for(const [T,phase,p] of [[260,'Ih',138.268],[254,'III',268.685],[265,'V',479.640],[320,'VI',1356.76],[550,'VII',6308.71]])test(`R14-08 Table 3 melting ${phase}`,()=>{near(meltingPressure(T,phase),p,p<1000?.001:.01);near(meltingTemperature(meltingPressure(T,phase)).T,T,1e-9);});
test('R14-08 Table 3 sublimation and triple point',()=>{near(sublimationPressure(230),8.94735e-6,1e-11);near(sublimationPressure(273.16),.000611657,1e-11);near(meltingPressure(273.16),.000611657,1e-14);});
// R16-17 Section 6, explicit computer-implementation check values.
for(const [T,phase,p] of [[270,'Ih',83.7888413],[255,'III',236.470168],[275,'V',619.526971],[300,'VI',959.203594]])test(`R16-17 Section 6 D2O melting ${phase}`,()=>{near(meltingPressure(T,phase,'D2O'),p,1e-6);near(meltingTemperature(meltingPressure(T,phase,'D2O'),'D2O').T,T,1e-8);});
test('D2O official sublimation check and auxiliary status',()=>{near(sublimationPressure(245,'D2O'),.327390934e-4,1e-12);assert.ok(boundaryCalculation('D2O','subl',245).notes[0].includes('відсутня'));});
test('Boundary extrapolation and unsupported phases are rejected',()=>{assert.throws(()=>meltingPressure(250));assert.throws(()=>sublimationPressure(49));assert.throws(()=>sublimationPressure(209,'D2O'));assert.throws(()=>meltingPressure(550,'VII','D2O'));});
test('Ice distinguishes stable, sublimating and melting states',()=>{assert.equal(ice(260,1e5).phase,'Лід Ih');assert.match(ice(260,.1).phase,/щодо пари/);assert.match(ice(273.16,1e5).phase,/щодо рідини/);});
test('D2O rejects solid states and supports stable liquid below triple temperature',()=>{assert.throws(()=>d2oPT(.1,270),/тверда область/);assert.throws(()=>d2oPT(.0001,245),/сублімації/);const q=d2oPT(100,270);assert.ok(q.rho>1100&&q.cp>0);assert.match(q.phase,/Стійка рідина/);const v=d2oPT(1e-6,245);assert.ok(v.rho<.001&&v.cp>0);});
test('Seawater freezing and boiling reduce to water and classify both metastable sides',()=>{near(seawaterFreezingTemperature(0,101325),273.15252,3e-5);near(seawaterFreezingTemperature(.03516504,101325),271.230885,1e-5);const pv=seawaterBoilingPressure(.03516504,300);near(pv,3470.551817,.001);assert.match(seawater(.03516504,300,pv*.9).phase,/перегріта/);assert.equal(seawater(.03516504,300,pv*1.1).phase,'Стійка рідина');assert.match(seawater(.03516504,265,101325).phase,/переохолоджена/);assert.equal(seawaterBoundary('boil',.03516504,300).boundary,true);});
for(const [mode,a,b] of [['pt',3,300],['pt',22.1,648],['ph',3,500],['ps',3,2],['px',.1,.5],['tx',450,.5]])test(`Model comparison ${mode} ${a} ${b}`,()=>{const q=compareModels(mode,a,b);assert.ok(q.models.every(m=>m.result?.state));for(const row of q.rows){if(row.delta!==null)near(row.delta,row.if97-row.iapws95,1e-12);}assert.ok(learningCSV(q,[],[]).includes('relative [%]'));});
test('Comparison handles unavailable model and saturation ambiguity without false deltas',()=>{const q=compareModels('pt',3,1500);assert.ok(q.models[0].result);assert.ok(q.models[1].error);assert.ok(q.rows.every(r=>r.delta===null));const sat=calculate('satt',450).saturation;const s=compareModels('pt',sat.p,450);assert.ok(s.notes.some(n=>n.includes('частку пари')));});
// Independent external oracle: Python iapws 1.5.5 _Tf/_Tb (not runtime code).
for(const [S,p,T] of [[0,101325,273.1525329504627],[.03516504,101325,271.23089853031576],[.03516504,1e7,270.47460367906086],[.1,101325,267.0318184747977]])test(`Independent seawater freezing S=${S},p=${p}`,()=>near(seawaterFreezingTemperature(S,p),T,3e-5));
// External _Tb uses an industrial water-property reference; allow 0.1 Pa.
test('Independent seawater boiling pressure via inversion of Python _Tb',()=>near(seawaterBoilingPressure(.03516504,300),3470.489222262482,.1));
test('Seawater identifies the coexistence freezing boundary',()=>{const T=seawaterFreezingTemperature(.03516504,101325);assert.match(seawater(.03516504,T,101325).phase,/Межа замерзання/);});
