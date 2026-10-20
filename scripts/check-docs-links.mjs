// Validate repository-local Markdown targets without network access or packages.
import {readdir,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
async function markdownFiles(dir){
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...await markdownFiles(file));
  else if(entry.name.endsWith('.md'))files.push(file);
 }
 return files;
}
const rootFiles=(await readdir(root,{withFileTypes:true})).filter(entry=>entry.isFile()&&entry.name.endsWith('.md')).map(entry=>path.join(root,entry.name));
const documents=[...rootFiles,...await markdownFiles(path.join(root,'docs'))];
let checked=0,failed=0;
for(const file of documents){
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)){
  const target=match[1].replace(/^<|>$/g,'');
  if(/^[a-z][a-z\d+.-]*:|^\/\//i.test(target)||target.startsWith('#'))continue;
  const pathname=target.split(/[?#]/)[0];if(!pathname)continue;
  checked++;
  try{await access(path.resolve(path.dirname(file),decodeURIComponent(pathname)));}
  catch{failed++;console.error(path.relative(root,file)+': missing local target '+target);}
 }
}
console.log(`Documentation: ${documents.length} Markdown files, ${checked} local links, ${failed} missing targets. External URLs and fragments are not checked.`);
process.exitCode=failed?1:0;
