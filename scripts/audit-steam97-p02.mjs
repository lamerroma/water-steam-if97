// P01 replay + independent 70/90-digit critical grid. Original fixtures and
// acceptance thresholds remain untouched; baseline failures stay reproducible.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {assess,assessAllRoots} from './inverse-precision-common.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(!isMainThread){
 const {initialize,calculate}=await import(pathToFileURL(resolve(workerData.engine)));
 await initialize(await readFile(resolve(dirname(workerData.engine),'../vendor/seuif97_bg.wasm')));
 const policy=workerData.policy,records=[];
 for(const {c,mode,group} of workerData.tasks){
  const keys=[...mode].map(k=>k==='t'?'T':k),inputs=keys.map(k=>c.expected[k]),row={id:c.id,model:c.model,mode,group};
  try{
   const result=calculate(mode,...inputs,c.model);
   if(['pt','px','tx'].includes(mode)){
    row.checks=Object.entries(c.expected).filter(([key])=>key in policy.forward_absolute).map(([key,value])=>{
     const actual=result.state?.[key],tolerance=Math.max(policy.forward_absolute[key],Math.abs(value)*policy.forward_relative),error=Math.abs(actual-value);
     return {key,actual:actual??null,expected:value,error:Number.isFinite(error)?error:null,tolerance,passed:actual!=null&&Number.isFinite(error)&&error<=tolerance};
    });row.passed=row.checks.every(c=>c.passed);
   }else{
    row.assessment=assess(result,c,keys);row.rootChecks=assessAllRoots(result,inputs,keys);
    row.passed=row.assessment.status==='passed'&&row.rootChecks.every(r=>r.valid);
   }
  }catch(error){row.passed=false;row.error=error.message;}
  records.push(row);
 }parentPort.postMessage(records);
}else{
 const p01=JSON.parse(await readFile('docs/steam97-p01/pilot-reference.json')),dense=JSON.parse(await readFile('tests/fixtures/steam97-p02-reference.json'));
 const policy=JSON.parse(await readFile('docs/steam97-p01/pilot-policy.json')),engine=resolve(process.env.P02_ENGINE||'src/engine.js');
 const tasks=[...p01.cases.map(c=>({c,group:'P01'})),...dense.records.map(c=>({c,group:'P02-dense'}))].flatMap(({c,group})=>c.modes.map(mode=>({c,mode,group})));
 const records=(await Promise.all(Array.from({length:4},(_,i)=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url),{workerData:{engine,policy,tasks:tasks.filter((_,j)=>j%4===i)}});
  w.on('message',resolve);w.on('error',reject);w.on('exit',code=>{if(code)reject(Error('Audit worker exit '+code));});
 })))).flat().sort((a,b)=>a.id.localeCompare(b.id)||a.mode.localeCompare(b.mode));
 const count=rows=>({queries:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length});
 const summary={...count(records),groups:Object.fromEntries(['P01','P02-dense'].map(g=>[g,count(records.filter(r=>r.group===g))])),byModel:Object.fromEntries(['IF97','IAPWS-95'].map(m=>[m,count(records.filter(r=>r.model===m))]))};
 const sources=Object.fromEntries(await Promise.all((await readdir(dirname(engine))).filter(p=>p.endsWith('.js')).sort().map(async p=>[p,sha(await readFile(resolve(dirname(engine),p)))])));
 const report={runtime:{node:process.version,v8:process.versions.v8},engine,policy_sha256:sha(await readFile('docs/steam97-p01/pilot-policy.json')),reference_sha256:{P01:sha(await readFile('docs/steam97-p01/pilot-reference.json')),dense:sha(await readFile('tests/fixtures/steam97-p02-reference.json'))},sources,summary,records};
 const folder=process.env.P02_DIR||'.release/steam97-p02',name=process.env.P02_NAME||'current';await mkdir(folder,{recursive:true});await writeFile(`${folder}/${name}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({name,summary,failures:records.filter(r=>!r.passed).map(({id,model,mode,error})=>({id,model,mode,error}))},null,2));process.exitCode=summary.failed?1:0;
}
