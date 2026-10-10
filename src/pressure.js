import {toCanonical,fromCanonical} from './units.js';
export const PRESSURE_UNITS=['MPa','kPa','Pa','bar','atm','psi'];
export function readPressure(value){
 if(value==null)return {basis:'absolute',atmosphere:.101325};
 if(!value||!['absolute','gauge'].includes(value.basis)||!Number.isFinite(value.atmosphere)||value.atmosphere<=0)throw Error('Задайте додатний атмосферний тиск і відомий вид тиску.');
 return {basis:value.basis,atmosphere:value.atmosphere};
}
export function pressureInput(value,unit,settings){const q=toCanonical(value,unit);return PRESSURE_UNITS.includes(unit)&&settings.basis==='gauge'?q+settings.atmosphere:q;}
export function pressureOutput(value,unit,settings){return fromCanonical(PRESSURE_UNITS.includes(unit)&&settings.basis==='gauge'?value-settings.atmosphere:value,unit);}
