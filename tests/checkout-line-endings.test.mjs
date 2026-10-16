import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('autocrlf checkout preserves hashed text and binary release inputs',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'if97-checkout-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']});
 try{
  git('init','--quiet');git('config','core.autocrlf','true');
  const files=['.gitattributes','vendor/seuif97.js','vendor/SHA256.json','src/equations.js','assets/calculator-worker.js','vendor/seuif97_bg.wasm'];
  const expected=new Map();
  for(const file of files){const bytes=await readFile(new URL('../'+file,import.meta.url));expected.set(file,bytes);await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),bytes);}
  git('add','--',...files);await mkdir(path.join(root,'checkout'));
  git('checkout-index','--all','--prefix='+path.join(root,'checkout')+path.sep);
  for(const [file,bytes]of expected)assert.deepEqual(await readFile(path.join(root,'checkout',file)),bytes,file);
 }finally{await rm(root,{recursive:true,force:true});}
});
