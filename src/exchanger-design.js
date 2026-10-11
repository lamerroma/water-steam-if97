export const EXCHANGER_DEFAULT={arrangement:'counter',hotIn:423.15,hotOut:373.15,coldIn:293.15,coldOut:343.15,heatKW:100,U:500};
export function exchangerDesign(input=EXCHANGER_DEFAULT){
 const a={...EXCHANGER_DEFAULT,...input};if(!['counter','parallel'].includes(a.arrangement)||!['hotIn','hotOut','coldIn','coldOut','heatKW','U'].every(k=>Number.isFinite(a[k]))||Math.min(a.hotIn,a.hotOut,a.coldIn,a.coldOut)<=0||a.heatKW<=0||a.U<=0||a.hotOut>=a.hotIn||a.coldOut<=a.coldIn)throw Error('Теплообмінник: перевірте температури, Q > 0 та U > 0.');
 const delta1=a.hotIn-(a.arrangement==='counter'?a.coldOut:a.coldIn),delta2=a.hotOut-(a.arrangement==='counter'?a.coldIn:a.coldOut);
 if(delta1<=0||delta2<=0)throw Error('Перетин температур або нульовий напір: скінченна площа неможлива.');
 const ratio=(delta1-delta2)/delta2,lmtd=Math.abs(ratio)<1e-10?(delta1+delta2)/2:(delta1-delta2)/Math.log1p(ratio),UA=a.heatKW*1000/lmtd,area=UA/a.U;
 return {input:a,model:'LMTD',states:[],delta1,delta2,lmtd,UA,area,heatKW:a.heatKW,U:a.U,assumptions:['Q = U A ΔTlm; ΔTlm = (ΔT₁−ΔT₂)/ln(ΔT₁/ΔT₂).','Ідеальна прямотечія або протитечія, F = 1, сталий U і сталі теплоємності потоків. Температури кінців задані; внутрішній профіль не розраховується.','U задається користувачем; геометрія, забруднення та кореляції тепловіддачі не визначаються.']};
}
