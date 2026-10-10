import {batchUnits} from './batch.js';

export const WORKSPACE_PANELS=['turbine','flash','engineering','batch','gases','humid','cycles','ice','d2o','seawater','boundaries','comparison'];
const modes=['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'];
const species=['N2','O2','CO2','CO','H2','H2O','CH4','Ar','He','Ne','NO','SO2'];
const fields={
 turbine:['process-mode','process-pressure','process-temperature','process-mass','process-power-unit','process-p1','process-t1','process-p2','process-eta','process-flow','process-power'],
 flash:['process-mode','process-pressure','process-temperature','process-mass','process-p1','process-t1','process-p2','process-flow'],
 engineering:['eng-mode','eng-pressure','eng-temperature','eng-mass','eng-power-unit','eng-p1','eng-t1','eng-p2','eng-eta','eng-flow','eng-pc1','eng-tc1','eng-pc2','eng-coldflow','eng-power'],
 batch:['batch-mode','batch-vary','batch-ua','batch-ub','batch-start','batch-end','batch-count','batch-fixed','batch-text'],
 gases:['gas-model','gas-fluid','gas-mode','gas-p','gas-b','gas-basis','gas-preset',...species.map(s=>'fraction-'+s)],
 humid:['ha-p','ha-t','ha-mode','ha-rh'],
 cycles:['cycle-kind','cycle-low','cycle-high','cycle-mid','cycle-tmin','cycle-tmax','cycle-tmid','cycle-et','cycle-ec','cycle-flow'],
 ice:['ice-t','ice-p'],d2o:['d2o-mode','d2o-p','d2o-t'],seawater:['sw-s','sw-t','sw-p'],
 boundaries:['phase-substance','phase-kind','phase-ice','phase-value','phase-s'],comparison:['compare-mode','compare-a','compare-b']
};
const choices={
 'process-pressure':['MPa','bar','kPa','psi'],'process-temperature':['C','K','F'],'process-mass':['kgs','kgh','lbs','lbh'],'process-power-unit':['kW','Btuh'],
 'eng-mode':['pump','compressor','heat-exchanger'],'eng-pressure':['MPa','kPa','Pa','bar','atm','psi'],'eng-temperature':['C','K','F'],'eng-mass':['kgs','kgh','lbs','lbh'],'eng-power-unit':['kW','Btuh'],
 'batch-mode':modes,'batch-vary':['a','b'],'gas-model':['real','mixture','ideal'],'gas-fluid':species.filter(s=>s!=='NO'),'gas-mode':['pt','ph','ps'],'gas-basis':['mole','mass'],'gas-preset':['air','flue','custom',...species],
 'ha-mode':['R','W','D','B'],'cycle-kind':['rankine','rankine-reheat','rankine-regen','brayton'],'d2o-mode':['pt','sat'],
 'phase-substance':['H2O','D2O','seawater'],'phase-kind':['melt','subl','freeze','boil'],'phase-ice':['Ih','III','V','VI','VII'],'compare-mode':['pt','ph','ps','px','tx']
};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
// Keep only inputs, never imported computed properties or HTML. Results are recomputed
// when their panel is opened, including modules whose WASM is loaded on demand.
export function readWorkspace(value){
 if(value==null)return {active:'general',panels:{}};
 if(!record(value)||!record(value.panels)||!['general','saturation','help','ts','hsdiagram',...WORKSPACE_PANELS].includes(value.active))throw Error('Некоректний робочий простір проєкту.');
 const panels={};
 for(const [kind,p] of Object.entries(value.panels)){
  if(!WORKSPACE_PANELS.includes(kind)||!record(p)||!record(p.inputs)||typeof p.calculated!=='boolean'||(p.model!=null&&!['IF97','IAPWS-95'].includes(p.model)))throw Error('Некоректна вкладка проєкту.');
  const inputs={};
  for(const [id,v] of Object.entries(p.inputs)){
   if(!fields[kind].includes(id)||typeof v!=='string'||v.length>(id==='batch-text'?1000000:80))throw Error('Некоректні дані вкладки '+kind+'.');
   const allowed=id==='process-mode'?(kind==='turbine'?['power','flow','efficiency']:['subcooled','saturated']):choices[id];
   if(allowed&&!allowed.includes(v))throw Error('Невідомий режим або одиниця вкладки '+kind+'.');
   inputs[id]=v;
  }
  if(kind==='batch'&&inputs['batch-mode']){const u=batchUnits(inputs['batch-mode']);for(const [id,list] of [['batch-ua',u.a],['batch-ub',u.b]])if(inputs[id]&&!list.includes(inputs[id]))throw Error('Одиниці серії не відповідають режиму.');}
  if(kind==='boundaries'){
   if(inputs['phase-kind']&&!(inputs['phase-substance']==='seawater'?['freeze','boil']:['melt','subl']).includes(inputs['phase-kind']))throw Error('Фазова межа не відповідає речовині.');
   if(inputs['phase-substance']==='D2O'&&inputs['phase-ice']==='VII')throw Error('Для D₂O лід VII не підтримується.');
  }
  if(p.source!=null&&!(kind==='batch'&&['range','csv'].includes(p.source)))throw Error('Некоректне джерело серії.');
  panels[kind]={inputs,calculated:p.calculated,model:p.model||'IF97',...(p.source?{source:p.source}:{})};
 }
 return {active:value.active,panels};
}

export function readCalculation(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('Файл розрахунку завеликий (максимум 2 МБ).');
 const p=JSON.parse(text);
 if(!record(p)||!WORKSPACE_PANELS.includes(p.module)||(p.format!=null&&p.format!=='water-steam-calculation')||(p.version!=null&&p.version!==1))throw Error('Непідтримуваний файл розрахунку.');
 const workspace=readWorkspace({active:p.module,panels:{[p.module]:{inputs:p.inputs,calculated:true,model:p.model||'IF97',...(p.source?{source:p.source}:{})}}});
 return {module:p.module,record:workspace.panels[p.module]};
}
