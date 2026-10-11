import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {readPressure,pressureInput,pressureOutput} from '../src/pressure.js';
import {pipeFlow,gasDensity,flowToSI,flowFromSI} from '../src/flow.js';
import {readProject,processCSV} from '../src/project.js';
import {exportCSV} from '../src/export.js';
import {turbine} from '../src/processes.js';
import {readWorkspace,readCalculation} from '../src/workspace.js';
import {printableReport} from '../src/print-report.js';
import {TUTORIALS,solveTutorial} from '../src/tutorials.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('gauge pressures round-trip units and allow physical vacuum readings',()=>{
 const q=readPressure({basis:'gauge',atmosphere:.09});for(const u of ['MPa','kPa','Pa','bar','atm','psi'])for(const p of [.01,.09,3])near(pressureInput(pressureOutput(p,u,q),u,q),p);
 near(pressureInput(-.5,'bar',q),.04);near(pressureInput(20,'C',q),293.15);assert.throws(()=>readPressure({basis:'gauge',atmosphere:0}));assert.throws(()=>readPressure({basis:'other',atmosphere:.1}));
});
test('gauge project restores physical state, legacy absolute project and rejects invalid pressure settings',()=>{
 const p={format:'water-steam-if97',version:1,history:[],pressure:{basis:'gauge',atmosphere:.101325},form:{mode:'pt',a:'0',b:'300',ua:'bar',ub:'K',calculated:true}};
 near(readProject(JSON.stringify(p)).result.state.p,.101325);p.form.a='1';delete p.pressure;near(readProject(JSON.stringify(p)).result.state.p,.1);p.pressure={basis:'absolute',atmosphere:-1};assert.throws(()=>readProject(JSON.stringify(p)));
});
test('flow continuity, three input directions and two viscosity definitions agree',()=>{
 const args={diameter:.05,rho:1000,viscosity:.001},a=pipeFlow({...args,kind:'volume',value:.001});near(a.mass,1);near(a.velocity,.5092958178940651);near(a.Re,25464.790894703256);assert.equal(a.regime,'Турбулентний');
 for(const [kind,value] of [['mass',a.mass],['velocity',a.velocity]]){const r=pipeFlow({...args,kind,value});near(r.volume,a.volume);near(r.Re,a.Re);}
 const r=pipeFlow({...args,kind:'mass',value:1,viscosityKind:'kinematic',viscosity:1e-6});near(r.mu,a.mu);near(r.Re,a.Re);
 near(pipeFlow({...args,kind:'volume',value:0}).Re,0);
 for(const bad of [{diameter:0},{rho:0},{viscosity:0},{value:-1},{kind:'unknown'},{viscosityKind:'unknown'},{diameter:1e-300}])assert.throws(()=>pipeFlow({...args,kind:'mass',value:1,...bad}));
});
test('gas working/standard volume follows absolute pressure, Kelvin temperature and Z without changing mass',()=>{
 const M=28.96546,rho=gasDensity({p:.5,T:350,M,Z:.95}),std=gasDensity({p:.101325,T:273.15,M,Z:1});
 const r=pipeFlow({kind:'standard',value:100/3600,diameter:.05,rho,viscosity:1.8e-5,standardDensity:std});near(r.mass,std*100/3600);near(r.volume/(100/3600),(.101325/.5)*(350/273.15)*.95);
 near(pipeFlow({kind:'volume',value:r.volume,diameter:.05,rho,viscosity:1.8e-5,standardDensity:std}).standardVolume,100/3600);
 for(const bad of [{p:0},{T:0},{M:0},{Z:0}])assert.throws(()=>gasDensity({p:.1,T:300,M,Z:1,...bad}));
 assert.throws(()=>pipeFlow({kind:'standard',value:1,diameter:.1,rho:1,viscosity:1e-5}));
});
test('engineering unit conversions retain continuity and viscosity scales',()=>{
 near(flowToSI(60,'volume','lmin'),.001);near(flowToSI(50,'diameter','mm'),.05);near(flowToSI(1,'dynamic','cP'),.001);near(flowToSI(1,'kinematic','cSt'),1e-6);near(flowFromSI(flowToSI(15,'volume','ft3min'),'volume','ft3min'),15);assert.throws(()=>flowToSI(1,'mass','ms'));
});
test('flow and tutorial inputs round-trip; incompatible imported units and forged results are rejected or ignored',()=>{
 const inputs={'flow-source':'manual','flow-kind':'volume','flow-unit':'lmin','flow-visc-kind':'kinematic','flow-visc-unit':'cSt','flow-value':'60'};
 const r=readCalculation(JSON.stringify({format:'water-steam-calculation',version:1,module:'flow',inputs,result:{Re:-999}}));assert.deepEqual(r.record.inputs,inputs);assert.equal(r.record.result,undefined);
 assert.throws(()=>readCalculation(JSON.stringify({module:'flow',inputs:{...inputs,'flow-unit':'kgs'}})));
 assert.throws(()=>readCalculation(JSON.stringify({module:'flow',inputs:{...inputs,'flow-visc-unit':'Pas'}})));
 assert.throws(()=>readCalculation(JSON.stringify({module:'flow',inputs:{'flow-kind':'standard','flow-standard':'off'}})));
 assert.equal(readWorkspace({active:'tutorials',panels:{tutorials:{inputs:{'tutorial-id':'pipe'},calculated:true}}}).panels.tutorials.inputs['tutorial-id'],'pipe');
});
test('original five tutorial controls match numerical references',()=>{
 assert.equal(TUTORIALS.length,9);const refs={saturation:[179.88563239146663,762.6828443354107],wet:[2508.1011667482085,.8061143558808757],throttle:[2749.216443634458,144.54234324507888],turbine:[611.128813873354,611.128813873354,.9758551008552316],pipe:[1,.5092958178940651,25464.790894703256]};
 for(const [id,numbers] of Object.entries(refs)){const rows=solveTutorial(id);numbers.forEach((v,i)=>near(rows[i][1],v,1e-7));}assert.throws(()=>solveTutorial('unknown'));
});
test('gauge report records atmospheric reference and converts shown pressures while source remains absolute',()=>{
 const state=calculate('pt',.101325,300).state;state.source={mode:'pt',a:.101325,b:300};const text=printableReport('Перевірка',[state],'si','kJ',{result:{state},pressure:{basis:'gauge',atmosphere:.101325}});assert.ok(text.includes('Pатм = 0.101325'));assert.ok(text.includes('MPa (gauge)'));assert.ok(text.includes('<td>p</td><td>0</td>'));assert.ok(text.includes('a = 0.101325'));assert.ok(exportCSV({state}).includes('pressure_basis'));assert.ok(processCSV('turbine',turbine(3,673.15,.1,.85,1)).includes('pressure_basis;absolute'));
});
