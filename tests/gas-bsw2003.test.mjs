import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BSW2003_DATA,BSW2003_SPECIES,BSW2003_R,bswComposition,bswGasState,bswGasInverse,calculateBSWGas} from '../src/gas-bsw2003.js';
import {gasTableRows,gasCompositionRows} from '../src/gas-table-rows.js';
import {gasTabular} from '../src/tabular-data.js';
import {learningCSV} from '../src/learning-export.js';
import {readWorkspace} from '../src/workspace.js';
const near=(a,b,atol=2e-10,rtol=2e-12)=>assert.ok(Math.abs(a-b)<=atol+rtol*Math.abs(b),`${a} != ${b}`);
const mix={N2:.73,CO2:.10,H2O:.12,O2:.05};
test('BSW2003 has exactly the eight documented components and ten decimal coefficients',()=>{
 assert.deepEqual([...BSW2003_SPECIES].sort(),['Ar','CO','CO2','H2O','N2','Ne','O2','SO2']);
 for(const d of BSW2003_DATA.species){assert.equal(d.a.length,10);assert.ok(d.a.every(v=>typeof v==='string'&&Number.isFinite(Number(v))));}
});
test('Pure-species zeros are exact; Ar and Ne satisfy the analytic monatomic solution',()=>{
 for(const id of BSW2003_SPECIES){const q=bswGasState(.101325,273.15,{[id]:1});assert.equal(q.h,0);assert.equal(q.s,0);}
 for(const id of ['Ar','Ne'])for(const T of [200,273.15,300,1000,3300]){
  const q=bswGasState(.3,T,{[id]:1});near(q.cp,2.5*BSW2003_R/q.M);near(q.gamma,5/3);near(q.h,q.cp*(T-273.15));near(q.s,q.cp*Math.log(T/273.15)-q.R*Math.log(.3/.101325));
 }
});
test('Molar averaging, mass basis and entropy of mixing agree with independent component sums',()=>{
 const c=bswComposition(mix),M=Object.entries(mix).reduce((sum,[id,x])=>sum+x*Number(BSW2003_DATA.species.find(d=>d.id===id).M),0);near(c.M,M);
 for(const T of [200,273.15,700,3300]){
  const q=bswGasState(2,T,mix),mass=bswGasState(2,T,c.mass,'mass');
  for(const key of ['M','R','cp','cv','h','s','u','rho','v','w','isentropic'])near(mass[key],q[key]);
  for(const key of ['cp','h'])near(q[key],Object.entries(c.mass).reduce((sum,[id,w])=>sum+w*bswGasState(2,T,{[id]:1})[key],0));
  const weightedS=Object.entries(c.mass).reduce((sum,[id,w])=>sum+w*bswGasState(2,T,{[id]:1}).s,0);
  near(q.s-weightedS,-BSW2003_R*Object.values(mix).reduce((sum,x)=>sum+x*Math.log(x),0)/M);
 }
 assert.ok(bswGasState(.101325,273.15,mix).s>0);
});
test('Pressure dependence and caloric derivatives obey ideal-gas identities',()=>{
 for(const fractions of [{SO2:1},mix])for(const T of [200.01,273.15,1200,3299.99]){
  const q=bswGasState(.1,T,fractions),high=bswGasState(10,T,fractions),d=.001,L=bswGasState(.1,T-d,fractions),H=bswGasState(.1,T+d,fractions);
  assert.equal(q.cp,high.cp);assert.equal(q.h,high.h);near(high.s-q.s,-q.R*Math.log(100));near(high.rho,100*q.rho);near(q.cp-q.cv,q.R);near(q.h-q.u,q.R*T);near(q.p*1000*q.v,q.R*T);near(q.w*q.w,q.isentropic*q.R*T*1000,1e-8);
  near((H.h-L.h)/(2*d),q.cp,4e-8);near((H.s-L.s)/(2*d),q.cp/T,1e-10);
 }
});
test('P-h and P-s recover the full closed temperature interval for all components and mixtures',()=>{
 for(const fractions of [...BSW2003_SPECIES.map(id=>({[id]:1})),mix])for(const T of [200,200.00001,273.15,273.150001,500,1073.2,2000,3299.99999,3300])for(const p of [.001,.101325,50]){
  const q=bswGasState(p,T,fractions);
  for(const key of ['h','s'])near(bswGasInverse(p,q[key],key,fractions).T,T,2e-9);
 }
 assert.equal(calculateBSWGas('pt',1,300,mix).T,300);
});
test('Unsupported components, invalid totals, nonfinite inputs and extrapolation are rejected',()=>{
 for(const c of [{},{N2:.99},{N2:1.001,O2:-.001},{N2:NaN},{H2:1},{N2:'1'},[],null])assert.throws(()=>bswGasState(1,300,c));
 assert.equal(bswGasState(1,300,{N2:1,H2:0}).composition.N2,1);
 assert.throws(()=>bswComposition(mix,'volume'));
 for(const p of [0,-1,Infinity,NaN,Number.MIN_VALUE,Number.MAX_VALUE])assert.throws(()=>bswGasState(p,300,mix));
 for(const T of [199.999,3300.001,NaN,Infinity])assert.throws(()=>bswGasState(1,T,mix));
 for(const key of ['h','s']){const L=bswGasState(1,200,mix),H=bswGasState(1,3300,mix);assert.throws(()=>bswGasInverse(1,L[key]-1e-8,key,mix));assert.throws(()=>bswGasInverse(1,H[key]+1e-8,key,mix));}
 assert.throws(()=>calculateBSWGas('pv',1,1,mix));assert.throws(()=>bswGasInverse(1,NaN,'h',mix));
});
test('Exports retain the model, reference, both bases and all eight zero-inclusive components',()=>{
 const q=bswGasState(.101325,1000,mix),rows=gasTableRows(q),doc=gasTabular(q,{'gas-model':'bsw2003'});
 assert.equal(gasCompositionRows(q).length,8);assert.ok(gasCompositionRows(q).some(r=>r[0]==='Ne'&&r[1]===0&&r[2]===0));
 assert.ok(JSON.stringify(doc).includes('BSW2003'));assert.ok(JSON.stringify(doc).includes('273.15'));assert.ok(JSON.stringify(doc).includes('dissociation_applied'));
 const csv=learningCSV(q,[],rows);assert.ok(csv.includes('model_id;BSW2003-technical'));assert.ok(csv.includes('Ne;0;0'));assert.ok(csv.includes('T0;273.15;K'));
 const english=gasTableRows(q,'english');assert.equal(english.find(r=>r[0]==='h')[2],'Btu/lb');near(english.find(r=>r[0]==='h')[1],q.h/2.326);
});
test('Legacy NASA7 workspace records remain valid; BSW2003 units and basis persist explicitly',()=>{
 const old=readWorkspace({active:'gases',panels:{gases:{inputs:{'gas-model':'ideal','gas-basis':'mole','fraction-N2':'1'},model:'IF97',calculated:false}}});assert.equal(old.panels.gases.inputs['gas-model'],'ideal');
 const q=readWorkspace({active:'gases',panels:{gases:{inputs:{'gas-model':'bsw2003','gas-fraction-scale':'percent','gas-basis':'mass','fraction-N2':'100'},model:'IF97',calculated:true}}});assert.equal(q.panels.gases.inputs['gas-fraction-scale'],'percent');
});
