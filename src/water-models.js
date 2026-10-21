export const WATER_MODELS=Object.freeze(['IF97','IAPWS-95','HEOS::Water']);
export const isScientificWater=model=>model==='IAPWS-95'||model==='HEOS::Water';

// Routing only selects a runtime. The normal project/input readers still validate
// every field and recompute outputs; a model tag never makes imported data trusted.
export function usesWaterHeos(value){
 const stack=[value],seen=new WeakSet();let visited=0;
 while(stack.length){
  const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;
  seen.add(item);if(++visited>50000)return false;
  if(item.model==='HEOS::Water')return true;
  for(const [key,child] of Object.entries(item)){
   if(child&&typeof child==='object')stack.push(child);
   else if(key==='cc-data'&&typeof child==='string'&&child.length<=30000){try{stack.push(JSON.parse(child));}catch{}}
  }
 }
 return false;
}
export function waterCalculationRuntime(request){
 if(request.moduleId==='water-heos')return 'heos';
 if(request.moduleId==='workflows'&&request.methodId==='project'){
  const text=request.payload?.text;if(typeof text!=='string'||text.length>2000000)return 'default';
  try{return usesWaterHeos(JSON.parse(text))?'heos':'default';}catch{return 'default';}
 }
 return usesWaterHeos(request.payload)?'heos':'default';
}
