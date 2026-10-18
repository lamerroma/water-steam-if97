// Affected existing workflows and real service-worker lifecycle, on one build.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='.release/steam97-p06';await mkdir(dir,{recursive:true});
const report={build:JSON.parse((await readFile('dist/assets/app.js','utf8')).match(/const APP_BUILD = ([^\n]+);/)[1]),checks:[]};
for(const [name,script,env]of [
 ['processes-extended','processes-extended',{}],['water-process','water-process',{}],
 ['ui-workspace','ui-workspace',{}],['project-safety','project-safety',{}],
 ['cross-browser','cross-browser',{UI_EVIDENCE_DIR:dir+'/ui'}],
 ['pwa-chromium','pwa',{BROWSER_NAME:'chromium'}],['pwa-firefox','pwa',{BROWSER_NAME:'firefox'}]
]){
 const log=`${dir}/${name}.log`,file=await open(log,'w');let code;const start=Date.now();
 try{code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`scripts/check-${script}${script==='cross-browser'?'':'-browser'}.cjs`],{env:{...process.env,...env},stdio:['ignore',file.fd,file.fd]});const timer=setTimeout(()=>child.kill('SIGTERM'),600000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',c=>{clearTimeout(timer);resolve(c);});});}finally{await file.close();}
 const bytes=await readFile(log);report.checks.push({name,status:code===0?'passed':'failed',exitCode:code,durationMs:Date.now()-start,log,sha256:createHash('sha256').update(bytes).digest('hex')});
 report.status=report.checks.every(c=>c.status==='passed')?'passed':'failed';await writeFile(dir+'/regression.json',JSON.stringify(report,null,2)+'\n');console.log(name,code===0?'PASS':'FAIL');
 if(code!==0){console.error(bytes.toString().slice(-4000));process.exitCode=1;break;}
}
