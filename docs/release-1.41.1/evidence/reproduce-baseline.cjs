const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const pw=require(process.env.PLAYWRIGHT_MODULE_PATH);
(async()=>{
 const browserName=process.env.BROWSER_NAME||'firefox',base=path.resolve('.release/startup-restore/baseline-c6a8464'),out=path.resolve('.release/startup-restore/reproduction',browserName);await fs.mkdir(out,{recursive:true});
 const fixture=JSON.parse(await fs.readFile('tests/fixtures/legacy-project-1.35.12.json','utf8'));
 const report={browser:browserName,status:'running',scope:'Frozen 1.41.0; real numerical Worker replies held and released without changing their contents. Diagnostic variant records the existing thrown snapshot guard and caught exception. Service workers blocked only for this isolated startup reproduction.',cases:[]};
 let debug=false;
 const original=await fs.readFile(path.join(base,'assets/app.js'),'utf8');report.originalAppSHA256=createHash('sha256').update(original).digest('hex');
 const guard="if(JSON.stringify(projectSnapshot())!==before)throw Error('Project changed during restore');applyProject(p);}}catch{if(text!==null)";
 assert.ok(original.includes(guard));
 const diagnostic=original.replace(guard,"if(JSON.stringify(projectSnapshot())!==before){window.restoreDifference={before:JSON.parse(before),after:projectSnapshot()};throw Error('Project changed during restore');}applyProject(p);}}catch(restoreError){window.restoreError={message:restoreError.message,code:restoreError.code||null,stack:restoreError.stack};if(text!==null)");
 report.diagnosticAppSHA256=createHash('sha256').update(diagnostic).digest('hex');
 const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local'),relative=u.pathname.replace(/^\/water-steam-if97\//,'')||'index.html',file=path.resolve(base,relative);assert.ok(file.startsWith(base+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(relative==='assets/app.js'&&debug?diagnostic:await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/water-steam-if97/';let browser;
 try{browser=await pw[browserName].launch({headless:true});report.browserVersion=browser.version();
  for(const variant of ['original','diagnostic'])for(const action of ['passive','navigate','edit']){
   debug=variant==='diagnostic';const record={variant,action,errors:[]};report.cases.push(record);const context=await browser.newContext({viewport:{width:390,height:1000},serviceWorkers:'block',acceptDownloads:true});
   await context.addInitScript(({project})=>{
    localStorage.setItem('water-steam-if97-project-v1',JSON.stringify(project));
    const requests=new WeakMap(),post=Worker.prototype.postMessage,descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage');
    Worker.prototype.postMessage=function(request,...rest){if(request?.moduleId==='workflows'&&request?.methodId==='project')requests.set(this,request.id);return post.call(this,request,...rest);};
    Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get:descriptor.get,set(listener){descriptor.set.call(this,function(event){if(event.data?.id===requests.get(this)&&event.data.status==='ok'){requests.delete(this);window.projectReplyHeld=true;window.releaseProjectReply=()=>listener.call(this,event);return;}return listener.call(this,event);});}});
   },{project:fixture});
   const page=await context.newPage();page.on('pageerror',e=>record.errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.projectReplyHeld,null,{timeout:120000});
   record.whileHeld=await page.evaluate(()=>({disabled:document.querySelector('#calculate').disabled,status:document.querySelector('#result-status').textContent,route:document.querySelector('#section-select').value,stored:localStorage.getItem('water-steam-if97-project-v1')}));
   if(action==='navigate')await page.selectOption('#section-select','batch');
   if(action==='edit')await page.fill('#input-a','4.2');
   await page.evaluate(()=>window.releaseProjectReply());await page.waitForFunction(()=>!document.querySelector('#calculate').disabled,null,{timeout:120000});
   record.after=await page.evaluate(()=>({status:document.querySelector('#result-status').textContent,recoveryEnabled:!document.querySelector('#file-recovery').disabled,inputA:document.querySelector('#input-a').value,title:document.querySelector('#project-title').value,stored:localStorage.getItem('water-steam-if97-project-v1'),error:window.restoreError||null,difference:window.restoreDifference||null}));
   assert.equal(record.whileHeld.stored,JSON.stringify(fixture));assert.equal(record.after.stored,JSON.stringify(fixture));assert.deepEqual(record.errors,[]);
   if(action==='passive')assert.equal(record.after.recoveryEnabled,false);else assert.equal(record.after.recoveryEnabled,true);
   if(debug&&action!=='passive')assert.equal(record.after.error.message,'Project changed during restore');
   await page.screenshot({path:path.join(out,variant+'-'+action+'.png'),fullPage:true});console.log(browserName,variant,action,record.after.error?.message||record.after.status);await context.close();
  }report.status='reproduced';
 }finally{await browser?.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
