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

function spPositive(n,label){if(!Number.isFinite(n)||n<=0)throw Error(label+' має бути додатним скінченним числом.');return n;}
function spNonNegative(n,label){if(!Number.isFinite(n)||n<0)throw Error(label+' має бути невід’ємним скінченним числом.');return n;}
function spFraction(n,label,allowZero=true){if(!Number.isFinite(n)||n<0||n>1||(!allowZero&&n===0))throw Error(label+' має бути в межах 0…1.');return n;}
function spState(mode,a,b){const r=calculate(mode,a,b);if(!r.state||r.alternatives?.length)throw Error('Не вдалося однозначно визначити стан води/пари.');return r.state;}

// Heat released per kg of steam: from the supply state down to the condensate
// leaving the equipment (saturated at the steam pressure unless subcooled).
export function steamHeat({p,T=null,x=1,subcooling=0}){
 spPositive(p,'Тиск пари');spNonNegative(subcooling,'Переохолодження конденсату');
 const supply=T==null?spState('px',p,spFraction(x,'Сухість')):spState('pt',p,spPositive(T,'Температура пари'));
 if(supply.x==null&&supply.region===1)throw Error('За цих P і T середовище рідке, а не пара.');
 const sat=spState('px',p,0),condensate=subcooling>0?spState('pt',p,sat.T-subcooling):sat;
 const q=supply.h-condensate.h;spPositive(q,'Теплота, що віддає пара');
 return {supply,condensate,q,Tsat:sat.T};
}

const SP_STEEL_CP=0.49; // kJ/(kg·K), carbon steel near 100–200 °C

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
  const {massPerMetre,length,T0,time,cp=SP_STEEL_CP}=input;spPositive(massPerMetre,'Маса 1 м труби');spPositive(length,'Довжина');spPositive(time,'Час прогріву');spPositive(cp,'Теплоємність металу');
  if(!Number.isFinite(T0)||T0>=steam.Tsat)throw Error('Початкова температура має бути нижчою за температуру насичення.');
  const energy=massPerMetre*length*cp*(steam.Tsat-T0);heat=energy/time;detail={energy,mass:massPerMetre*length};
 }else if(kind==='pipe-loss'){
  const {outerDiameter,length,Tamb,insulationThickness=0,insulationConductivity=0.04,surfaceCoefficient=10}=input;
  spPositive(outerDiameter,'Зовнішній діаметр труби');spPositive(length,'Довжина');spPositive(surfaceCoefficient,'Коефіцієнт тепловіддачі поверхні');spNonNegative(insulationThickness,'Товщина ізоляції');
  if(!Number.isFinite(Tamb)||Tamb>=steam.Tsat)throw Error('Температура довкілля має бути нижчою за температуру пари.');
  const r1=outerDiameter/2,r2=r1+insulationThickness;
  const resistance=(insulationThickness>0?Math.log(r2/r1)/(2*Math.PI*spPositive(insulationConductivity,'Теплопровідність ізоляції')):0)+1/(2*Math.PI*r2*surfaceCoefficient);
  const perMetre=(steam.Tsat-Tamb)/resistance/1000; // kW/m
  heat=perMetre*length;detail={perMetre,surfaceTemperature:steam.Tsat-(steam.Tsat-Tamb)*(insulationThickness>0?Math.log(r2/r1)/(2*Math.PI*insulationConductivity)/resistance:0)};
 }else if(kind==='tank'){
  const {mass,cp=4.19,T1,T2,time}=input;spPositive(mass,'Маса рідини');spPositive(cp,'Теплоємність рідини');spPositive(time,'Час нагріву');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Кінцева температура має бути вищою за початкову.');
  if(T2>=steam.Tsat)throw Error('Кінцева температура рідини має бути нижчою за температуру насичення пари.');
  heat=mass*cp*(T2-T1)/time;detail={energy:mass*cp*(T2-T1)};
 }else if(kind==='exchanger'){
  const {flow,cp=4.19,T1,T2}=input;spPositive(flow,'Витрата рідини');spPositive(cp,'Теплоємність рідини');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Температура на виході має бути вищою за температуру на вході.');
  if(T2>=steam.Tsat)throw Error('Температура на виході має бути нижчою за температуру насичення пари.');
  heat=flow*cp*(T2-T1);
 }else if(kind==='air-heater'){
  const {volumeFlow,T1,T2,p=0.101325}=input;spPositive(volumeFlow,'Об’ємна витрата повітря');spPositive(p,'Тиск повітря');
  if(!(Number.isFinite(T1)&&Number.isFinite(T2)&&T2>T1))throw Error('Температура на виході має бути вищою за температуру на вході.');
  if(T2>=steam.Tsat)throw Error('Температура повітря на виході має бути нижчою за температуру насичення пари.');
  const R=0.287047,rho=p*1000/(R*T1),cp=1.006,mass=volumeFlow*rho;heat=mass*cp*(T2-T1);detail={airDensity:rho,airMass:mass};
 }else if(kind==='duty'){heat=spPositive(input.heat,'Теплове навантаження');}
 else throw Error('Невідомий тип конденсатного навантаження.');
 const condensate=heat/steam.q;
 return {kind,heat,condensate,design:condensate*safety,safetyFactor:safety,q:steam.q,Tsat:steam.Tsat,steam:steam.supply,...detail};
}

// Separator: removes a fraction η of the entrained water.
export function separatorDryness({p,x,efficiency,massFlow=1}){
 spPositive(p,'Тиск');spFraction(x,'Сухість на вході');spFraction(efficiency,'Ефективність сепаратора');spPositive(massFlow,'Витрата');
 const water=(1-x)*massFlow,removed=water*efficiency,outFlow=massFlow-removed,x2=(x*massFlow)/outFlow;
 const before=spState('px',p,x),after=spState('px',p,x2),liquid=spState('px',p,0);
 return {x1:x,x2,removed,outFlow,h1:before.h,h2:after.h,heatGainPerKg:after.h-before.h,liquid};
}

// Air in steam: Dalton's law. airFraction is the volume (mole) fraction of air.
export function airInSteam({p,airFraction}){
 spPositive(p,'Загальний тиск');spFraction(airFraction,'Об’ємна частка повітря');if(airFraction>=1)throw Error('Частка повітря має бути меншою за 1.');
 const ps=p*(1-airFraction),pure=spState('px',p,1),mix=spState('px',ps,1);
 const Ma=28.965,Mw=18.015,massFractionAir=airFraction*Ma/(airFraction*Ma+(1-airFraction)*Mw);
 return {steamPartialPressure:ps,Tpure:pure.T,Tmix:mix.T,temperatureDrop:pure.T-mix.T,massFractionAir,
  notes:['Температура суміші дорівнює температурі насичення за парціальним тиском пари (закон Дальтона). Повітря також погіршує тепловіддачу при конденсації.']};
}

// Steam cost per tonne: fuel to raise the enthalpy from feedwater to steam,
// plus water/treatment cost. fuelPrice per unit of fuel; lhv in kJ per unit.
export function steamCost({p,T=null,feedT,efficiency,fuelPrice,lhv,waterCost=0}){
 spPositive(p,'Тиск пари');spFraction(efficiency,'ККД котла',false);spPositive(fuelPrice,'Ціна палива');spPositive(lhv,'Нижча теплота згоряння');spNonNegative(waterCost,'Вартість води');
 const steam=T==null?spState('px',p,1):spState('pt',p,spPositive(T,'Температура пари')),fw=spState('pt',p,spPositive(feedT,'Температура живильної води'));
 if(fw.region!==1)throw Error('Живильна вода має бути рідкою за тиску котла.');
 const dh=steam.h-fw.h;spPositive(dh,'Приріст ентальпії');
 const fuelPerTonne=1000*dh/(efficiency*lhv),cost=fuelPerTonne*fuelPrice+waterCost;
 return {dh,fuelPerTonne,fuelCostPerTonne:fuelPerTonne*fuelPrice,costPerTonne:cost,energyCostPerGJ:fuelPrice/(lhv/1e6)/efficiency};
}

// Boiler efficiency, direct method: η = ṁs·(hs − hfw) / (ṁf·LHV).
export function boilerEfficiency({p,T=null,feedT,steamFlow,fuelFlow,lhv,blowdown=0}){
 spPositive(p,'Тиск пари');spPositive(steamFlow,'Витрата пари');spPositive(fuelFlow,'Витрата палива');spPositive(lhv,'Нижча теплота згоряння');spFraction(blowdown,'Частка продувки');
 if(blowdown>=1)throw Error('Частка продувки має бути меншою за 1.');
 const steam=T==null?spState('px',p,1):spState('pt',p,spPositive(T,'Температура пари')),fw=spState('pt',p,spPositive(feedT,'Температура живильної води')),bd=spState('px',p,0);
 const feedFlow=steamFlow/(1-blowdown),blowFlow=feedFlow-steamFlow;
 const useful=steamFlow*(steam.h-fw.h)+blowFlow*(bd.h-fw.h),input=fuelFlow*lhv,eta=useful/input;
 if(eta>1)throw Error('ККД більший за 100 %: перевірте витрати й теплоту згоряння.');
 return {efficiency:eta,useful,input,feedFlow,blowdownFlow:blowFlow};
}

// Condensate recovery: saves make-up water and the fuel for heating it.
export function condensateRecovery({p,condensateFlow,condensateT,makeupT,efficiency,fuelPrice,lhv,waterCost=0,hours=8000,investment=0}){
 spPositive(p,'Тиск котла');spPositive(condensateFlow,'Витрата конденсату');spFraction(efficiency,'ККД котла',false);spPositive(fuelPrice,'Ціна палива');spPositive(lhv,'Нижча теплота згоряння');
 spNonNegative(waterCost,'Вартість води');spPositive(hours,'Годин роботи на рік');spNonNegative(investment,'Інвестиції');
 if(!(Number.isFinite(condensateT)&&Number.isFinite(makeupT)&&condensateT>makeupT))throw Error('Температура конденсату має бути вищою за температуру підживлення.');
 const pc=Math.max(p,.101325),c=spState('pt',pc,condensateT),m=spState('pt',pc,makeupT);
 if(c.region!==1||m.region!==1)throw Error('Конденсат і підживлювальна вода мають бути рідкими.');
 const tonnes=condensateFlow*3600*hours/1000,heat=condensateFlow*(c.h-m.h)*3600*hours; // kJ/yr
 const fuel=heat/(efficiency*lhv),saving=fuel*fuelPrice+tonnes*waterCost;
 return {tonnesPerYear:tonnes,heatPerYear:heat,fuelPerYear:fuel,fuelSaving:fuel*fuelPrice,waterSaving:tonnes*waterCost,annualSaving:saving,paybackYears:investment>0?investment/saving:null};
}
