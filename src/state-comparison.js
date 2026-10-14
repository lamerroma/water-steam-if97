import {calculate} from './engine.js';
import {SMART_PAIRS} from './smart-input.js';
import {readUIUnits,uiDisplayQuantity} from './ui-quantities.js';
import {readPressure} from './pressure.js';
export const STATE_COMPARISON_FIELDS=[['p','MPa','Тиск','Pressure'],['T','K','Температура','Temperature'],['h','kJ/kg','Ентальпія','Enthalpy'],['s','kJ/(kg K)','Ентропія','Entropy'],['rho','kg/m³','Густина','Density'],['v','m³/kg','Питомий об’єм','Specific volume'],['u','kJ/kg','Внутрішня енергія','Internal energy'],['x','–','Сухість','Quality'],['cp','kJ/(kg K)','Ізобарна теплоємність','Isobaric heat capacity'],['cv','kJ/(kg K)','Ізохорна теплоємність','Isochoric heat capacity'],['w','m/s','Швидкість звуку','Speed of sound'],['mu','Pa·s','Динамічна в’язкість','Dynamic viscosity'],['lambda','W/(m K)','Теплопровідність','Thermal conductivity']];
export function comparisonSourceState(source){
 if(!source||!['IF97','IAPWS-95'].includes(source.model)||typeof source.name!=='string'||source.name.length>80||!SMART_PAIRS[source.mode]||source.mode.startsWith('sat')||![source.a,source.b,source.p,source.h].every(Number.isFinite))throw Error('Некоректний стан порівняння / Invalid comparison state.');
 const r=calculate(source.mode,source.a,source.b,source.model),q=[r.state,...(r.alternatives||[])].find(v=>v&&Math.abs(v.p-source.p)<=Math.max(1e-10,Math.abs(source.p)*1e-7)&&Math.abs(v.h-source.h)<=Math.max(1e-7,Math.abs(source.h)*1e-7));
 if(!q)throw Error('Стан не відповідає входам / State does not match its inputs.');return {...q,name:source.name,model:source.model};
}
export function readStateComparison(value){
 if(!value||!Array.isArray(value.states)||value.states.length<2||value.states.length>5||!Number.isInteger(value.reference)||value.reference<0||value.reference>=value.states.length)throw Error('Оберіть 2–5 станів та базовий стан / Select 2–5 states and a reference.');
 const states=value.states.map(s=>{comparisonSourceState(s);return {name:s.name,model:s.model,mode:s.mode,a:s.a,b:s.b,p:s.p,h:s.h};});
 return {states,reference:value.reference,units:readUIUnits(value.units),pressure:readPressure(value.pressure)};
}
export function compareHistoryStates(input){
 const a=readStateComparison(input),states=a.states.map(comparisonSourceState),base=states[a.reference];
 const rows=STATE_COMPARISON_FIELDS.map(([key,unit,uk,en])=>{
  const displayedUnit=uiDisplayQuantity(0,unit,a.units)[1]+(key==='p'?(a.pressure.basis==='gauge'?' (gauge)':' (abs)'):'');
  const values=states.map(q=>{
   const raw=q[key],reference=base[key];if(!Number.isFinite(raw))return {value:null,delta:null,percent:null};
   const value=uiDisplayQuantity(key==='p'&&a.pressure.basis==='gauge'?raw-a.pressure.atmosphere:raw,unit,a.units)[0];
   const delta=Number.isFinite(reference)?uiDisplayQuantity(raw-reference,unit,a.units,{difference:key==='T'})[0]:null;
   const percent=Number.isFinite(reference)&&reference!==0?100*(raw-reference)/Math.abs(reference):null;
   return {value,delta,percent};
  });
  return {key,unit:displayedUnit,uk,en,values};
 });return {input:a,states,rows};
}
export function stateComparisonTable(input,language='uk'){
 const c=compareHistoryStates(input),en=language==='en';
 return {headers:[en?'Property':'Властивість',en?'Unit':'Одиниця',...c.states.flatMap((q,i)=>{const name=q.name||String(i+1),tag=name+' · '+q.model+(i===c.input.reference?' ★':'');return [tag,tag+' Δ',tag+' Δ %'];})],rows:c.rows.map(r=>[en?r.en:r.uk,r.unit,...r.values.flatMap(v=>[v.value,v.delta,v.percent])])};
}
export function stateComparisonCSV(input,language='uk'){
 const table=stateComparisonTable(input,language),note=language==='en'?'Δ = state − reference. % uses absolute pressure and Kelvin; zero/missing reference gives no %.':'Δ = стан − базовий. % використовує абсолютний тиск і K; для нульової/відсутньої бази % не визначено.';
 const cell=v=>'"'+(typeof v==='number'?String(v):String(v??'').replace(/^[=+\-@]/,"'$&")).replaceAll('"','""')+'"';
 return '\uFEFF'+[[note],table.headers,...table.rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
export function stateComparisonInputRows(input){
 const a=readStateComparison(input),units={p:'MPa abs',T:'K',h:'kJ/kg',s:'kJ/(kg K)',u:'kJ/kg',x:'fraction',rho:'kg/m³',v:'m³/kg'};
 return [['reference',a.reference+1,'index'],['pressure basis',a.pressure.basis,'–'],['atmosphere',a.pressure.atmosphere,'MPa'],['display units',JSON.stringify(a.units),'–'],...a.states.flatMap((q,i)=>{const pair=SMART_PAIRS[q.mode],name=String(i+1)+' '+q.name+' · '+q.model;return [[name,q.mode,'–'],[name+' '+pair[0],q.a,units[pair[0]]],[name+' '+pair[1],q.b,units[pair[1]]]];})];
}
// A separate narrow table per state keeps a five-state comparison readable on A4.
export function stateComparisonReportTables(input,language='uk'){
 const c=compareHistoryStates(input),en=language==='en';return c.states.map((q,i)=>({title:(q.name||String(i+1))+' · '+q.model+(i===c.input.reference?' ★ '+(en?'Reference':'База'):''),className:'comparison-report',headers:[en?'Property':'Властивість',en?'Unit':'Одиниця',en?'Value':'Значення','Δ','Δ %'],rows:c.rows.map(r=>[en?r.en:r.uk,r.unit,r.values[i].value,r.values[i].delta,r.values[i].percent])}));
}
