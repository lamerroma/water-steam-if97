import {calculate,PC,TC} from './engine.js';
function processInput(p1,T1,p2,flow,model='IF97'){
 if(![p1,T1,p2,flow].every(Number.isFinite)||flow<0)throw Error('Введіть скінченні числа; витрата не може бути від’ємною.');
 if(p2<=0||p2>=p1)throw Error('Вихідний абсолютний тиск має бути додатним і нижчим за вхідний.');
 const inlet=calculate('pt',p1,T1,model).state;
 if(!inlet)throw Error('На вході потрібен однозначний однофазний стан; P–T на насиченні недостатньо.');
 return inlet;
}
export function turbine(p1,T1,p2,eta,flow=1,model='IF97'){
 if(!Number.isFinite(eta)||eta<=0||eta>1)throw Error('Ізоентропний ККД має бути в межах 0 < η ≤ 1.');
 const inlet=processInput(p1,T1,p2,flow,model),ideal=calculate('ps',p2,inlet.s,model).state;
 if(inlet.phase.includes('рідина')||inlet.h<=ideal.h)throw Error('Для парової турбіни задайте паровий стан на вході з додатним перепадом ентальпії.');
 const work=eta*(inlet.h-ideal.h),outlet=calculate('ph',p2,inlet.h-work,model).state;
 return {inlet,ideal,outlet,work,power:flow*work,eta,flow};
}
export function flash(p1,T1,p2,flow=1,saturated=0,model='IF97'){
 if(![0,1].includes(saturated))throw Error('Невірний режим конденсату.');
 if(saturated&&(!Number.isFinite(flow)||flow<0||p2<=0||p2>=p1))throw Error('Перевірте тиски й витрату.');
 const inlet=saturated?calculate('px',p1,0,model).state:processInput(p1,T1,p2,flow,model);
 if(saturated&&inlet.critical)throw Error('У критичній точці немає окремої насиченої рідини.');
 const result=calculate('ph',p2,inlet.h,model),outlet=result.state;
 const x=outlet.x;
 return {inlet,outlet,flow,vaporFlow:x==null?null:flow*x,liquidFlow:x==null?null:flow*(1-x),saturation:result.saturation};
}
export function turbineInverse(mode,p1,T1,p2,power,known,model='IF97'){
 if(!['flow','efficiency'].includes(mode)||!Number.isFinite(power)||power<=0||!Number.isFinite(known)||known<=0)throw Error('Для зворотного розрахунку потужність і відомий параметр мають бути додатними.');
 if(mode==='flow'){const unit=turbine(p1,T1,p2,known,1,model);return turbine(p1,T1,p2,known,power/unit.work,model);}
 const ideal=turbine(p1,T1,p2,1,known,model);const eta=power/ideal.power;return turbine(p1,T1,p2,eta,known,model);
}
// Each plotted point is evaluated from IF97. Straight SVG segments only interpolate the drawing.
export function diagramData(model='IF97'){
 const dome=[[],[]],isobars=[];
 for(let i=0;i<=90;i++){
  const T=(model==='IF97'?273.15:273.16)+((model==='IF97'?TC:TC-.0001)-(model==='IF97'?273.15:273.16))*i/90;
  try{const q=calculate('satt',T,undefined,model).saturation;dome[0].push(q.liquid);dome[1].push(q.vapor);}catch{dome[0].push(null);dome[1].push(null);}
 }
 for(const p of [.01,.1,1,10,22.064,50,100]){
  const points=[];
  for(let i=0;i<=100;i++){const T=(model==='IF97'?273.15:273.16)+(1073.15-(model==='IF97'?273.15:273.16))*i/100;try{points.push(calculate('pt',p,T,model).state||null);}catch{points.push(null);}}
  if(p<PC){const q=calculate('satp',p,undefined,model).saturation;for(let i=0;i<=10;i++)points.push(calculate('px',p,i/10,model).state);points.sort((a,b)=>(a?.T||0)-(b?.T||0)||(a?.s||0)-(b?.s||0));}
  isobars.push({p,points});
 }
 return {dome,isobars};
}

export function throttle(p1,x,p2,model='IF97'){
 if(!Number.isFinite(p1)||!Number.isFinite(p2)||!Number.isFinite(x)||p2<=0||p2>=p1||x<0||x>1)throw Error('Потрібні 0 < P₂ < P₁ і сухість 0…1.');
 const inlet=calculate('px',p1,x,model).state,outlet=calculate('ph',p2,inlet.h,model).state;
 return {inlet,outlet};
}
