import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {reactorBenchmarkCellInput} from './reactor-cell-input.mjs';
import {reactorNeutronCell} from '../src/reactor-neutronics.js';

const root=new URL('../',import.meta.url),ref=JSON.parse(await readFile(new URL('tests/fixtures/iaea-zr6-cell.json',root),'utf8'));
const baseline=JSON.parse(await readFile(new URL('docs/REACTOR_CELL_BASELINE_1_16_3.json',root),'utf8'));
const version=JSON.parse(await readFile(new URL('package.json',root),'utf8')).version;
const first=reactorBenchmarkCellInput(ref,ref.cases[0]),{fuelAreaCM2:V0,gasAreaCM2:Vgas,metalAreaCM2:Vzr,totalAreaCM2:Vcell}=first.geometry,V1=Vcell-V0-Vgas-Vzr;
const rows=ref.cases.map(c=>{
 const args=reactorBenchmarkCellInput(ref,c);
 const n=reactorNeutronCell(args),kAt=b=>n.kinf*Math.exp(-b*n.age)/(1+b*n.Lsq);
 let critical=null;
 if(n.kinf>1){let lo=0,hi=.01;while(kAt(hi)>1){hi*=2;if(hi>1e3)throw Error('Cannot bracket critical buckling.');}for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(kAt(mid)>1)lo=mid;else hi=mid;}critical=(lo+hi)/2;if(Math.abs(kAt(critical)-1)>ref.policy.numericalRootTolerance)throw Error('Critical buckling root residual.');}
 const earlier=baseline.cases.find(r=>r.code===c.code&&r.parameters===c.parameters);
 const illustrativeSensitivity={meaning:'Illustrative ±10% perturbations, not physical uncertainty bounds or parameter fitting.',resonanceIntegral:[.9,1,1.1].map(factor=>({factor,k:reactorNeutronCell({...args,options:{...args.options,resonanceMethod:'given',resonanceI8:n.baseI8*factor}}).keff})),age:[.9,1,1.1].map(factor=>({factor,k:n.kinf*Math.exp(-n.Bsq*n.age*factor)/(1+n.Bsq*n.Lsq)})),diffusionArea:[.9,1,1.1].map(factor=>({factor,k:n.kinf*Math.exp(-n.Bsq*n.age)/(1+n.Bsq*n.Lsq*factor)}))};
 const deltaK=n.keff-c.experimentalK,deltaB=critical==null?null:critical*1e4-c.measuredBucklingM2;
 return {code:c.code,parameters:c.parameters,sourceDeckCase:c.deckCase,measuredBucklingM2:c.measuredBucklingM2,reportedBucklingDeviationM2:c.reportedBucklingDeviationM2,experimentalK:c.experimentalK,reportedKError:c.reportedKError,publishedWimsIAEA69K:c.publishedWimsIAEA69K,publishedWimsIAEA172K:c.publishedWimsIAEA172K,calculatedK:n.keff,deltaK,deltaKPcm:deltaK*1e5,withinReportedKError:Math.abs(deltaK)<=c.reportedKError,withinScreeningGoal:Math.abs(deltaK)<=ref.policy.kScreeningAbsoluteTolerance,calculatedCriticalBucklingM2:critical==null?null:critical*1e4,deltaBucklingM2:deltaB,withinReportedBucklingInterval:deltaB!=null&&Math.abs(deltaB)<=c.reportedBucklingDeviationM2,waterDensityGCM3:args.material.rhoWater,baselineK:earlier?.calculatedK??null,changeFromBaseline:earlier?n.keff-earlier.calculatedK:null,illustrativeSensitivity,diagnostics:{kinf:n.kinf,kinfThermal:n.kinfThermal,kinfResonance:n.kinfResonance,Lwater2:n.Lwater2,phi5:n.phi5,phi8:n.phi8,phiZr:n.phiZr,qAbs:n.qAbs,Tng:n.Tng,theta:n.theta,phi:n.phi,mu:n.mu,baseI8:n.baseI8,KT:n.KT,Lsq:n.Lsq,age:n.age,nonLeak:n.nonLeak,boundaryGamma:n.boundaryGamma}};
});
const fingerprints={};for(const p of ['tests/fixtures/iaea-zr6-cell.json','src/reactor-neutronics.js','src/reactor-methods.js','src/reactor-nuclear-data.js','scripts/reactor-cell-benchmark.mjs','scripts/reactor-cell-input.mjs','docs/REACTOR_CELL_BASELINE_1_16_3.json'])fingerprints[p]=createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');
const passed=rows.every(r=>r.withinScreeningGoal&&r.withinReportedKError&&r.withinReportedBucklingInterval);
const report={appVersion:version,methodVersion:'reactor-course-3',source:ref.sources,model:'Course two-region neutron cell with supplied atom densities and measured buckling; no reactor power or fitted parameters.',status:passed?'screening-passed-not-full-validation':'physical-screening-failed',policy:ref.policy,omitted:ref.modelOmissions,geometry:{fuelAreaCM2:V0,gasAreaCM2:Vgas,metalAreaCM2:Vzr,waterAreaCM2:V1,totalAreaCM2:Vcell,waterFuelRatio:V1/V0,totalFuelRatio:Vcell/V0,publishedSummaryRatioLabel:'Vm/Vf',publishedSummaryRatio:3.079,ratioWarning:'The published summary ratio matches total/fuel, not water/fuel. Areas are taken from the explicit input radii.'},sourceSHA256:fingerprints,cases:rows};
if(process.argv.includes('--write-report'))await writeFile(new URL('docs/REACTOR_CELL_BENCHMARK.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--strict')&&!passed)process.exitCode=1;
