export function parseNumber(text) {
  const value=String(text).trim().replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw Error('Введіть число без розділювачів тисяч. Десяткова кома або крапка дозволені.');
  const n=Number(value);if(!Number.isFinite(n))throw Error('Число має бути скінченним.');return n;
}
const pressureFactors={MPa:1,kPa:0.001,Pa:1e-6,bar:0.1,atm:0.101325,psi:.45359237*9.80665/(.3048/12)**2/1e6};
export function toCanonical(value,unit) {
  if(unit in pressureFactors)return value*pressureFactors[unit];
  if(unit==='F')return (value-32)/1.8+273.15;
  if(unit==='Btulb')return value*2.326;
  if(unit==='BtulbR')return value*4.1868;
  if(unit==='C')return value+273.15;
  if(unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value/1000;
  if(unit==='fraction')return value;if(unit==='percent')return value/100;
  throw Error('Невідома одиниця.');
}
export function fromCanonical(value,unit) {
  if(unit in pressureFactors)return value/pressureFactors[unit];
  if(unit==='F')return (value-273.15)*1.8+32;
  if(unit==='Btulb')return value/2.326;
  if(unit==='BtulbR')return value/4.1868;
  if(unit==='C')return value-273.15;
  if(unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value*1000;
  if(unit==='fraction')return value;if(unit==='percent')return value*100;
  throw Error('Невідома одиниця.');
}
// International pound/foot, standard gravity and International Table Btu (NIST SP811).
const LB=.45359237,FT=.3048,BTU=1055.05585262,PSI=LB*9.80665/(FT/12)**2;
export function englishProperty(key,value,unit=''){
 const e=1000*LB/BTU,v=LB/FT**3,p=1e6/PSI;
 const map={p:[p,'psi'],T:[1.8,'°F'],rho:[FT**3/LB,'lb/ft³'],v:[v,'ft³/lb'],h:[e,'Btu/lb'],u:[e,'Btu/lb'],A:[e,'Btu/lb'],G:[e,'Btu/lb'],ex:[e,'Btu/lb'],s:[e/1.8,'Btu/(lb·°R)'],cp:[e/1.8,'Btu/(lb·°R)'],cv:[e/1.8,'Btu/(lb·°R)'],w:[1/FT,'ft/s'],alpha:[1/1.8,'1/°R'],kappa:[1/p,'1/psi'],dvdt:[v/1.8,'ft³/(lb·°R)'],dvdp:[v/p,'ft³/(lb·psi)'],dpdt:[p/1.8,'psi/°R'],dpdv:[p/v,'psi·lb/ft³'],jt:[1.8/p,'°R/psi'],ijt:[e/p,'Btu/(lb·psi)'],mu:[FT/LB,'lb/(ft·s)'],nu:[1/FT**2,'ft²/s'],diffusivity:[1/FT**2,'ft²/s'],lambda:[3600*FT/(BTU*1.8),'Btu/(h·ft·°R)'],sigma:[FT/(LB*9.80665),'lbf/ft'],flow:[1/LB,'lb/s'],power:[3600000/BTU,'Btu/h'],work:[e,'Btu/lb']};
 const spec=map[key];if(!spec)return [value,unit];return [value==null?null:key==='T'?(value-273.15)*1.8+32:value*spec[0],spec[1]];
}
