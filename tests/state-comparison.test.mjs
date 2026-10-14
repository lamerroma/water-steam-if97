import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {readStateComparison,compareHistoryStates,stateComparisonCSV} from '../src/state-comparison.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
function source(mode,a,b,name='State',model='IF97'){const q=calculate(mode,a,b,model).state;return {name,model,mode,a,b,p:q.p,h:q.h};}
const input=()=>({states:[source('pt',3,273.15,'Cold'),source('pt',6,373.15,'Hot')],reference:0,units:{temperature:'F',pressure:'bar'},pressure:{basis:'gauge',atmosphere:.101325}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('comparison handles affine temperatures, gauge pressure, canonical percentage and reference changes',()=>{
 const a=input(),c=compareHistoryStates(a),T=c.rows.find(q=>q.key==='T'),p=c.rows.find(q=>q.key==='p');
 near(T.values[0].value,32);near(T.values[1].value,212);near(T.values[1].delta,180);near(T.values[1].percent,100*100/273.15);
 near(p.values[0].value,28.98675);near(p.values[1].delta,30);near(p.values[1].percent,100);
 const rev=compareHistoryStates({...a,reference:1});near(rev.rows.find(q=>q.key==='T').values[0].delta,-180);near(rev.rows.find(q=>q.key==='p').values[0].percent,-50);
 const abs=compareHistoryStates({...a,units:{temperature:'C',pressure:'MPa'},pressure:{basis:'absolute',atmosphere:.101325}});near(abs.rows.find(q=>q.key==='T').values[1].percent,T.values[1].percent);
});
test('quality at zero reference and unavailable two-phase properties do not invent values',()=>{
 const c=compareHistoryStates({states:[source('px',.2,0),source('px',.2,.9)],reference:0});
 assert.equal(c.rows.find(q=>q.key==='x').values[1].percent,null);near(c.rows.find(q=>q.key==='x').values[1].delta,.9);
 const sound=c.rows.find(q=>q.key==='w').values[1];assert.equal(sound.value,null);assert.equal(sound.delta,null);assert.equal(sound.percent,null);
});
test('comparison snapshots reject tampered states, excess counts, invalid references and modes',()=>{
 const a=input();assert.throws(()=>readStateComparison({...a,reference:2}));assert.throws(()=>readStateComparison({...a,states:a.states.slice(0,1)}));assert.throws(()=>readStateComparison({...a,states:Array(6).fill(a.states[0])}));assert.throws(()=>readStateComparison({...a,states:[{...a.states[0],h:9999},a.states[1]]}));assert.throws(()=>readStateComparison({...a,states:[{...a.states[0],mode:'satp'},a.states[1]]}));
});
test('CSV and report retain frozen names units and per-state models while escaping user text',()=>{
 const a=input();a.states[0].name='=SUM(1) <script>alert(1)</script>';a.states[1]=source('pt',6,373.15,'Second','IAPWS-95');const csv=stateComparisonCSV(a,'en');assert.ok(csv.includes('"\'=SUM'));assert.ok(csv.includes('°F'));assert.ok(csv.includes('IAPWS-95'));const report=readStudyReport({entries:[{kind:'comparison',input:a,title:'Comparison'}]});a.states[1].name='changed';assert.equal(report.entries[0].input.states[1].name,'Second');const html=studyReportHTML('Report',report,{language:'en'});assert.ok(html.includes('State comparison'));assert.ok(html.includes('Pressure'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('°F'));assert.ok(html.includes('kJ/kg'));assert.ok(!html.includes('undefined'));assert.ok(html.includes('Second · IAPWS-95'));assert.ok(html.includes('IF97 / IAPWS-95'));
});
