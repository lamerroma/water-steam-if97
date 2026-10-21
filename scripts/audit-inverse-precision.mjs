// Same-EOS independent references; alternatives count as distinct valid roots.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
const folder=process.env.INVERSE_DIR||'.release/inverse-precision';
import {assess,assessAllRoots} from './inverse-precision-common.mjs';
import {inverseAuditTasks} from './inverse-audit-selection.mjs';

if(!isMainThread){
 const engine=await import(pathToFileURL(resolve(workerData.engine)));await engine.initialize(await readFile('vendor/seuif97_bg.wasm'));
 const rows=[];for(const {c,mode,keys} of workerData.tasks){const start=performance.now(),row={id:c.id,model:c.model,group:c.group,mode,expected:c.expected};
  try{const result=engine.calculate(mode,c.expected[keys[0]],c.expected[keys[1]],c.model);Object.assign(row,assess(result,c,keys));row.rootChecks=assessAllRoots(result,keys.map(k=>c.expected[k]),keys);if(row.rootChecks.some(q=>!q.valid))row.status='different';row.rootDiagnostics=result.diagnostics;}catch(e){row.status='failed';row.error=e.message;}
  row.durationMs=performance.now()-start;rows.push(row);if(row.status!=='passed')parentPort.postMessage({failure:{id:row.id,mode,status:row.status,error:row.error,errors:row.errors}});if(rows.length%25===0)parentPort.postMessage({progress:25});
 }parentPort.postMessage({rows});
}else if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
 const fixture=JSON.parse(await readFile('tests/fixtures/inverse-precision-reference.json')),engine=process.env.INVERSE_ENGINE||'src/engine.js',name=process.env.INVERSE_NAME||(process.argv.includes('--quick')?'quick':'full'),tasks=inverseAuditTasks(fixture,process.argv.includes('--quick')).filter(t=>(!process.env.INVERSE_FILTER||[t.c.id,t.c.group,t.mode,t.c.model].join(' ').includes(process.env.INVERSE_FILTER))&&!(process.env.INVERSE_SKIP_MIXTURE_PAIRS==='1'&&t.c.group==='mixture'&&['us','vs','hv','uv'].includes(t.mode)));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),sourceDir=resolve(engine,'..'),sourceManifest=Object.fromEntries(await Promise.all((await readdir(sourceDir)).filter(f=>f.endsWith('.js')).sort().map(async f=>[f,sha(await readFile(resolve(sourceDir,f)))]))),fixtureSha256=sha(await readFile('tests/fixtures/inverse-precision-reference.json'));
 const n=Number(process.env.INVERSE_WORKERS||4);if(!Number.isInteger(n)||n<1||n>16||!tasks.length)throw Error('Audit requires nonempty tasks and 1–16 workers.');let done=0;const start=Date.now();
 const groups=await Promise.all(Array.from({length:n},(_,i)=>new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{engine,tasks:tasks.filter((_,j)=>j%n===i)}});w.on('message',m=>{if(m.failure)console.log('Issue',JSON.stringify(m.failure));else if(m.progress){done+=m.progress;if(done%250===0)console.log(`${name}: ${done}/${tasks.length}, ${((Date.now()-start)/1000).toFixed(0)}s`);}else resolve(m.rows);});w.on('error',reject);w.on('exit',code=>{if(code)reject(Error('Worker exit '+code));});})));
 const rows=groups.flat().sort((a,b)=>a.id.localeCompare(b.id)||a.mode.localeCompare(b.mode)),counts=rows=>({queries:rows.length,passed:rows.filter(r=>r.status==='passed').length,different:rows.filter(r=>r.status==='different').length,failed:rows.filter(r=>r.status==='failed').length});
 const summary={complete:rows.length===inverseAuditTasks(fixture).length,profile:process.argv.includes('--quick')?'quick':'full',states:new Set(rows.map(r=>r.id)).size,...counts(rows),byModel:Object.fromEntries(['IF97','IAPWS-95'].map(m=>[m,counts(rows.filter(r=>r.model===m))])),byMode:Object.fromEntries(Object.keys(fixture.modes).map(m=>[m,counts(rows.filter(r=>r.mode===m))])),durationMs:Date.now()-start};
 await mkdir(folder,{recursive:true});await writeFile(`${folder}/${name}.json`,JSON.stringify({runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},engine,sourceManifest,fixtureSha256,summary,records:rows},null,2)+'\n');
 const csv=[['id','model','group','mode','status','p_error_MPa','T_error_K','rho_relative','message'],...rows.map(r=>[r.id,r.model,r.group,r.mode,r.status,r.errors?.p,r.errors?.T,r.errors?.rhoRelative,r.error])].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');await writeFile(`${folder}/${name}.csv`,csv+'\n');
 console.log(JSON.stringify({summary,failures:rows.filter(r=>r.status!=='passed').slice(0,30)},null,2));process.exitCode=summary.different||summary.failed?1:0;
}
