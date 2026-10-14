// Display units are independent of the numerical models. Canonical values are
// MPa, K, kg/s, kW, m, kJ/kg and kJ/(kg K); temperature differences have no offset.
export const UI_UNIT_GROUPS={
 temperature:{C:['°C',1,273.15],K:['K',1,0],F:['°F',1/1.8,273.15-32/1.8]},
 temperatureDifference:{dK:['K',1,0],dC:['°C',1,0],dF:['°F',1/1.8,0]},
 pressure:{MPa:['MPa',1,0],kPa:['kPa',.001,0],Pa:['Pa',1e-6,0],bar:['bar',.1,0],atm:['atm',.101325,0],psi:['psi',.006894757293168361,0]},
 mass:{kgs:['kg/s',1,0],kgh:['kg/h',1/3600,0],lbs:['lb/s',.45359237,0],lbh:['lb/h',.45359237/3600,0]},
 power:{kW:['kW',1,0],W:['W',.001,0],MW:['MW',1000,0],Btuh:['Btu/h',1055.05585262/3600000,0]},
 length:{m:['m',1,0],mm:['mm',.001,0],cm:['cm',.01,0],ft:['ft',.3048,0],inch:['in',.0254,0]},
 energy:{kJkg:['kJ/kg',1,0],Jkg:['J/kg',.001,0],Btulb:['Btu/lb',2.326,0]},
 entropy:{kJkgK:['kJ/(kg K)',1,0],JkgK:['J/(kg K)',.001,0],BtulbR:['Btu/(lb °R)',4.1868,0]},
 fraction:{fraction:['0…1',1,0],percent:['%',.01,0]}
};
export const UI_UNIT_DEFAULTS={temperature:'C',pressure:'MPa',mass:'kgs',power:'kW',length:'m',energy:'kJkg'};
export function uiConvertQuantity(value,group,from,to){
 const a=UI_UNIT_GROUPS[group]?.[from],b=UI_UNIT_GROUPS[group]?.[to];
 if(!a||!b||!Number.isFinite(value))throw Error('Несумісні одиниці або нескінченне число. / Incompatible units or nonfinite number.');
 const result=(value*a[1]+a[2]-b[2])/b[1];if(!Number.isFinite(result))throw Error('Переповнення перетворення одиниць. / Unit conversion overflow.');return result;
}
export function readUIUnits(value){
 if(value==null)return {...UI_UNIT_DEFAULTS};
 if(typeof value!=='object'||Array.isArray(value))throw Error('Некоректний набір одиниць. / Invalid unit preferences.');
 const out={...UI_UNIT_DEFAULTS};for(const [key,unit] of Object.entries(value)){if(!(key in out)||!UI_UNIT_GROUPS[key][unit])throw Error('Невідома одиниця налаштувань. / Unknown preferred unit.');out[key]=unit;}return out;
}
export function uiPreferredUnit(group,prefs){
 if(group==='entropy')return prefs.energy==='Btulb'?'BtulbR':prefs.energy==='Jkg'?'JkgK':'kJkgK';
 if(group==='temperatureDifference')return prefs.temperature==='F'?'dF':prefs.temperature==='C'?'dC':'dK';
 return prefs[group];
}
export function uiUnitFromLabel(text){
 const cleaned=String(text).replace(/\s*(?:\(абс\.\)|\(abs\)|\(absolute\)|abs|абс\.)/g,'').replace(/МПа/g,'MPa').replace(/кПа/g,'kPa').replace(/Па/g,'Pa').replace(/МВт/g,'MW').replace(/кВт/g,'kW').replace(/Вт/g,'W').replace(/кДж/g,'kJ').replace(/Дж/g,'J').replace(/кг/g,'kg').replace(/год/g,'h').replace(/м³/g,'m³').replace(/мм/g,'mm').replace(/см/g,'cm').replace(/м/g,'m').replace(/с/g,'s').replace(/бар/g,'bar').replace(/·/g,' ').replace(/\s+/g,' ').trim();
 for(const [group,units] of Object.entries(UI_UNIT_GROUPS))for(const [unit,[label]] of Object.entries(units))if(label===cleaned)return {group,unit};return null;
}
export function uiDisplayQuantity(value,unit,prefs,{difference=false}={}){
 const spec=uiUnitFromLabel(unit);if(!spec)return [value,unit];
 if(spec.group==='fraction')return [value,unit];
 let {group}=spec,from=spec.unit;if(difference&&group==='temperature'){group='temperatureDifference';from='d'+from;}
 const target=uiPreferredUnit(group,prefs);if(!target)return [value,unit];
 return [Number.isFinite(value)?uiConvertQuantity(value,group,from,target):value,UI_UNIT_GROUPS[group][target][0]];
}
