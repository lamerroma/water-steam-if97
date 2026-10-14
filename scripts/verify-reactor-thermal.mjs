// Component arithmetic / analytical heat-equation checks, not a reactor experiment.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {reactorAnnulusFactor,reactorTemperatureRise} from '../src/reactor-course.js';
import {reactorBoiling,reactorCHF} from '../src/reactor-methods.js';
const cases=[],actual=[];
function add(c,result){cases.push(c);actual.push(result);}
for(const inner of [0,.1,.5,.9,.999,1-1e-6,1-1e-9,1-1e-12,1-1e-15])add({kind:'annulus',inner,outer:1},{factor:reactorAnnulusFactor(inner,1)});
for(const fraction of [0,.1,.5,.9,.999999]){
 const c={kind:'radial',inner:.004*fraction,outer:.004,linear:30000,conductivity:3};
 add(c,{rise:reactorTemperatureRise(500,c.linear*reactorAnnulusFactor(c.inner,c.outer)/(4*Math.PI),'fuel',c.conductivity).rise});
}
for(const c of [{kind:'shell',inner:.004,outer:.00457,linear:30000,conductivity:20},{kind:'shell',inner:.00392,outer:.004,linear:30000,conductivity:.323}])add(c,{rise:reactorTemperatureRise(400,c.linear*Math.log(c.outer/c.inner)/(2*Math.PI),'clad',c.conductivity).rise});
for(const conductance of [1000,10000,100000])add({kind:'contact',linear:30000,radius:.004,conductance},{rise:30000/(2*Math.PI*.004*conductance)});
// INL TMAP8 ver-1m Table 1: published inputs, independent analytical solution.
// This is a U-ZrH idealized constant-property verification case, not UO2 data.
for(const linear of [15000,20000,25000,30000]){
 const c={kind:'published-pin',source:'https://tmap8.inl.gov/docs/PRs/451/site/verification_and_validation/ver-1m.html',fuelRadius:.005,gap:.0001,cladThickness:.001,fuelLambda:17.6,cladLambda:16.5,gapConductance:7381,coolantAlpha:18000,coolant:563.15-273.15,linear};
 const cladInnerRadius=c.fuelRadius+c.gap,cladOuterRadius=cladInnerRadius+c.cladThickness;
 const cladOuter=c.coolant+linear/(2*Math.PI*cladOuterRadius*c.coolantAlpha);
 const cladInner=cladOuter+reactorTemperatureRise(cladOuter,linear*Math.log(cladOuterRadius/cladInnerRadius)/(2*Math.PI),'clad',c.cladLambda).rise;
 const fuelSurface=cladInner+linear/(2*Math.PI*c.fuelRadius*c.gapConductance);
 const fuelCentre=fuelSurface+reactorTemperatureRise(fuelSurface,linear/(4*Math.PI),'fuel',c.fuelLambda).rise;
 add(c,{cladOuter,cladInner,fuelSurface,fuelCentre});
}
for(const [material,outer,target] of [['clad',342.1,1.44*32250*Math.log(9.144/8.001)/(2*Math.PI)],['gap',390.33,1.44*32250*Math.log(8.001/7.844)/(2*Math.PI)],['fuel',819.48,1.44*32250/(4*Math.PI)]])add({kind:'polynomial',material,outer,target},{rise:reactorTemperatureRise(outer,target,material).rise});
for(const [pressure,massFlux,quality] of [[15.55,4358.55,-.01389],[15.55,4358.55,(1498.1-1631.8)/962.9],[10,1000,-.2],[16,4000,0],[20,5000,.1]])add({kind:'chf',pressure,massFlux,quality},{critical:reactorCHF(pressure,massFlux,quality).qCritical});
for(const pressure of [7.99,8,15.5,20,20.01])for(const flux of [400000,500000,500000.001,1000000]){
 const c={kind:'boiling',pressure,coolant:300,saturation:350,alpha:10000,flux},r=reactorBoiling({pMPa:pressure,coolantC:c.coolant,saturationC:c.saturation,alphaConv:c.alpha,designFlux:flux,method:'guide'});
 add(c,{wall:r.wall,alphaBoiling:r.alphaBoiling,onset:r.onsetFlux});
}
const proc=spawnSync(process.env.REACTOR_PYTHON||'python3',[fileURLToPath(new URL('reference/reactor_thermal_reference.py',import.meta.url))],{input:JSON.stringify(cases),encoding:'utf8'});
if(proc.error)throw proc.error;if(proc.status!==0)throw Error(proc.stderr);const references=JSON.parse(proc.stdout);if(references.length!==cases.length)throw Error('Incomplete reference');
let checks=0,maxError=0;const results=cases.map((input,i)=>{
 const comparisons=Object.entries(actual[i]).map(([quantity,value])=>{
  const expected=references[i][quantity],relativeError=Math.abs(value-expected)/Math.max(1e-30,Math.abs(expected));
  const tolerance=input.kind==='shell'||input.kind==='radial'?2e-9:2e-11;
  if(!Number.isFinite(relativeError)||relativeError>tolerance)throw Error(`${input.kind} ${quantity}: JS=${value}, reference=${expected}, error=${relativeError}`);
  checks++;maxError=Math.max(maxError,relativeError);return {quantity,value,reference:expected,relativeError,tolerance};
 });return {input,comparisons,...(input.kind==='polynomial'?{integralComparison:{rise:references[i].integralRise,differenceK:references[i].differenceK,status:'Different model; informational, not a pass criterion'}}:{})};
});
const files=['src/reactor-course.js','src/reactor-methods.js','scripts/verify-reactor-thermal.mjs','scripts/reference/reactor_thermal_reference.py'];
const report={status:'PASS',scope:'Analytical / component arithmetic verification; not experimental physical validation',cases:cases.length,checks,maxRelativeError:maxError,sourceSHA256:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')])),results};
if(process.argv.includes('--write-report'))writeFileSync(new URL('../docs/REACTOR_THERMAL_AUDIT.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`PASS: ${checks} checks across ${cases.length} thermal component cases. Max relative error ${maxError}.`);
for(const row of results.filter(r=>r.integralComparison))console.log(`${row.input.material}: guide rise ${row.comparisons[0].value.toFixed(5)} K; conductivity-integral rise ${row.integralComparison.rise.toFixed(5)} K; difference ${row.integralComparison.differenceK.toFixed(5)} K.`);
console.log(report.scope);
