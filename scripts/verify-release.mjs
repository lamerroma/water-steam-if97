// Sequential acceptance checks against one build; no external reference downloads.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,stat,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const flags=new Set(process.argv.slice(2));
if([...flags].some(f=>!['--core','--browser-only'].includes(f))||(flags.has('--core')&&flags.has('--browser-only'))){
 console.error('Usage: node scripts/verify-release.mjs [--core | --browser-only]');process.exit(2);
}
const mode=flags.has('--core')?'core':flags.has('--browser-only')?'browser':'full';
const dir=path.join(root,'.release',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(dir,{recursive:true});
const report={started:new Date().toISOString(),mode,version:JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,build:null,status:'running',checks:[],artifacts:{},scope:'Software acceptance only; passing does not validate every physical model or device.'};
let server;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshot=async()=>Object.fromEntries(await Promise.all(['index.html','assets/app.js','assets/calculator-worker.js','assets/heos-calculator-worker.js','assets/python-worker.js','assets/python-package.json','assets/sheetjs.js','assets/styles.css','assets/coolprop.wasm','service-worker.js','manifest.webmanifest'].map(async p=>[p,hash(await readFile(path.join(root,p)))])));
async function check(name,args,env={},executable=process.execPath){
 const start=Date.now();console.log(`Starting ${name}`);
 const log=path.join(dir,name+'.log'),logFile=await open(log,'w');
 let code;
 try{code=await new Promise((resolve,reject)=>{
  // Stream directly to the durable log. This keeps long test output visible
  // during execution and avoids losing all diagnostics if a pipe is closed.
  const child=spawn(executable,args,{cwd:root,env:{...process.env,...env},stdio:['ignore',logFile.fd,logFile.fd]});
  const timeout=setTimeout(()=>child.kill('SIGTERM'),600000);
  child.once('error',e=>{clearTimeout(timeout);reject(e);});child.once('close',c=>{clearTimeout(timeout);resolve(c);});
 });}finally{await logFile.close();}
 const output=await readFile(log,'utf8');
 report.checks.push({name,status:code===0?'passed':'failed',exitCode:code,durationMs:Date.now()-start,log:path.relative(root,log)});
 console.log(`${code===0?'PASS':'FAIL'} ${name} (${((Date.now()-start)/1000).toFixed(1)} s)`);
 if(code!==0)console.error(output.slice(-2500));
 await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 return code===0;
}
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.webmanifest':'application/manifest+json'};
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const url=`http://127.0.0.1:${server.address().port}/`;
 return {CALCULATOR_URL:url,DIAGRAM_URL:url};
}
try{
 if(!await check('build',['scripts/build.mjs']))throw Error('Build failed; dependent checks skipped.');
 report.build=JSON.parse((await readFile(path.join(root,'assets/app.js'),'utf8')).match(/const APP_BUILD = ([^\n]+);/)[1]);
 await check('documentation',['scripts/check-docs-links.mjs']);
 await check('library-registry',['scripts/check-library-registry.mjs']);
 await check('library-recipes',['scripts/check-library-recipes.mjs']);
 const initial=await snapshot();
 if(mode!=='browser'){
  await check('fluids-pipe-reference',['scripts/reference-fluids-pipe.py','--check'],{},process.env.REACTOR_PYTHON||'python3');
  await check('unit',['--test',...(await readdir(path.join(root,'tests'))).filter(p=>p.endsWith('.test.mjs')).sort().map(p=>'tests/'+p)]);
  await check('water',['scripts/water-conformance.mjs',path.join(dir,'water.json')]);
  await check('water-heos',['scripts/audit-water-heos.mjs',path.relative(root,path.join(dir,'water-heos.json'))]);
  await check('transport',['scripts/transport-conformance.mjs',path.join(dir,'transport.json')]);
  await check('steam97-p09-units',['scripts/audit-steam97-p09-units.mjs']);
  await check('steam97-p03',['scripts/audit-steam97-p03.mjs']);await check('steam97-p04',['scripts/audit-steam97-p04.mjs']);
  await check('reactor',['scripts/verify-reactor-reference.mjs']);
  await check('reactor-thermal',['scripts/verify-reactor-thermal.mjs']);
  await check('reactor-validation',['scripts/audit-reactor-validation.mjs']);
  if(await check('reactor-cell-audit',['scripts/reactor-cell-benchmark.mjs'])){
   const cell=JSON.parse(await readFile(path.join(dir,'reactor-cell-audit.log'),'utf8'));
   report.physicalValidation={reactorCell:cell.status,scope:'Independent cell screening; failure blocks claims of neutron-model physical validation, separately from software acceptance.'};
  }
 }
 if(mode!=='core'){
  if(mode==='browser'){await check('steam97-p09-units',['scripts/audit-steam97-p09-units.mjs']);await check('steam97-p03',['scripts/audit-steam97-p03.mjs']);await check('steam97-p04',['scripts/audit-steam97-p04.mjs']);}
  const env=await serve();
  // Fail early on the two release-blocking legacy regressions.
  for(const browser of ['chromium','firefox']){
   if(!await check('browser-legacy-project-'+browser,['scripts/check-legacy-project-browser.cjs'],{...env,BROWSER_NAME:browser,LEGACY_PROJECT_EVIDENCE:path.join(dir,'legacy-project',browser)}))throw Error('Legacy regression check failed; remaining browser checks skipped.');
   if(!await check('browser-diagram-navigation-'+browser,['scripts/check-diagram-navigation-browser.cjs'],{...env,BROWSER_NAME:browser,DIAGRAM_NAV_EVIDENCE:path.join(dir,'diagram-navigation',browser)}))throw Error('Legacy regression check failed; remaining browser checks skipped.');
  }
  for(const name of ['steam97-p04','steam97-p03','steam97-p09-units','steam97-p08','steam97-p07','steam97-p06','steam97-p05','steam97-p02','input-sensitivity','inverse-boundaries','rankine-sweep','rankine-regeneration','rankine-efficiency','rankine-library','cycle-library','custom-cycle','processes-extended','water-process','calculator-async','navigation','smart-input','calculator-workspace','state-comparison','study-workflow','task-ui','diagram','diagram-guides','diagram-quality','process-paths','chart-layout','study-workspace','hydraulics','study','full-sprint','laboratory','coursework','usability','reactor-course','reactor-validation','provenance','project-safety','pwa','pwa-package','lazy-assets','python-libraries','fluids-pipe','ui-workspace'])await check('browser-'+name,[`scripts/check-${name}-browser.cjs`],env);
  await check('browser-cross-browser',['scripts/check-cross-browser.cjs'],{...env,UI_EVIDENCE_DIR:path.join(dir,'ui')});
  for(const browser of ['chromium','firefox']){
   await check('browser-library-recipes-'+browser,['scripts/check-library-recipes-browser.cjs'],{...env,BROWSER_NAME:browser,LIBRARY_RECIPES_EVIDENCE:path.join(dir,'library-recipes',browser)});
   await check('browser-library-registry-'+browser,['scripts/check-library-registry-browser.cjs'],{...env,BROWSER_NAME:browser,LIBRARY_REGISTRY_EVIDENCE:path.join(dir,'library-registry',browser)});
   await check('browser-water-heos-'+browser,['scripts/check-water-heos-browser.cjs'],{...env,BROWSER_NAME:browser});
   await check('browser-water-heos-workspace-'+browser,['scripts/check-water-heos-workspace-browser.cjs'],{...env,BROWSER_NAME:browser,HEOS_WORKSPACE_EVIDENCE:path.join(dir,'heos-workspace',browser)});
   await check('browser-water-heos-fault-'+browser,['scripts/check-water-heos-fault-browser.cjs'],{...env,BROWSER_NAME:browser,HEOS_FAULT_EVIDENCE:path.join(dir,'heos-fault',browser)});
   await check('browser-steam-process-worker-'+browser,['scripts/check-steam-process-worker-browser.cjs'],{...env,BROWSER_NAME:browser,STEAM_PROCESS_OFFLINE:'1',STEAM_PROCESS_EVIDENCE:path.join(dir,'steam-process',browser)});
   await check('browser-auxiliary-worker-'+browser,['scripts/check-auxiliary-worker-browser.cjs'],{...env,BROWSER_NAME:browser,AUXILIARY_OFFLINE:'1',AUXILIARY_EVIDENCE:path.join(dir,'auxiliary',browser)});
  }
  for(const name of ['steam97-p04','steam97-p03','steam97-p09-units','steam97-p08','steam97-p07','steam97-p06','steam97-p05','steam97-p02','input-sensitivity','inverse-boundaries','rankine-sweep','rankine-regeneration','rankine-efficiency','rankine-library','cycle-library','custom-cycle','processes-extended','water-process','calculator-async','calculator-workspace','smart-input','state-comparison','study-workflow','pwa','pwa-package','lazy-assets','python-libraries','fluids-pipe'])await check('browser-'+name+'-firefox',[`scripts/check-${name}-browser.cjs`],{...env,BROWSER_NAME:'firefox'});
 }
 if(await check('rebuild',['scripts/build.mjs'])){
  const repeated=await snapshot();const same=JSON.stringify(initial)===JSON.stringify(repeated);
  report.checks.push({name:'deterministic-build',status:same?'passed':'failed'});
  report.artifacts=repeated;
 }
 if(mode!=='browser'&&await check('package',['scripts/package-release.mjs'])){
  const zip='dist/water-steam-calculator.zip';report.artifacts[zip]={sha256:hash(await readFile(path.join(root,zip))),bytes:(await stat(path.join(root,zip))).size};
  await check('package-integrity',['scripts/verify-package.py'],{},process.env.REACTOR_PYTHON||'python3');
  if(await check('repackage',['scripts/package-release.mjs']))report.checks.push({name:'deterministic-package',status:hash(await readFile(path.join(root,zip)))===report.artifacts[zip].sha256?'passed':'failed'});
 }
 report.status=report.checks.every(q=>q.status==='passed')?'passed':'failed';
}catch(e){report.status='failed';report.error=e.message;console.error(e.message);}
finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 report.completed=new Date().toISOString();await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`Report: ${path.join(dir,'report.json')}`);process.exitCode=report.status==='passed'?0:1;
}
