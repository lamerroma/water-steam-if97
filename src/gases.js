// Frozen ideal-gas thermodynamics: NASA7 / NASA TM-4513. MPa, K, kg, kJ.
import {GAS_DATA} from './gas-data.js';
export {GAS_DATA};
export const GAS_R=8.31446261815324, GAS_P0=.101325;
export const AIR={N2:.78084,O2:.20946,Ar:.00934,CO2:.00036};
export const FLUE={N2:.73,CO2:.10,H2O:.12,O2:.05};
export function gasComposition(fractions,basis='mole'){
 if(!['mole','mass'].includes(basis))throw Error('Базис складу: молярний або масовий.');
 if(!fractions||typeof fractions!=='object'||Array.isArray(fractions))throw Error('Задайте склад суміші.');
 const entries=Object.entries(fractions).map(([id,x])=>{const d=GAS_DATA.find(s=>s.id===id);if(!d||!Number.isFinite(x)||x<0)throw Error('Невідома речовина або некоректна частка: '+id);return {d,x};});
 const total=entries.reduce((a,b)=>a+b.x,0);if(Math.abs(total-1)>1e-8)throw Error('Сума часток має дорівнювати 1 (100 %).');
 const positive=entries.filter(s=>s.x>0);if(!positive.length)throw Error('Суміш порожня.');
 const divisor=basis==='mass'?positive.reduce((a,b)=>a+b.x/b.d.M,0):1;
 return positive.map(({d,x})=>({d,x:basis==='mass'?x/d.M/divisor:x}));
}
export function gasLimits(fractions,basis='mole') {const c=gasComposition(fractions,basis);return {min:Math.max(...c.map(q=>q.d.range[0])),max:Math.min(...c.map(q=>q.d.range.at(-1)))};}
function speciesNASA(d,T){const a=d.coeff[T<=d.range[1]?0:1];return {cp:GAS_R*(a[0]+a[1]*T+a[2]*T**2+a[3]*T**3+a[4]*T**4),h:GAS_R*T*(a[0]+a[1]*T/2+a[2]*T**2/3+a[3]*T**3/4+a[4]*T**4/5+a[5]/T),s:GAS_R*(a[0]*Math.log(T)+a[1]*T+a[2]*T**2/2+a[3]*T**3/3+a[4]*T**4/4+a[6])};}
export function gasState(p,T,fractions=AIR,basis='mole'){
 if(!Number.isFinite(p)||p<=0||!Number.isFinite(T))throw Error('Газ: потрібні скінченні T та додатний абсолютний P.');
 const comp=gasComposition(fractions,basis),lim=gasLimits(fractions,basis);
 if(T<lim.min||T>lim.max)throw Error(`NASA7: для цього складу T = ${lim.min}…${lim.max} K; екстраполяція заборонена.`);
 let M=0,cp=0,h=0,s=0;for(const q of comp){const z=speciesNASA(q.d,T);M+=q.x*q.d.M;cp+=q.x*z.cp;h+=q.x*z.h;s+=q.x*(z.s-GAS_R*Math.log(q.x*p/GAS_P0));}
 const R=GAS_R/M;cp/=M;h/=M;s/=M;const cv=cp-R,rho=1000*p/(R*T),v=1/rho;
 if(!(cv>0&&cp>cv))throw Error('NASA7: нефізична теплоємність.');
 return {model:'NASA7 · ідеальний газ',p,T,M,R,cp,cv,h,s,rho,v,u:h-R*T,w:Math.sqrt(cp/cv*R*T*1000),gamma:cp/cv,Z:1,composition:Object.fromEntries(comp.map(q=>[q.d.id,q.x])),basis:'mole',limits:lim,mu:null,lambda:null};
}
export function gasInverse(p,target,key,fractions=AIR,basis='mole'){
 if(!['h','s'].includes(key)||!Number.isFinite(target))throw Error('Газова інверсія: скінченні h або s.');
 const lim=gasLimits(fractions,basis);let lo=lim.min,hi=lim.max;
 if(target<gasState(p,lo,fractions,basis)[key]-1e-10||target>gasState(p,hi,fractions,basis)[key]+1e-10)throw Error('Задана величина поза діапазоном NASA7.');
 let T=(lo+hi)/2;for(let k=0;k<90;k++){const q=gasState(p,T,fractions,basis),error=q[key]-target;if(Math.abs(error)<1e-9)return q;if(error<0)lo=T;else hi=T;const n=T-error/(key==='h'?q.cp:q.cp/T);T=n>lo&&n<hi?n:(lo+hi)/2;}
 throw Error('Газова інверсія не збіглася.');
}
