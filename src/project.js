import {readStudyReport} from './study-report.js';
import {batchUnits} from './batch.js';
import {compression,heatExchanger} from './engineering.js';
import {englishProperty} from './units.js';
import {referenceState} from './exergy.js';
import {calculate} from './engine.js';
import {turbine,flash,throttle} from './processes.js';
import {parseNumber,toCanonical} from './units.js';
import {readDisplayDigits} from './ux-display.js';
import {readPressure,pressureInput} from './pressure.js';
import {readDiagramWorkspace} from './diagram-workspace.js';
import {readWorkspace} from './workspace.js';
export const PROJECT_VERSION=1;
export function readProject(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('Файл проєкту завеликий (максимум 2 МБ).');
 const p=JSON.parse(text);
 if(p?.format!=='water-steam-if97'||p.version!==PROJECT_VERSION)throw Error('Непідтримуваний формат або версія проєкту.');
 if(!Array.isArray(p.history)||p.history.length>500)throw Error('Журнал має містити не більше 500 станів.');
 if(p.process?.model!=null&&!['IF97','IAPWS-95'].includes(p.process.model))throw Error('Невідома формуляція процесу.');
 const workspace=readWorkspace(p.workspace),pressure=readPressure(p.pressure);
 const states=p.history.map(q=>{
  if(!q||!Number.isFinite(q.p)||!Number.isFinite(q.h))throw Error('Некоректний стан у журналі.');
  if(q.model!=null&&!['IF97','IAPWS-95'].includes(q.model))throw Error('Невідома формуляція стану.');
  if(q.name!=null&&(typeof q.name!=='string'||q.name.length>80))throw Error('Назва стану має бути до 80 символів.');
  let state,source;
  if(q.source){
   const z=q.source;if(!['pt','ph','ps','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'].includes(z.mode)||!Number.isFinite(z.a)||!Number.isFinite(z.b))throw Error('Некоректні входи стану.');
   const r=calculate(z.mode,z.a,z.b,q.model||'IF97');
   state=[r.state,...(r.alternatives||[])].find(v=>v&&Math.abs(v.p-q.p)<=Math.max(1e-10,Math.abs(q.p)*1e-7)&&Math.abs(v.h-q.h)<=Math.max(1e-7,Math.abs(q.h)*1e-7));
   if(!state)throw Error('Стан журналу не відповідає збереженим входам.');source={mode:z.mode,a:z.a,b:z.b};
  }else state=calculate('ph',q.p,q.h,q.model||'IF97').state;
  return {...state,name:q.name||'',...(source?{source}:{})};
 });
 let process=null;
 if(p.process){const q=p.process;if(!['turbine','flash','throttle','compressor','pump','heat-exchanger'].includes(q.type)||!Array.isArray(q.args)||!(q.type==='throttle'?[3]:q.type==='heat-exchanger'?[9]:q.type==='flash'?[4,5]:[5]).includes(q.args.length)||!q.args.every(Number.isFinite))throw Error('Некоректний процес.');process={type:q.type,args:q.args,model:q.model||'IF97',result:q.type==='throttle'?throttle(...q.args,q.model||'IF97'):q.type==='turbine'?turbine(...q.args,q.model||'IF97'):q.type==='flash'?flash(...q.args,...(q.args.length===4?[0]:[]),q.model||'IF97'):q.type==='heat-exchanger'?heatExchanger(...q.args,q.model||'IF97'):compression(q.type,...q.args,q.model||'IF97')};}
 const f=p.form;if(f?.model!=null&&!['IF97','IAPWS-95'].includes(f.model))throw Error('Невідома формуляція проєкту.');if(!f||!['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'].includes(f.mode)||!['MPa','kPa','Pa','bar','atm','C','K','kJkg','Jkg'].concat(['psi','F','Btulb','m3kg','ft3lb']).includes(f.ua)||!['MPa','kPa','Pa','bar','atm','C','K','kJkg','Jkg','kJkgK','JkgK','fraction','percent'].concat(['F','Btulb','BtulbR','kgm3','lbft3','m3kg','ft3lb']).includes(f.ub)||typeof f.a!=='string'||typeof f.b!=='string'||f.a.length>80||f.b.length>80)throw Error('Некоректні параметри введення.');
 if(f.inputStyle!=null&&!['smart','advanced'].includes(f.inputStyle)||f.inputOrder!=null&&!['canonical','reverse'].includes(f.inputOrder))throw Error('Некоректний спосіб введення.');
 const {a:allowedA,b:allowedB}=batchUnits(f.mode);if(!allowedA.includes(f.ua)||!allowedB.includes(f.ub))throw Error('Одиниці не відповідають режиму.');
 if(f.calculated!=null&&typeof f.calculated!=='boolean')throw Error('Некоректний статус розрахунку.');
 const result=f.calculated?calculate(f.mode,pressureInput(parseNumber(f.a),f.ua,pressure),f.mode.startsWith('sat')?undefined:pressureInput(parseNumber(f.b),f.ub,pressure),f.model||'IF97'):null;
 const drafts={};for(const type of ['turbine','flash','engineering']){const d=p.drafts?.[type];if(!d)continue;const v={};for(const k of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit','pc1','tc1','pc2','coldflow'])if(typeof d[k]==='string'&&d[k].length<80)v[k]=d[k];drafts[type]=v;}
 const ambient=p.ambient||{p:.101325,T:298.15};referenceState(ambient.p,ambient.T);
 if(p.title!=null&&(typeof p.title!=='string'||p.title.length>80))throw Error('Назва проєкту має бути до 80 символів.');
 return {study:readStudyReport(p.study),digits:readDisplayDigits(p.digits),diagram:readDiagramWorkspace(p.diagram,states),pressure,title:p.title||'Вода та пара',system:p.system==='english'?'english':'si',ambient,states,process,form:f,drafts,workspace,result,energy:p.energy==='J'?'J':'kJ',gray:p.gray===true,scale:['1','1.15','1.3'].includes(p.scale)?p.scale:'1',hints:p.hints!==false};
}
export function processCSV(type,r,system='si'){
 const convert=(k,v,u='')=>system==='english'?englishProperty(k,v,u):[v,u];
 const states=[['inlet',r.inlet],...(r.ideal?[['isentropic_outlet',r.ideal]]:[]),['outlet',r.outlet]];
 return '\ufeff'+[['process','state',`p [${convert('p',0,'MPa')[1]}]`,`T [${convert('T',273.15,'K')[1]}]`,`h [${convert('h',0,'kJ/kg')[1]}]`,`s [${convert('s',0,'kJ/(kg K)')[1]}]`,'x [-]'].join(';'),...states.map(([name,q])=>[type,name,convert('p',q.p)[0],convert('T',q.T)[0],convert('h',q.h)[0],convert('s',q.s)[0],q.x??''].join(';')),'',`model;${r.inlet.model||'IF97'}`,'pressure_basis;absolute','quantity;value;unit',...Object.entries(type==='turbine'?{work:r.work,power:r.power,efficiency:r.eta,flow:r.flow}:{flow:r.flow,vaporFlow:r.vaporFlow,liquidFlow:r.liquidFlow}).map(([k,v])=>(()=>{const [value,unit]=convert(k.includes('Flow')?'flow':k,v,k==='work'?'kJ/kg':k==='power'?'kW':k==='efficiency'?'-':'kg/s');return `${k};${value??''};${unit}`;})())].join('\r\n');
}
