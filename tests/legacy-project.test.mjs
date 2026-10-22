import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {readProject} from '../src/project.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));

test('Legacy 1.35.12 multi-panel project restores after batch export controls leaked into its inputs',()=>{
 const text=fs.readFileSync(new URL('./fixtures/legacy-project-1.35.12.json',import.meta.url),'utf8');
 const legacy=JSON.parse(text),restored=readProject(text);
 assert.equal(legacy.savedWith.appVersion,'1.35.12');
 assert.equal(legacy.workspace.panels.batch.inputs['batch-spreadsheet-format'],'xlsx');
 assert.equal(Object.hasOwn(restored.workspace.panels.batch.inputs,'batch-spreadsheet-format'),false);
 assert.equal(restored.workspace.panels.batch.inputs['batch-text'],legacy.workspace.panels.batch.inputs['batch-text']);
 assert.equal(restored.workspace.panels.batch.calculated,true);
 assert.equal(restored.states.length,legacy.history.length);
 assert.ok(Math.abs(restored.result.state.h-legacy.history.at(-1).h)<1e-7);
 for(const format of ['xlsx','ods','xls','csv']){legacy.workspace.panels.batch.inputs['batch-spreadsheet-format']=format;assert.doesNotThrow(()=>readProject(JSON.stringify(legacy)));}
 for(const value of ['html','xlsx<script>',{},null]){legacy.workspace.panels.batch.inputs['batch-spreadsheet-format']=value;assert.throws(()=>readProject(JSON.stringify(legacy)));}
 delete legacy.workspace.panels.batch.inputs['batch-spreadsheet-format'];legacy.workspace.panels.batch.inputs['unknown-result-control']='xlsx';assert.throws(()=>readProject(JSON.stringify(legacy)));
});
