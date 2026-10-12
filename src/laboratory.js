import {calculate,PC,TC,PMIN_SAT} from './engine.js';
import {turbine} from './processes.js';
import {parseNumber,toCanonical,fromCanonical} from './units.js';
export const LAB_COLUMNS={saturation:['p','T','uP','uT'],turbine:['p1','T1','p2','flow','eta','power','uPower']};
export const LAB_UNITS={pressure:['MPa','kPa','bar','Pa','atm','psi'],temperature:['C','K','F'],flow:['kgs','kgh'],power:['kW','MW','W'],eta:['fraction','percent']};
export const LAB_DEFAULT={kind:'saturation',pressure:'kPa',temperature:'C',flow:'kgs',power:'kW',eta:'percent',basis:'absolute',atmosphere:101.325,quantity:'internal',etaM:1,etaG:1,source:'',condition:'',conclusion:''};
export function readLabSettings(value={}){
 const a={...LAB_DEFAULT,...value};if(!Object.hasOwn(LAB_COLUMNS,a.kind))throw Error('Невідома лабораторна робота.');
 for(const [k,values] of Object.entries(LAB_UNITS))if(!values.includes(a[k]))throw Error('Невідома одиниця лабораторної роботи.');
 if(!['absolute','gauge','vacuum'].includes(a.basis)||!['internal','electrical'].includes(a.quantity)||!Number.isFinite(a.atmosphere)||a.atmosphere<=0||![a.etaM,a.etaG].every(v=>Number.isFinite(v)&&v>0&&v<=1))throw Error('Перевірте вид тиску, атмосферний тиск і ККД.');
 for(const k of ['source','condition','conclusion'])if(typeof a[k]!=='string'||a[k].length>(k==='source'?500:3000))throw Error('Завеликий текст лабораторної роботи.');
 return Object.fromEntries(Object.keys(LAB_DEFAULT).map(k=>[k,a[k]]));
}
export function labUnit(key,a){return ['p','p1','p2','uP'].includes(key)?a.pressure:['T','T1','uT'].includes(key)?a.temperature:key==='flow'?(a.flow==='kgh'?'kg/h':'kg/s'):key==='eta'?(a.eta==='percent'?'%':'–'):a.power;}
export function labCanonical(key,value,a){
 if(value===null)return null;
 if(['p','p1','p2','uP'].includes(key)){const p=toCanonical(value,a.pressure);return key==='uP'?p:a.basis==='gauge'?p+a.atmosphere*.001:a.basis==='vacuum'?a.atmosphere*.001-p:p;}
 if(['T','T1'].includes(key))return toCanonical(value,a.temperature);
 if(key==='uT')return a.temperature==='F'?value/1.8:value;
 if(key==='flow')return a.flow==='kgh'?value/3600:value;
 if(key==='eta')return a.eta==='percent'?value/100:value;
 return a.power==='MW'?value*1000:a.power==='W'?value/1000:value;
}
export function labDisplay(key,value,a){
 if(value===null)return '';
 if(['p','p1','p2','uP'].includes(key)){const p=key==='uP'||a.basis==='absolute'?value:a.basis==='gauge'?value-a.atmosphere*.001:a.atmosphere*.001-value;return fromCanonical(p,a.pressure);}
 if(['T','T1'].includes(key))return fromCanonical(value,a.temperature);
 if(key==='uT')return a.temperature==='F'?value*1.8:value;
 if(key==='flow')return a.flow==='kgh'?value*3600:value;
 if(key==='eta')return a.eta==='percent'?value*100:value;
 return a.power==='MW'?value/1000:a.power==='W'?value*1000:value;
}
// Strict numeric CSV: semicolon/tab supports decimal commas; comma delimiter requires decimal dots.
export function parseLabCSV(text,settings=LAB_DEFAULT){
 const a=readLabSettings(settings);if(typeof text!=='string'||text.length>100000)throw Error('CSV: максимум 100 кБ.');
 const lines=text.replace(/^\uFEFF/,'').replace(/^[\r\n]+|[\r\n]+$/g,'').split(/\r?\n/);if(!text.trim()||lines.length>101)throw Error('Введіть від 1 до 100 рядків вимірювань.');
 const delimiter=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':',',columns=lines[0].split(delimiter).map(s=>s.trim());
 const expected=LAB_COLUMNS[a.kind];if(columns.length!==expected.length||columns.some((c,i)=>c!==expected[i]))throw Error('CSV: очікувані колонки '+expected.join(';')+'.');
 if(lines.length<2)throw Error('CSV не містить вимірювань.');
 return lines.slice(1).map((line,i)=>{const cells=line.split(delimiter);if(cells.length!==columns.length)throw Error('CSV: неправильна кількість колонок у рядку '+(i+2)+'.');return Object.fromEntries(columns.map((key,j)=>{const optional=key.startsWith('u')||key==='power';let n;try{n=cells[j].trim()===''&&optional?null:parseNumber(cells[j]);}catch{throw Error('CSV: некоректне число, рядок '+(i+2)+', '+key+'.');}return [key,labCanonical(key,n,a)];}));});
}
export function readLabInput(value){
 if(!value||!Object.hasOwn(LAB_COLUMNS,value.kind)||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>100)throw Error('Лабораторна робота: від 1 до 100 вимірювань.');
 const text={};for(const k of ['source','condition','conclusion']){const s=value[k]??'';if(typeof s!=='string'||s.length>(k==='source'?500:3000))throw Error('Некоректний текст лабораторної роботи.');text[k]=s;}
 const quantity=value.quantity??'internal',etaM=value.etaM??1,etaG=value.etaG??1;if(!['internal','electrical'].includes(quantity)||![etaM,etaG].every(v=>Number.isFinite(v)&&v>0&&v<=1))throw Error('Перевірте вид потужності та ККД.');
 const rows=value.rows.map(row=>Object.fromEntries(LAB_COLUMNS[value.kind].map(k=>{const v=row?.[k];if((v==null)&&(k.startsWith('u')||k==='power'))return [k,null];if(!Number.isFinite(v))throw Error('Вимірювання мають бути скінченними числами.');return [k,v];})));
 return {kind:value.kind,rows,quantity,etaM,etaG,...text};
}
export function laboratory(input,model='IF97'){
 if(!['IF97','IAPWS-95'].includes(model))throw Error('Невідома модель лабораторної роботи.');const a=readLabInput(input),rows=a.rows.map((v,index)=>{
  try{
   for(const [k,n] of Object.entries(v))if(k.startsWith('u')&&n!==null&&n<0)throw Error('Невизначеність не може бути від’ємною.');
   if(a.kind==='saturation'){
    if(v.p<PMIN_SAT||v.p>=PC||v.T<273.15||v.T>=TC)throw Error('Тиск і температура мають бути в межах рідинно-парової лінії насичення нижче критичної точки.');
    const atT=calculate('satt',v.T,undefined,model).saturation,atP=calculate('satp',v.p,undefined,model).saturation;if(!atT||!atP)throw Error('Не визначено насичення.');
    let uncertainty=null,slope=null;if(v.uP!==null&&v.uT!==null){const step=Math.min(.01,(TC-v.T)/2),lo=Math.max(273.15,v.T-step),hi=Math.min(TC-1e-7,v.T+step);slope=(calculate('satt',hi,undefined,model).saturation.p-calculate('satt',lo,undefined,model).saturation.p)/(hi-lo);uncertainty=Math.hypot(v.uP,slope*v.uT);if(!Number.isFinite(uncertainty))throw Error('Невизначеність виходить за числові межі.');}
    const delta=v.p-atT.p;return {index,input:v,expected:atT.p,measured:v.p,delta,relative:100*delta/atT.p,temperatureExpected:atP.T,deltaT:v.T-atP.T,latentHeat:atT.vapor.h-atT.liquid.h,uncertainty,normalized:uncertainty>0?delta/uncertainty:null,slope,error:null};
   }
   if(v.flow<=0)throw Error('Масова витрата має бути додатною.');if(v.power!==null&&v.power<0)throw Error('Виміряна потужність не може бути від’ємною.');
   const r=turbine(v.p1,v.T1,v.p2,v.eta,v.flow,model),expected=r.power*(a.quantity==='electrical'?a.etaM*a.etaG:1),delta=v.power===null?null:v.power-expected;if(!Number.isFinite(expected)||expected<=0||delta!==null&&!Number.isFinite(delta))throw Error('Потужність виходить за числові межі розрахунку.');
   return {index,input:v,expected,measured:v.power,delta,relative:delta===null||!Number.isFinite(delta/expected*100)?null:delta/expected*100,uncertainty:v.power===null?null:v.uPower,normalized:v.uPower>0&&delta!==null&&Number.isFinite(delta/v.uPower)?delta/v.uPower:null,result:r,error:null};
  }catch(e){return {index,input:v,error:e.message};}
 });
 const valid=rows.filter(r=>!r.error),compared=valid.filter(r=>r.delta!==null),n=compared.length,mean=n?compared.reduce((s,r)=>s+r.delta/n,0):null,mae=n?compared.reduce((s,r)=>s+Math.abs(r.delta)/n,0):null,rmse=n?Math.hypot(...compared.map(r=>r.delta/Math.sqrt(n))):null;
 return {input:a,model,rows,valid:valid.length,invalid:rows.length-valid.length,compared:n,mean,mae,rmse};
}
export function labTable(q,english=false){const t=(uk,en)=>english?en:uk,sat=q.input.kind==='saturation';
 const headers=sat?['#','p [MPa abs]','T [K]','u(p) [MPa]','u(T) [K]','p model [MPa]','Δp [MPa]','Δp [%]','ΔT [K]','u(Δp) [MPa]','Δp/u',t('Статус','Status')]:['#','p₁ [MPa abs]','T₁ [K]','p₂ [MPa abs]','ṁ [kg/s]','ηᵢ [–]',t('N виміряна [kW]','N measured [kW]'),'u(N) [kW]','N model [kW]','ΔN [kW]','ΔN [%]','ΔN/u',t('Статус','Status')];
 const rows=q.rows.map(r=>[r.index+1,...(sat?[r.input.p,r.input.T,r.input.uP,r.input.uT,r.expected,r.delta,r.relative,r.deltaT,r.uncertainty,r.normalized]:[r.input.p1,r.input.T1,r.input.p2,r.input.flow,r.input.eta,r.input.power,r.input.uPower,r.expected,r.delta,r.relative,r.normalized]),r.error?(english?labErrorEnglish(r.error):r.error):'OK']);return {headers,rows};
}
export function laboratoryCSV(q,english=false){const table=labTable(q,english),cell=v=>{let s=v==null?'':String(v);if(/^[=+@]/.test(s)||typeof v!=='number'&&/^-/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\uFEFF'+[table.headers,...table.rows,['model',q.model],['power_quantity',q.input.quantity],['source',q.input.source],['condition',q.input.condition],['conclusion',q.input.conclusion]].map(row=>row.map(cell).join(';')).join('\r\n');}
export function labMeasurementCSV(input,settings){const a=readLabSettings(settings);return LAB_COLUMNS[a.kind].join(';')+'\n'+input.rows.map(row=>LAB_COLUMNS[a.kind].map(k=>{const v=labDisplay(k,row[k],a);return v===''?'':String(Number(v.toPrecision(12)));}).join(';')).join('\n');}
export function labExample(kind,model='IF97'){
 const rows=kind==='saturation'?[303.15,323.15,343.15,363.15,373.15].map((T,i)=>({T,p:calculate('satt',T,undefined,model).saturation.p+(i-2)*.00002,uP:.00005,uT:.1})):[.5,1,1.5].map((flow,i)=>({p1:3,T1:673.15,p2:.1,flow,eta:.85,power:turbine(3,673.15,.1,.85,flow,model).power+(i-1)*2,uPower:2}));
 return {kind,rows,quantity:'internal',etaM:1,etaG:1,source:'Синтетичний навчальний приклад / Synthetic educational example',condition:'',conclusion:''};
}
export function labErrorEnglish(message){
 const map={
 'Невідомa лабораторна робота.':'Unknown laboratory scenario.',
 'Невідома лабораторна робота.':'Unknown laboratory scenario.',
 'Невідома одиниця лабораторної роботи.':'Unknown laboratory unit.',
 'Перевірте вид тиску, атмосферний тиск і ККД.':'Check pressure basis, atmospheric pressure and efficiencies.',
 'Завеликий текст лабораторної роботи.':'Laboratory text is too long.',
 'CSV: максимум 100 кБ.':'CSV: maximum 100 kB.',
 'Введіть від 1 до 100 рядків вимірювань.':'Enter 1 to 100 measurement rows.',
 'CSV не містить вимірювань.':'CSV contains no measurements.',
 'Невизначеність не може бути від’ємною.':'Uncertainty cannot be negative.',
 'Тиск і температура мають бути в межах рідинно-парової лінії насичення нижче критичної точки.':'Pressure and temperature must lie within the liquid-vapour saturation range below the critical point.',
 'Не визначено насичення.':'Saturation could not be determined.',
 'Невизначеність виходить за числові межі.':'Uncertainty exceeds numerical limits.',
 'Масова витрата має бути додатною.':'Mass flow must be positive.',
 'Виміряна потужність не може бути від’ємною.':'Measured power cannot be negative.',
 'Потужність виходить за числові межі розрахунку.':'Power exceeds numerical limits.',
 'Вихідний абсолютний тиск має бути додатним і нижчим за вхідний.':'Outlet absolute pressure must be positive and lower than inlet pressure.',
 'Ізоентропний ККД має бути в межах 0 < η ≤ 1.':'Isentropic efficiency must satisfy 0 < η ≤ 1.',
 'Для парової турбіни задайте паровий стан на вході з додатним перепадом ентальпії.':'Specify inlet steam with a positive enthalpy drop.',
 'На вході потрібен однозначний однофазний стан; P–T на насиченні недостатньо.':'An unambiguous single-phase inlet is required; P–T at saturation is insufficient.'
 };return map[message]||message.replace('CSV: очікувані колонки ','CSV: expected columns ').replace('CSV: неправильна кількість колонок у рядку ','CSV: wrong column count at row ').replace('CSV: некоректне число, рядок ','CSV: invalid number at row ');
}
