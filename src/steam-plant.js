// Steam-plant balances in the style of steam-system engineering calculators:
// condensate loads, separator dryness, air in steam and steam economics.
// Water/steam states from IF97. Energy in kJ, power in kW, mass flow in kg/s,
// pressure absolute in MPa, temperature in K.
//
// Sources: first-law energy balances; Fourier conduction through a cylindrical
// insulation layer (Incropera, Fundamentals of Heat and Mass Transfer, §3.3);
// Dalton's law for steam–air mixtures; boiler efficiency by the direct
// (input–output) method of ASME PTC 4 / EN 12952-15.
import {calculate} from './engine.js';

function positive(n,label){if(!Number.isFinite(n)||n<=0)throw Error(label+' має бути додатним скінченним числом.');return n;}
function nonNegative(n,label){if(!Number.isFinite(n)||n<0)throw Error(label+' має бути невід’ємним скінченним числом.');return n;}
function fraction(n,label,allowZero=true){if(!Number.isFinite(n)||n<0||n>1||(!allowZero&&n===0))throw Error(label+' має бути в межах 0…1.');return n;}
function state(mode,a,b){const r=calculate(mode,a,b);if(!r.state||r.alternatives?.length)throw Error('Не вдалося однозначно визначити стан води/пари.');return r.state;}

// Heat released per kg of steam: from the supply state down to the condensate
// leaving the equipment (saturated at the steam pressure unless subcooled).
export function steamHeat({p,T=null,x=1,subcooling=0}){
 positive(p,'Тиск пари');nonNegative(subcooling,'Переохолодження конденсату');
 const supply=T==null?state('px',p,fraction(x,'Сухість')):state('pt',p,positive(T,'Температура пари'));
 if(supply.x==null&&supply.region===1)throw Error('За цих P і T середовище рідке, а не пара.');
 const sat=state('px',p,0),condensate=subcooling>0?state('pt',p,sat.T-subcooling):sat;
 const q=supply.h-condensate.h;positive(q,'Теплота, що віддає пара');
 return {supply,condensate,q,Tsat:sat.T};
}

const STEEL_CP=0.49; // kJ/(kg·K), carbon steel near 100–200 °C

// kind:
//  'warmup'   — pipe start-up: pipe mass per metre, length, start temperature, time.
//  'pipe-loss' — running loss of a (possibly insulated) pipe at ambient temperature.
//  'tank'     — batch heating of a liquid mass in a given time.
//  'exchanger' — continuous heating of a liquid flow.
//  'air-heater' — heating an air flow (volume at the inlet temperature).
//  'duty'     — known heat duty.
export function condensateLoad(kind,input){
 const steam=steamHeat(input.steam||{});let heat,detail={};
 const safety=input.safetyFactor==null?1:input.safetyFactor;if(!Number.isFinite(safety)||safety<1)throw Error('Коефіцієнт запасу має бути ≥ 1.');
 if(kind==='warmup'){
  const {massPerMetre,length,T0,time,cp=STEEL_CP}=input;positive(massPerMetre,'Маса 1 м труби');positive(length,'Довжина');positive(time,'Час прогріву');positive(cp,'Теплоємність металу');
  if(!Number.isFinite(T0)||T0>=steam.Tsat)throw Error('Початкова температура має бути нижчою за температуру насичення.');
  const energy=massPerMetre*length*cp*(steam.Tsat-T0);heat=energy/time;detail={energy,mass:massPerMetre*length};
 }else if(kind==='pipe-loss'){
  const {outerDiameter,length,Tamb,insulationThickness=0,insulationConductivity=0.04,surfaceCoefficient=10}=input;
  positive(outerDiameter,'Зовнішній діаметр труби');positive(length,'Довжина');positive(surfaceCoefficient,'Коефіцієнт тепловіддачі поверхні');nonNegative(insulationThickness,'Товщина ізоляції');
  if(!Number.isFinite(Tamb)||Tamb>=steam.Tsat)throw Error('Температура довкілля має бути нижчою за температуру пари.');
  const r1=outerDiameter/2,r2=r1+insulationThickness;
  const resistance=(insulationThickness>0?Math.log(r2/r1)/(2*Math.PI*positive(insulationConductivity,'Теплопровідність ізоляції')):0)+1/(2*Math.PI*r2*surfaceCoefficient);
  const perMetre=(steam.Tsat-Tamb)/resistance/1000; // kW/m
  heat=perMetre*length;detail={perMetre,surfaceTemperature:steam.Tsat-(steam.Tsat-Tamb)*(insulationThickness>0?Math.log(r2/r1)/(2*Math.PI*insulationConductivity)/resistance:0)};
 }else if(kind==='tank'){
  const {mass,cp=4.19,T1,T2,time}=input;positive(mass,'Маса рідини');positive(cp,'Теплоємність рідини');positive(time,'Час нагріву');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Кінцева температура має бути вищою за початкову.');
  if(T2>=steam.Tsat)throw Error('Кінцева температура рідини має бути нижчою за температуру насичення пари.');
  heat=mass*cp*(T2-T1)/time;detail={energy:mass*cp*(T2-T1)};
 }else if(kind==='exchanger'){
  const {flow,cp=4.19,T1,T2}=input;positive(flow,'Витрата рідини');positive(cp,'Теплоємність рідини');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Температура на виході має бути вищою за температуру на вході.');
  if(T2>=steam.Tsat)throw Error('Температура на виході має бути нижчою за температуру насичення пари.');
  heat=flow*cp*(T2-T1);
 }else if(kind==='air-heater'){
  const {volumeFlow,T1,T2,p=0.101325}=input;positive(volumeFlow,'Об’ємна витрата повітря');positive(p,'Тиск повітря');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Температура на виході має бути вищою за температуру на вході.');
  if(T2>=steam.Tsat)throw Error('Температура повітря на виході має бути нижчою за температуру насичення пари.');
  const R=0.287047,rho=p*1000/(R*T1),cp=1.006,mass=volumeFlow*rho;heat=mass*cp*(T2-T1);detail={airDensity:rho,airMass:mass};
 }else if(kind==='duty'){heat=positive(input.heat,'Теплове навантаження');}
 else throw Error('Невідомий тип конденсатного навантаження.');
 const condensate=heat/steam.q;
 return {kind,heat,condensate,design:condensate*safety,safetyFactor:safety,q:steam.q,Tsat:steam.Tsat,steam:steam.supply,...detail};
}

// Separator: removes a fraction η of the entrained water.
export function separatorDryness({p,x,efficiency,massFlow=1}){
 positive(p,'Тиск');fraction(x,'Сухість на вході');fraction(efficiency,'Ефективність сепаратора');positive(massFlow,'Витрата');
 const water=(1-x)*massFlow,removed=water*efficiency,outFlow=massFlow-removed,x2=(x*massFlow)/outFlow;
 const before=state('px',p,x),after=state('px',p,x2),liquid=state('px',p,0);
 return {x1:x,x2,removed,outFlow,h1:before.h,h2:after.h,heatGainPerKg:after.h-before.h,liquid};
}

// Air in steam: Dalton's law. airFraction is the volume (mole) fraction of air.
export function airInSteam({p,airFraction}){
 positive(p,'Загальний тиск');fraction(airFraction,'Об’ємна частка повітря');if(airFraction>=1)throw Error('Частка повітря має бути меншою за 1.');
 const ps=p*(1-airFraction),pure=state('px',p,1),mix=state('px',ps,1);
 const Ma=28.965,Mw=18.015,massFractionAir=airFraction*Ma/(airFraction*Ma+(1-airFraction)*Mw);
 return {steamPartialPressure:ps,Tpure:pure.T,Tmix:mix.T,temperatureDrop:pure.T-mix.T,massFractionAir,
  notes:['Температура суміші дорівнює температурі насичення за парціальним тиском пари (закон Дальтона). Повітря також погіршує тепловіддачу при конденсації.']};
}

// Steam cost per tonne: fuel to raise the enthalpy from feedwater to steam,
// plus water/treatment cost. fuelPrice per unit of fuel; lhv in kJ per unit.
export function steamCost({p,T=null,feedT,efficiency,fuelPrice,lhv,waterCost=0}){
 positive(p,'Тиск пари');fraction(efficiency,'ККД котла',false);positive(fuelPrice,'Ціна палива');positive(lhv,'Нижча теплота згоряння');nonNegative(waterCost,'Вартість води');
 const steam=T==null?state('px',p,1):state('pt',p,positive(T,'Температура пари')),fw=state('pt',p,positive(feedT,'Температура живильної води'));
 if(fw.region!==1)throw Error('Живильна вода має бути рідкою за тиску котла.');
 const dh=steam.h-fw.h;positive(dh,'Приріст ентальпії');
 const fuelPerTonne=1000*dh/(efficiency*lhv),cost=fuelPerTonne*fuelPrice+waterCost;
 return {dh,fuelPerTonne,fuelCostPerTonne:fuelPerTonne*fuelPrice,costPerTonne:cost,energyCostPerGJ:fuelPrice/(lhv/1e6)/efficiency};
}

// Boiler efficiency, direct method: η = ṁs·(hs − hfw) / (ṁf·LHV).
export function boilerEfficiency({p,T=null,feedT,steamFlow,fuelFlow,lhv,blowdown=0}){
 positive(p,'Тиск пари');positive(steamFlow,'Витрата пари');positive(fuelFlow,'Витрата палива');positive(lhv,'Нижча теплота згоряння');fraction(blowdown,'Частка продувки');
 if(blowdown>=1)throw Error('Частка продувки має бути меншою за 1.');
 const steam=T==null?state('px',p,1):state('pt',p,positive(T,'Температура пари')),fw=state('pt',p,positive(feedT,'Температура живильної води')),bd=state('px',p,0);
 const feedFlow=steamFlow/(1-blowdown),blowFlow=feedFlow-steamFlow;
 const useful=steamFlow*(steam.h-fw.h)+blowFlow*(bd.h-fw.h),input=fuelFlow*lhv,eta=useful/input;
 if(eta>1)throw Error('ККД більший за 100 %: перевірте витрати й теплоту згоряння.');
 return {efficiency:eta,useful,input,feedFlow,blowdownFlow:blowFlow};
}

// Condensate recovery: saves make-up water and the fuel for heating it.
export function condensateRecovery({p,condensateFlow,condensateT,makeupT,efficiency,fuelPrice,lhv,waterCost=0,hours=8000,investment=0}){
 positive(p,'Тиск котла');positive(condensateFlow,'Витрата конденсату');fraction(efficiency,'ККД котла',false);positive(fuelPrice,'Ціна палива');positive(lhv,'Нижча теплота згоряння');
 nonNegative(waterCost,'Вартість води');positive(hours,'Годин роботи на рік');nonNegative(investment,'Інвестиції');
 if(!(Number.isFinite(condensateT)&&Number.isFinite(makeupT)&&condensateT>makeupT))throw Error('Температура конденсату має бути вищою за температуру підживлення.');
 const pc=Math.max(p,.101325),c=state('pt',pc,condensateT),m=state('pt',pc,makeupT);
 if(c.region!==1||m.region!==1)throw Error('Конденсат і підживлювальна вода мають бути рідкими.');
 const tonnes=condensateFlow*3600*hours/1000,heat=condensateFlow*(c.h-m.h)*3600*hours; // kJ/yr
 const fuel=heat/(efficiency*lhv),saving=fuel*fuelPrice+tonnes*waterCost;
 return {tonnesPerYear:tonnes,heatPerYear:heat,fuelPerYear:fuel,fuelSaving:fuel*fuelPrice,waterSaving:tonnes*waterCost,annualSaving:saving,paybackYears:investment>0?investment/saving:null};
}
