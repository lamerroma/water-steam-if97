import {englishProperty} from './units.js';
import {calculate,TC} from './engine.js';
export function compression(kind,p1,T1,p2,eta,flow=1){
 if(!['pump','compressor'].includes(kind))throw Error('Невідомий процес стиснення.');
 if(![p1,T1,p2,eta,flow].every(Number.isFinite)||p2<=p1||flow<0||eta<=0||eta>1)throw Error('Потрібні p₂ > p₁, витрата ≥ 0 і 0 < ККД ≤ 1.');
 const inlet=calculate('pt',p1,T1).state;if(!inlet)throw Error('Потрібен однозначний однофазний вхід P–T.');
 const liquid=inlet.region===1||inlet.phase.includes('рідина');
 if(kind==='pump'&&!liquid)throw Error('Для насоса потрібна рідина на вході.');
 if(kind==='compressor'&&(liquid||(inlet.T<TC&&inlet.rho>322)))throw Error('Для компресора потрібен паровий стан на вході.');
 const ideal=calculate('ps',p2,inlet.s).state,work=(ideal.h-inlet.h)/eta;
 if(work<=0)throw Error('Перепад ентальпії стиснення має бути додатним.');
 const outlet=calculate('ph',p2,inlet.h+work).state;
 return {inlet,ideal,outlet,work,power:flow*work,eta,flow};
}
export function heatExchanger(pHot,THot,pHotOut,flowHot,pCold,TCold,pColdOut,flowCold,heat){
 if(![pHot,THot,pHotOut,flowHot,pCold,TCold,pColdOut,flowCold,heat].every(Number.isFinite)||flowHot<=0||flowCold<=0||heat<0||pHotOut<=0||pColdOut<=0||pHotOut>pHot||pColdOut>pCold)throw Error('Потрібні додатні витрати, Q ≥ 0 та вихідні тиски не вищі за вхідні.');
 const inlet=calculate('pt',pHot,THot).state,coldInlet=calculate('pt',pCold,TCold).state;
 if(!inlet||!coldInlet)throw Error('Входи теплообмінника мають бути однозначними P–T.');
 if(THot<=TCold)throw Error('Гарячий вхід має бути теплішим за холодний.');
 const outlet=calculate('ph',pHotOut,inlet.h-heat/flowHot).state,coldOutlet=calculate('ph',pColdOut,coldInlet.h+heat/flowCold).state;
 // Counter-current terminal pinch feasibility. No UA or internal profile is inferred.
 if(outlet.T<coldInlet.T-1e-7||coldOutlet.T>inlet.T+1e-7)throw Error('Задана теплова потужність спричиняє перетин температур на кінцях протитечійного теплообмінника.');
 return {inlet,outlet,coldInlet,coldOutlet,flow:flowHot,coldFlow:flowCold,heat,power:heat,hotDrop:inlet.h-outlet.h,coldRise:coldOutlet.h-coldInlet.h};
}
export function engineeringStates(result){return [['Вхід',result.inlet],...(result.ideal?[['Ізоентропний вихід',result.ideal]]:[]),['Вихід',result.outlet],...(result.coldInlet?[['Холодний вхід',result.coldInlet],['Холодний вихід',result.coldOutlet]]:[])];}
export function engineeringCSV(kind,result,system='si'){
 const convert=(k,v,u)=>system==='english'?englishProperty(k,v,u):[v,u];
 const head=['state',...['p','T','h','s','x'].map(k=>`${k} [${convert(k,null,{p:'MPa',T:'K',h:'kJ/kg',s:'kJ/(kg K)',x:'-'}[k])[1]}]`)];
 const metrics=[['power',result.power,'kW'],['flow',result.flow,'kg/s'],...(result.work!=null?[['work',result.work,'kJ/kg'],['eta',result.eta,'-']]:[['coldFlow',result.coldFlow,'kg/s']])];
 return '\uFEFF'+[head.join(';'),...engineeringStates(result).map(([name,q])=>[name,...['p','T','h','s','x'].map(k=>convert(k,q[k],'')[0]??'')].join(';')),'',`process;${kind}`,'quantity;value;unit',...metrics.map(([k,v,u])=>{const [a,b]=convert(k==='coldFlow'?'flow':k,v,u);return `${k};${a};${b}`;})].join('\r\n');
}
