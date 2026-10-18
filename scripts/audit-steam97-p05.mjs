// Independent P05 forward/validity checks and phase-certified inverse roots.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assessAllRoots} from './inverse-precision-common.mjs';
const engine=resolve(process.env.P05_ENGINE||'src/engine.js');
const {initialize,calculate}=await import(pathToFileURL(engine));
await initialize(await readFile(resolve(dirname(engine),'../vendor/seuif97_bg.wasm')));
const fixture=await readFile('tests/fixtures/steam97-p05-reference.json');
const ref=JSON.parse(fixture),policy=ref.policy,records=[],maxima={};
const sha=b=>createHash('sha256').update(b).digest('hex');
const attempt=(id,kind,run)=>{const row={id,kind};try{Object.assign(row,run());}catch(e){row.passed=false;row.error=e.message;}records.push(row);};
for(const c of ref.records)attempt(c.id,'forward',()=>{
 const e=c.expected,q=calculate('pt',e.p,e.T,c.model).state;
 const checks=Object.entries(policy.forward_absolute).map(([key,absolute])=>{
  const actual=q[key]??null,wanted=c.available[key]===false?null:e[key],error=wanted==null?null:Math.abs(actual-wanted),tolerance=wanted==null?null:Math.max(absolute,Math.abs(wanted)*policy.forward_relative);
  const passed=wanted==null?actual===null:actual!==null&&Number.isFinite(actual)&&error<=tolerance;
  if(actual!==null&&wanted!==null){const relative=error/Math.max(Math.abs(wanted),1e-20);if(!maxima[key]||relative>maxima[key].relative)maxima[key]={id:c.id,relative,error,tolerance};}
  return {key,actual,expected:wanted,error,tolerance,passed};
 });
 const availability=Object.entries(c.available).map(([key,available])=>({key,available,passed:(q[key]!=null)===available}));
 return {p:e.p,T:e.T,passed:checks.every(c=>c.passed)&&availability.every(c=>c.passed),checks,availability};
});
for(const [i,c]of ref.domain_probes.entries())attempt('domain-'+i,'domain',()=>{
 let accepted=false,error;try{accepted=!!calculate('pt',c.p,c.T,'IAPWS-95').state;}catch(e){error=e.message;}
 return {...c,error,actualAccepted:accepted,passed:accepted===c.accepted};
});
const selected=[200,1,.1,20,100,208.566,300,350.1,632.4,1000].map(p=>ref.records.find(c=>c.expected.p===p&&c.expected.T<355));
for(const c of selected){
 for(const mode of ['ph','ps','pu','pv','prho','th','ts','tu','tv','trho','hs','us','vs','hv','uv'])attempt(c.id+'-'+mode,'inverse',()=>{
  const keys={prho:['p','rho'],trho:['T','rho']}[mode]??[...mode].map(k=>k==='t'?'T':k),e=c.expected;
  const r=calculate(mode,...keys.map(k=>e[k]),c.model),roots=[r.state,...(r.alternatives||[])].filter(Boolean);
  const rootChecks=assessAllRoots(r,keys.map(k=>e[k]),keys);
  const found=roots.some(q=>Math.abs(q.p-e.p)<=policy.inverse_pressure_absolute&&Math.abs(q.T-e.T)<=policy.inverse_temperature_absolute);
  return {mode,p:e.p,T:e.T,found,rootChecks,passed:found&&rootChecks.length>0&&rootChecks.every(r=>r.valid)};
 });
}
const count=rows=>({total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length});
const summary={...count(records),byKind:Object.fromEntries(['forward','domain','inverse'].map(k=>[k,count(records.filter(r=>r.kind===k))]))};
const sources=Object.fromEntries(await Promise.all((await readdir(dirname(engine))).filter(p=>p.endsWith('.js')).sort().map(async p=>[p,sha(await readFile(resolve(dirname(engine),p)))])));
const report={runtime:process.version,engine,reference_sha256:sha(fixture),policy,sources,summary,maxima,records};
const folder=process.env.P05_DIR||'.release/steam97-p05';await mkdir(folder,{recursive:true});await writeFile(`${folder}/${process.env.P05_NAME||'numeric'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary,maxima,failures:records.filter(r=>!r.passed)},null,2));process.exitCode=summary.failed?1:0;
