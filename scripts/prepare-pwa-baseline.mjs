// Extract immutable release bytes from local Git without checking out or resetting files.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const [revision,folder]=process.argv.slice(2);
assert.ok(/^[a-f0-9]{40}$/.test(revision||'')&&folder,'Usage: node scripts/prepare-pwa-baseline.mjs <full-commit-sha> <new-output-directory>');
const root=process.cwd(),output=path.resolve(folder);
try{await stat(output);throw Error('Output already exists; choose a new directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
const git=file=>execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'show',revision+':'+file],{cwd:root,maxBuffer:64*1024**2,windowsHide:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const sw=git('service-worker.js'),text=sw.toString(),parse=name=>JSON.parse(text.match(new RegExp('const '+name+'=(.*?);'))?.[1]||'null');
const build=parse('BUILD'),resources=parse('RESOURCES'),digests=parse('DIGESTS');
assert.ok(build?.id&&Array.isArray(resources)&&digests,'Unsupported baseline service-worker manifest');
const files=new Map([['service-worker.js',sw]]);
for(const resource of resources){const file=resource.split('?')[0],bytes=git(file);assert.equal(hash(bytes),digests[resource],resource);files.set(file,bytes);}
const optional=JSON.parse(files.get('assets/python-package.json').toString());
for(const file of optional.files){const bytes=git(file.url);assert.equal(bytes.length,file.bytes,file.url);assert.equal(hash(bytes),file.sha256,file.url);files.set(file.url,bytes);}
assert.deepEqual(JSON.parse(files.get('assets/app.js').toString().match(/const APP_BUILD = ([^\n]+);/)[1]),build);
await mkdir(output,{recursive:true});
const manifest={sourceCommit:revision,build,verification:'Every core resource matches the historical Service Worker digest; every optional file matches the historical Python package manifest. Extracted from local Git; no network or working-tree modifications.',files:{}};
for(const [file,bytes] of files){const target=path.resolve(output,file);assert.ok(target.startsWith(output+path.sep));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);assert.equal(hash(await readFile(target)),hash(bytes));manifest.files[file]={bytes:bytes.length,sha256:hash(bytes)};}
await writeFile(path.join(output,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,build,files:files.size,sourceCommit:revision}));
