import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {runP06,assessP06} from './steam97-p06-common.mjs';
const source=resolve(process.env.P06_SOURCE||'src'),sha=b=>createHash('sha256').update(b).digest('hex');
const {initialize}=await import(pathToFileURL(source+'/engine.js')),api=await import(pathToFileURL(source+'/processes.js'));
await initialize(await readFile(resolve(dirname(source),'vendor/seuif97_bg.wasm')));
const bytes=await readFile('tests/fixtures/steam97-p06-reference.json'),ref=JSON.parse(bytes),records=[];
for(const c of ref.records)for(const mode of c.modes){const row={id:c.id,model:c.model,kind:c.kind,mode};
 try{Object.assign(row,assessP06(runP06(c,mode,api),c,ref.policy));}catch(e){row.passed=false;row.error=e.message;}records.push(row);
}
const summary={queries:records.length,passed:records.filter(r=>r.passed).length,failed:records.filter(r=>!r.passed).length};
const sources=Object.fromEntries(await Promise.all((await readdir(source)).filter(p=>p.endsWith('.js')).sort().map(async p=>[p,sha(await readFile(source+'/'+p))])));
const folder=process.env.P06_DIR||'.release/steam97-p06';await mkdir(folder,{recursive:true});
await writeFile(`${folder}/${process.env.P06_NAME||'numeric'}.json`,JSON.stringify({runtime:process.version,source,reference_sha256:sha(bytes),policy:ref.policy,sources,summary,records},null,2)+'\n');
console.log(JSON.stringify({summary,failures:records.filter(r=>!r.passed)},null,2));process.exitCode=summary.failed?1:0;
