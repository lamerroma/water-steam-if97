import {readProject} from './project.js';
import {pressureInput,pressureOutput} from './pressure.js';
import {parseNumber} from './units.js';

// Only the visible startup draft may override a restored project. History,
// calculations and inactive panel content come from the validated Worker reply.
// Rebase inactive process pressures if the user changes the pressure convention.
export function mergeStartupDraft(project,before,current){
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const editable=['form','title','uiUnits','uiInputDefaults','digits','pressure','ambient','system','energy','gray','scale','hints'];
 const changed=Object.keys(current).filter(key=>!equal(before[key],current[key]));
 const formChanged=changed.includes('form');
 for(const key of changed){
  if(editable.includes(key))continue;
  if(key==='workspace'&&formChanged&&['general','saturation'].includes(current.workspace?.active)&&equal(before.workspace?.panels,current.workspace?.panels))continue;
  throw Error('Project changed during restore: '+key);
 }
 if(!changed.length)return {project,edited:false,groups:[]};
 // Reuse the normal reader for units, models and metadata, without recalculating
 // the old history again for every keystroke. A draft has no claimed result.
 const draft=readProject(JSON.stringify({...current,history:[],process:null,study:undefined,research:undefined,diagram:undefined,drafts:{},libraryRecipe:'',workspace:{active:'general',panels:{}},form:{...current.form,calculated:false,selectedRoot:undefined}}));
 const merged={...project};
 for(const key of changed)if(editable.includes(key))merged[key]=draft[key];
 if(formChanged)merged.pressure=draft.pressure;
 if(!equal(project.pressure,merged.pressure)){
  const panels=structuredClone(project.workspace.panels),drafts=structuredClone(project.drafts);
  const convert=(values,prefix,engineering=false)=>{
   const unit=values[prefix+'pressure']||'MPa';
   for(const key of engineering?['p1','p2','pc1','pc2']:['p1','p2']){
    const id=prefix+key;
    if(values[id]!=null&&values[id].trim())values[id]=String(Number(pressureOutput(pressureInput(parseNumber(values[id]),unit,project.pressure),unit,merged.pressure).toPrecision(12)));
   }
  };
  for(const kind of ['turbine','flash','engineering']){
   if(panels[kind])convert(panels[kind].inputs,kind==='engineering'?'eng-':'process-',kind==='engineering');
   if(drafts[kind])convert(drafts[kind],'',kind==='engineering');
  }
  merged.workspace={...project.workspace,panels};merged.drafts=drafts;
 }
 if(formChanged||changed.includes('pressure')){
  merged.form={...draft.form,calculated:false};merged.result=null;
  merged.workspace={...merged.workspace,active:current.workspace.active};
 }
 return {project:merged,edited:true,groups:changed};
}
