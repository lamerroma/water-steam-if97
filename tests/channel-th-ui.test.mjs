import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {createTranslator} from '../src/i18n.js';
import {CH_PANEL,CH_FIELDS,CH_CALCS} from '../src/channel-th-ui.js';
import {calcPanelValues,calcPanelVisible,calcPanelCheck,calcPanelLineChart} from '../src/calc-panel-ui.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const catalogs=Object.fromEntries(['uk','en'].map(l=>[l,JSON.parse(fs.readFileSync(new URL(`../src/locales/${l}.json`,import.meta.url),'utf8'))]));
globalThis.uiTranslator=createTranslator(catalogs,'uk');
globalThis.parseNumber=(await import('../src/units.js')).parseNumber;
const defaults=Object.fromEntries(Object.entries(CH_FIELDS).map(([k,[,,def,opts]])=>[k,opts?opts[0][0]:String(def)]));
test('Every calculation runs with the default inputs and every label is translated',()=>{
 for(const calc of Object.keys(CH_CALCS)){
  const values=calcPanelValues(CH_PANEL,calc,defaults);assert.equal(calcPanelCheck(CH_PANEL,calc,values),null);
  const r=CH_CALCS[calc].run(values);assert.ok(r.rows.length>3);
  for(const [k,v] of r.rows){for(const l of ['uk','en'])assert.ok(catalogs[l][k],l+' '+k);assert.ok(v==null||typeof v==='string'||Number.isFinite(v),k);}
  for(const n of r.notes)assert.ok(catalogs.en[n],n);
  for(const key of ['calc.','formula.'])assert.ok(catalogs.en['ch.'+key+calc]);
 }
 for(const [id] of Object.values(CH_FIELDS))for(const l of ['uk','en'])assert.ok(catalogs[l]['ch.f.'+id],id);
 for(const [, , ,opts] of Object.values(CH_FIELDS))for(const [,label] of opts||[])assert.ok(catalogs.en[label],label);
});
test('Channel result has a node table, chart and DNBR above 1 for the default case',()=>{
 const r=CH_CALCS.channel.run(calcPanelValues(CH_PANEL,'channel',defaults));
 assert.ok(r.table.rows.length>=20);assert.match(r.svg,/^<svg[^>]+viewBox/);assert.equal((r.svg.match(/<path /g)||[]).length,2);
 assert.ok(r.rows.find(([k])=>k==='ch.r.minDNBR')[1]>1);
});
test('Visibility and validation follow the selected options',()=>{
 assert.ok(!calcPanelVisible(CH_PANEL,'channel',{...defaults,shape:'uniform'}).includes('Le'));
 assert.ok(calcPanelVisible(CH_PANEL,'channel',defaults).includes('Le'));
 assert.throws(()=>calcPanelValues(CH_PANEL,'two-phase',{...defaults,x:'abc'}));assert.deepEqual(calcPanelCheck(CH_PANEL,'two-phase',{...calcPanelValues(CH_PANEL,'two-phase',defaults),x:NaN}),{field:'x'});
 assert.throws(()=>CH_CALCS['two-phase'].run(calcPanelValues(CH_PANEL,'two-phase',{...defaults,x:'1.2'})),/ch.error.quality/);
});
test('Line chart escapes labels and skips non-finite points',()=>{
 const svg=calcPanelLineChart({series:[{label:'<a>',color:'#000',points:[[0,1],[1,NaN],[2,3]]}],xLabel:'x&y',yLabel:'q'});
 assert.ok(svg.includes('&lt;a&gt;')&&svg.includes('x&amp;y')&&!svg.includes('NaN'));
 assert.equal(calcPanelLineChart({series:[{label:'a',color:'#000',points:[]}],xLabel:'x',yLabel:'y'}),'');
});
