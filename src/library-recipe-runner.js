import {readLibraryRecipe} from './library-recipe.js';

function recipeFailure(code,message){return Object.assign(Error(message),{code});}
// Never reuse a live UI object store. Terminate the isolated runner on every exit.
export async function runLibraryRecipe(input,{config,createRunner,signal,onProgress,maxResultCharacters=2000000}){
 const recipe=readLibraryRecipe(input);
 if(recipe.packageRevision!==config.revision||Object.entries(recipe.packages).some(([name,version])=>config.packages[name]?.version!==version))throw recipeFailure('recipe-version','Recipe package versions/revision do not match the prepared runtime.');
 const report={format:'thermocalc-library-recipe-result',version:1,recipe,status:'running',steps:[],scope:'Commands recalculated in an isolated Worker. Object summaries are not live handles or serialized object state. Units follow each upstream API.'};
 const values=new Map();let runner,retained=0,current=null;
 const abort=()=>{if(signal?.aborted)throw recipeFailure('cancelled','Recipe cancelled.');};
 function ref(value){
  let result=values.get(value.$ref);
  for(const key of value.path??[]){if(result===null||typeof result!=='object'||!Object.hasOwn(result,key))throw recipeFailure('recipe-reference','Reference path is absent: '+value.$ref);result=result[key];}
  return result;
 }
 function handle(value){const obj=ref(value);if(obj?.kind!=='object'||obj.scope!=='worker-session'||typeof obj.handle!=='string')throw recipeFailure('recipe-reference','Reference does not identify a live object.');return obj.handle;}
 function resolve(value){
  if(Array.isArray(value))return value.map(resolve);
  if(value!==null&&typeof value==='object'){
   if(Object.hasOwn(value,'$ref')){const result=ref(value);if(result?.kind==='object')throw recipeFailure('recipe-reference','Pass a Python object through $object or handle.');return result;}
   if(Object.keys(value).length===1&&Object.hasOwn(value,'$object'))return {$object:handle(value.$object)};
   return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolve(item)]));
  }return value;
 }
 function summary(value){
  if(Array.isArray(value))return value.map(summary);
  if(value!==null&&typeof value==='object'){
   if(value.kind==='object'&&value.scope==='worker-session'&&typeof value.handle==='string')return {kind:'object-summary',class:value.class,members:value.members};
   return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,summary(item)]));
  }return value;
 }
 try{
  abort();runner=createRunner();
  for(const step of recipe.steps){
   current=step.id;abort();const p=step.payload;
   const payload=Object.hasOwn(p,'handle')?{...Object.fromEntries(Object.entries(p).filter(([key])=>key!=='handle').map(([key,value])=>[key,resolve(value)])),handle:handle(p.handle)}:resolve(p);
   onProgress?.({step:current,completed:report.steps.length,total:recipe.steps.length});
   const reply=await runner.run(step.module,step.method,payload,{signal,onProgress:progress=>onProgress?.({step:current,completed:report.steps.length,total:recipe.steps.length,stage:progress.stage})});abort();
   if(reply.status!=='ok'||reply.engineVersion!==recipe.packages[step.module])throw recipeFailure('recipe-version','Unexpected library reply status/version.');
   if(typeof reply.implementationRevision!=='string'||!/^[a-f0-9]{64}$/.test(reply.implementationRevision)||report.implementationRevision&&report.implementationRevision!==reply.implementationRevision)throw recipeFailure('recipe-version','Worker implementation revision changed during replay.');
   report.implementationRevision=reply.implementationRevision;
   const record={id:step.id,module:step.module,method:step.method,engineVersion:reply.engineVersion,implementationRevision:reply.implementationRevision,result:summary(reply.result),units:reply.units??null,warnings:reply.warnings??[]};
   retained+=JSON.stringify(record).length;if(retained>maxResultCharacters)throw recipeFailure('recipe-result-limit','Recipe results exceed the '+maxResultCharacters+'-character limit.');
   report.steps.push(record);values.set(step.id,reply.result);
  }
  report.status='ok';
 }catch(error){report.status=signal?.aborted||error.code==='cancelled'?'cancelled':'error';report.failedStep=current;report.error={code:error.code??'recipe',message:error.message,details:error.details??{}};}
 finally{runner?.reset();}
 return report;
}
