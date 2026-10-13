import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {reactorNeutronCell,reactorWaterDiffusionArea} from '../src/reactor-neutronics.js';
import {reactorBenchmarkCellInput} from '../scripts/reactor-cell-input.mjs';
const ref=JSON.parse(readFileSync(new URL('./fixtures/iaea-zr6-cell.json',import.meta.url),'utf8'));
const input=()=>reactorBenchmarkCellInput(ref,ref.cases[0]);
const near=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('IAEA adapter preserves explicit radii, atomic densities and measured buckling units',()=>{
 const a=input(),g=a.geometry,m=a.material;
 near(g.fuelAreaCM2,Math.PI*.38**2);near(g.totalAreaCM2,Math.PI*.666798**2);
 near(a.leakage.materialBucklingCM2,.009655);near(reactorBenchmarkCellInput(ref,ref.cases[1]).leakage.materialBucklingCM2,.009027);
 assert.equal(m.N5,8.25606e20);assert.equal(m.N8,2.20998e22);assert.equal(m.Nwater,3.24855e22);
 near(m.NZr/4.27937e22,g.metalAreaCM2/(g.metalAreaCM2+g.gasAreaCM2));
 const ratio=(g.totalAreaCM2-g.fuelAreaCM2-g.gasAreaCM2-g.metalAreaCM2)/g.fuelAreaCM2;
 near(ratio,1.661103343518006);assert.ok(Math.abs(ratio-3.079)>1);
 assert.equal(a.temperature.waterK,353.15);assert.ok(!('coreHeightCM' in a.leakage));
});
test('Benchmark case identity and unsupported dissolved boron cannot be silently accepted',()=>{
 assert.throws(()=>reactorBenchmarkCellInput(ref,{...ref.cases[0],measuredBucklingM2:90.27}),/Buckling/);
 assert.throws(()=>reactorBenchmarkCellInput(ref,{...ref.cases[0],boricAcidGL:1}),/boron/);
 assert.notEqual(ref.cases[0].summaryTableName,ref.cases[0].detailedTableName);
});
test('Supplied cell buckling has the zero-leakage limit and monotonically lowers k',()=>{
 const a=input(),n=reactorNeutronCell(a),zero=reactorNeutronCell({...a,leakage:{materialBucklingCM2:0}});
 near(zero.keff,zero.kinf);near(n.keff,n.kinf*Math.exp(-.009655*n.age)/(1+.009655*n.Lsq));
 const high=reactorNeutronCell({...a,leakage:{materialBucklingCM2:.02}});assert.ok(zero.keff>n.keff&&n.keff>high.keff);
});
test('Cell rejects negative buckling, impossible moderator volume and table extrapolation',()=>{
 const a=input();assert.throws(()=>reactorNeutronCell({...a,leakage:{materialBucklingCM2:-1}}));
 assert.throws(()=>reactorNeutronCell({...a,geometry:{...a.geometry,totalAreaCM2:.1}}));
 assert.throws(()=>reactorNeutronCell({...a,temperature:{...a.temperature,waterK:294.15}}),/table/i);
});
test('Strict physical check fails visibly and computes a critical root independently of measured buckling',()=>{
 const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/reactor-cell-benchmark.mjs',import.meta.url)),'--strict'],{encoding:'utf8'});
 assert.equal(run.status,1,run.stderr);const r=JSON.parse(run.stdout);assert.equal(r.status,'physical-screening-failed');
 for(const row of r.cases){const d=row.diagnostics,b=row.calculatedCriticalBucklingM2/1e4;near(d.kinf*Math.exp(-b*d.age)/(1+b*d.Lsq),1);assert.equal(row.withinScreeningGoal,false);assert.equal(row.withinReportedKError,false);assert.equal(row.withinReportedBucklingInterval,false);}
});

test('Water diffusion uses the guide reference state, density scaling and coolant temperature',()=>{
 near(reactorWaterDiffusionArea(293.15,1),7.3984);
 near(reactorWaterDiffusionArea(293.15,.5),4*7.3984);
 assert.ok(reactorWaterDiffusionArea(575,.722)>reactorWaterDiffusionArea(353.15,.722));
 const n=reactorNeutronCell(input());near(n.Lwater2,reactorWaterDiffusionArea(n.Twater,n.rhoWater));assert.ok(Math.abs(n.Lwater2-reactorWaterDiffusionArea(n.Tng,n.rhoWater))>.1);
 assert.throws(()=>reactorWaterDiffusionArea(300,0));assert.throws(()=>reactorWaterDiffusionArea(Infinity,1));
});
test('Homogenized non-fuel absorption conserves the sum of constituent reaction rates',()=>{
 const n=reactorNeutronCell(input());
 const integrated=n.V1*n.saWater+n.V2*n.saZr;
 near((n.qAbs-n.delta)*n.V0*n.sa0/n.fluxRatio,integrated);
 near(n.qAbs,integrated/(n.V0*n.sa0)*n.fluxRatio+n.delta);
});
test('Zirconium resonance absorption integrates actual metal atoms exactly once',()=>{
 for(const gasScale of [1,1.5]){
  const a=input(),g=a.geometry;g.gasAreaCM2*=gasScale;
  a.material.NZr=ref.atomDensitiesPerCM3.clad.Zr*g.metalAreaCM2/(g.metalAreaCM2+g.gasAreaCM2);
  const n=reactorNeutronCell(a),actualAtomArea=ref.atomDensitiesPerCM3.clad.Zr*g.metalAreaCM2;
  near(-Math.log(n.phiZr)*n.slow1*(n.V1+n.V2),3e-24*actualAtomArea);
 }
});
test('Diagnostic perturbations preserve their centre and are labelled as illustrative',()=>{
 const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/reactor-cell-benchmark.mjs',import.meta.url))],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);assert.equal(r.methodVersion,'reactor-course-3');
 for(const row of r.cases){assert.ok(row.baselineK>0);near(row.calculatedK-row.baselineK,row.changeFromBaseline);assert.match(row.illustrativeSensitivity.meaning,/not physical uncertainty/);
 for(const key of ['resonanceIntegral','age','diffusionArea']){const [lo,mid,hi]=row.illustrativeSensitivity[key];near(mid.k,row.calculatedK);assert.ok(lo.k>mid.k&&mid.k>hi.k);}}
});
