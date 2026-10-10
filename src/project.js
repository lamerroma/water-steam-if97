import {englishProperty} from './units.js';
import {referenceState} from './exergy.js';
import {calculate} from './engine.js';
import {turbine,flash} from './processes.js';
export const PROJECT_VERSION=1;
export function readProject(text){
 if(typeof text!=='string'||text.length>2000000)throw Error('Файл проєкту завеликий (максимум 2 МБ).');
 const p=JSON.parse(text);
 if(p?.format!=='water-steam-if97'||p.version!==PROJECT_VERSION)throw Error('Непідтримуваний формат або версія проєкту.');
 if(!Array.isArray(p.history)||p.history.length>500)throw Error('Журнал має містити не більше 500 станів.');
 const states=p.history.map(q=>{if(!q||!Number.isFinite(q.p)||!Number.isFinite(q.h))throw Error('Некоректний стан у журналі.');return calculate('ph',q.p,q.h).state;});
 let process=null;
 if(p.process){const q=p.process;if(!['turbine','flash'].includes(q.type)||!Array.isArray(q.args)||!(q.type==='turbine'?[5]:[4,5]).includes(q.args.length)||!q.args.every(Number.isFinite))throw Error('Некоректний процес.');process={type:q.type,args:q.args,result:q.type==='turbine'?turbine(...q.args):flash(...q.args)};}
 const f=p.form;if(!f||!['pt','ph','ps','satp','satt','px','tx','hs'].includes(f.mode)||!['MPa','kPa','Pa','bar','atm','C','K','kJkg','Jkg'].concat(['psi','F','Btulb']).includes(f.ua)||!['MPa','kPa','Pa','bar','atm','C','K','kJkg','Jkg','kJkgK','JkgK','fraction','percent'].concat(['F','Btulb','BtulbR']).includes(f.ub)||typeof f.a!=='string'||typeof f.b!=='string'||f.a.length>80||f.b.length>80)throw Error('Некоректні параметри введення.');
 const allowedA=['satt','tx'].includes(f.mode)?['C','K','F']:f.mode==='hs'?['kJkg','Jkg','Btulb']:['MPa','kPa','Pa','bar','atm','psi'];const allowedB=['px','tx'].includes(f.mode)?['fraction','percent']:f.mode==='ph'?['kJkg','Jkg','Btulb']:['ps','hs'].includes(f.mode)?['kJkgK','JkgK','BtulbR']:['C','K','F'];if(!allowedA.includes(f.ua)||!allowedB.includes(f.ub))throw Error('Одиниці не відповідають режиму.');
 const drafts={};for(const type of ['turbine','flash']){const d=p.drafts?.[type];if(!d)continue;const v={};for(const k of ['p1','t1','p2','eta','flow','power','mode','pressure','temperature','mass','power-unit'])if(typeof d[k]==='string'&&d[k].length<80)v[k]=d[k];drafts[type]=v;}
 const ambient=p.ambient||{p:.101325,T:298.15};referenceState(ambient.p,ambient.T);
 return {system:p.system==='english'?'english':'si',ambient,states,process,form:f,drafts,energy:p.energy==='J'?'J':'kJ',gray:p.gray===true,scale:['1','1.15','1.3'].includes(p.scale)?p.scale:'1'};
}
export function processCSV(type,r,system='si'){
 const convert=(k,v,u='')=>system==='english'?englishProperty(k,v,u):[v,u];
 const states=[['inlet',r.inlet],...(r.ideal?[['isentropic_outlet',r.ideal]]:[]),['outlet',r.outlet]];
 return '\ufeff'+[['process','state',`p [${convert('p',0,'MPa')[1]}]`,`T [${convert('T',273.15,'K')[1]}]`,`h [${convert('h',0,'kJ/kg')[1]}]`,`s [${convert('s',0,'kJ/(kg K)')[1]}]`,'x [-]'].join(';'),...states.map(([name,q])=>[type,name,convert('p',q.p)[0],convert('T',q.T)[0],convert('h',q.h)[0],convert('s',q.s)[0],q.x??''].join(';')),'','quantity;value;unit',...Object.entries(type==='turbine'?{work:r.work,power:r.power,efficiency:r.eta,flow:r.flow}:{flow:r.flow,vaporFlow:r.vaporFlow,liquidFlow:r.liquidFlow}).map(([k,v])=>(()=>{const [value,unit]=convert(k.includes('Flow')?'flow':k,v,k==='work'?'kJ/kg':k==='power'?'kW':k==='efficiency'?'-':'kg/s');return `${k};${value??''};${unit}`;})())].join('\r\n');
}
