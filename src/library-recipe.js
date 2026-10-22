// Declarative data only. Reading a project never executes library commands.
export const LIBRARY_RECIPE_MAX_TEXT=100000;
export const LIBRARY_RECIPE_MAX_STEPS=32;
const recipeRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const recipeAssert=(condition,message)=>{if(!condition)throw Error(message);};
function recipeKeys(value,allowed){recipeAssert(Object.keys(value).every(key=>allowed.includes(key)),'Unknown recipe field.');}
function recipeTarget(value,module){return typeof value==='string'&&value.startsWith(module+'.')&&value.split('.').every(part=>/^[A-Za-z][A-Za-z0-9_]*$/.test(part));}
export function readLibraryRecipeDraft(value){
 if(value==null)return '';
 recipeAssert(typeof value==='string'&&value.length<=LIBRARY_RECIPE_MAX_TEXT,'Library recipe draft: maximum 100000 characters.');return value;
}
export function readLibraryRecipe(input){
 if(typeof input!=='string'){
  const parents=new Set();let nodes=0;
  function jsonValue(value,depth=0){
   recipeAssert(++nodes<=100000&&depth<=40,'Recipe data exceeds its size/nesting limits.');
   if(value===null||typeof value==='string'||typeof value==='boolean')return;
   if(typeof value==='number'){recipeAssert(Number.isFinite(value),'Recipe numbers must be finite.');return;}
   recipeAssert(value&&typeof value==='object'&&(Array.isArray(value)||[Object.prototype,null].includes(Object.getPrototypeOf(value)))&&!parents.has(value),'Recipe must contain acyclic JSON data.');
   if(Array.isArray(value))recipeAssert(Object.keys(value).length===value.length,'Recipe arrays must not contain holes or extra properties.');
   parents.add(value);for(const item of Object.values(value))jsonValue(item,depth+1);parents.delete(value);
  }jsonValue(input);
 }
 const text=typeof input==='string'?input:JSON.stringify(input);
 readLibraryRecipeDraft(text);const value=JSON.parse(text);
 recipeAssert(recipeRecord(value)&&value.format==='thermocalc-library-recipe'&&value.version===1,'Unsupported library recipe format/version.');
 recipeKeys(value,['format','version','packageRevision','packages','steps']);
 recipeAssert(typeof value.packageRevision==='string'&&/^[a-f0-9]{16}$/.test(value.packageRevision)&&recipeRecord(value.packages),'Recipe requires pinned package revision/versions.');
 recipeAssert(Array.isArray(value.steps)&&value.steps.length>0&&value.steps.length<=LIBRARY_RECIPE_MAX_STEPS,'Recipe must contain 1–32 steps.');
 const previous=new Set(),needed=new Set();
 function reference(ref){
  recipeAssert(recipeRecord(ref),'Use a logical $ref instead of a live handle.');recipeKeys(ref,['$ref','path']);
  recipeAssert(typeof ref.$ref==='string'&&previous.has(ref.$ref),'Recipe reference must point to an earlier step.');
  if(ref.path!==undefined)recipeAssert(Array.isArray(ref.path)&&ref.path.length<=8&&ref.path.every(key=>Number.isSafeInteger(key)&&key>=0||typeof key==='string'&&key.length>0&&key.length<=80),'Invalid recipe reference path.');
 }
 function visit(item,depth=0){
  recipeAssert(depth<=30,'Recipe argument nesting exceeds 30.');
  if(typeof item==='number')recipeAssert(Number.isFinite(item),'Recipe numbers must be finite.');
  if(Array.isArray(item)){item.forEach(v=>visit(v,depth+1));return;}
  if(!recipeRecord(item))return;
  if(Object.hasOwn(item,'$ref')){reference(item);return;}
  if(Object.keys(item).length===1&&Object.hasOwn(item,'$object')){reference(item.$object);return;}
  if(Object.keys(item).length===1&&Object.hasOwn(item,'$function')){
   const module=typeof item.$function==='string'?item.$function.split('.')[0]:null;
   recipeAssert(['ht','fluids'].includes(module)&&recipeTarget(item.$function,module),'Invalid public function reference.');needed.add(module);
  }
  Object.values(item).forEach(v=>visit(v,depth+1));
 }
 for(const step of value.steps){
  recipeAssert(recipeRecord(step),'Invalid recipe step.');recipeKeys(step,['id','module','method','payload']);
  recipeAssert(typeof step.id==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(step.id)&&!previous.has(step.id),'Recipe step IDs must be unique.');
  recipeAssert(['ht','fluids'].includes(step.module)&&['call','get','release'].includes(step.method)&&recipeRecord(step.payload),'Unsupported recipe module/method/payload.');needed.add(step.module);
  const p=step.payload,object=Object.hasOwn(p,'handle');
  recipeKeys(p,step.method==='release'?['handle']:step.method==='get'?(object?['handle','member']:['target']):(object?['handle','member','args','kwargs']:['target','args','kwargs']));
  if(object){reference(p.handle);if(step.method!=='release')recipeAssert(typeof p.member==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(p.member),'Specify a public object member.');}
  else recipeAssert(step.method!=='release'&&recipeTarget(p.target,step.module),'Specify a public target in the selected module.');
  if(step.method==='call')recipeAssert((p.args===undefined||Array.isArray(p.args))&&(p.kwargs===undefined||recipeRecord(p.kwargs)),'args must be an array; kwargs must be an object.');
  visit(p);previous.add(step.id);
 }
 recipeAssert(Object.keys(value.packages).length===needed.size&&[...needed].every(module=>typeof value.packages[module]==='string'&&/^\d+\.\d+\.\d+$/.test(value.packages[module])),'Pin exactly the packages used by recipe steps and function references.');
 return value;
}
export function exampleTankRecipe(config){return {
 format:'thermocalc-library-recipe',version:1,packageRevision:config.revision,packages:{fluids:config.packages.fluids.version},
 steps:[
  {id:'tank',module:'fluids',method:'call',payload:{target:'fluids.geometry.TANK',kwargs:{D:1,L:2,horizontal:false}}},
  {id:'volume',module:'fluids',method:'get',payload:{handle:{$ref:'tank'},member:'V_total'}},
  {id:'filled',module:'fluids',method:'call',payload:{handle:{$ref:'tank'},member:'V_from_h',kwargs:{h:0.5}}},
  {id:'level',module:'fluids',method:'call',payload:{handle:{$ref:'tank'},member:'h_from_V',kwargs:{V:{$ref:'filled'}}}}
 ]};}
