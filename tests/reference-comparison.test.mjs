import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildComparison,violations,writeOutputs,GROUPS} from '../scripts/reference-comparison.mjs';
import {createTranslator} from '../src/i18n.js';
const result=await buildComparison();
test('IAPWS-95 matches NIST IAPWS-95 (CoolProp HEOS) and IF97 matches CoolProp IF97 within limits',()=>{
 assert.deepEqual(violations(result),[]);
 assert.ok(result.states.length>=45);
 for(const group of Object.keys(GROUPS))assert.ok(result.states.some(s=>s.group===group&&s.formulation),group);
 assert.ok(result.states.filter(s=>s.heos).length>=40);
});
test('reference comparison docs and help table are regenerated from the fixture',()=>{
 assert.deepEqual(writeOutputs(result,true),[],'run: node scripts/reference-comparison.mjs');
});
test('help table text is translated to English',async()=>{
 const catalogs={};for(const l of ['uk','en'])catalogs[l]=JSON.parse(await readFile(new URL('../src/locales/'+l+'.json',import.meta.url),'utf8'));
 const t=createTranslator(catalogs,'en');
 assert.equal(t.text('Звірка з NIST і CoolProp'),'Comparison with NIST and CoolProp');
 for(const group of Object.values(GROUPS))assert.equal(t.text(group.uk),group.en);
});
