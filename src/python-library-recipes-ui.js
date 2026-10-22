import {readLibraryRecipe,readLibraryRecipeDraft,exampleTankRecipe} from './library-recipe.js';
import {runLibraryRecipe} from './library-recipe-runner.js';

function cancelPythonLibraryRecipe(discard=true){
 pythonLibraries.recipeSerial=(pythonLibraries.recipeSerial??0)+1;
 pythonLibraries.recipeController?.abort();pythonLibraries.recipeController=null;if(discard)pythonLibraries.recipeLast=null;
 pythonLibraries.recipeRefresh?.();
}
function mountLibraryRecipeUI(host){
 const t=(key,params)=>uiTranslator.t('libraries.recipe.'+key,params),section=document.createElement('section');section.id='python-library-recipe';section.dataset.i18nIgnore='';
 section.innerHTML='<h3 data-i18n="libraries.recipe.title">'+escapeHTML(t('title'))+'</h3><p data-i18n="libraries.recipe.scope">'+escapeHTML(t('scope'))+'</p><p data-i18n="libraries.recipe.exampleHelp">'+escapeHTML(t('exampleHelp'))+'</p>'+
  '<div class="process-grid"><button type="button" id="py-recipe-example" data-i18n="libraries.recipe.example">'+escapeHTML(t('example'))+'</button><button type="button" id="py-recipe-import" data-i18n="libraries.recipe.import">'+escapeHTML(t('import'))+'</button><button type="button" id="py-recipe-export" data-i18n="libraries.recipe.export">'+escapeHTML(t('export'))+'</button></div>'+
  '<label><span data-i18n="libraries.recipe.editor">'+escapeHTML(t('editor'))+'</span><textarea id="py-recipe-text" rows="12" maxlength="100000" spellcheck="false"></textarea></label>'+
  '<button type="button" id="py-recipe-run" data-i18n="libraries.recipe.run">'+escapeHTML(t('run'))+'</button><button type="button" id="py-recipe-cancel" data-i18n="libraries.recipe.cancel" hidden>'+escapeHTML(t('cancel'))+'</button>'+
  '<p id="py-recipe-status" role="status"></p><p id="py-recipe-error" role="alert" hidden></p><pre id="py-recipe-result" class="python-result"></pre><button type="button" id="py-recipe-result-export" data-i18n="libraries.recipe.resultExport" disabled>'+escapeHTML(t('resultExport'))+'</button>'+
  '<input type="file" id="py-recipe-file" accept=".json" hidden>';
 host.append(section);const connected=()=>section.isConnected&&activeSection==='libraries';let importSerial=0;
 const text=$('py-recipe-text');text.value=libraryRecipeDraft;
 let statusKey='empty',statusParams;
 function status(key,params){statusKey=key;statusParams=params;if(connected())$('py-recipe-status').textContent=t(key,params);}
 pythonLibraries.recipeTranslate=()=>{if(connected()){for(const node of section.querySelectorAll('[data-i18n]'))node.textContent=uiTranslator.t(node.dataset.i18n);status(statusKey,statusParams);}};
 function fail(error){if(connected()){$('py-recipe-error').hidden=false;$('py-recipe-error').textContent=error.message;}}
 function refresh(){if(!connected())return;const busy=!!pythonLibraries.recipeController;
  $('py-recipe-run').disabled=busy||!!pythonLibraries.download||!pythonLibraries.ready||pythonLibraries.runner.busy;
  $('py-recipe-cancel').hidden=!busy;$('py-recipe-result-export').disabled=!pythonLibraries.recipeLast;
 }
 pythonLibraries.recipeRefresh=refresh;
 function change(value){cancelPythonLibraryRecipe();libraryRecipeDraft=readLibraryRecipeDraft(value);text.value=value;$('py-recipe-result').textContent='';$('py-recipe-error').hidden=true;status('ready');saveProject();pythonLibraries.refreshRecipeHost?.();refresh();}
 text.oninput=()=>{importSerial++;try{change(text.value);}catch(error){fail(error);}};
 $('py-recipe-example').onclick=()=>{importSerial++;change(JSON.stringify(exampleTankRecipe(PYTHON_PACKAGE),null,2));};
 $('py-recipe-export').onclick=()=>{try{const recipe=readLibraryRecipe(text.value);downloadFile(JSON.stringify(recipe,null,2),'ht-fluids-recipe.json','application/json',{metadata:false});}catch(error){fail(error);}};
 $('py-recipe-import').onclick=()=>$('py-recipe-file').click();
 $('py-recipe-file').onchange=async()=>{
  const input=$('py-recipe-file'),file=input.files[0];if(!file)return;const serial=++importSerial,before=text.value;
  try{
   if(file.size>400000)throw Error(t('fileSize'));
   const raw=await file.text();readLibraryRecipe(raw);
   if(serial!==importSerial||!connected())return;
   if(text.value!==before)throw Error(t('changed'));
   change(raw);status('imported');
  }catch(error){if(serial===importSerial&&connected())fail(error);}finally{if(connected()&&input.files[0]===file)input.value='';}
 };
 $('py-recipe-cancel').onclick=()=>{cancelPythonLibraryRecipe();$('py-recipe-result').textContent='';status('cancelled');pythonLibraries.refreshRecipeHost?.();};
 $('py-recipe-run').onclick=async()=>{
  let recipe;try{recipe=readLibraryRecipe(text.value);}catch(error){fail(error);return;}
  cancelPythonLibraryRecipe();const serial=pythonLibraries.recipeSerial,controller=new AbortController();pythonLibraries.recipeController=controller;
  $('py-recipe-error').hidden=true;$('py-recipe-result').textContent='';status('running',{done:0,total:recipe.steps.length});refresh();pythonLibraries.refreshRecipeHost?.();
  try{
   const result=await runLibraryRecipe(recipe,{config:PYTHON_PACKAGE,signal:controller.signal,createRunner:()=>createCalculationRunner(()=>new Worker(PYTHON_WORKER_URL,{type:'module'}),180000),onProgress:progress=>{if(serial===pythonLibraries.recipeSerial)status('running',{done:progress.completed,total:progress.total});}});
   if(!connected()||serial!==pythonLibraries.recipeSerial)return;
   if(result.error?.code==='module-missing')pythonLibraries.ready=false;
   pythonLibraries.recipeLast=result;$('py-recipe-result').textContent=JSON.stringify(result,null,2);
   if(result.status==='ok')status('complete');else{status(result.status==='cancelled'?'cancelled':'failed');fail(Error((result.failedStep?result.failedStep+': ':'')+result.error.message));}
  }catch(error){if(serial===pythonLibraries.recipeSerial&&connected()){status('failed');fail(error);}}
  finally{if(serial===pythonLibraries.recipeSerial){pythonLibraries.recipeController=null;refresh();pythonLibraries.refreshRecipeHost?.();}}
 };
 $('py-recipe-result-export').onclick=()=>{if(pythonLibraries.recipeLast)downloadFile(JSON.stringify(pythonLibraries.recipeLast,null,2),'ht-fluids-recipe-result.json','application/json',{metadata:false});};
 status(libraryRecipeDraft?'ready':'empty');refresh();
}
document.addEventListener('languagechange',()=>pythonLibraries.recipeTranslate?.());
