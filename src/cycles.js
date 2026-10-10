import {calculate} from './engine.js';
import {gasState,gasInverse,AIR} from './gases.js';
function cycleChecks(values){if(!values.every(Number.isFinite))throw Error('Цикл: потрібні скінченні числа.');}
function efficiencies(a,b,flow){if(a<=0||a>1||b<=0||b>1||flow<=0)throw Error('0 < ККД агрегатів ≤ 1; витрата > 0.');}
function balances(states,works,heat,flow,model,assumptions){const net=works.turbine-works.compressor, rejected=heat-net;if(!(heat>0&&net>0&&rejected>=0))throw Error('Задані параметри не утворюють енергетичний цикл з додатною корисною роботою.');return {states:states.map(q=>({...q,model:q.model||model})),...works,heat,rejected,net,efficiency:net/heat,power:flow*net,flow,model,assumptions};}
export function rankine(pHigh,pLow,Tmax,etaT=.85,etaPump=.8,flow=1,model='IF97'){
 cycleChecks([pHigh,pLow,Tmax,etaT,etaPump,flow]);efficiencies(etaT,etaPump,flow);if(pHigh<=pLow)throw Error('Тиск котла має перевищувати тиск конденсатора.');
 const one=calculate('px',pLow,0,model).state;
 const pumpIdeal=calculate('ps',pHigh,one.s,model).state,two=calculate('ph',pHigh,one.h+(pumpIdeal.h-one.h)/etaPump,model).state;
 const three=calculate('pt',pHigh,Tmax,model).state;if(!three||three.h<=two.h||three.rho>322&&Tmax<647.096)throw Error('На вході турбіни потрібна пара або надкритичний флюїд.');
 const turbineIdeal=calculate('ps',pLow,three.s,model).state,four=calculate('ph',pLow,three.h-etaT*(three.h-turbineIdeal.h),model).state;
 return balances([one,two,three,four],{compressor:two.h-one.h,turbine:three.h-four.h},three.h-two.h,flow,model,['Простий цикл Ренкіна без регенерації та проміжного перегріву.','Без втрат тиску і тепла в трубопроводах; насос і турбіна задаються ізоентропними ККД.']);
}
export function rankineReheat(pHigh,pReheat,pLow,Tmax,Treheat,etaT=.85,etaPump=.8,flow=1,model='IF97'){
 cycleChecks([pHigh,pReheat,pLow,Tmax,Treheat,etaT,etaPump,flow]);efficiencies(etaT,etaPump,flow);
 if(!(pHigh>pReheat&&pReheat>pLow))throw Error('Потрібно: тиск котла > тиск перегріву > тиск конденсатора.');
 const one=calculate('px',pLow,0,model).state;
 const pumpIdeal=calculate('ps',pHigh,one.s,model).state,two=calculate('ph',pHigh,one.h+(pumpIdeal.h-one.h)/etaPump,model).state;
 const three=calculate('pt',pHigh,Tmax,model).state;if(!three||three.h<=two.h||three.rho>322&&Tmax<647.096)throw Error('На вході турбіни потрібна пара або надкритичний флюїд.');
 const hpIdeal=calculate('ps',pReheat,three.s,model).state,hpOut=calculate('ph',pReheat,three.h-etaT*(three.h-hpIdeal.h),model).state;
 const reheated=calculate('pt',pReheat,Treheat,model).state;if(!reheated||reheated.h<=hpOut.h)throw Error('Температура перегріву має давати додатний підігрів після циліндра високого тиску.');
 const lpIdeal=calculate('ps',pLow,reheated.s,model).state,four=calculate('ph',pLow,reheated.h-etaT*(reheated.h-lpIdeal.h),model).state;
 const turbineWork=(three.h-hpOut.h)+(reheated.h-four.h),heat=(three.h-two.h)+(reheated.h-hpOut.h);
 return balances([one,two,three,hpOut,reheated,four],{compressor:two.h-one.h,turbine:turbineWork},heat,flow,model,['Цикл Ренкіна з одним проміжним перегрівом між циліндрами високого й низького тиску.','Без втрат тиску й тепла в трубопроводах; насос і обидва ступені турбіни — ізоентропні ККД.']);
}
export function rankineRegen(pHigh,pExtract,pLow,Tmax,etaT=.85,etaPump=.8,flow=1,model='IF97'){
 cycleChecks([pHigh,pExtract,pLow,Tmax,etaT,etaPump,flow]);efficiencies(etaT,etaPump,flow);
 if(!(pHigh>pExtract&&pExtract>pLow))throw Error('Потрібно: тиск котла > тиск витяжки > тиск конденсатора.');
 const condOut=calculate('px',pLow,0,model).state;
 const cpIdeal=calculate('ps',pExtract,condOut.s,model).state,cpOut=calculate('ph',pExtract,condOut.h+(cpIdeal.h-condOut.h)/etaPump,model).state;
 const inlet=calculate('pt',pHigh,Tmax,model).state;if(!inlet||inlet.h<=cpOut.h||inlet.rho>322&&Tmax<647.096)throw Error('На вході турбіни потрібна пара або надкритичний флюїд.');
 const extractIdeal=calculate('ps',pExtract,inlet.s,model).state,extractState=calculate('ph',pExtract,inlet.h-etaT*(inlet.h-extractIdeal.h),model).state;
 const lpIdeal=calculate('ps',pLow,extractState.s,model).state,lpOut=calculate('ph',pLow,extractState.h-etaT*(extractState.h-lpIdeal.h),model).state;
 const fwhOut=calculate('px',pExtract,0,model).state;
 const y=(fwhOut.h-cpOut.h)/(extractState.h-cpOut.h);
 if(!(y>0&&y<1))throw Error('Тиск витяжки не утворює фізичний баланс підігрівача (0<y<1); оберіть тиск між тиском котла і конденсатора.');
 const fpIdeal=calculate('ps',pHigh,fwhOut.s,model).state,fpOut=calculate('ph',pHigh,fwhOut.h+(fpIdeal.h-fwhOut.h)/etaPump,model).state;
 const turbineWork=(inlet.h-extractState.h)+(1-y)*(extractState.h-lpOut.h),pumpWork=(1-y)*(cpOut.h-condOut.h)+(fpOut.h-fwhOut.h),heat=inlet.h-fpOut.h;
 return balances([inlet,extractState,lpOut,condOut,cpOut,fwhOut,fpOut],{compressor:pumpWork,turbine:turbineWork},heat,flow,model,[`Цикл Ренкіна з одним відкритим регенеративним підігрівачем живильної води; витяжка пари y=${(y*100).toFixed(2)}% маси потоку при p=${pExtract} МПа.`,'Підігрівач виводить насичену рідину (без підрівня/перегріву). Без втрат тиску й тепла в трубопроводах; насоси і турбіна — ізоентропні ККД.']);
}
export function brayton(pLow,ratio,Tmin,Tmax,etaT=.9,etaC=.85,flow=1,composition=AIR){
 cycleChecks([pLow,ratio,Tmin,Tmax,etaT,etaC,flow]);efficiencies(etaT,etaC,flow);if(ratio<=1||Tmax<=Tmin)throw Error('Ступінь підвищення тиску > 1 та T₃ > T₁.');
 const pHigh=pLow*ratio,one=gasState(pLow,Tmin,composition),ci=gasInverse(pHigh,one.s,'s',composition),two=gasInverse(pHigh,one.h+(ci.h-one.h)/etaC,'h',composition);
 const three=gasState(pHigh,Tmax,composition),ti=gasInverse(pLow,three.s,'s',composition),four=gasInverse(pLow,three.h-etaT*(three.h-ti.h),'h',composition);
 return balances([one,two,three,four],{compressor:two.h-one.h,turbine:three.h-four.h},three.h-two.h,flow,one.model,['Замкнений цикл Брайтона, ідеальний газ зі сталим складом і змінною Cp(T).','Підігрів моделюється підведенням тепла; горіння, реакції й дисоціація не моделюються.']);
}
