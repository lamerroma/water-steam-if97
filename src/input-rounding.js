import {toCanonical} from './units.js';
// Parse the spelling, not Number.toString(): trailing zeroes carry the scenario.
export function typedRounding(text,unit){
 const normalized=String(text).trim().replace(',','.'),m=/^[+-]?(?:\d+(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(normalized);
 if(!m||!Number.isFinite(Number(normalized)))return null;
 const decimalPlaces=(m[1]??m[2]??'').length,exponent=Number(m[3]||0),step=10**(exponent-decimalPlaces);
 // Units are affine. Their offsets (Celsius/Fahrenheit, gauge pressure) must
 // never enter an increment. Use the same conversion as the calculator.
 let factor;try{factor=Math.abs(toCanonical(1,unit)-toCanonical(0,unit));}catch{return null;}
 const halfWidth=.5*step*factor;
 return Number.isFinite(halfWidth)&&halfWidth>0?{halfWidth,unit,text:String(text)}:null;
}
