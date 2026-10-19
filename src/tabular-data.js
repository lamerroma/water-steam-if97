import {gasTableRows,gasCompositionRows} from './gas-table-rows.js';
import {resultExportRows} from './export.js';
import {saturationCell,SATURATION_COLUMNS} from './saturation-grid.js';
import {processExportRows} from './project.js';
import {diagramExportRows} from './diagram-workspace.js';
import {propertyUnavailableReason} from './ux-display.js';
import {batchStates} from './batch.js';

// A typed document shared by every writer. No display rounding or CSV parsing.
export function tabularDocument(kind,tables,context={}){
 const metadata={...context,format:'water-steam-tabular',schema:1,kind,pressure_basis:'absolute'};
 const metaRows=[['key','value'],...Object.entries(metadata).map(([k,v])=>[k,v??null]),['blank_value','Unavailable or inapplicable; never a numeric zero.'],['precision','Unrounded JavaScript binary64; spreadsheet readers may display fewer digits.']];
 const all=[{name:'Metadata',rows:metaRows},...tables];
 if(all.length>20||!tables.length)throw Error('Invalid spreadsheet tables.');
 const names=new Set();
 const sheets=all.map(({name,rows})=>{
  if(typeof name!=='string'||!name||name.length>31||/[\\/?*\[\]:]/.test(name)||names.has(name.toLowerCase()))throw Error('Invalid or duplicate worksheet name.');
  names.add(name.toLowerCase());
  // Common limits keep XLS, XLSX and ODS exports equivalent and prevent truncation.
  if(!Array.isArray(rows)||rows.length>65536)throw Error('Worksheet exceeds the Excel 97–2003 row limit.');
  return {name,rows:rows.map(row=>{
   if(!Array.isArray(row)||row.length>256)throw Error('Worksheet exceeds the Excel 97–2003 column limit.');
   return row.map(value=>{
    if(value==null)return null;
    if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Non-finite spreadsheet value.');return value;}
    if(typeof value==='boolean')return value;
    if(typeof value!=='string'||value.length>32767)throw Error('Invalid spreadsheet text.');
    return value;
   });
  })};
 });
 return {format:'water-steam-tabular',version:1,sheets};
}

function completeStateRows(result,energy,ambient,system,preferences){
 const records=resultExportRows(result,energy,ambient,system,preferences);
 const states=[...(result.state?[['state',result.state]]:[]),...(result.saturation?[['saturated_liquid',result.saturation.liquid],['saturated_vapor',result.saturation.vapor]]:[]),...(result.alternatives||[]).map((q,i)=>['alternative_'+(i+1),q])];
 for(const [name,state] of states){
  for(const row of records.filter(r=>r[0]===name)){
   const key=row[1];
   if(row[2]===''&&(state[key]===null||state[key]===undefined)&&!key.endsWith('_unavailable_reason')){
    row[2]=null;
    if(!records.some(r=>r[0]===name&&r[1]===key+'_unavailable_reason'))records.push([name,key+'_unavailable_reason',propertyUnavailableReason(key,state),'']);
   }
  }
 }
 return records;
}
export function resultTabular(result,context={}){
 if(!result?.state&&!result?.saturation)throw Error('Calculate a state before exporting.');
 const {system='si',energy='kJ',p0=.101325,T0=298.15}=context;
 return tabularDocument('state',[{name:'Properties',rows:completeStateRows(result,energy,{p:p0,T:T0},system,context)}],context);
}
export function historyTabular(states,context={}){
 if(!states.length)throw Error('No calculated history to export.');
 const rows=[['name','state','property','value','unit']];
 for(const q of states)rows.push(...completeStateRows({state:q},context.energy||'kJ',null,context.system||'si',context).slice(1).map(r=>[q.name||'',...r]));
 return tabularDocument('history',[{name:'Properties',rows}],{...context,model:'per result'});
}
export function saturationTabular(records,model,context={}){
 if(!records.length)throw Error('Generate a saturation table before exporting.');
 const cell=(k,q)=>saturationCell(k,q,context.system||'si',context.energy||'kJ');
 const rows=[['input ['+(context.input_unit||'?')+']',...SATURATION_COLUMNS.map(([k,label])=>label+' ['+cell(k,null)[1]+']'),'status','message'],...records.map(r=>[r.input,...SATURATION_COLUMNS.map(([k])=>r.error?null:cell(k,r.saturation)[0]),r.error?'error':'ok',r.error||''])];
 return tabularDocument('saturation',[{name:'Saturation',rows}],{...context,model});
}
export function processTabular(kind,result,context={}){
 const states=[result.inlet,...(result.ideal?[result.ideal]:[]),result.outlet];
 return tabularDocument(kind,[{name:'Process',rows:processExportRows(kind,result,context.system||'si')},{name:'Properties',rows:[['point','state','property','value','unit'],...states.flatMap((q,i)=>completeStateRows({state:q},'kJ',null,context.system||'si',context).slice(1).map(row=>[i+1,...row]))]}],{...context,model:result.inlet.model||'IF97'});
}
export function diagramTabular(entries,plan={},context={},preferences){
 if(!entries.length)throw Error('No calculated diagram points to export.');
 return tabularDocument('diagram',[{name:'Points and series',rows:diagramExportRows(entries,context.system||'si',context.energy||'kJ',plan,preferences)},{name:'Properties',rows:[['name','state','property','value','unit'],...entries.flatMap(([q,name])=>completeStateRows({state:q},context.energy||'kJ',null,context.system||'si',context).slice(1).map(row=>[name,...row]))]}],context);
}
export function batchTabular(records,context={}){
 if(!records.length)throw Error('Calculate a batch before exporting.');
 const states=records.filter(r=>!r.error).flatMap(r=>batchStates(r).map(q=>({...q,name:r.input.name})));
 const rows=[['name','status','message'],...records.map(r=>[r.input.name,r.error?'error':'ok',r.error||''])];
 const properties=[['name','state','property','value','unit'],...states.flatMap(q=>completeStateRows({state:q},context.energy||'kJ',null,context.system||'si',context).slice(1).map(row=>[q.name,...row]))];
 return tabularDocument('batch',[{name:'Batch',rows},{name:'Properties',rows:properties}],context);
}

export function gasTabular(q,inputs={},context={},preferences=null){
 if(!q?.modelId?.startsWith('BSW2003-'))throw Error('Calculate a BSW2003 state before exporting.');
 return tabularDocument('gas',[{name:'Properties',rows:[['property','value','unit'],...gasTableRows(q,context.system||'si',preferences)]},{name:'Composition',rows:[['component','mole [%]','mass [%]'],...gasCompositionRows(q)]},{name:'Inputs',rows:[['field','value'],...Object.entries(inputs)]}],{...context,model:q.model,composition_basis:q.inputBasis,T0_K:q.reference.T0,p0_MPa:q.reference.p0,reference:q.reference.definition,dissociation_applied:q.dissociationApplied,...(q.dissociationApplied?{dissociation_model:q.dissociation.model,excess_air_lambda:q.excessAirLambda,combustion:q.dissociation.combustion,composition_meaning:q.compositionMeaning,equilibrium_composition_computed:false,sound_speed_available:false,Steam97Web_parity_verified:false,cp_definition:q.dissociation.cpDefinition}:{})});
}
