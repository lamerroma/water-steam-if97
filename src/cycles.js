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
export function brayton(pLow,ratio,Tmin,Tmax,etaT=.9,etaC=.85,flow=1,composition=AIR){
 cycleChecks([pLow,ratio,Tmin,Tmax,etaT,etaC,flow]);efficiencies(etaT,etaC,flow);if(ratio<=1||Tmax<=Tmin)throw Error('Ступінь підвищення тиску > 1 та T₃ > T₁.');
 const pHigh=pLow*ratio,one=gasState(pLow,Tmin,composition),ci=gasInverse(pHigh,one.s,'s',composition),two=gasInverse(pHigh,one.h+(ci.h-one.h)/etaC,'h',composition);
 const three=gasState(pHigh,Tmax,composition),ti=gasInverse(pLow,three.s,'s',composition),four=gasInverse(pLow,three.h-etaT*(three.h-ti.h),'h',composition);
 return balances([one,two,three,four],{compressor:two.h-one.h,turbine:three.h-four.h},three.h-two.h,flow,one.model,['Замкнений цикл Брайтона, ідеальний газ зі сталим складом і змінною Cp(T).','Підігрів моделюється підведенням тепла; горіння, реакції й дисоціація не моделюються.']);
}
