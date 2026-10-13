// A separate Python implementation audits arithmetic. It is not an external
// reactor benchmark: water boundary data, input constants and models are shared.
import {spawnSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {coursework,COURSE_DEFAULTS} from '../src/coursework.js';
import {reactorApplyVariant} from '../src/reactor-course.js';
import {calculate} from '../src/engine.js';
import {REACTOR_G_TABLE,REACTOR_ROD_F_TABLE} from '../src/reactor-nuclear-data.js';
const cases=[],expected=[],names=[];
function add(name,input,model='IF97'){
 const q=coursework(input,model),a=q.input,m=q.metrics,n=q.neutronics;
 const water=(T)=>calculate('pt',a.pIn-a.pressureDrop/2,T,model).state;
 const indices=[0,Math.floor(q.profile.length/2),q.profile.length-1],rows=indices.map(i=>q.profile[i]);
 const nodes=rows.map(r=>{const w=calculate('ph',r.p,r.h,model).state,sat=calculate('satp',r.p,0,model).saturation;return {z:r.z,p:r.p,h:r.h,T:r.t,cp:w.cp,mu:w.mu,lambda:w.lambda,satT:sat.T-273.15,hf:sat.liquid.h,hg:sat.vapor.h};});
 const campaignIndices=[0,30,60];
 cases.push({input:a,water:{inlet:q.states[0],outlet:q.states[1],mean:q.states[2],hot:water(m.meanCoolant+273.15),cold:water(a.coldC+273.15)},meanFuel:m.meanFuel,nodes,campaignDays:campaignIndices.map(i=>n.campaign.profile[i].days),gTable:REACTOR_G_TABLE,rodTable:REACTOR_ROD_F_TABLE});
 const result={};
 for(const key of ['thermalMW','rods','waterArea','hydraulicDiameter','diameter','height','bundles','flow','peakLinear','meanRe','fBundle','frictionDrop','localDrop','gravityDrop','accelerationDrop','calculatedDrop'])result['metrics.'+key]=m[key];
 result['zones.enrichment']=n.zones.enrichment;
 for(const label of ['hot','cold'])for(const key of ['V0','V1','V2','N5','N8','Tng','baseI8','KT','phi','theta','kinf','boundaryGamma','Lsq','age','nonLeak','keff','Lwater2','phiZr','qAbs'])result[label+'.'+key]=n[label][key];
 for(const key of ['centralWorth','totalWorth','boron','boricAcid'])result['controls.'+key]=n.controls[key];
 campaignIndices.forEach((i,j)=>result['campaign.'+j]=n.campaign.profile[i].keff);
 rows.forEach((r,i)=>{for(const key of ['alpha','cladOuter','cladInner','fuelSurface','fuelCenter'])result['nodes.'+i+'.'+key]=r[key];if(q.chf)result['nodes.'+i+'.chf']=q.chf[indices[i]].ratio;});
 expected.push(result);names.push(name);
}
for(let variant=1;variant<=45;variant++)add('variant-'+variant,reactorApplyVariant(variant,{...COURSE_DEFAULTS.reactor,points:7}));
add('custom-annular-duct',{...COURSE_DEFAULTS.reactor,variant:0,holeDiameter:2,ductThickness:.2,areaMethod:'duct'});
add('given-integral-and-rod',{...COURSE_DEFAULTS.reactor,variant:0,resonanceMethod:'given',rodMethod:'given',boilingMethod:'off',chfMethod:'off'});
add('constant-conductivity',{...COURSE_DEFAULTS.reactor,cladMethod:'constant',gapMethod:'constant',fuelMethod:'constant'});
add('coordinate-layout',{...COURSE_DEFAULTS.reactor,controlAssemblies:3,rodLayout:'coordinates',controlLayout:'0;0\n0.2;0\n0;0.4'});
add('rings-layout',{...COURSE_DEFAULTS.reactor,controlAssemblies:7,rodLayout:'rings',controlLayout:'0;1\n0.4;6',bellFactor:1.4});
add('IAPWS-95-default',{...COURSE_DEFAULTS.reactor},'IAPWS-95');
const pyPath=fileURLToPath(new URL('./reference/reactor_reference.py',import.meta.url));
const proc=spawnSync(process.env.REACTOR_PYTHON||'python3',[pyPath],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:10*1024*1024});
if(proc.error)throw proc.error;if(proc.status!==0)throw Error(proc.stderr||'Python audit failed');
const references=JSON.parse(proc.stdout);
if(references.length!==cases.length)throw Error('Incomplete Python result');
let checks=0;const summaries=[];
for(let i=0;i<expected.length;i++){
 let max=0,worst='';
 if(Object.keys(references[i]).length!==Object.keys(expected[i]).length)throw Error('Reference key mismatch');
 for(const [key,actual] of Object.entries(expected[i])){
  const reference=references[i][key],error=Math.abs(actual-reference)/Math.max(Math.abs(reference),1e-12);checks++;
  if(!Number.isFinite(reference)||!Number.isFinite(error)||error>2e-8)throw Error(`${names[i]} ${key}: JS=${actual}; Python=${reference}; relative error=${error}`);
  if(error>max){max=error;worst=key;}
 }
 summaries.push({case:names[i],checks:Object.keys(expected[i]).length,maxRelativeError:max,worstQuantity:worst});
}
const fingerprint=createHash('sha256');for(const name of ['src/reactor-course.js','src/reactor-methods.js','src/reactor-neutronics.js','src/reactor-nuclear-data.js','src/reactor-variants.js','scripts/verify-reactor-reference.mjs','scripts/reference/reactor_reference.py'])fingerprint.update(readFileSync(new URL('../'+name,import.meta.url)));
const report={status:'PASS',kind:'Independent implementation arithmetic audit; not a physical benchmark',sharedBoundaryData:['Water equation of state and transport properties','Mean coolant and fuel temperatures','Source constants and tabulated g/F corrections','Supplied lattice boundary factor for square variants'],checks,cases:cases.length,tolerance:2e-8,sourceFingerprint:fingerprint.digest('hex'),summaries};
if(process.argv.includes('--write-report'))writeFileSync(new URL('../docs/REACTOR_NUMERICAL_AUDIT.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${checks} comparisons across ${cases.length} cases (45 variants plus custom methods, layouts and IAPWS-95). Maximum relative error: ${Math.max(...summaries.map(r=>r.maxRelativeError))}.`);
console.log('Scope: independent Python arithmetic; shared water boundary data. Does not establish physical accuracy or missing square-lattice formula.');
