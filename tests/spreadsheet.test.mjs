import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initialize,calculate} from '../src/engine.js';
import {tabularDocument,resultTabular,historyTabular,saturationTabular,processTabular,diagramTabular,batchTabular} from '../src/tabular-data.js';
import {writeTabular} from '../src/spreadsheet.js';
import {saturationGrid} from '../src/saturation-grid.js';
import {turbine,flash} from '../src/processes.js';
await initialize(readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const context={model:'IF97',appVersion:'test',buildId:'test',system:'si',energy:'kJ'};
test('Spreadsheet dependency is pinned byte for byte and licensed',()=>{
 const pin=JSON.parse(readFileSync(new URL('../vendor/SHEETJS.json',import.meta.url)));
 assert.equal(createHash('sha256').update(readFileSync(new URL('../vendor/sheetjs.cjs',import.meta.url))).digest('hex'),pin.sha256);
 assert.match(readFileSync(new URL('../vendor/SHEETJS-LICENSE',import.meta.url),'utf8'),/Apache License/);
});
test('Actual spreadsheet signatures distinguish OLE XLS from ZIP XLSX and ODS',()=>{
 const doc=resultTabular(calculate('pt',3,300),context);
 assert.equal(Buffer.from(writeTabular(doc,'xls')).subarray(0,8).toString('hex'),'d0cf11e0a1b11ae1');
 for(const format of ['xlsx','ods'])assert.equal(Buffer.from(writeTabular(doc,format)).subarray(0,2).toString(),'PK');
 const csv=writeTabular(doc,'csv');assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('pressure_basis'));assert.ok(csv.includes('absolute'));
});
test('All state phases, alternative roots and undefined properties retain full numeric records',()=>{
 const wet=calculate('px',1,.5),sat=calculate('satp',1),alt=calculate('pt',3,300).state;
 const doc=resultTabular({...wet,saturation:sat.saturation,alternatives:[alt]},context),rows=doc.sheets[1].rows;
 for(const name of ['state','saturated_liquid','saturated_vapor','alternative_1'])assert.ok(rows.some(r=>r[0]===name&&r[1]==='h'&&typeof r[2]==='number'));
 assert.equal(rows.find(r=>r[0]==='state'&&r[1]==='cp')[2],null);assert.ok(rows.find(r=>r[0]==='state'&&r[1]==='cp_unavailable_reason')[2]);
 assert.equal(rows.find(r=>r[0]==='alternative_1'&&r[1]==='h')[2],alt.h);
});
test('J and English outputs keep explicit unit conversions and reference conditions',()=>{
 const q=calculate('pt',3,300),j=resultTabular(q,{...context,energy:'J',p0:.2,T0:310}).sheets[1].rows;
 assert.equal(j.find(r=>r[0]==='state'&&r[1]==='h')[2],q.state.h*1000);assert.match(j.find(r=>r[1]==='h')[3],/Дж/);
 assert.equal(j.find(r=>r[0]==='reference'&&r[1]==='T0')[2],310);
 const en=resultTabular(q,{...context,system:'english'}).sheets[1].rows;assert.equal(en.find(r=>r[1]==='p')[3],'psi');
});
test('History retains names, model per state and numeric zeros',()=>{
 const q=calculate('px',1,0).state,doc=historyTabular([{...q,name:'=SUM(A1:A2) Україна'}],context),r=doc.sheets[1].rows;
 assert.ok(r.some(x=>x[0]==='=SUM(A1:A2) Україна'&&x[2]==='x'&&x[3]===0));
 assert.equal(doc.sheets[0].rows.find(r=>r[0]==='model')[1],'per result');
 const csv=writeTabular(doc,'csv');assert.ok(csv.includes("'=SUM(A1:A2) Україна"));assert.ok(!csv.includes('undefined'));
});
test('Saturation records include input units, both phases, latent heat and per-row errors',()=>{
 const records=saturationGrid({basis:'temperature',unit:'C',start:100,end:100,step:1});records.push({input:400,error:'Недопустимий стан'});
 const doc=saturationTabular(records,'IF97',{...context,input_unit:'C'}),r=doc.sheets[1].rows;
 assert.equal(r.length,3);assert.match(r[0][0],/C/);assert.ok(r[0].some(x=>x.startsWith('r [')));assert.equal(r[2][1],null);assert.equal(r[2].at(-2),'error');
});
test('Turbine and flash exports retain balances plus full properties for every endpoint',()=>{
 for(const [kind,q] of [['turbine',turbine(3,673.15,.1,.85,1)],['flash',flash(3,473.15,.1,1,2)]]){
  const d=processTabular(kind,q,context);assert.equal(d.sheets.length,3);assert.ok(d.sheets[1].rows.some(r=>r[0]==='pressure_basis'&&r[1]==='absolute'));
  assert.ok(d.sheets[2].rows.some(r=>r[0]===2&&r[2]==='h'));
 }
});
test('Diagram series are textual links and keep their selected model and exact state properties',()=>{
 const q=calculate('pt',3,300).state,r=calculate('pt',3,400).state,entries=[[q,'А','history'],[r,'Б','history']];
 const d=diagramTabular(entries,{excluded:[],series:[{name:'@series',model:'IF97',kind:'line',points:[q,r]}]},context);
 assert.ok(d.sheets[1].rows.some(r=>r[0]==='@series'));assert.ok(d.sheets[2].rows.some(r=>r[0]==='А'&&r[2]==='h'&&r[3]===q.h));
});
test('Batch errors stay in the export alongside every successful calculated phase',()=>{
 const q=calculate('pt',3,300),d=batchTabular([{input:{name:'ok'},result:q},{input:{name:'bad'},error:'Invalid state'}],context);
 assert.ok(d.sheets[1].rows.some(r=>r[0]==='bad'&&r[1]==='error'));assert.ok(d.sheets[2].rows.some(r=>r[0]==='ok'&&r[2]==='h'));
});
test('Typed schema rejects formula objects, infinities and silent legacy truncation',()=>{
 for(const cell of [Infinity,NaN,{f:'1+1'},'x'.repeat(32768)])assert.throws(()=>tabularDocument('test',[{name:'Data',rows:[[cell]]}]));
 assert.throws(()=>tabularDocument('test',[{name:'Data',rows:Array.from({length:65537},()=>[])}]));
 assert.throws(()=>tabularDocument('test',[{name:'Data',rows:[Array(257).fill(1)]}]));
 assert.throws(()=>tabularDocument('test',[{name:'Data',rows:[]},{name:'data',rows:[]}]));
 const doc=tabularDocument('test',[{name:'Data',rows:[['literal']]}],{pressure_basis:'gauge'});assert.equal(doc.sheets[0].rows.find(r=>r[0]==='pressure_basis')[1],'absolute');
 const long=tabularDocument('test',[{name:'Data',rows:[['Україна '.repeat(501)]]}]);assert.throws(()=>writeTabular(long,'xls'),/4000/);
 doc.sheets[1].rows[0][0]={f:'1+1'};assert.throws(()=>writeTabular(doc));
});
