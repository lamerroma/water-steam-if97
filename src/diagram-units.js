import {englishProperty} from './units.js';
// Ranges and geometry stay canonical; only tick labels and annotations convert.
export function diagramQuantity(key,value,system='si',energy='kJ'){
 if(system==='english')return englishProperty(key,key==='T'&&value!=null?value+273.15:value);
 const unit=key==='T'?'°C':key==='p'?'МПа':key==='s'?'кДж/(кг·K)':'кДж/кг';
 return energy==='J'&&['h','s'].includes(key)?[value==null?null:value*1000,unit.replace('кДж','Дж')]:[value,unit];
}
