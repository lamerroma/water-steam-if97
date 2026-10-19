import {readCustomCycleDraft} from './custom-cycle.js';
import {PROCESS_MODELS,PROCESS_GASES} from './process-gas.js';
import {WATER_PROCESS_ENDS} from './water-process.js';
import {UI_UNIT_GROUPS} from './ui-quantities.js';
import {REACTOR_CHOICES} from './reactor-course.js';
import {COURSE_FIELDS} from './coursework.js';
import {batchUnits} from './batch.js';

export const WORKSPACE_PANELS=['custom-cycle','water-process','turbine','flash','engineering','batch','satgrid','gases','humid','cycles','ice','d2o','seawater','boundaries','comparison','flow','tutorials','npp','exchanger','laboratory','coursework'];
const modes=['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'];
const species=['N2','O2','CO2','CO','H2','H2O','CH4','Ar','He','Ne','NO','SO2'];
const fields={'custom-cycle':['cc-data'],'water-process':['wp-fluid','wp-n','wp-model','wp-kind','wp-mode','wp-a','wp-b','wp-end','wp-value','wp-mass'],coursework:['cw-controlLayout','cw-kind','cw-pumpMethod','cw-areaMethod','cw-cladMethod',...Object.keys(REACTOR_CHOICES).map(k=>'cw-'+k),...new Set(Object.values(COURSE_FIELDS).flatMap(list=>list.map(([k])=>'cw-'+k)))],laboratory:['lab-kind','lab-pressure','lab-temperature','lab-flow-unit','lab-power-unit','lab-eta-unit','lab-basis','lab-atmosphere','lab-quantity','lab-eta-m','lab-eta-g','lab-source','lab-condition','lab-conclusion','lab-data'],exchanger:['hx-arrangement','hx-hotIn','hx-hotOut','hx-coldIn','hx-coldOut','hx-heatKW','hx-U'],npp:['npp-mode','npp-pMid','npp-reheatC','npp-etaLP','npp-thermalMW','npp-primaryP','npp-coldC','npp-hotC','npp-steamP','npp-condenserP','npp-etaT','npp-etaPump'],
 satgrid:['satgrid-basis','satgrid-unit','satgrid-start','satgrid-end','satgrid-step'],
 tutorials:['tutorial-id'],
 flow:['flow-hydraulics','flow-length','flow-length-unit','flow-roughness','flow-roughness-unit','flow-local-k','flow-eta','flow-height','flow-pressure-difference','flow-pressure-difference-unit','flow-source','flow-fluid','flow-p','flow-t','flow-rho','flow-rho-unit','flow-viscosity','flow-visc-kind','flow-visc-unit','flow-kind','flow-value','flow-unit','flow-diameter','flow-diameter-unit','flow-standard','flow-std-p','flow-std-t','flow-M','flow-Z','flow-std-Z'],
 turbine:['process-mode','process-pressure','process-temperature','process-mass','process-power-unit','process-p1','process-t1','process-p2','process-eta','process-flow','process-power'],
 flash:['process-mode','process-pressure','process-temperature','process-mass','process-p1','process-t1','process-p2','process-flow'],
 engineering:['eng-mode','eng-pressure','eng-temperature','eng-mass','eng-power-unit','eng-p1','eng-t1','eng-p2','eng-eta','eng-flow','eng-pc1','eng-tc1','eng-pc2','eng-coldflow','eng-power'],
 batch:['batch-mode','batch-vary','batch-ua','batch-ub','batch-start','batch-end','batch-count','batch-fixed','batch-text'],
 gases:['gas-model','gas-fluid','gas-mode','gas-p','gas-b','gas-basis','gas-fraction-scale','gas-preset',...species.map(s=>'fraction-'+s)],
 humid:['ha-p','ha-t','ha-mode','ha-rh'],
 cycles:['cycle-kind','cycle-low','cycle-high','cycle-mid','cycle-tmin','cycle-tmax','cycle-tmid','cycle-et','cycle-ec','cycle-flow'],
 ice:['ice-t','ice-p'],d2o:['d2o-mode','d2o-p','d2o-t'],seawater:['sw-s','sw-t','sw-p'],
 boundaries:['phase-substance','phase-kind','phase-ice','phase-value','phase-s'],comparison:['compare-mode','compare-a','compare-b']
};
const choices={'wp-fluid':['water',...PROCESS_GASES],'wp-model':PROCESS_MODELS,'wp-kind':Object.keys(WATER_PROCESS_ENDS),'wp-mode':['pt','px','ph','ps'],'wp-end':['T','h','x','v','p'],...Object.fromEntries(Object.entries(REACTOR_CHOICES).map(([k,v])=>['cw-'+k,v])),'cw-kind':['rankine','stage','core','reactor'],'cw-pumpMethod':['volume','isentropic'],'cw-areaMethod':['duct','course'],'cw-cladMethod':['polynomial','constant','guide'],'lab-kind':['saturation','turbine'],'lab-pressure':['MPa','kPa','bar','Pa','atm','psi'],'lab-temperature':['C','K','F'],'lab-flow-unit':['kgs','kgh'],'lab-power-unit':['kW','MW','W'],'lab-eta-unit':['fraction','percent'],'lab-basis':['absolute','gauge','vacuum'],'lab-quantity':['internal','electrical'],'npp-mode':['simple','msr'],'hx-arrangement':['counter','parallel'],
 'satgrid-basis':['temperature','pressure'],'satgrid-unit':['C','K','F','MPa','kPa','Pa','bar','atm','psi'],
 'tutorial-id':['saturation','wet','throttle','turbine','pipe','rankine-study','reheat-study','hydraulic-study','npp-study'],
 'flow-hydraulics':['off','on'],'flow-length-unit':['m','ft'],'flow-roughness-unit':['m','mm','inch'],'flow-pressure-difference-unit':['Pa','kPa','MPa','bar','psi'],'flow-source':['manual','water','real','gas'],'flow-fluid':['N2','O2','CO2','CO','H2','H2O','CH4','Ar','He','SO2','Ne'],'flow-rho-unit':['kgm3','lbft3'],'flow-visc-kind':['dynamic','kinematic'],'flow-visc-unit':['Pas','mPas','cP','m2s','mm2s','cSt'],'flow-kind':['mass','volume','velocity','standard'],'flow-unit':['kgs','kgh','lbs','lbh','m3s','m3h','ls','lmin','ft3min','ms','fts'],'flow-diameter-unit':['m','mm','inch'],'flow-standard':['off','normal','room','custom'],
 'process-pressure':['MPa','bar','kPa','psi'],'process-temperature':['C','K','F'],'process-mass':['kgs','kgh','lbs','lbh'],'process-power-unit':['kW','MW','Btuh'],
 'eng-mode':['pump','compressor','heat-exchanger'],'eng-pressure':['MPa','kPa','Pa','bar','atm','psi'],'eng-temperature':['C','K','F'],'eng-mass':['kgs','kgh','lbs','lbh'],'eng-power-unit':['kW','Btuh'],
 'batch-mode':modes,'batch-vary':['a','b'],'gas-model':['real','mixture','ideal','bsw2003'],'gas-fluid':species.filter(s=>s!=='NO'),'gas-mode':['pt','ph','ps'],'gas-basis':['mole','mass'],'gas-fraction-scale':['fraction','percent'],'gas-preset':['air','flue','custom',...species],
 'ha-mode':['R','W','D','B'],'cycle-kind':['rankine','rankine-reheat','rankine-regen','brayton'],'d2o-mode':['pt','sat'],
 'phase-substance':['H2O','D2O','seawater'],'phase-kind':['melt','subl','freeze','boil'],'phase-ice':['Ih','III','V','VI','VII'],'compare-mode':['pt','ph','ps','px','tx']
};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
// Keep only inputs, never imported computed properties or HTML. Results are recomputed
// when their panel is opened, including modules whose WASM is loaded on demand.
export function readWorkspace(value){
 if(value==null)return {active:'general',panels:{}};
 if(!record(value)||!record(value.panels)||!['general','saturation','help','ts','hsdiagram','phdiagram','tutorials','study','research','projects',...WORKSPACE_PANELS].includes(value.active))throw Error('Некоректний робочий простір проєкту.');
 const panels={};
 for(const [kind,p] of Object.entries(value.panels)){
  if(!WORKSPACE_PANELS.includes(kind)||!record(p)||!record(p.inputs)||typeof p.calculated!=='boolean'||(p.model!=null&&!(['water-process','custom-cycle'].includes(kind)?PROCESS_MODELS:['IF97','IAPWS-95']).includes(p.model)))throw Error('Некоректна вкладка проєкту.');
  const inputs={};
  for(const [id,v] of Object.entries(p.inputs)){
   const unitField=id.startsWith('ui-unit-')&&fields[kind].includes(id.slice(8));
   if(unitField&&!Object.values(UI_UNIT_GROUPS).some(g=>Object.hasOwn(g,v)))throw Error('Невідома локальна одиниця. / Unknown local unit.');
   if(!unitField&&!fields[kind].includes(id)||typeof v!=='string'||v.length>(id==='cc-data'?30000:id==='batch-text'?1000000:id==='lab-data'?100000:id==='cw-controlLayout'?20000:['lab-condition','lab-conclusion'].includes(id)?3000:id==='lab-source'?500:80))throw Error('Некоректні дані вкладки '+kind+'.');
   const allowed=id==='process-mode'?(kind==='turbine'?['power','flow','efficiency']:['condensate','saturated','subcooled']):choices[id];
   if(allowed&&!allowed.includes(v))throw Error('Невідомий режим або одиниця вкладки '+kind+'.');
   inputs[id]=v;
  }
  if(kind==='custom-cycle'&&inputs['cc-data']!=null)inputs['cc-data']=JSON.stringify(readCustomCycleDraft(JSON.parse(inputs['cc-data'])));
  if(kind==='water-process'&&inputs['wp-kind']&&inputs['wp-end']&&!(WATER_PROCESS_ENDS[inputs['wp-kind']].includes(inputs['wp-end'])))throw Error('Несумісна гранична умова процесу.');
  if(kind==='water-process'){const fluid=inputs['wp-fluid']||'water',model=inputs['wp-model']||p.model||'IF97';if((fluid==='water')!==['IF97','IAPWS-95'].includes(model)||fluid!=='water'&&(inputs['wp-mode']==='px'||inputs['wp-end']==='x'))throw Error('Несумісні речовина, модель або сухість процесу.');}
  if(kind==='coursework'&&inputs['cw-kind']==='reactor'){for(const [key,fallback] of Object.entries({resonanceMethod:'given',boilingMethod:'off',rodLayout:'effective'}))if(inputs['cw-'+key]===undefined)inputs['cw-'+key]=fallback;}
  if(kind==='flow'){if(inputs['flow-kind']==='standard'&&(!inputs['flow-standard']||inputs['flow-standard']==='off')||inputs['flow-source']==='water'&&inputs['flow-standard']&&inputs['flow-standard']!=='off')throw Error('Стандартні умови не відповідають джерелу або виду витрати.');const allowed={mass:['kgs','kgh','lbs','lbh'],volume:['m3s','m3h','ls','lmin','ft3min'],standard:['m3s','m3h','ls','lmin','ft3min'],velocity:['ms','fts']};if(inputs['flow-kind']&&inputs['flow-unit']&&!allowed[inputs['flow-kind']].includes(inputs['flow-unit']))throw Error('Одиниця не відповідає виду витрати.');if(inputs['flow-visc-kind']&&inputs['flow-visc-unit']&&!(inputs['flow-visc-kind']==='dynamic'?['Pas','mPas','cP']:['m2s','mm2s','cSt']).includes(inputs['flow-visc-unit']))throw Error('Одиниця не відповідає виду в’язкості.');}
  if(kind==='satgrid'&&inputs['satgrid-basis']&&inputs['satgrid-unit']&&!(inputs['satgrid-basis']==='temperature'?['C','K','F']:['MPa','kPa','Pa','bar','atm','psi']).includes(inputs['satgrid-unit']))throw Error('Одиниці не відповідають параметру таблиці насичення.');
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
