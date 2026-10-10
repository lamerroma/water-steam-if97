import {gasComposition} from './gases.js';
// Pure-fluid HEOS calculations, using the same local MIT CoolProp WASM as humid air.
import {getCoolPropBackend} from './humid-air-scientific.js';
export const REAL_GAS_FLUIDS={N2:'Nitrogen',O2:'Oxygen',CO2:'CarbonDioxide',CO:'CarbonMonoxide',H2:'Hydrogen',H2O:'Water',CH4:'Methane',Ar:'Argon',He:'Helium',SO2:'SulfurDioxide',Ne:'Neon'};
// Huber et al. (2018), Tables 5/6, doi:10.1063/1.5036625; only matching CoolProp correlations.
const GAS_TRANSPORT_LIMITS={N2:{mu:[50,2000,2200],lambda:[50,2000,2200]},O2:{mu:[54.36,1000,82],lambda:[54.36,2000,82]},Ar:{mu:[55,2000,1000],lambda:[55,2000,1000]},CO2:{mu:[100,2000,8000],lambda:[216.59,1100,200]},H2:{mu:[13.96,1000,200],lambda:[13.96,1000,100]},He:{mu:[.8,1500,2000],lambda:[2.18,830,127]},CH4:{lambda:[91,700,100]}};
export function realGasState(id,p,value,mode='pt'){
 const name=REAL_GAS_FLUIDS[id];if(!name)throw Error('Для '+id+' модель реального газу не підключена. Оберіть NASA7 явно.');
 if(!['pt','ph','ps'].includes(mode)||!Number.isFinite(p)||p<=0||!Number.isFinite(value))throw Error('Потрібні додатний абсолютний тиск і скінченний другий параметр.');
 return evaluateRealFluid(id,name,p,value,mode,{[id]:1});
}
function evaluateRealFluid(id,name,p,value,mode,composition){
 const cp=getCoolPropBackend(),fluid='HEOS::'+name;
 const valid=n=>Number.isFinite(n)&&Math.abs(n)<1e100;
 const constant=key=>{const n=cp.PropsSI(key,'',0,'',0,fluid);if(!valid(n))throw Error('Не вдалося прочитати межі моделі '+name);return n;};
 const min=constant('Tmin'),max=constant('Tmax'),pmax=constant('pmax')/1e6;
 if(p>pmax||mode==='pt'&&(value<min||value>max))throw Error(`Модель ${id}: T=${min}…${max} K; P≤${pmax} МПа. Екстраполяція заборонена.`);
 const key=mode==='pt'?'T':mode==='ph'?'Hmass':'Smass',input=mode==='pt'?value:value*1000;
 const get=(output,optional=false)=>{let n;try{n=cp.PropsSI(output,'P',p*1e6,key,input,fluid);}catch{}if(!valid(n)){if(optional)return null;throw Error('Не знайдено стан '+id+'. Перевірте входи; на лінії насичення P–T не визначає фазу однозначно.');}return n;};
 const T=get('T'),rho=get('Dmass');if(T<min||T>max||rho<=0)throw Error('Результат поза межами рівняння стану.');
 const h=get('Hmass')/1000,s=get('Smass')/1000;
 if(mode!=='pt'&&Math.abs((mode==='ph'?h:s)-value)>1e-6*Math.max(1,Math.abs(value)))throw Error('Обернений розрахунок не задовольняє заданий вхід.');
 const quality=get('Q',true),twoPhase=quality!=null&&quality>=0&&quality<=1;
 const c=twoPhase?null:get('Cpmass',true),v=twoPhase?null:get('Cvmass',true);
 const transportLimits=GAS_TRANSPORT_LIMITS[id]||{};
 const transportGet=(key,output)=>{const lim=transportLimits[key];return twoPhase||lim&&(T<lim[0]||T>lim[1]||p>lim[2])?null:get(output,true);};
 const transportRange=Object.entries(transportLimits).map(([k,b])=>`${k==='mu'?'μ':'λ'}: ${b[0]}…${b[1]} K, P≤${b[2]} МПа.`).join(' ');
 const phase=twoPhase?'Двофазний стан':({0:'Рідина',1:'Надкритичний флюїд',2:'Надкритичний газ',3:'Надкритична рідина',4:'Критична точка',5:'Газ',6:'Двофазний стан',7:'Невизначено'})[get('Phase')]||'Невизначено';
 return {model:'CoolProp 8 · HEOS · '+name,p,T,M:constant('molar_mass')*1000,h,s,u:get('Umass')/1000,rho,v:1/rho,cp:c==null?null:c/1000,cv:v==null?null:v/1000,w:twoPhase?null:get('A',true),gamma:c!=null&&v>0?c/v:null,Z:get('Z',true),mu:transportGet('mu','VISCOSITY'),lambda:transportGet('lambda','CONDUCTIVITY'),transportLimits,transportModels:id==='CH4'?{mu:'Quiñones-Cisneros–Deiters 2006',lambda:'Friend–Ely–Ingham 1989'}:id==='He'?{mu:'Arp–McCarty–Friend 1998',lambda:'Hands–Arp 1981 · критичний доданок CoolProp 8'}:null,quality:twoPhase?quality:null,phase,composition,validation:{source:'https://coolprop.org/fluid_properties/fluids/'+(REAL_GAS_FLUIDS[id]||'Air')+'.html',status:id==='CH4'?'NIST: 3 стани; λ: 4 первинні контролі Friend (1989) у границі розрідженого газу.':['N2','O2','Ar'].includes(id)?'NIST: 3 стани; транспорт: первинна таблиця Lemmon–Jacobsen (2004).':'NIST: 3 стани; первинні транспортні контролі ще не перевірені.',transport:transportRange+' '+(id==='CH4'?'μ: Quiñones-Cisneros–Deiters (2006), λ: Friend–Ely–Ingham (1989). Модель μ відрізняється від описаної для REFPROP (2011). У 3 станах NIST: μ до 6,15 %, λ до 1,39 %. Різниця відтворюється у прямому ядрі; причина λ ще не встановлена.':id==='He'?'λ: Hands–Arp (1981) з критичним доданком CoolProp 8; μ: Arp–McCarty–Friend (1998). При 5,3 K і 0,25 МПа λ відрізняється від NIST на 12,23 %. Питання до критичного доданка зазначено авторами ядра; точну причину розбіжності ще не доведено.':'Розбіжність із NIST та невизначеність кореляції — різні величини.')},limits:{min,max,pmax},notes:['Чиста речовина; фаза: '+phase+'.','h та s — у системі відліку цієї моделі CoolProp; значення NASA7 мають інший базис.','Теплоємності, звук і транспортні властивості двофазної суміші не наведено. Недоступні властивості позначено «—».']};
}

export function realGasMixture(p,T,fractions,basis='mole'){
 if(!Number.isFinite(p)||p<=0||p>5||!Number.isFinite(T)||T<250||T>600)throw Error('Дослідний режим сумішей: P=0…5 МПа (P>0), T=250…600 K, лише P–T та газова фаза.');
 const comp=gasComposition(fractions,basis);
 if(comp.some(q=>!['N2','O2','Ar','CO2','H2O'].includes(q.d.id)))throw Error('HEOS суміші: підтримуються N2, O2, Ar, CO2, H2O; інші компоненти потребують окремої перевірки.');
 const name=comp.map(q=>REAL_GAS_FLUIDS[q.d.id]+'['+q.x+']').join('&');
 const q=evaluateRealFluid('mixture',name,p,T,'pt',Object.fromEntries(comp.map(z=>[z.d.id,z.x])));
 if(!['Газ','Надкритичний газ','Надкритичний флюїд'].includes(q.phase))throw Error('Режим сумішей перевірено лише для газової фази.');
 q.model='CoolProp 8 · HEOS · реальна суміш (дослідний режим)';q.limits={min:250,max:600,pmax:5};
 q.validation={source:'https://coolprop.org/fluid_properties/Mixtures.html',status:'Перевірка інтеграції; незалежна точність сумішей не підтверджена.',transport:'Транспортні властивості суміші не сертифіковано; не наведено.'};
 q.mu=null;q.lambda=null;q.notes=['Молярний склад нормовано з обраного базису; тільки однофазний газ.','Дослідний режим: P–h/P–s, конденсація та реакції сумішей не реалізовані.','Система відліку h/s — CoolProp. Межі інтерфейсу не є оцінкою фізичної похибки.'];return q;
}
