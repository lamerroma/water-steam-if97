import {BSW2003_DATA} from './gas-bsw2003-data.js';
export {BSW2003_DATA};
import {hpAdd,hpSub,hpMul,hpDiv,hpIntPow,hpPow,hpLog,hpDecimal,hpValue} from './precision.js';
export const BSW2003_SPECIES=BSW2003_DATA.species.map(q=>q.id);
export const BSW2003_R=Number(BSW2003_DATA.R),BSW2003_T0=Number(BSW2003_DATA.T0),BSW2003_P0=Number(BSW2003_DATA.p0);
const bswT0=hpDecimal(BSW2003_DATA.T0),bswOne=[1,0],bswExponents=BSW2003_DATA.exponents.map(Number);
const bswSpecies=new Map(BSW2003_DATA.species.map(q=>[q.id,{id:q.id,M:Number(q.M),a:q.a.map(hpDecimal)}]));
export function bswComposition(fractions,basis='mole'){
 if(!['mole','mass'].includes(basis)||!fractions||typeof fractions!=='object'||Array.isArray(fractions))throw Error('BSW2003: некоректний склад або базис. / Invalid composition or basis.');
 let total=0;const comp=[];
 for(const [id,value] of Object.entries(fractions)){
  if(!Number.isFinite(value)||value<0||value>1||!bswSpecies.has(id)&&value!==0)throw Error('BSW2003: невідомий компонент або некоректна частка. / Unknown component or invalid fraction.');
  total+=value;if(value>0)comp.push({id,value,M:bswSpecies.get(id).M});
 }
 if(!comp.length||Math.abs(total-1)>1e-10)throw Error('BSW2003: сума часток має дорівнювати 1 (100 %). / Fractions must sum to 1 (100%).');
 const divisor=comp.reduce((s,q)=>s+(basis==='mass'?q.value/q.M:q.value),0);
 const mole=comp.map(q=>({...q,x:(basis==='mass'?q.value/q.M:q.value)/divisor})),M=mole.reduce((s,q)=>s+q.x*q.M,0);
 return {M,mole:Object.fromEntries(mole.map(q=>[q.id,q.x])),mass:Object.fromEntries(mole.map(q=>[q.id,q.x*q.M/M]))};
}
// The large, alternating coefficients cancel strongly. Evaluate the printed decimals
// with double-double arithmetic and one fourth-root shared by all quarter powers.
// Integrals start at T0, enforcing the documented pure-species zero exactly rather
// than inheriting residuals of the separately rounded integration constants.
function bswMolar(T,composition){
 const tau=hpDiv(hpDecimal(T),bswT0),root=hpPow(tau,.25),log=hpLog(tau);let cp=[0,0],h=[0,0],s=[0,0];
 for(const [id,x] of Object.entries(composition)){
  const a=bswSpecies.get(id).a;let cpi=[0,0],hi=[0,0],si=[0,0];
  for(let i=0;i<a.length;i++){
   if(a[i][0]===0&&a[i][1]===0)continue;
   const b=bswExponents[i];cpi=hpAdd(cpi,hpMul(a[i],hpIntPow(root,b*4)));
   hi=hpAdd(hi,hpMul(a[i],hpMul(bswT0,hpDiv(hpSub(hpIntPow(root,(b+1)*4),bswOne),[b+1,0]))));
   si=hpAdd(si,hpMul(a[i],b===0?log:hpDiv(hpSub(hpIntPow(root,b*4),bswOne),[b,0])));
  }
  cp=hpAdd(cp,hpMul([x,0],cpi));h=hpAdd(h,hpMul([x,0],hi));s=hpAdd(s,hpMul([x,0],si));
 }
 return {cp:hpValue(cp),h:hpValue(h),s:hpValue(s)};
}
export function bswGasState(p,T,fractions,basis='mole'){
 if(!Number.isFinite(p)||p<=0||!Number.isFinite(T)||T<200||T>3300)throw Error('BSW2003: 200 ≤ T ≤ 3300 K; потрібен додатний абсолютний тиск. / Positive absolute pressure required.');
 const composition=bswComposition(fractions,basis),q=bswMolar(T,composition.mole),M=composition.M,R=BSW2003_R/M;
 const mixingMolar=-BSW2003_R*Object.values(composition.mole).reduce((s,x)=>s+x*Math.log(x),0);
 const cp=q.cp/M,cv=cp-R,h=q.h/M,s=(q.s+mixingMolar-BSW2003_R*(Math.log(p)-Math.log(BSW2003_P0)))/M;
 const rho=1000*p/(R*T),v=1/rho,u=h-R*T,gamma=cp/cv,w=Math.sqrt(gamma*R*T*1000);
 if(!(cv>0&&rho>0&&v>0)||![cp,cv,h,s,rho,v,u,w,gamma].every(Number.isFinite))throw Error('BSW2003: результат поза числовими межами. / Result exceeds numerical bounds.');
 return {model:'BSW2003 · technical ideal gas',modelId:'BSW2003-technical',p,T,M,R,cp,cv,h,s,u,rho,v,w,gamma,isentropic:gamma,Z:1,composition:composition.mole,massComposition:composition.mass,basis:'mole',inputBasis:basis,limits:{min:200,max:3300},reference:{T0:BSW2003_T0,p0:BSW2003_P0,definition:'h0=s0=0 for each pure ideal species at T0,p0; mixture entropy includes -R sum(x ln x).',formationEnthalpyIncluded:false},mixingEntropy:mixingMolar/M,dissociationApplied:false,mu:null,lambda:null,notes:['Ідеальний газ зі сталим складом; конденсацію та реакції не враховано. / Frozen ideal gas; no condensation or reactions.','Нуль h і s чистих компонентів: 273,15 K та 0,101325 МПа. Ентропія суміші містить внесок змішування. / Pure-species h/s reference: 273.15 K, 0.101325 MPa; mixture entropy includes mixing.'],validation:{source:'https://repositorio.ufjf.br/jspui/handle/ufjf/13031',status:'Technical coefficient transcription; direct Steam97Web parity remains unverified.',transport:'Caloric ideal-gas model; transport properties are not supplied.'}};
}
export function bswGasInverse(p,target,key,fractions,basis='mole'){
 if(!['h','s'].includes(key)||!Number.isFinite(target))throw Error('BSW2003: скінченні h або s. / Finite h or s required.');
 let lo=200,hi=3300;const L=bswGasState(p,lo,fractions,basis),H=bswGasState(p,hi,fractions,basis);
 if(target<L[key]||target>H[key])throw Error('BSW2003: задана величина поза діапазоном 200…3300 K. / Target outside temperature bounds.');
 if(target===L[key])return L;if(target===H[key])return H;
 let T=(lo+hi)/2;
 for(let i=0;i<90;i++){
  const q=bswGasState(p,T,fractions,basis),error=q[key]-target,step=error/(key==='h'?q.cp:q.cp/T);
  if(Math.abs(error)<=2e-12*Math.max(1,Math.abs(target))&&Math.abs(step)<=2e-9)return q;
  if(error<0)lo=T;else hi=T;const next=T-step;T=next>lo&&next<hi?next:(lo+hi)/2;
 }
 throw Error('BSW2003: обернений розрахунок не збігся. / Inverse calculation did not converge.');
}
export function calculateBSWGas(mode,p,value,fractions,basis='mole'){
 if(!['pt','ph','ps'].includes(mode))throw Error('BSW2003: підтримуються P–T, P–h, P–s. / Supported input pairs: P–T, P–h, P–s.');
 return mode==='pt'?bswGasState(p,value,fractions,basis):bswGasInverse(p,value,mode==='ph'?'h':'s',fractions,basis);
}
