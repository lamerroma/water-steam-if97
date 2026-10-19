import test from 'node:test';
import assert from 'node:assert/strict';
import {UI_UNIT_GROUPS,readUIUnits,uiConvertQuantity,uiDisplayQuantity,uiTransportQuantity,uiUnitFromLabel} from '../src/ui-quantities.js';
import {resultExportRows} from '../src/export.js';
import {resultTabular,historyTabular,processTabular,diagramTabular,batchTabular} from '../src/tabular-data.js';
import {printableReport} from '../src/print-report.js';
import {readProject} from '../src/project.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=2e-14*Math.abs(b),`${a} != ${b}`);
const prefs=readUIUnits({dynamicViscosity:'lb_fth',kinematicViscosity:'ft2h',surfaceTension:'mNm'});
const state={p:1,T:400,h:500,s:1,phase:'liquid',model:'IF97',mu:.001,nu:1e-6,diffusivity:1e-7,sigma:.072};
test('Transport dimensions recognize SI, English and Cyrillic labels without conflating dimensions',()=>{
 for(const [label,group,unit] of [['Па·с','dynamicViscosity','Pas'],['lb/(ft·h)','dynamicViscosity','lb_fth'],['μPa·s','dynamicViscosity','uPas'],['м²/с','kinematicViscosity','m2s'],['ft²/h','kinematicViscosity','ft2h'],['Н/м','surfaceTension','Nm'],['mN/m','surfaceTension','mNm']])assert.deepEqual(uiUnitFromLabel(label),{group,unit});
 assert.equal(uiUnitFromLabel('За системою'),null);
 assert.throws(()=>uiConvertQuantity(1,'dynamicViscosity','auto','Pas'));
 assert.throws(()=>uiConvertQuantity(1,'dynamicViscosity','Pas','auto'));
});
test('Transport units preserve physical dimensions and missing values',()=>{
 near(uiConvertQuantity(1,'dynamicViscosity','lb_fts','lb_fth'),3600);
 near(uiConvertQuantity(1,'kinematicViscosity','ft2s','ft2h'),3600);
 assert.deepEqual(uiDisplayQuantity(.072,'Н/м',prefs),[72,'mN/m']);
 assert.deepEqual(uiDisplayQuantity(null,'Па·с',prefs),[null,'lb/(ft·h)']);
 assert.deepEqual(uiTransportQuantity('h',500,'кДж/кг',prefs),[500,'кДж/кг']);
 for(const group of ['dynamicViscosity','kinematicViscosity','surfaceTension'])for(const a of Object.keys(UI_UNIT_GROUPS[group]).filter(x=>x!=='auto'))for(const b of Object.keys(UI_UNIT_GROUPS[group]).filter(x=>x!=='auto'))for(const x of [1e-12,1,1e7])near(uiConvertQuantity(uiConvertQuantity(x,group,a,b),group,b,a),x);
});
test('Historical preferences keep legacy SI and English transport values by default',()=>{
 const old=readUIUnits({temperature:'F',pressure:'psi',mass:'lbs',power:'Btuh',length:'ft',energy:'Btulb'});
 assert.equal(old.dynamicViscosity,'auto');
 for(const [value,unit] of [[.001,'Па·с'],[.001,'lb/(ft·s)'],[null,'Н/м']])assert.deepEqual(uiDisplayQuantity(value,unit,old),[value,unit]);
 const p=readProject(JSON.stringify({format:'water-steam-if97',version:1,history:[],form:{mode:'pt',a:'1',b:'100',ua:'MPa',ub:'C'},uiUnits:prefs}));assert.deepEqual(p.uiUnits,prefs);
});
test('All complete-state exports honor transport preferences and keep unavailable values blank',()=>{
 for(const system of ['si','english']){
  const context={...prefs,system};
  const reference=resultExportRows({state},'kJ',null,system,prefs);
  const documents=[resultTabular({state},context),historyTabular([{...state,name:'point'}],context),processTabular('turbine',{inlet:state,outlet:state,ideal:state,work:0,eta:1,flow:1,power:0},context),diagramTabular([[state,'point']],{},context),batchTabular([{input:{name:'point'},result:{state}}],context)];
  for(const doc of documents){const rows=doc.sheets.find(s=>s.name==='Properties').rows;for(const key of ['mu','nu','diffusivity','sigma']){const expected=reference.find(r=>r[1]===key).slice(-2);assert.ok(rows.some(r=>r.at(-3)===key&&r.at(-2)===expected[0]&&r.at(-1)===expected[1]),key);}}
  const rows=resultTabular({state:{...state,mu:null}},context).sheets.find(s=>s.name==='Properties').rows;assert.equal(rows.find(r=>r[1]==='mu')[2],null);assert.ok(rows.some(r=>r[1]==='mu_unavailable_reason'));
 }
});

test('Printable current-state transport units follow the selected preferences',()=>{
 for(const system of ['si','english']){const html=printableReport('Units',[],system,'kJ',{result:{state},preferences:prefs});for(const u of ['lb/(ft·h)','ft²/h','mN/m'])assert.ok(html.includes(u),u);}
});
