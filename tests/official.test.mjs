import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate,regionPT,PMIN_SAT,saturationPressure,saturationTemperature,boundary23Pressure,TC,PC} from '../src/engine.js';
import {gibbs,helmholtz} from '../src/equations.js';
import {viscosity,conductivity} from '../src/transport.js';
import {parseNumber,toCanonical,fromCanonical} from '../src/units.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const near=(a,b,tol=5e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(Math.abs(b),1e-4),`${a} != ${b}`);
// IAPWS R7-97(2012), Tables 5, 15, 33, 42. Columns v,h,u,s,cp,w.
const points=[
 [5,1,3,300,[0.00100215168,115.331273,112.324818,0.392294792,4.17301218,1507.73921]],
 [5,1,80,300,[0.000971180894,184.142828,106.448356,0.368563852,4.01008987,1634.69054]],
 [5,1,3,500,[0.00120241800,975.542239,971.934985,2.58041912,4.65580682,1240.71337]],
 [15,2,0.0035,300,[39.4913866,2549.91145,2411.69160,8.52238967,1.91300162,427.920172]],
 [15,2,0.0035,700,[92.3015898,3335.68375,3012.62819,10.1749996,2.08141274,644.289068]],
 [15,2,30,700,[0.00542946619,2631.49474,2468.61076,5.17540298,10.3505092,480.386523]],
 [42,5,0.5,1500,[1.38455090,5219.76855,4527.49310,9.65408875,2.61609445,917.068690]],
 [42,5,30,1500,[0.0230761299,5167.23514,4474.95124,7.72970133,2.72724317,928.548002]],
 [42,5,30,2000,[0.0311385219,6571.22604,5637.07038,8.53640523,2.88569882,1067.36948]]
];
for(const [table,region,p,T,values] of points)test(`R7-97 Table ${table}: ${p} MPa / ${T} K`,()=>{
 const s=calculate('pt',p,T).state;assert.equal(s.region,region);
 ['v','h','u','s','cp','w'].forEach((key,i)=>near(s[key],values[i]));near(s.rho,1/s.v,1e-12);near(s.h-s.u,1000*p*s.v,1e-10);
});
const r3=[
 [650,500,[25.5837018,1863.43019,1812.26279,4.05427273,13.8935717,502.005554]],
 [650,200,[22.2930643,2375.12401,2263.65868,4.85438792,44.6579342,383.444594]],
 [750,500,[78.3095639,2258.68845,2102.06932,4.46971906,6.34165359,760.696041]]
];
for(const [T,rho,values] of r3)test(`R7-97 Table 33: ${rho} kg/m³ / ${T} K`,()=>{
 const s=helmholtz(T,rho);['p','h','u','s','cp','w'].forEach((key,i)=>near(s[key],values[i]));
 const pt=calculate('pt',s.p,T).state;near(pt.rho,rho,1e-10);near(pt.cp,s.cp,1e-9);
});
for(const [T,p] of [[300,0.00353658941],[500,2.63889776],[600,12.3443146]])test(`R7-97 Table 35: saturation at ${T} K`,()=>near(saturationPressure(T),p));
for(const [p,T] of [[0.1,372.755919],[1,453.035632],[10,584.149488]])test(`R7-97 Table 37: saturation at ${p} MPa`,()=>near(saturationTemperature(p),T));
// R12-08 Table 4: mu2=1, units microPa.s.
for(const [T,rho,mu] of [[298.15,998,889.735100],[298.15,1200,1437.649467],[373.15,1000,307.883622],[433.15,1,14.538324],[433.15,1000,217.685358],[873.15,1,32.619287],[873.15,100,35.802262],[873.15,600,77.430195],[1173.15,1,44.217245],[1173.15,100,47.640433],[1173.15,400,64.154608]])test(`R12-08 Table 4: ${T} K / ${rho} kg/m³`,()=>near(viscosity(T,rho)*1e6,mu,5e-8));
// R15-11 industrial verification tables 7,8,9 (includes critical enhancement).
for(const [p,T,lambda] of [[20,620,481.485195],[50,620,545.038940],[0.3,650,52.2311024],[50,800,177.709914]])test(`R15-11 Table 7/8: ${p} MPa / ${T} K`,()=>near(calculate('pt',p,T).state.lambda*1000,lambda));
for(const [rho,lambda] of [[222,366.879411],[322,1241.82415]])test(`R15-11 Table 9: 647.35 K / ${rho} kg/m³`,()=>near(conductivity(helmholtz(647.35,rho))*1000,lambda));
for(const [T,rho,lambda] of [[298.15,0,18.4341883],[298.15,998,607.712868],[298.15,1200,799.038144],[873.15,0,79.1034659]])test(`R15-11 Table 4: ${T} K / ${rho} kg/m³`,()=>near(conductivity({T,rho,cp:1,cv:1,drhodp:0,region:1})*1000,lambda));
test('P-h / P-s inversion in all single-phase regions',()=>{
 for(const [,,p,T] of points)for(const key of ['h','s']) {const s=calculate('pt',p,T).state;near(calculate('p'+key,p,s[key]).state.T,T,1e-9);}
 for(const [T,rho] of r3)for(const key of ['h','s']) {const s=helmholtz(T,rho);near(calculate('p'+key,s.p,s[key]).state.T,T,1e-9);}
});
test('Saturation, mixture quality and unavailable mixture derivatives',()=>{
 for(const p of [PMIN_SAT,0.1,1,16.52916425260448,20,22,22.063]) {
 const sat=calculate('satp',p).saturation;assert.ok(sat.liquid.rho>sat.vapor.rho);near(saturationPressure(sat.T),p,1e-10);
 for(const key of ['h','s'])for(const x of [0,0.25,0.75,1]) {const target=sat.liquid[key]+x*(sat.vapor[key]-sat.liquid[key]);const s=calculate('p'+key,p,target).state;near(s.x,x,1e-10);near(s.v,sat.liquid.v+x*(sat.vapor.v-sat.liquid.v),1e-10);if(x>0&&x<1)for(const k of ['cp','cv','w','mu','lambda'])assert.equal(s[k],null);}
 }
});
test('P-T on saturation is ambiguous; critical point is not a mixture',()=>{
 const sat=calculate('satp',1).saturation;assert.equal(calculate('pt',1,sat.T).ambiguous,true);
 const c=calculate('pt',PC,TC).state;assert.equal(c.rho,322);assert.equal(c.cp,null);assert.equal(c.lambda,null);assert.equal(c.x,null);
 assert.equal(calculate('satt',TC).saturation.critical,true);
 const cs=calculate('satp',PC).saturation;assert.equal(cs.latentHeat,0);assert.equal(cs.liquid.x,null);
});
test('Boundary classification and limits',()=>{
 assert.equal(regionPT(100,273.15),1);assert.equal(regionPT(100,623.15),1);assert.equal(regionPT(100,623.1501),3);
 for(const T of [650,700,800]) {const p=boundary23Pressure(T);assert.equal(regionPT(p,T),2);assert.equal(regionPT(p+1e-6,T),3);}
 assert.equal(regionPT(50,1073.15),2);assert.equal(regionPT(50,1073.15001),5);assert.equal(regionPT(50,2273.15),5);
 for(const [p,T] of [[0,300],[-1,300],[101,300],[51,1074],[50,2274],[1,273],[NaN,300],[1,Infinity]])assert.throws(()=>calculate('pt',p,T));
 assert.throws(()=>calculate('satp',PMIN_SAT/2));assert.throws(()=>calculate('satp',23));assert.throws(()=>calculate('satt',648));
 assert.throws(()=>calculate('ph',1,10000));assert.throws(()=>calculate('ps',1,-100));
 // The vapor fundamental equation supports pressures below the vendored library's P_MIN.
 const low=calculate('pt',1e-5,300).state;assert.equal(low.region,2);assert.ok(low.v>1000);
 near(calculate('ph',1e-5,low.h).state.T,300,1e-9);
});
test('Units and decimal comma; invalid input is not silently coerced',()=>{
 near(toCanonical(30,'bar'),3,1e-12);near(toCanonical(3000,'kPa'),3,1e-12);near(toCanonical(26.85,'C'),300,1e-12);near(toCanonical(100000,'Jkg'),100,1e-12);near(fromCanonical(3,'Pa'),3000000,1e-12);
 assert.equal(parseNumber('26,85'),26.85);assert.equal(parseNumber('1e-3'),0.001);
 for(const n of ['',' ','1,000.2','3abc','Infinity','0x10'])assert.throws(()=>parseNumber(n));
});
test('Cv and density derivative agree with thermodynamic identities',()=>{
 for(const [,,p,T] of points.filter(x=>x[3]<1073.15)) {const s=calculate('pt',p,T).state,eps=1e-4;const a=calculate('pt',p,T-eps).state,b=calculate('pt',p,T+eps).state;near((b.h-a.h)/(2*eps),s.cp,1e-6);assert.ok(s.cv>0&&s.cv<=s.cp);const dp=p*1e-5;const dr=(calculate('pt',p+dp,T).state.rho-calculate('pt',p-dp,T).state.rho)/(2*dp);near(dr,s.drhodp,1e-5);}
});
test('Small overlaps at region boundaries expose alternate roots',()=>{
 const original=calculate('pt',10,1073.151).state;
 for(const key of ['h','s']) {const inverse=calculate('p'+key,10,original[key]);assert.ok(inverse.alternatives.length>0);assert.ok(inverse.state.notes.some(n=>n.includes('кілька коренів')));assert.ok([inverse.state,...inverse.alternatives].some(q=>Math.abs(q.T-1073.151)<1e-9));const scores=inverse.diagnostics.assessments;assert.ok(scores.every(q=>q.normalizedResidual>=scores[0].normalizedResidual));}
 assert.throws(()=>calculate('pt',1e-300,300));
});
test('CSV exports full precision, units, unavailable values and phase endpoints',async()=>{
 const {exportCSV}=await import('../src/export.js');
 const r=calculate('pt',3,300),csv=exportCSV(r,'J');assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"'+r.state.h*1000+'","Дж/кг"'));assert.ok(csv.includes('"p","3","MPa"'));
 const sat=calculate('satp',0.1).saturation,m=calculate('ph',0.1,(sat.liquid.h+sat.vapor.h)/2),wet=exportCSV(m);
 assert.ok(wet.includes('"state","cp","","кДж/(кг·K)"'));assert.ok(wet.includes('"saturated_liquid","x","0",""'));assert.ok(wet.includes('"saturated_vapor","x","1",""'));
});
