import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {readProject} from '../src/project.js';
import {mergeStartupDraft} from '../src/startup-restore.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const raw=JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-project-1.35.12.json',import.meta.url),'utf8'));
const initial=()=>({...structuredClone(raw),title:'Startup defaults',history:[],workspace:{active:'general',panels:{}},form:{model:'IF97',mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C',calculated:false,inputStyle:'smart',inputOrder:'canonical'}});
test('Startup title edit keeps validated history, batch inputs and current result',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);current.title='My newest title';
 const result=mergeStartupDraft(loaded,before,current);
 assert.equal(result.project.title,current.title);assert.equal(result.project.states,loaded.states);assert.equal(result.project.workspace,loaded.workspace);assert.equal(result.project.result,loaded.result);assert.equal(loaded.title,raw.title);
});
test('Startup input edits keep the full visible pair/units as an uncalculated draft and retain old history',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);current.form={...current.form,mode:'ph',a:'10',b:'-',ua:'bar',ub:'kJkg'};
 const result=mergeStartupDraft(loaded,before,current);
 assert.equal(result.project.form.a,'10');assert.equal(result.project.form.b,'-');assert.equal(result.project.form.ua,'bar');assert.equal(result.project.form.mode,'ph');assert.equal(result.project.form.calculated,false);assert.equal(result.project.result,null);assert.equal(result.project.states,loaded.states);assert.equal(result.project.workspace.panels,loaded.workspace.panels);assert.ok(loaded.result);
});
test('Startup saturation input choice can change the main route without losing inactive panels',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);current.form={...current.form,mode:'px',a:'.1',b:'.5',ub:'fraction'};current.workspace.active='saturation';
 const result=mergeStartupDraft(loaded,before,current);assert.equal(result.project.workspace.active,'saturation');assert.equal(result.project.workspace.panels,loaded.workspace.panels);assert.equal(result.project.form.mode,'px');
});
test('Startup display preferences preserve a computed result; invalid units are rejected by the existing reader',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);current.energy='J';current.gray=true;current.scale='1.3';
 const result=mergeStartupDraft(loaded,before,current);assert.equal(result.project.energy,'J');assert.equal(result.project.gray,true);assert.equal(result.project.scale,'1.3');assert.equal(result.project.result,loaded.result);
 current.form.ua='invalid';assert.throws(()=>mergeStartupDraft(loaded,before,current),/Одиниці|параметри/);
});
test('Startup merging still refuses unrelated history/panel changes and never mutates either input',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);current.history.push({p:1,h:999});assert.throws(()=>mergeStartupDraft(loaded,before,current),/history/);
 current.history=[];current.workspace.panels.batch={};assert.throws(()=>mergeStartupDraft(loaded,before,current),/workspace/);assert.deepEqual(before,initial());assert.equal(loaded.title,raw.title);
});
test('Unchanged startup uses the original validated reply without fabricating overrides',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial();const result=mergeStartupDraft(loaded,before,structuredClone(before));assert.equal(result.project,loaded);assert.equal(result.edited,false);
});

test('Startup pressure convention rebases inactive process inputs without changing absolute history',()=>{
 const loaded=readProject(JSON.stringify(raw)),before=initial(),current=structuredClone(before);
 loaded.drafts.turbine={p1:'10',p2:'1',pressure:'bar'};loaded.drafts.engineering={p1:'10',p2:'1',pc1:'20',pc2:'2',pressure:'bar'};
 current.pressure={basis:'gauge',atmosphere:.1};
 const result=mergeStartupDraft(loaded,before,current).project;
 assert.equal(result.workspace.panels.turbine.inputs['process-p1'],'2.9');
 assert.equal(result.drafts.turbine.p1,'9');assert.equal(result.drafts.turbine.p2,'0');assert.equal(result.drafts.engineering.pc1,'19');assert.equal(result.drafts.engineering.pc2,'1');
 assert.equal(loaded.workspace.panels.turbine.inputs['process-p1'],'3');assert.equal(loaded.drafts.turbine.p1,'10');
 assert.equal(result.states,loaded.states);assert.equal(result.result,null);
});

test('A visible absolute-pressure draft keeps its convention when the saved project used gauge pressure',()=>{
 const gauge={...structuredClone(raw),pressure:{basis:'gauge',atmosphere:.1},form:{...raw.form,calculated:false}};
 const loaded=readProject(JSON.stringify(gauge)),before=initial(),current=structuredClone(before);current.form.a='4.2';
 const result=mergeStartupDraft(loaded,before,current).project;
 assert.deepEqual(result.pressure,before.pressure);assert.equal(result.form.a,'4.2');assert.equal(result.form.calculated,false);
 assert.equal(result.workspace.panels.turbine.inputs['process-p1'],'3.1');assert.equal(result.states,loaded.states);
});
