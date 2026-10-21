// Compare the shared offline collector in the real pinned Pyodide runtime.
// This complements (does not replace) actual UI/Worker/offline integration tests.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function difference(a,b,at='$'){
 if(a===b)return null;
 if(a===null||b===null||typeof a!==typeof b||typeof a!=='object')return at;
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
 if(JSON.stringify(ak)!==JSON.stringify(bk))return at+' (keys)';
 for(const key of ak){const found=difference(a[key],b[key],at+'.'+key);if(found)return found;}
 return null;
}
(async()=>{
 const root=process.cwd(),name=process.env.BROWSER_NAME||'chromium';
 const output=path.resolve(process.env.LIBRARY_REGISTRY_EVIDENCE||'.release/library-registry/'+name);await fs.mkdir(output,{recursive:true});
 const read=p=>fs.readFile(path.join(root,p),'utf8');
 const config=JSON.parse(await read('assets/python-package.json'));
 const bridge=await read('src/python-library-bridge.py'),collector=await read('scripts/reference/library_registry_collector.py');
 const expected=JSON.parse(await read('docs/library-registry/surface.json'));
 assert.equal(hash(bridge),expected.inputs.bridgeSHA256);assert.equal(hash(collector),expected.inputs.collectorSHA256);
 const controls=JSON.parse(await read('docs/library-registry/controls.json'));
 const report={browser:name,status:'running',checks:[],errors:[],requests:[],registrySHA256:hash(await read('docs/library-registry/surface.json')),inputs:expected.inputs,scope:'Shared collector parity and elementary primitive controls; not full numerical or application UI acceptance.'};
 const worker=`self.onmessage=async()=>{try{
  const config=${JSON.stringify(config)},indexURL=new URL(config.base+'pyodide/',self.location.origin+'/').href;
  const {loadPyodide}=await import(indexURL+'pyodide.mjs');const p=await loadPyodide({indexURL,enableRunUntilComplete:false});await p.loadPackage(['numpy','scipy']);
  const dest=p.runPython('import sysconfig; sysconfig.get_paths()["purelib"]');
  for(const name of ['fluids','ht']){const r=await fetch('/'+config.base+config.packages[name].file);if(!r.ok)throw Error('Missing wheel');p.unpackArchive(new Uint8Array(await r.arrayBuffer()),'zip',{extractDir:dest});}
  await p.runPythonAsync(${JSON.stringify(bridge)});await p.runPythonAsync(${JSON.stringify(collector)});
  const surface=JSON.parse(await p.runPythonAsync('json.dumps(collect_library_registry(),allow_nan=False)'));
  const execute=p.globals.get('_thermocalc_library_json');const cases=${JSON.stringify(controls.cases)}.map(c=>({id:c.id,reply:JSON.parse(execute(JSON.stringify({module:c.module,method:'call',payload:{target:c.target,args:c.args}})))}));
  const environment=JSON.parse(p.runPython('json.dumps({"python":__import__("platform").python_version(),**{n:importlib.metadata.version(n) for n in ("ht","fluids","numpy","scipy")}})'));
  const runtimeSignatures=JSON.parse(p.runPython('json.dumps(_registry_runtime_signatures,allow_nan=False)'));
  self.postMessage({ok:true,surface,cases,environment,runtimeSignatures});
 }catch(error){self.postMessage({ok:false,error:error.stack});}};`;
 const resources=new Map(config.files.map(f=>['/'+f.url,f.sha256]));let browser;
 const server=http.createServer(async(req,res)=>{try{
  const uri=new URL(req.url,'http://local').pathname;
  if(uri==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Library registry verification</title>');return;}
  if(uri==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(uri==='/registry-worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
  assert.ok(resources.has(uri),'Unexpected runtime resource '+uri);
  const file=path.resolve(root,'.'+uri);assert.ok(file.startsWith(root+path.sep));const raw=await fs.readFile(file);assert.equal(hash(raw),resources.get(uri),uri);
  report.requests.push(uri);res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(raw);
 }catch(error){report.errors.push(error.message);res.writeHead(404);res.end(error.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await pw[name].launch({headless:true});report.browserVersion=browser.version();
  const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/');
  const actual=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const worker=new Worker('/registry-worker.js',{type:'module'}),timer=setTimeout(()=>{worker.terminate();reject(Error('Registry worker timed out'));},240000);
   worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();data.ok?resolve(data):reject(Error(data.error));};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error(e.message));};worker.postMessage({});
  }));
  report.environment=actual.environment;
  const {inputs,scope,...expectedSurface}=expected;const diff=difference(actual.surface,expectedSurface);
  if(diff){await fs.writeFile(path.join(output,'observed-surface.json'),JSON.stringify(actual.surface,null,2)+'\n');throw Error('Native/browser registry differs at '+diff);}
  report.checks.push('Every public path, identity group, pinned-source signature/hash/documentation and static member matches the native registry.');
  for(const c of controls.cases){const result=actual.cases.find(r=>r.id===c.id);assert.equal(result.reply.ok,true,c.id);
   if(c.disposition==='known_upstream_discrepancy'){assert.notDeepEqual(result.reply.result,c.expected,c.id);assert.deepEqual(result.reply.result,c.observedUpstream,c.id);assert.ok(result.reply.description.knownIssues.some(i=>i.code===c.issueCode));result.numericalStatus='known_discrepancy';}
   else{assert.equal(result.reply.result,c.expected,c.id);result.numericalStatus='matched';}}
  report.controls=actual.cases;report.checks.push('Three elementary determinant references match; the one-by-one shape discrepancy remains explicitly observed and warned.');
  const runtimePath=path.join(root,'docs/library-registry/runtime-signatures-pyodide.json');
  const runtime={environment:actual.environment,signatures:actual.runtimeSignatures,qualification:'Runtime/dependency signatures in pinned Pyodide; review status remains unreviewed.'};
  if(process.argv.includes('--write-runtime-signatures'))await fs.writeFile(runtimePath,JSON.stringify(runtime,null,2)+'\n');
  else{const pinned=JSON.parse(await fs.readFile(runtimePath,'utf8'));assert.equal(difference(runtime,pinned),null,'Pinned Pyodide runtime signatures changed');}
  const nativeRuntime=JSON.parse(await read('docs/library-registry/runtime-signatures-native.json'));
  assert.deepEqual(Object.keys(actual.runtimeSignatures).sort(),Object.keys(nativeRuntime.signatures).sort());
  report.runtimeSignatureDifferences=Object.keys(actual.runtimeSignatures).filter(id=>difference(actual.runtimeSignatures[id],nativeRuntime.signatures[id])).map(id=>({id,native:nativeRuntime.signatures[id],pyodide:actual.runtimeSignatures[id]}));
  report.checks.push('Runtime-dependent signatures are preserved in separate native/Pyodide profiles; differences are explicit.');
  report.summary=actual.surface.summary;assert.deepEqual(report.errors,[]);report.status='passed';console.log(name+': registry parity '+report.summary.catalogPaths+' paths, '+report.summary.records+' records; 3 matched controls, 1 known upstream discrepancy');
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
