// CoolProp ASHRAE-RP1485 humid-air EOS. All units below use kg dry air.
import createCoolProp from '../vendor/coolprop.js';
let humidBackend,humidInitialization;
export function initializeHumidAir(bytes){
 if(humidBackend)return Promise.resolve(humidBackend);
 if(!bytes)throw Error('Потрібні локальні байти ядра вологого повітря.');
 if(!humidInitialization)humidInitialization=createCoolProp({wasmBinary:bytes,print:()=>{},printErr:()=>{}}).then(m=>{humidBackend=m;return m;}).catch(e=>{humidInitialization=null;throw e;});
 return humidInitialization;
}
export function humidAirScientific(p,T,rh){return humidAirInputs(p,T,'R',rh);}
export function humidAirInputs(p,T,input,value){
 if(!humidBackend)throw Error('Ядро вологого повітря ще не завантажено.');
 if(![p,T,value].every(Number.isFinite)||p<.00001||p>5||T<193||T>473||!['R','W','D','B'].includes(input))throw Error('Вологе повітря: P=0,00001…5 МПа, T=193…473 K; допустимі входи RH, W, точка роси або мокрий термометр.');
 if(input==='R'&&(value<0||value>1)||input==='W'&&value<0||['D','B'].includes(input)&&(value<193||value>T+1e-6))throw Error('Перевірте вологість: RH=0…1, W≥0; температура роси / мокрого термометра не вища за сухий термометр.');
 if(['D','B'].includes(input)&&value>T)value=T;
 let solveInput=input,solveValue=value;
 // Refine dew-point inversion against the forward EOS; the native inverse is loose at very small vapour fractions.
 if(input==='D'){let lo=0,hi=1;for(let i=0;i<70;i++){const mid=(lo+hi)/2,n=humidBackend.HAPropsSI('D','P',p*1e6,'T',T,'R',mid);solveValue=mid;if(Number.isFinite(n)&&Math.abs(n)<1e100&&Math.abs(n-value)<1e-9)break;if(!Number.isFinite(n)||Math.abs(n)>1e100)hi=mid;else if(n<value)lo=mid;else hi=mid;}solveInput='R';}
 const get=(key,optional=false)=>{let n;try{n=humidBackend.HAPropsSI(key,'P',p*1e6,'T',T,solveInput,solveValue);}catch{}if(!Number.isFinite(n)||Math.abs(n)>1e100){if(optional)return null;throw Error('Не знайдено фізичного стану вологого повітря. Перевірте тиск, температуру та вологість.');}return n;};
 const W=get('W'),r=get('R');if(r<0||r>1+1e-8)throw Error('Заданий стан пересичений: RH перевищує 100 %.');
 const v=get('V'),h=get('H')/1000,cp=get('C')/1000,y=get('Y'),dew=W===0?null:get('D',true),wet=get('B',true);
 if(input==='D'&&(dew==null||Math.abs(dew-value)>1e-6)||input==='B'&&(wet==null||Math.abs(wet-value)>1e-5))throw Error('Зворотний розрахунок не задовольняє задану температуру. Стан може лежати на розриві фазового переходу.');
 return {model:'Вологе повітря · CoolProp 8 / ASHRAE-RP1485',p,T,rh:r,pv:y*p,W,h,dew,wet,v,rho:(1+W)/v,cp,notes:['Неідеальна суміш: віріальні коефіцієнти та поправка насичення.','h, Cp і v — на 1 кг сухого повітря; ρ — для всієї суміші.','Фазу насичення (вода / лід) визначає ядро CoolProp. Невизначені температури не наведено.','Ентальпія використовує систему відліку CoolProp/ASHRAE; вона відрізняється від навчальної моделі NASA7.']};
}
