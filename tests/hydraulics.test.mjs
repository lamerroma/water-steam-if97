import {test} from 'node:test';import assert from 'node:assert/strict';
import {pipeFlow,pipeHydraulics,darcyFactor,flowToSI} from '../src/flow.js';import {readCalculation} from '../src/workspace.js';
const flow=(velocity=2,diameter=.05)=>pipeFlow({kind:'velocity',value:velocity,diameter,rho:1000,viscosity:.001});
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('laminar control agrees with independent Hagen–Poiseuille law and pump energy',()=>{
 const q=flow(.1,.01),h=pipeHydraulics(q,{length:10,efficiency:.8});near(q.Re,1000);near(h.factor,.064);near(h.lossPressure,320);near(h.lossPressure,128*q.mu*10*q.volume/(Math.PI*q.diameter**4));near(h.lossHead,.03263091881529371);near(h.shaftPower,.003141592653589794);near(h.fanningFactor,.016);
});
test('turbulent rough-pipe reference, local losses and head balance',()=>{
 const q=flow(),h=pipeHydraulics(q,{length:100,roughness:.00005,localK:3,efficiency:.8});near(h.factor,.022174535944515);near(h.localPressure,6000);near(h.lossPressure,94698.14377806);near(h.shaftPower,464.8484262527);near(h.lossHead,9.65652325494);
 const raised=pipeHydraulics(q,{length:100,roughness:.00005,localK:3,efficiency:.8,heightDifference:5,pressureDifference:20000});near(raised.requiredHead,h.lossHead+5+20000/(1000*9.80665));near(raised.hydraulicPower,raised.requiredHead*1000*9.80665*q.volume);near(raised.shaftPower,raised.hydraulicPower/.8);
});
test('Colebrook residual and monotonic roughness across decades',()=>{
 for(const Re of [4000,1e4,1e5,1e7,1e10]){let last=0;for(const rough of [0,1e-6,.001,.01,.05]){const f=darcyFactor(Re,rough).factor;near(1/Math.sqrt(f)+2*Math.log10(rough/3.7+2.51/(Re*Math.sqrt(f))),0);assert.ok(f>=last);last=f;}}
 near(darcyFactor(1e5,0).factor,.01798977308427384);
});
test('transition boundaries never produce invented total friction or power',()=>{
 assert.equal(darcyFactor(2299).method,'laminar');for(const Re of [2300,3000,3999])assert.equal(darcyFactor(Re).factor,null);assert.equal(darcyFactor(4000).method,'colebrook');
 const h=pipeHydraulics(flow(.06),{length:10,localK:2});assert.equal(h.method,'transition');assert.equal(h.lossPressure,null);assert.equal(h.shaftPower,null);near(h.localPressure,3.6);
 const local=pipeHydraulics(flow(.06),{length:0,localK:2});near(local.lossPressure,3.6);
});
test('zero flow, gravity-driven balance and input rejection',()=>{
 const zero=pipeHydraulics(flow(0),{length:100,localK:3,heightDifference:5});assert.equal(zero.factor,null);assert.equal(zero.lossPressure,0);assert.equal(zero.shaftPower,0);assert.equal(zero.pumpHead,5);
 const gravity=pipeHydraulics(flow(),{length:0,heightDifference:-5});assert.equal(gravity.pumpHead,0);assert.equal(gravity.shaftPower,0);assert.equal(gravity.requiredHead,-5);
 for(const bad of [{length:-1},{roughness:-1},{roughness:.003},{localK:-1},{efficiency:0},{efficiency:1.01},{heightDifference:Infinity},{pressureDifference:NaN},{length:1e308}])assert.throws(()=>pipeHydraulics(flow(),{length:10,...bad}));
});
test('hydraulic units and legacy/new input-only records round-trip',()=>{
 near(flowToSI(10,'length','ft'),3.048);near(flowToSI(1,'pressureDrop','bar'),1e5);near(flowToSI(.05,'diameter','mm'),.00005);
 const inputs={'flow-hydraulics':'on','flow-length':'100','flow-length-unit':'m','flow-roughness':'.05','flow-roughness-unit':'mm','flow-local-k':'3','flow-eta':'80','flow-height':'0','flow-pressure-difference':'0','flow-pressure-difference-unit':'kPa'};
 const record=readCalculation(JSON.stringify({module:'flow',inputs,result:{lossPressure:1}})).record;assert.deepEqual(record.inputs,inputs);assert.equal(record.result,undefined);
 assert.deepEqual(readCalculation(JSON.stringify({module:'flow',inputs:{'flow-source':'manual'}})).record.inputs,{'flow-source':'manual'});
 assert.throws(()=>readCalculation(JSON.stringify({module:'flow',inputs:{...inputs,'flow-length-unit':'mm'}})));
});
