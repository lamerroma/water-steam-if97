// Extended precision only in the small critical neighborhood. Form pressure
// and the cancellation-prone compressibility combination before rounding.
import {hpDecimal,hpAdd,hpSub,hpMul,hpDiv,hpPow,hpExp,hpLog,hpValue} from './precision.js';
import {R3} from './coefficients.js';
const ceOne=[1,0],ceZero=[0,0],ceTwo=[2,0],ceTc=hpDecimal('647.096'),ceRc=[322,0],ceR97=hpDecimal('.461526'),ceR95=hpDecimal('.46151805');
const ceR3=R3.map(([i,j,n])=>[i,j,hpDecimal(n)]),ceLog97=hpDecimal('1.0658070028513');
export const useCriticalPrecision=(T,rho,model)=>Math.abs(T-647.096)<=(model==='IF97'?.6:.011)&&Math.abs(rho-322)<(model==='IF97'?80:60);
function cePowers(x,n){const a=[ceOne];for(let i=1;i<=n;i++)a.push(hpMul(a[i-1],x));return a;}
export function critical97Data(T,rho){
 const t=Array.isArray(T)?T:hpDecimal(T),r=hpDecimal(rho),delta=hpDiv(r,ceRc),tau=hpDiv(ceTc,t),dp=cePowers(delta,11),tp=cePowers(tau,26),d=Array.from({length:6},()=>ceZero);
 for(const [i,j,n] of ceR3){
  d[0]=hpAdd(d[0],hpMul(n,hpMul(dp[i],tp[j])));
  if(i)d[1]=hpAdd(d[1],hpMul(hpMul(n,[i,0]),hpMul(dp[i-1],tp[j])));
  if(j)d[2]=hpAdd(d[2],hpMul(hpMul(n,[j,0]),hpMul(dp[i],tp[j-1])));
  if(i>1)d[3]=hpAdd(d[3],hpMul(hpMul(n,[i*(i-1),0]),hpMul(dp[i-2],tp[j])));
  if(i&&j)d[4]=hpAdd(d[4],hpMul(hpMul(n,[i*j,0]),hpMul(dp[i-1],tp[j-1])));
  if(j>1)d[5]=hpAdd(d[5],hpMul(hpMul(n,[j*(j-1),0]),hpMul(dp[i],tp[j-2])));
 }
 d[0]=hpAdd(d[0],hpMul(ceLog97,hpLog(delta)));d[1]=hpAdd(d[1],hpDiv(ceLog97,delta));d[3]=hpSub(d[3],hpDiv(ceLog97,dp[2]));
 const B=hpAdd(hpMul(ceTwo,hpMul(delta,d[1])),hpMul(dp[2],d[3])),A=hpSub(hpMul(delta,d[1]),hpMul(hpMul(delta,tau),d[4])),pressure=hpDiv(hpMul(hpMul(hpMul(r,ceR97),t),hpMul(delta,d[1])),[1000,0]);
 return {delta:hpValue(delta),tau:hpValue(tau),derivatives:d.map(hpValue),A:hpValue(A),B:hpValue(B),pressure};
}
const ceJ=x=>[x,ceZero,ceZero,ceZero,ceZero,ceZero];
const ceJAdd=(a,b)=>a.map((v,i)=>hpAdd(v,b[i]));
const ceJScale=(a,b)=>a.map(v=>hpMul(v,b));
function ceJMul(a,b){return [hpMul(a[0],b[0]),hpAdd(hpMul(a[1],b[0]),hpMul(a[0],b[1])),hpAdd(hpMul(a[2],b[0]),hpMul(a[0],b[2])),hpAdd(hpAdd(hpMul(a[3],b[0]),hpMul(ceTwo,hpMul(a[1],b[1]))),hpMul(a[0],b[3])),hpAdd(hpAdd(hpMul(a[4],b[0]),hpMul(a[1],b[2])),hpAdd(hpMul(a[2],b[1]),hpMul(a[0],b[4]))),hpAdd(hpAdd(hpMul(a[5],b[0]),hpMul(ceTwo,hpMul(a[2],b[2]))),hpMul(a[0],b[5]))];}
function ceJUnary(a,f,df,ddf){return [f,hpMul(df,a[1]),hpMul(df,a[2]),hpAdd(hpMul(df,a[3]),hpMul(ddf,hpMul(a[1],a[1]))),hpAdd(hpMul(df,a[4]),hpMul(ddf,hpMul(a[1],a[2]))),hpAdd(hpMul(df,a[5]),hpMul(ddf,hpMul(a[2],a[2])))];}
function ceJPow(a,b){if(a[0][0]===0&&a[1][0]===0&&a[2][0]===0&&hpValue(b)>1)return ceJ(ceZero);const f=hpPow(a[0],b),df=hpMul(b,hpPow(a[0],hpSub(b,ceOne))),ddf=hpMul(hpMul(b,hpSub(b,ceOne)),hpPow(a[0],hpSub(b,ceTwo)));return ceJUnary(a,f,df,ddf);}
function ceJExp(a){const e=hpExp(a[0]);return ceJUnary(a,e,e,e);}
let ce95Coefficients;
export function critical95Data(T,rho,N,D,E,C){
 ce95Coefficients??=N.map(hpDecimal);
 const t=Array.isArray(T)?T:hpDecimal(T),r=hpDecimal(rho),delta=hpDiv(r,ceRc),tau=hpDiv(ceTc,t),delta2=hpMul(delta,delta),tau2=hpMul(tau,tau),dp=cePowers(delta,15),tp=cePowers(tau,50);let residual=ceJ(ceZero);
 for(let i=0;i<51;i++){
  const c=C[i],d=D[i],exponent=E[i],dc=c?dp[c]:ceZero,f=hpMul(ce95Coefficients[i],hpMul(dp[d],hpMul(Number.isInteger(exponent)?tp[exponent]:hpPow(tau,exponent),hpExp([-dc[0],-dc[1]])))),ld=hpDiv(hpSub([d,0],hpMul([c,0],dc)),delta),lt=hpDiv([exponent,0],tau),ldd=hpSub(hpMul(ld,ld),hpAdd(hpDiv([d,0],delta2),c>1?hpMul([c*(c-1),0],dp[c-2]):ceZero));
  residual=ceJAdd(residual,[f,hpMul(f,ld),hpMul(f,lt),hpMul(f,ldd),hpMul(f,hpMul(ld,lt)),hpMul(f,hpDiv([exponent*(exponent-1),0],tau2))]);
 }
 const dx=hpSub(delta,ceOne),ty=hpSub(tau,ceOne),sq=hpMul(dx,dx);
 for(const [n,e,b,g] of [[-31.306260323435,0,150,1.21],[31.546140237781,1,150,1.21],[-2521.3154341695,4,250,1.25]]){
  const diff=hpSub(tau,hpDecimal(g)),f=hpMul(hpDecimal(n),hpMul(dp[3],hpMul(tp[e],hpExp(hpSub(hpMul([-20,0],sq),hpMul([b,0],hpMul(diff,diff))))))),ld=hpSub(hpDiv([3,0],delta),hpMul([40,0],dx)),lt=hpSub(hpDiv([e,0],tau),hpMul([2*b,0],diff));
  residual=ceJAdd(residual,[f,hpMul(f,ld),hpMul(f,lt),hpMul(f,hpSub(hpSub(hpMul(ld,ld),hpDiv([3,0],delta2)),[40,0])),hpMul(f,hpMul(ld,lt)),hpMul(f,hpSub(hpSub(hpMul(lt,lt),hpDiv([e,0],tau2)),[2*b,0]))]);
 }
 const dj=[delta,ceOne,ceZero,ceZero,ceZero,ceZero],xj=[dx,ceOne,ceZero,ceZero,ceZero,ceZero],tj=[ty,ceZero,ceOne,ceZero,ceZero,ceZero],sqj=ceJMul(xj,xj);
 for(const [n,b,c,d] of [[-.14874640856724,.85,28,700],[.31806110878444,.95,32,800]]){
  const theta=ceJAdd(ceJScale(tj,[-1,0]),ceJScale(ceJPow(sqj,hpDiv([5,0],[3,0])),hpDecimal('.32'))),Delta=ceJAdd(ceJMul(theta,theta),ceJScale(ceJPow(sqj,hpDecimal('3.5')),hpDecimal('.2'))),psi=ceJExp(ceJAdd(ceJScale(sqj,[-c,0]),ceJScale(ceJMul(tj,tj),[-d,0])));
  if(Delta[0][0]===0)throw Error('Точна критична точка IAPWS-95: сингулярні похідні.');
  residual=ceJAdd(residual,ceJScale(ceJMul(ceJMul(ceJPow(Delta,hpDecimal(b)),dj),psi),hpDecimal(n)));
 }
 const B=hpAdd(ceOne,hpAdd(hpMul(ceTwo,hpMul(delta,residual[1])),hpMul(delta2,residual[3]))),A=hpSub(hpAdd(ceOne,hpMul(delta,residual[1])),hpMul(hpMul(delta,tau),residual[4])),pressure=hpDiv(hpMul(hpMul(hpMul(r,ceR95),t),hpAdd(ceOne,hpMul(delta,residual[1]))),[1000,0]);
 return {delta:hpValue(delta),tau:hpValue(tau),residual:residual.map(hpValue),A:hpValue(A),B:hpValue(B),pressure};
}
