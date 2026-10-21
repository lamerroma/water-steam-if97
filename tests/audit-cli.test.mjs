import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('Inverse audit CLI executes real cases and creates its report on native paths',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),folder=await mkdtemp(path.join(tmpdir(),'thermo-inverse-cli-'));
 try{
  const run=spawnSync(process.execPath,[path.join(root,'scripts/audit-inverse-precision.mjs'),'--quick'],{
   cwd:root,encoding:'utf8',timeout:30000,
   env:{...process.env,INVERSE_DIR:folder,INVERSE_FILTER:'IF97-0000',INVERSE_WORKERS:'1',INVERSE_NAME:'entrypoint',INVERSE_ENGINE:'src/engine.js'}
  });
  assert.equal(run.status,0,run.stderr||run.stdout);
  const report=JSON.parse(await readFile(path.join(folder,'entrypoint.json'),'utf8'));
  assert.ok(report.summary.queries>0,'exit 0 without executed cases is not acceptance');
  assert.equal(report.summary.failed,0);assert.equal(report.summary.different,0);
  assert.equal(report.records.length,report.summary.queries);
  assert.ok(report.records.every(r=>r.id==='IF97-0000'&&r.status==='passed'));
 }finally{
  // mkdtemp returns a fresh child of this known test temp directory.
  const parent=path.resolve(tmpdir());assert.equal(path.dirname(path.resolve(folder)),parent);
  assert.ok(path.basename(folder).startsWith('thermo-inverse-cli-'));
  await rm(folder,{recursive:true,force:true});
 }
});
