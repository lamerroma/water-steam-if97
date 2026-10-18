// Validate immutable references/source bytes and summarize matched comparisons.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='.release/inverse-precision',json=async p=>JSON.parse(await readFile(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const fixtureBytes=await readFile('tests/fixtures/inverse-precision-reference.json'),fixture=JSON.parse(fixtureBytes),beforeRaw=await json(dir+'/before-final.json'),afterRaw=await json(dir+'/after-final.json');
const expectedTasks=fixture.records.flatMap(c=>c.modes.map(mode=>({c,mode}))),id=r=>r.id+':'+r.mode;
const validate=(report,tasks)=>{
 const map=new Map(report.records.map(r=>[id(r),r]));assert.equal(map.size,tasks.length);
 assert.equal(report.fixtureSha256,sha(fixtureBytes));
 return tasks.map(({c,mode})=>{const r=map.get(c.id+':'+mode);assert.ok(r,'Missing '+c.id+':'+mode);assert.deepEqual(r.expected,c.expected,'Stale reference '+id(r));return r;});
};
const baselineTasks=expectedTasks.filter(({c,mode})=>!(c.group==='mixture'&&['us','vs','hv','uv'].includes(mode)));
const before=validate(beforeRaw,baselineTasks);let after=validate(afterRaw,expectedTasks),sourceManifest=afterRaw.sourceManifest,composition='Single full candidate audit';
const changed=[];for(const [file,hash]of Object.entries(sourceManifest))if(sha(await readFile('src/'+file))!==hash)changed.push(file);
if(changed.length){
 // The final change tightens only IF97 h/u stopping. Replay every IF97 query;
 // IAPWS-95 uses its own inverses and unchanged shared dispatch/dependencies.
 assert.deepEqual(changed,['engine.js']);
 const engine=await readFile('src/engine.js','utf8');assert.equal(sha(engine.replace("key==='s'?2e-11:2e-10","key==='s'?2e-11:2e-8")),sourceManifest['engine.js']);
 const replacement=await json(dir+'/after-if97-final.json'),rows=validate(replacement,expectedTasks.filter(({c})=>c.model==='IF97')),map=new Map(rows.map(r=>[id(r),r]));
 after=after.map(r=>r.model==='IF97'?map.get(id(r)):r);sourceManifest=replacement.sourceManifest;
 composition='Full IAPWS-95 audit plus full IF97 replay after tightening h/u residual; only the IF97 stopping constant differs (byte-verified).';
}
for(const[file,hash]of Object.entries(sourceManifest))assert.equal(sha(await readFile('src/'+file)),hash,file);
const comparisonIds=new Set(before.map(id)),afterMatched=after.filter(r=>comparisonIds.has(id(r)));
const counts=rows=>({queries:rows.length,passed:rows.filter(r=>r.status==='passed').length,different:rows.filter(r=>r.status==='different').length,failed:rows.filter(r=>r.status==='failed').length});
function summary(rows){return{states:new Set(rows.map(r=>r.id)).size,...counts(rows),byModel:Object.fromEntries(['IF97','IAPWS-95'].map(m=>[m,counts(rows.filter(r=>r.model===m))])),byMode:Object.fromEntries(Object.keys(fixture.modes).map(m=>[m,counts(rows.filter(r=>r.mode===m))])),maxErrors:Object.fromEntries(['p','T','rhoRelative'].map(k=>[k,Math.max(...rows.map(r=>r.errors?.[k]||0))]))};}
const report={status:after.every(r=>r.status==='passed')?'passed':'needs-review',version:'1.35.3',fixtureSha256:afterRaw.fixtureSha256,sourceManifest,composition,before:summary(before),after:summary(after),afterMatched:summary(afterMatched),comparisonScope:'4441 matched requests across all 2200 states and 15 modes. The additional 216 compound mixture us/vs/hv/uv requests are checked against independent references in the candidate only; the legacy run is expensive.',reference:fixture.source,crossChecks:fixture.crossChecks.length};
await mkdir('docs/inverse-precision',{recursive:true});
for(const[name,rows]of [['before',before],['after',after]]){
 await writeFile(`${dir}/${name}-validated.json`,JSON.stringify({summary:summary(rows),records:rows},null,2)+'\n');
 const csv=[['id','model','group','mode','status','p_error_MPa','T_error_K','rho_relative','roots','message'],...rows.map(r=>[r.id,r.model,r.group,r.mode,r.status,r.errors?.p,r.errors?.T,r.errors?.rhoRelative,r.roots,r.error])].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
 await writeFile(`docs/inverse-precision/${name}.csv`,csv+'\n');
}
await writeFile('docs/inverse-precision/summary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='passed'?0:1;
