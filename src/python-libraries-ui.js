import {createPythonPackageManager} from './python-package.js';

const pythonLibraries={manager:createPythonPackageManager(PYTHON_PACKAGE,new URL('./',location.href)),runner:createCalculationRunner(()=>new Worker(PYTHON_WORKER_URL,{type:'module'}),180000),module:'ht',catalogs:{},download:null,controller:null,ready:false,serial:0,last:null};
function cancelPythonLibraries(){pythonLibraries.serial++;pythonLibraries.runner.cancel();}
window.addEventListener('pagehide',()=>{pythonLibraries.controller?.abort();pythonLibraries.runner.reset();});
function showPythonLibraries(){
 selectView('panel');$('calculator-view').hidden=true;activeSection='libraries';
 for(const tab of document.querySelectorAll('[role=tab]'))tab.setAttribute('aria-selected',String(tab.dataset.action==='libraries'));
 const host=$('process-view');host.hidden=false;
 const t=(key,params)=>uiTranslator.t('libraries.'+key,params),label=(key,body)=>'<label><span data-i18n="libraries.'+key+'">'+escapeHTML(t(key))+'</span>'+body+'</label>';
 host.innerHTML='<section id="python-libraries" data-i18n-ignore><h2 data-i18n="libraries.title">'+escapeHTML(t('title'))+'</h2><p data-i18n="libraries.scope">'+escapeHTML(t('scope'))+'</p><p data-i18n="libraries.units">'+escapeHTML(t('units'))+'</p><details><summary data-i18n="libraries.licenses">'+escapeHTML(t('licenses'))+'</summary><p>ht / fluids: MIT; Pyodide: MPL-2.0; CPython: PSF; NumPy / SciPy: BSD + bundled notices.</p><p>'+['ht','fluids','pyodide','cpython','emscripten'].map(name=>'<a href="'+PYTHON_PACKAGE.base+'licenses/'+name+'-LICENSE.txt" target="_blank" rel="noopener">'+name+' LICENSE</a>').join(' · ')+'</p><p><a href="https://github.com/pyodide/pyodide/tree/314.0.7" target="_blank" rel="noopener">Pyodide 314.0.7 source</a> · <a href="https://github.com/lamerroma/water-steam-if97/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">THIRD_PARTY_NOTICES</a></p></details>'+
  '<div class="process-grid"><button type="button" id="py-install"></button><button type="button" id="py-download-cancel" data-i18n="libraries.downloadCancel">'+escapeHTML(t('downloadCancel'))+'</button><button type="button" id="py-remove" data-i18n="libraries.remove">'+escapeHTML(t('remove'))+'</button></div><progress id="py-progress" hidden></progress><p id="py-status" role="status"></p>'+
  '<form id="python-library-form">'+label('package','<select id="py-package"><option value="ht">ht 1.2.0</option><option value="fluids">fluids 1.3.1</option></select>')+
  '<button type="button" id="py-catalog" data-i18n="libraries.catalog">'+escapeHTML(t('catalog'))+'</button>'+label('search','<input id="py-search" type="search" autocomplete="off">')+
  label('function','<select id="py-target"></select>')+'<p id="py-count"></p><details><summary data-i18n="libraries.documentation">'+escapeHTML(t('documentation'))+'</summary><pre id="py-documentation" class="python-documentation"></pre></details>'+
  '<div class="process-grid"><button type="button" id="py-example-ht">Nu · ht</button><button type="button" id="py-example-fluids">f · fluids</button></div>'+
  label('operation','<select id="py-method"><option value="call">call</option><option value="get">get</option><option value="describe">describe</option><option value="release">release</option></select>')+
  label('arguments','<textarea id="py-request" rows="7" spellcheck="false" maxlength="100000"></textarea>')+
  '<p data-i18n="libraries.jsonHelp">'+escapeHTML(t('jsonHelp'))+'</p><button type="submit" id="py-run" data-i18n="libraries.run">'+escapeHTML(t('run'))+'</button><button type="button" id="py-cancel" data-i18n="libraries.cancel">'+escapeHTML(t('cancel'))+'</button></form>'+
  '<p id="py-error" role="alert" hidden></p><p id="py-unsupported"></p><pre id="py-result" class="python-result" data-i18n-ignore></pre><button type="button" id="py-export" data-i18n="libraries.export" disabled>'+escapeHTML(t('export'))+'</button></section>';
 mountWaterHeos(host);
 const section=$('python-libraries'),connected=()=>section.isConnected&&activeSection==='libraries';
 const text=(id,key,params)=>{if(connected())$(id).textContent=t(key,params);};
 function refresh(){if(!connected())return;const downloading=!!pythonLibraries.download,busy=pythonLibraries.runner.busy;
  $('py-install').textContent=t('install',{size:(PYTHON_PACKAGE.bytes/1e6).toFixed(1)});$('py-install').disabled=downloading||pythonLibraries.ready||busy;
  $('py-download-cancel').hidden=!downloading;$('py-remove').disabled=downloading||busy||!pythonLibraries.ready;
  for(const id of ['py-catalog','py-run','py-target','py-example-ht','py-example-fluids'])$(id).disabled=!pythonLibraries.ready||busy||downloading;
  $('py-cancel').hidden=!busy;$('py-export').disabled=!pythonLibraries.last;
 }
 pythonLibraries.refresh=()=>{if(connected())readiness();};
 async function readiness(){try{pythonLibraries.ready=(await pythonLibraries.manager.status()).ready;text('py-status',pythonLibraries.ready?'ready':'missing');}catch(error){$('py-error').textContent=error.message;$('py-error').hidden=false;}refresh();}
 function draft(){if(!connected())return;try{localStorage.setItem('thermocalc-library-draft',JSON.stringify({module:$('py-package').value,method:$('py-method').value,request:$('py-request').value}));}catch{}}
 try{const saved=JSON.parse(localStorage.getItem('thermocalc-library-draft')||'null');if(saved&&['ht','fluids'].includes(saved.module)&&typeof saved.request==='string'&&saved.request.length<=100000){pythonLibraries.module=saved.module;$('py-request').value=saved.request;if(['call','get','describe','release'].includes(saved.method))$('py-method').value=saved.method;}}catch{}
 $('py-package').value=pythonLibraries.module;
 async function execute(method,payload){
  cancelPythonLibraries();const sequence=pythonLibraries.serial;pythonLibraries.last=null;$('py-error').hidden=true;$('py-result').textContent='';
  const pending=pythonLibraries.runner.run(pythonLibraries.module,method,payload,{onProgress:progress=>text('py-status','starting',{stage:progress.stage})});refresh();
  try{const reply=await pending;if(sequence!==pythonLibraries.serial||!connected())return null;return reply;}
  catch(error){if(error.code==='module-missing')pythonLibraries.ready=false;if(sequence===pythonLibraries.serial&&connected()){$('py-error').textContent=error.code==='cancelled'?t('cancelled'):error.message;$('py-error').hidden=false;}return null;}
  finally{if(sequence===pythonLibraries.serial&&connected()){text('py-status',pythonLibraries.ready?'ready':'missing');refresh();}}
 }
 function filter(){const catalog=pythonLibraries.catalogs[pythonLibraries.module];if(!catalog){$('py-target').replaceChildren();$('py-count').textContent='';$('py-unsupported').textContent='';return;}const query=$('py-search').value.toLowerCase(),matches=catalog.entries.filter(entry=>(entry.path+' '+entry.summary).toLowerCase().includes(query));$('py-target').replaceChildren(...matches.map(entry=>new Option(entry.path+(entry.signature||''),entry.path)));text('py-count','count',{count:matches.length,total:catalog.entries.length});$('py-unsupported').textContent=catalog.unavailableModules.map(item=>item.module+': '+item.reason).join('\n');}
 async function describe(){const target=$('py-target').value;if(!target)return;const reply=await execute('describe',{target});if(reply){$('py-documentation').textContent=reply.result.documentation;}}
 async function catalog(){const reply=await execute('catalog',{});if(reply){pythonLibraries.catalogs[pythonLibraries.module]=reply.result;filter();}}
 $('py-catalog').onclick=catalog;$('py-search').oninput=filter;$('py-target').onchange=async()=>{const target=$('py-target').value,entry=pythonLibraries.catalogs[pythonLibraries.module]?.entries.find(item=>item.path===target);if(entry){$('py-method').value=entry.kind==='data'?'get':'call';$('py-request').value=JSON.stringify({target,kwargs:Object.fromEntries(entry.parameters.filter(p=>p.required).map(p=>[p.name,null]))},null,2);draft();await describe();}};
 $('py-package').onchange=()=>{cancelPythonLibraries();pythonLibraries.module=$('py-package').value;filter();draft();refresh();};
 $('py-cancel').onclick=()=>{cancelPythonLibraries();text('py-status','cancelled');refresh();};
 $('py-install').onclick=async()=>{
  pythonLibraries.controller=new AbortController();$('py-error').hidden=true;const progress=$('py-progress');progress.hidden=false;
  pythonLibraries.download=pythonLibraries.manager.install({signal:pythonLibraries.controller.signal,onProgress:value=>{if(connected()){progress.max=value.total;progress.value=value.done;text('py-status','download',{done:value.done,total:value.total});}}});refresh();
  try{await pythonLibraries.download;pythonLibraries.ready=true;text('py-status','ready');}catch(error){pythonLibraries.ready=false;if(connected()){$('py-error').textContent=error.name==='AbortError'?t('cancelled'):error.message;$('py-error').hidden=false;}}
  finally{pythonLibraries.download=null;pythonLibraries.controller=null;if(connected()){progress.hidden=true;refresh();}pythonLibraries.refresh?.();}
 };
 $('py-download-cancel').onclick=()=>pythonLibraries.controller?.abort();
 $('py-remove').onclick=async()=>{cancelPythonLibraries();pythonLibraries.runner.reset();await pythonLibraries.manager.remove();pythonLibraries.ready=false;pythonLibraries.last=null;await readiness();};
 function example(module){cancelPythonLibraries();pythonLibraries.module=module;$('py-package').value=module;$('py-method').value='call';$('py-request').value=JSON.stringify(module==='ht'?{target:'ht.Nu_conv_internal',kwargs:{Re:100000,Pr:.7}}:{target:'fluids.friction_factor',kwargs:{Re:100000,eD:.0001}},null,2);filter();draft();}
 $('py-example-ht').onclick=()=>example('ht');$('py-example-fluids').onclick=()=>example('fluids');if(!$('py-request').value)example(pythonLibraries.module);
 $('python-library-form').oninput=draft;$('py-method').onchange=draft;
 $('python-library-form').onsubmit=async event=>{event.preventDefault();let payload;try{payload=JSON.parse($('py-request').value);if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error(t('objectRequired'));}catch(error){$('py-error').textContent=error.message;$('py-error').hidden=false;return;}
  const module=pythonLibraries.module,method=$('py-method').value;draft();const reply=await execute(method,payload);if(reply){pythonLibraries.last={format:'thermocalc-library-result',version:1,module,method,payload,reply};$('py-result').textContent=JSON.stringify(reply,null,2);if(reply.description)$('py-documentation').textContent=reply.description.documentation;refresh();}
 };
 $('py-export').onclick=()=>{if(pythonLibraries.last)downloadFile(JSON.stringify(pythonLibraries.last,null,2),'ht-fluids-result.json','application/json');};
 if(pythonLibraries.catalogs[pythonLibraries.module])filter();readiness();refresh();
}
document.addEventListener('languagechange',()=>{const section=$('python-libraries');if(!section)return;for(const node of section.querySelectorAll('[data-i18n]'))node.textContent=uiTranslator.t(node.dataset.i18n);$('py-install').textContent=uiTranslator.t('libraries.install',{size:(PYTHON_PACKAGE.bytes/1e6).toFixed(1)});});
