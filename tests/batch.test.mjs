import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {batchRange,parseBatchCSV,calculateBatch,batchStates,batchCSV} from '../src/batch.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
test('range includes exact endpoints in increasing and decreasing series',()=>{for(const [start,end] of [[30,300],[300,30]]){const q=batchRange({mode:'pt',vary:'b',start,end,count:4,fixed:3,ua:'MPa',ub:'C'});assert.equal(q[0].b,start);assert.equal(q[3].b,end);assert.equal(calculateBatch(q).filter(r=>!r.error).length,4);}assert.throws(()=>batchRange({mode:'pt',vary:'a',start:0,end:1,count:501,fixed:300}));});
test('CSV parser accepts semicolon decimal commas and RFC quoted fields',()=>{const records=parseBatchCSV('mode;a;b;unit_a;unit_b;name\r\npt;3;26,85;MPa;C;"Рідина; test"\r\nph;3;500;kPa;kJkg;"line\nname"');assert.equal(records[0].name,'Рідина; test');assert.equal(calculateBatch(records)[0].result.state.T,300);assert.throws(()=>parseBatchCSV('mode,a,b,unit_a,unit_b\npt,3,300,MPa,"K'));assert.throws(()=>parseBatchCSV('mode,a,b,unit_a,unit_b\npt,3'));});
test('batch keeps errors per row and expands saturation into phase endpoints',()=>{const r=calculateBatch(parseBatchCSV('mode,a,b,unit_a,unit_b,name\npt,435.11321319062773,80.33,psi,F,water\npt,101,300,MPa,K,invalid\nsatp,0.1,,MPa,,sat'));assert.ok(r[0].result);assert.ok(r[1].error);assert.equal(batchStates(r[2]).length,2);const csv=batchCSV(r,'english');assert.ok(csv.includes('h [Btu/lb]'));assert.ok(csv.includes('"invalid","error"'));assert.ok(csv.includes('Насичена рідина'));});
