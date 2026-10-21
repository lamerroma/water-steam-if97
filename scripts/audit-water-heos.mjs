// Independent stored IAPWS95 matrix. No Python or network required for replay.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {initializeWaterHeos,WATER_HEOS_MODES} from '../src/water-heos.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createCalculationRequest} from '../src/calculation-protocol.js';
import {typedRounding} from '../src/input-rounding.js';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const fixture=JSON.parse(await read('tests/fixtures/water-heos-matrix.json'));
await initializeWaterHeos(await readFile(new URL('vendor/coolprop.wasm',root)));
const units={p:'MPa',T:'K',h:'kJkg',s:'kJkgK',u:'kJkg',v:'m3kg',rho:'kgm3',x:'fraction'};
const matches=(a,b)=>Math.abs(a.p-b.p)<=Math.max(1e-7,b.p*3e-6)&&Math.abs(a.T-b.T)<=3e-4;
const report={scope:'Water HEOS M2 input matrix; numerical acceptance, not Steam97Web parity or experimental accuracy',node:process.version,status:'running',cases:[],counts:{matched:0,ambiguous:0,conditioned:0,failed:0}};
for(const c of fixture.records){
 const q=c.expected,modes=c.modes??Object.keys(WATER_HEOS_MODES).filter(mode=>c.kind==='mixture'||!['satp','satt','px','tx'].includes(mode));
 for(const mode of modes){
  const keys=WATER_HEOS_MODES[mode],payload={mode,a:q[keys[0]],...(keys.length===2?{b:q[keys[1]]}:{})};
  if(keys.length===2&&!keys.includes('x'))payload.options={inputRounding:keys.map(k=>typedRounding(q[k].toPrecision(17),units[k]))};
  const request=createCalculationRequest({id:report.cases.length+1,moduleId:'water-heos',methodId:'calculate',payload}),start=performance.now();
  const reply=await dispatchCalculation(request),entry={id:c.id,request,expected:c.roots??[q],reply,ms:performance.now()-start,status:'failed'};
  if(reply.status==='ok'){
   const r=reply.result,roots=[r.state,...(r.alternatives||[])].filter(Boolean);
   if(['satp','satt'].includes(mode))entry.status=matches(r.saturation,q)?'matched':'failed';
   else if(r.ambiguous)entry.status=matches(r.saturation,q)?'ambiguous':'failed';
   else if(entry.expected.every(expected=>roots.some(state=>matches(state,expected))))entry.status='matched';
   else if(entry.expected.length===1){
    const state=roots.find(state=>Math.abs(state.T-q.T)<=3e-4&&Number.isFinite(state.inputSensitivity?.numericalResponse?.p)&&Math.abs(state.p-q.p)<=4*state.inputSensitivity.numericalResponse.p);
    if(state){entry.status='conditioned';entry.conditioning={pressureDeviation:state.p-q.p,numericalPressureResponse:state.inputSensitivity.numericalResponse.p,explanation:'Independent pressure lies inside the local propagated floating-point input floor; input residuals passed adapter diagnostics. This is not a physical error bound.'};}
   }
  }
  report.counts[entry.status]++;report.cases.push(entry);
  if(entry.status==='failed')console.log('FAIL',c.id,mode,reply.error?.message??JSON.stringify(reply.result.state));
 }
 console.log('Checked',c.id);
}
report.status=report.counts.failed?'failed':report.counts.conditioned?'passed-with-conditioning-limits':'passed';
const output=process.argv[2]??'.release/heos-m2/matrix.json';
await mkdir(new URL('./',new URL(output,root)),{recursive:true});await writeFile(new URL(output,root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,cases:report.cases.length,counts:report.counts,output}));process.exitCode=report.counts.failed?1:0;
