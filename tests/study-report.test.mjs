import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';import {readProject} from '../src/project.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const state={kind:'state',model:'IF97',title:'Example',comment:'',input:{mode:'pt',a:3,b:373.15}};
test('report recomputes states, process and hydraulics instead of trusting imported results',()=>{
 const r=readStudyReport({entries:[{...state,result:{h:999}},{kind:'process',input:{type:'turbine',args:[3,673.15,.1,.85,1]}},{kind:'flow',input:{fluidModel:'Manual values',flow:{kind:'velocity',value:2,diameter:.05,rho:1000,viscosity:.001},hydraulics:{length:100,roughness:.00005,localK:3,efficiency:.8}}},{kind:'npp',input:{thermalMW:3000}},{kind:'coursework',input:{}},{kind:'laboratory',input:{}}]});assert.equal(r.entries.length,3);assert.equal(r.entries[0].result,undefined);assert.ok(evaluateReportEntry(r.entries[0]).states[0].h<500);const h=evaluateReportEntry(r.entries[2]);near(h.rows.find(row=>row[0]==='lossPressure')[1],94698.14377806);
 const html=studyReportHTML('Lab',r,{language:'en',version:'1.9.0'});assert.ok(!html.includes('Steam generator'));assert.ok(html.includes('Manual values'));assert.ok(html.includes('Darcy friction factor'));assert.ok(html.includes('canonical SI'));assert.ok(!html.includes('<pre>'));
});
test('text and diagrams cannot inject executable HTML into a report',()=>{
 const r=readStudyReport({author:'<script>alert(1)</script>',entries:[{...state,title:'<img src=x onerror=alert(1)>',comment:'</p><script>alert(1)</script>'}]});const html=studyReportHTML('<svg onload=alert(1)>',r);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes("default-src 'none'"));
 for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,PHN2Zz4=','javascript:alert(1)'])assert.throws(()=>readStudyReport({entries:[{kind:'diagram',image}]}));
 const png='data:image/png;base64,'+fs.readFileSync(new URL('../src/icons/icon-192.png',import.meta.url)).toString('base64');assert.ok(readStudyReport({entries:[{kind:'diagram',image:png}]}).entries[0].image);
 assert.throws(()=>readStudyReport({entries:Array(21).fill(state)}));assert.throws(()=>readStudyReport({entries:[{kind:'process',input:{type:'turbine',args:[1,2]}}]}));
});
test('old projects gain an empty report; report composition round-trips and removed NPP tab falls back',()=>{
 const base={format:'water-steam-if97',version:1,history:[],form:{mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C',calculated:false}};assert.deepEqual(readProject(JSON.stringify(base)).study.entries,[]);
 const study=readStudyReport({author:'Student',assignment:'Lab',intro:'Given',entries:[state]});const workspace={active:'npp',panels:{npp:{inputs:{'npp-thermalMW':'3000'},calculated:true}}};const parsed=readProject(JSON.stringify({...base,study,workspace}));assert.deepEqual(parsed.study,study);assert.equal(parsed.workspace.active,'general');assert.deepEqual(parsed.workspace.panels,{});
 assert.equal(readProject(JSON.stringify({...base,workspace:{active:'study',panels:{}}})).workspace.active,'study');
});
