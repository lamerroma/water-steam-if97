import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {createTranslator} from '../src/i18n.js';
import {PP_PANEL,PP_FIELDS,PP_CALCS} from '../src/power-plant-ui.js';
import {calcPanelValues,calcPanelCheck} from '../src/calc-panel-ui.js';
import {readWorkspace} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const catalogs=Object.fromEntries(['uk','en'].map(l=>[l,JSON.parse(fs.readFileSync(new URL(`../src/locales/${l}.json`,import.meta.url),'utf8'))]));
globalThis.uiTranslator=createTranslator(catalogs,'uk');globalThis.parseNumber=(await import('../src/units.js')).parseNumber;
const defaults=Object.fromEntries(Object.entries(PP_FIELDS).map(([k,[,,def,opts]])=>[k,opts?opts[0][0]:String(def)]));
test('Every power-plant calculation runs with defaults; labels exist in both languages',()=>{
 for(const calc of Object.keys(PP_CALCS)){
  const values=calcPanelValues(PP_PANEL,calc,defaults);assert.equal(calcPanelCheck(PP_PANEL,calc,values),null,calc);
  const r=PP_CALCS[calc].run(values);assert.ok(r.rows.length>3,calc);
  for(const [k,v] of r.rows){for(const l of ['uk','en'])assert.ok(catalogs[l][k],l+' '+k);assert.ok(v==null||typeof v==='string'&&catalogs.en[v]||Number.isFinite(v),calc+' '+k+' '+v);}
  for(const n of r.notes)assert.ok(catalogs.en[n],n);
  for(const key of ['calc.','formula.'])assert.ok(catalogs.en['pp.'+key+calc],calc);
  if(r.svg)assert.match(r.svg,/^<svg/);
 }
 for(const [id,, ,opts] of Object.values(PP_FIELDS)){for(const l of ['uk','en'])assert.ok(catalogs[l]['pp.f.'+id],id);for(const [,label] of opts||[])assert.ok(catalogs.en[label],label);}
});
test('Workspace accepts every power-plant field and calculation',()=>{
 const inputs=Object.fromEntries(Object.values(PP_FIELDS).map(([id,, ,opts])=>['pp-'+id,opts?opts[0][0]:'1']));
 for(const calc of Object.keys(PP_CALCS))assert.equal(readWorkspace({active:'power-plant',panels:{'power-plant':{inputs:{...inputs,'pp-calc':calc},calculated:true}}}).panels['power-plant'].inputs['pp-calc'],calc);
});
