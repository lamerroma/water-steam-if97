export function parseNumber(text) {
  const value=String(text).trim().replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw Error('Введіть число без розділювачів тисяч. Десяткова кома або крапка дозволені.');
  const n=Number(value);if(!Number.isFinite(n))throw Error('Число має бути скінченним.');return n;
}
const pressureFactors={MPa:1,kPa:0.001,Pa:1e-6,bar:0.1,atm:0.101325};
export function toCanonical(value,unit) {
  if(unit in pressureFactors)return value*pressureFactors[unit];
  if(unit==='C')return value+273.15;
  if(unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value/1000;
  if(unit==='fraction')return value;if(unit==='percent')return value/100;
  throw Error('Невідома одиниця.');
}
export function fromCanonical(value,unit) {
  if(unit in pressureFactors)return value/pressureFactors[unit];
  if(unit==='C')return value-273.15;
  if(unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value*1000;
  if(unit==='fraction')return value;if(unit==='percent')return value*100;
  throw Error('Невідома одиниця.');
}
