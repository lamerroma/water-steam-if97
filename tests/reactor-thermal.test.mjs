import test from 'node:test';
import assert from 'node:assert/strict';
import {reactorAnnulusFactor,reactorTemperatureRise} from '../src/reactor-course.js';
import {reactorBoiling,reactorCHF} from '../src/reactor-methods.js';
import {coursework,COURSE_DEFAULTS,courseworkTables} from '../src/coursework.js';
import {reactorCoverage,reactorThermalEvidence} from '../src/reactor-coverage.js';
import {studyReportHTML,readStudyReport} from '../src/study-report.js';

test('Thin annulus approaches its positive wall-thickness limit without cancellation',()=>{
 for(const thickness of [1e-6,1e-9,1e-12,1e-15]){
  const inner=1-thickness,actualThickness=1-inner,factor=reactorAnnulusFactor(inner,1);
  assert.ok(factor>0);assert.ok(Math.abs(factor/actualThickness-1)<2e-6);
 }
 for(const pair of [[1,1],[-1,1],[0,0],[NaN,1],[1,Infinity]])assert.throws(()=>reactorAnnulusFactor(...pair));
});
test('Midpoint conductivity cannot hide a nonpositive layer surface or accept nonfinite constants',()=>{
 assert.throws(()=>reactorTemperatureRise(2800,3500,'fuel'),/inside layer/);
 assert.throws(()=>reactorTemperatureRise(10000,0,'clad'),/layer surface/);
 assert.throws(()=>reactorTemperatureRise(400,0,'fuel',-1));
 assert.throws(()=>reactorTemperatureRise(400,1,'fuel',Infinity));
 assert.throws(()=>reactorTemperatureRise(NaN,1,'fuel'));assert.throws(()=>reactorTemperatureRise(-1e308,1,'fuel'));
 assert.equal(reactorTemperatureRise(400,300,'fuel',3).rise,100);
});
test('Boiling pressure-domain status is independent of crossing the onset threshold',()=>{
 const a={pMPa:7,coolantC:200,saturationC:250,alphaConv:10000,designFlux:100,method:'guide'};
 assert.equal(reactorBoiling(a).outside,true);assert.equal(reactorBoiling(a).active,false);
 assert.equal(reactorBoiling({...a,method:'off'}).outside,false);
 assert.throws(()=>reactorBoiling({...a,method:'unknown'}));assert.throws(()=>reactorCHF(15,3000,0,'unknown'));
});
test('Thermal evidence and assumptions survive both language reports and custom contact inputs',()=>{
 const input={...COURSE_DEFAULTS.reactor,neutronMethod:'off',gap:0,gapMethod:'contact',contactConductance:12345,points:7};
 const q=coursework(input);assert.equal(q.methodVersion,'reactor-course-4');
 const evidence=reactorThermalEvidence(q,true);assert.equal(evidence.length,7);assert.ok(evidence.some(r=>r.includes('12345 W/(m² K)')));
 assert.ok(courseworkTables(q,true).some(t=>t.title==='Thermal assumptions and source evidence'));
 for(const language of ['uk','en']){
  const html=studyReportHTML('thermal',readStudyReport({entries:[{kind:'coursework',input}]}),{language});
  assert.ok(html.includes('PNNL-17644.pdf'));assert.ok(html.includes('12345 W/(m² K)'));assert.ok(html.includes('reactor-course-4'));
 }
 const outside=coursework({...input,pIn:7,pressureDrop:.1,tIn:180,tOut:200,hotFactor:1});assert.equal(reactorCoverage(outside).find(r=>r[0]==='3.3 boiling')[3],'outside');
});
