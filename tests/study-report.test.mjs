import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';import {nuclearCycle,NPP_DEFAULT} from '../src/nuclear.js';
import {readStudyReport,studyReportHTML,evaluateReportEntry} from '../src/study-report.js';import {readProject} from '../src/project.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('two-loop model conserves mass/energy and matches locked educational references',()=>{
 const r=nuclearCycle();near(r.primaryFlow,17714.588756504483);near(r.secondaryFlow,1138.1282950977659);near(r.netKW,952123.6510340518);near(r.efficiency,.3173745503446839);
 near(r.steamGeneratorResidual,0);near(r.cycleResidual,0);near(r.heatKW+r.pumpKW,r.turbineKW+r.rejectedKW);assert.ok(r.states[4].x>0&&r.states[4].x<1);assert.equal(r.states[3].x,1);
 const scaled=nuclearCycle({...NPP_DEFAULT,thermalMW:1500});near(scaled.primaryFlow,r.primaryFlow/2);near(scaled.netKW,r.netKW/2);near(scaled.efficiency,r.efficiency);
 for(const model of ['IF97','IAPWS-95']){const q=nuclearCycle(NPP_DEFAULT,model);near(q.cycleResidual,0);assert.equal(q.model,model);}
});
test('nuclear model rejects inverted pressures, boiling primary water and temperature crossing',()=>{
 for(const invalid of [{thermalMW:0},{primaryP:5},{hotC:280},{hotC:380},{coldC:250},{etaT:0},{etaPump:1.1},{steamP:.001},{condenserP:Infinity}])assert.throws(()=>nuclearCycle({...NPP_DEFAULT,...invalid}));
});
const state={kind:'state',model:'IF97',title:'Example',comment:'',input:{mode:'pt',a:3,b:373.15}};
test('report recomputes states, process and hydraulics instead of trusting imported results',()=>{
 const r=readStudyReport({entries:[{...state,result:{h:999}},{kind:'process',input:{type:'turbine',args:[3,673.15,.1,.85,1]}},{kind:'flow',input:{fluidModel:'Manual values',flow:{kind:'velocity',value:2,diameter:.05,rho:1000,viscosity:.001},hydraulics:{length:100,roughness:.00005,localK:3,efficiency:.8}}},{kind:'npp',input:NPP_DEFAULT}]});assert.equal(r.entries[0].result,undefined);assert.ok(evaluateReportEntry(r.entries[0]).states[0].h<500);const h=evaluateReportEntry(r.entries[2]);near(h.rows.find(row=>row[0]==='lossPressure')[1],94698.14377806);
 const html=studyReportHTML('Lab',r,{language:'en',version:'1.9.0'});assert.ok(html.includes('Steam generator'));assert.ok(html.includes('Manual values'));assert.ok(html.includes('Darcy friction factor'));assert.ok(html.includes('canonical SI'));assert.ok(!html.includes('<pre>'));
});
test('text and diagrams cannot inject executable HTML into a report',()=>{
 const r=readStudyReport({author:'<script>alert(1)</script>',entries:[{...state,title:'<img src=x onerror=alert(1)>',comment:'</p><script>alert(1)</script>'}]});const html=studyReportHTML('<svg onload=alert(1)>',r);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes("default-src 'none'"));
 for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,PHN2Zz4=','javascript:alert(1)'])assert.throws(()=>readStudyReport({entries:[{kind:'diagram',image}]}));
 const png='data:image/png;base64,'+fs.readFileSync(new URL('../src/icons/icon-192.png',import.meta.url)).toString('base64');assert.ok(readStudyReport({entries:[{kind:'diagram',image:png}]}).entries[0].image);
 assert.throws(()=>readStudyReport({entries:Array(21).fill(state)}));assert.throws(()=>readStudyReport({entries:[{kind:'process',input:{type:'turbine',args:[1,2]}}]}));
});
test('old projects gain an empty report; report composition and NPP inputs round-trip',()=>{
 const base={format:'water-steam-if97',version:1,history:[],form:{mode:'pt',a:'3',b:'100',ua:'MPa',ub:'C',calculated:false}};assert.deepEqual(readProject(JSON.stringify(base)).study.entries,[]);
 const study=readStudyReport({author:'Student',assignment:'Lab',intro:'Given',entries:[state]});const workspace={active:'npp',panels:{npp:{inputs:{'npp-thermalMW':'3000'},calculated:true}}};const parsed=readProject(JSON.stringify({...base,study,workspace}));assert.deepEqual(parsed.study,study);assert.equal(parsed.workspace.active,'npp');
 assert.equal(readProject(JSON.stringify({...base,workspace:{active:'study',panels:{}}})).workspace.active,'study');
});
