// Diagnostic only: timing cannot be used as a physical accuracy guarantee.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';import os from 'node:os';import {performance} from 'node:perf_hooks';
import {initialize,calculate} from '../src/engine.js';import {pt,ph,ps,hs} from '../vendor/seuif97.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const points=[[3,300],[3,500],[.1,500],[3,700],[20,640],[25,650],[25,700],[20,900],[30,1500]].map(([p,T])=>calculate('pt',p,T).state);
const jobs=[['IF97 JS PT',q=>calculate('pt',q.p,q.T)],['IF97 JS PH refined',q=>calculate('ph',q.p,q.h)],['IF97 JS PS refined',q=>calculate('ps',q.p,q.s)],['IF97 JS HS refined',q=>calculate('hs',q.h,q.s)],['SEUIF97 WASM PT density',q=>pt(q.p,q.T-273.15,2)],['SEUIF97 WASM PH temperature',q=>ph(q.p,q.h,1)],['SEUIF97 WASM PS temperature',q=>ps(q.p,q.s,1)],['SEUIF97 WASM HS pressure',q=>hs(q.h,q.s,0)]];
const baselineRef=process.argv[3];if(baselineRef){
 const root=new URL('../',import.meta.url),file=new URL('src/engine.js',root);
 let source=execFileSync('git',['show',baselineRef+':src/engine.js'],{cwd:root,encoding:'utf8'});
 source=source.replace(/(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,path)=>quote+new URL(path,file).href+quote);
 const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const mode of ['ph','ps','hs'])jobs.push(['Baseline '+baselineRef+' JS '+mode.toUpperCase(),q=>old.calculate(mode,mode==='hs'?q.h:q.p,mode==='ps'||mode==='hs'?q.s:q.h)]);
}
const results=[];for(const [name,fn] of jobs){for(const q of points)fn(q);const samples=[];for(let k=0;k<7;k++){const start=performance.now();for(let j=0;j<30;j++)for(const q of points)fn(q);samples.push((performance.now()-start)/(30*points.length));}samples.sort((a,b)=>a-b);results.push({name,medianMillisecondsPerState:samples[3],statesPerSecond:1000/samples[3]});}
const result={date:new Date().toISOString(),node:process.version,cpu:os.cpus()[0]?.model,baselineRef:baselineRef||null,pointCount:points.length,notes:['Includes regions 1, 2, 3 and 5. Each median: 7 runs × 270 calls.','WASM returns one property; JS returns a decorated state and validates/refines roots. These are different workloads.','Region 5 HS may use fallback. This microbenchmark does not predict browser diagram latency.'],results};
console.log(JSON.stringify(result,null,2));if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
