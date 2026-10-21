import {isScientificWater} from './water-models.js';
import {WATER_MODELS} from './water-models.js';
import {calculate,TC,PC,PMIN_SAT} from './engine.js';
import {toCanonical,englishProperty} from './units.js';

export function saturationGrid({basis,unit,start,end,step},model='IF97'){
 const units=basis==='temperature'?['C','K','F']:basis==='pressure'?['MPa','kPa','Pa','bar','atm','psi']:[];
 if(!units.includes(unit)||!WATER_MODELS.includes(model))throw Error('Невірний параметр, одиниця або модель таблиці насичення.');
 if(![start,end,step].every(Number.isFinite)||end<start||step<=0)throw Error('Потрібні скінченні числа, кінець ≥ початок і додатний крок.');
 const a=toCanonical(start,unit),b=toCanonical(end,unit);
 const minimum=basis==='temperature'?(model==='IF97'?273.15:273.16):(model==='IF97'?PMIN_SAT:calculate('satt',273.16,undefined,model).saturation.p);
 const maximum=basis==='temperature'?TC:PC;
 if(a<minimum-1e-10||b>maximum+1e-10||(isScientificWater(model)&&b>=maximum))throw Error('Діапазон має бути в межах насичення обраної моделі. Критична точка IAPWS-95 виключена.');
 const count=Math.floor((end-start)/step+1e-10)+1;
 if(!Number.isFinite(count)||count>500)throw Error('Таблиця має містити не більше 500 рядків — збільште крок.');
 return Array.from({length:count},(_,i)=>{
  const input=start+i*step;
  try{return {input,saturation:calculate(basis==='temperature'?'satt':'satp',toCanonical(input,unit),undefined,model).saturation};}
  catch(e){return {input,error:e.message};}
 });
}
export const SATURATION_COLUMNS=[['p','p'],['T','t'],['vl','v′'],['vg','v″'],['hl','h′'],['hg','h″'],['sl','s′'],['sg','s″'],['r','r']];
export function saturationCell(key,sat,system='si',energy='kJ'){
 const property={vl:'v',vg:'v',hl:'h',hg:'h',sl:'s',sg:'s',r:'h'}[key]||key;
 const value=sat?(key==='r'?sat.latentHeat:key.endsWith('l')?sat.liquid[property]:key.endsWith('g')?sat.vapor[property]:sat[key]):null;
 if(system==='english')return englishProperty(property,value);
 const units={p:'МПа',T:'°C',v:'м³/кг',h:'кДж/кг',s:'кДж/(кг·K)'};
 if(property==='T')return [value==null?null:value-273.15,units.T];
 const factor=energy==='J'&&['h','s'].includes(property)?1000:1;
 return [value==null?null:value*factor,factor===1000?units[property].replace('кДж','Дж'):units[property]];
}
export function saturationCSV(records,system='si',energy='kJ',model='IF97'){
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows=[['pressure_basis','absolute'],['model',model],['input',...SATURATION_COLUMNS.map(([k,label])=>`${label} [${saturationCell(k,null,system,energy)[1]}]`),'status','message'],...records.map(row=>[row.input,...SATURATION_COLUMNS.map(([k])=>row.error?'':saturationCell(k,row.saturation,system,energy)[0]),row.error?'error':'ok',row.error||''])];
 return '\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
}
