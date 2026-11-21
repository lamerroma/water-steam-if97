// Steam turbine elements on real IF97 properties: nozzle (critical flow, Laval
// nozzle sizing), one axial stage (velocity triangles, losses, blade efficiency)
// and expansion with moisture loss after Baumann.
// Units: p MPa, T K, h kJ/kg, s kJ/(kg·K), velocities m/s, angles degrees, areas m².
//
// Sources: classic turbine theory (Щегляев А.В. «Паровые турбины», кн. 1, 1993,
// гл. 2–4; Dixon S.L., Hall C.A. «Fluid Mechanics and Thermodynamics of
// Turbomachinery», 7th ed., ch. 3–4). Expansion is isentropic in thermodynamic
// equilibrium (no metastable supersaturation); the critical section is found as
// the maximum of the mass flux ρ·c along the isentrope, which reproduces
// ε* ≈ 0.546 for superheated steam and ≈ 0.58 for dry saturated steam.
// Baumann K. (1912): moisture reduces the stage efficiency by a·y, a ≈ 1.
import {calculate} from './engine.js';

const PPT_DEG=Math.PI/180;
function pptState(mode,a,b){const s=calculate(mode,a,b).state;if(!Number.isFinite(s?.h))throw Error('pp.error.state');return s;}
function pptPositive(name,v){if(!Number.isFinite(v)||v<=0)throw Error('pp.error.'+name);return v;}
// Stagnation state from static p, T and inlet velocity c0.
export function pptStagnation(p0,T0,c0=0){
 pptPositive('pressure',p0);pptPositive('temperature',T0);
 const st=pptState('pt',p0,T0),h=st.h+c0*c0/2000,stag=c0>0?pptState('hs',h,st.s):st;
 return {static:st,h,s:st.s,p:stag.p,T:stag.T};
}

// Nozzle: stagnation p0*, h0*, s0; back pressure p1; flow m (kg/s); velocity
// coefficient phi and discharge coefficient mu.
export function pptNozzle({p0,T0,c0=0,p1,m,phi=.97,mu=.97}){
 const s0=pptStagnation(p0,T0,c0);pptPositive('pressure',p1);pptPositive('massFlow',m);
 if(!(phi>0&&phi<=1)||!(mu>0&&mu<=1.1))throw Error('pp.error.coefficient');
 if(p1>=s0.p)throw Error('pp.error.backPressure');
 const flux=p=>{const st=pptState('ps',p,s0.s),c=Math.sqrt(Math.max(0,2000*(s0.h-st.h)));return {p,st,c,G:st.rho*c};};
 // Unimodal mass flux along the isentrope: coarse scan then golden-section search.
 let lo=Math.max(1e-3,s0.p*.05),hi=s0.p*.999;
 const scan=Array.from({length:41},(_,i)=>lo+(hi-lo)*i/40).map(flux);let k=scan.reduce((b,x,i)=>x.G>scan[b].G?i:b,0);
 lo=scan[Math.max(0,k-1)].p;hi=scan[Math.min(40,k+1)].p;const g=(Math.sqrt(5)-1)/2;
 let a=hi-g*(hi-lo),b=lo+g*(hi-lo),fa=flux(a),fb=flux(b);
 for(let i=0;i<60;i++){if(fa.G>fb.G){hi=b;b=a;fb=fa;a=hi-g*(hi-lo);fa=flux(a);}else{lo=a;a=b;fa=fb;b=lo+g*(hi-lo);fb=flux(b);}}
 const crit=flux((lo+hi)/2),ratio=crit.p/s0.p,converging=p1>=crit.p;
 const exitT=flux(p1),c1=phi*exitT.c,h1=s0.h-c1*c1/2000,st1=pptState('ph',p1,h1);
 const throatArea=converging?m/(mu*st1.rho*c1):m/(mu*crit.G),exitArea=m/(mu*st1.rho*c1);
 const notes=[];if(!converging)notes.push('pp.note.laval');if(st1.x!=null&&st1.x<1)notes.push('pp.note.equilibrium');
 return {stagnation:s0,critical:{p:crit.p,T:crit.st.T,c:crit.c,G:crit.G,x:crit.st.x,ratio},exit:{p:p1,c:c1,cIdeal:exitT.c,h:h1,T:st1.T,x:st1.x,rho:st1.rho,w:st1.w},
  converging,throatArea,exitArea,areaRatio:exitArea/throatArea,throatDiameter:Math.sqrt(4*throatArea/Math.PI),exitDiameter:Math.sqrt(4*exitArea/Math.PI),
  mach:st1.w?c1/st1.w:null,loss:(exitT.c**2-c1*c1)/2000,notes};
}

// Axial stage at the mean diameter. Reaction rho is the isentropic rotor share of
// the stage drop; beta2 = beta1 − dBeta (degrees).
export function pptStage({p0,T0,c0=0,p2,reaction=0,alpha1=14,d,n,phi=.96,psi=.92,dBeta=3,uOverride=null}){
 const s0=pptStagnation(p0,T0,c0);pptPositive('pressure',p2);if(p2>=s0.p)throw Error('pp.error.backPressure');
 if(!(reaction>=0&&reaction<1))throw Error('pp.error.reaction');if(!(alpha1>0&&alpha1<90))throw Error('pp.error.angle');
 const h2t=pptState('ps',p2,s0.s).h,H0=(s0.h-h2t)*1e3,cf=Math.sqrt(2*H0);
 const u=uOverride??Math.PI*pptPositive('diameter',d)*pptPositive('speed',n)/60;
 const c1t=Math.sqrt(2*(1-reaction)*H0),c1=phi*c1t,h1=s0.h-c1*c1/2000;
 const p1=reaction>0?pptState('hs',s0.h-(1-reaction)*H0/1e3,s0.s).p:p2,st1=pptState('ph',p1,h1);
 const a1=alpha1*PPT_DEG,c1u=c1*Math.cos(a1),c1a=c1*Math.sin(a1),w1u=c1u-u,w1=Math.hypot(w1u,c1a),beta1=Math.atan2(c1a,w1u)/PPT_DEG;
 const dhr=reaction>0?(h1-pptState('ps',p2,st1.s).h)*1e3:0,w2t=Math.sqrt(w1*w1+2*dhr),w2=psi*w2t,beta2=beta1-dBeta;
 if(!(beta2>0))throw Error('pp.error.angle');
 const w2u=-w2*Math.cos(beta2*PPT_DEG),w2a=w2*Math.sin(beta2*PPT_DEG),c2u=w2u+u,c2=Math.hypot(c2u,w2a),alpha2=Math.atan2(w2a,c2u)/PPT_DEG;
 const work=u*(c1u-c2u),lossN=(c1t*c1t-c1*c1)/2,lossB=(w2t*w2t-w2*w2)/2,lossC=c2*c2/2;
 const h2=h1+(w1*w1-w2*w2)/2000,st2=pptState('ph',p2,h2);
 return {H0:H0/1e3,cf,u,uRatio:u/cf,uRatioOpt:phi*Math.cos(a1)/(2*Math.sqrt(1-reaction)),p1,c1t,c1,w1,beta1,w2t,w2,beta2,c2,alpha2,c1u,c1a,w1u,c2u,w2u,w2a,
  work:work/1e3,lossNozzle:lossN/1e3,lossBlade:lossB/1e3,lossLeaving:lossC/1e3,efficiency:work/H0,exit:{p:p2,h:h2,T:st2.T,x:st2.x},balance:(H0-lossN-lossB-lossC-work)/1e3,notes:st2.x!=null&&st2.x<1?['pp.note.wetStage']:[]};
}
// Blade efficiency against u/cf for the same stage (peripheral speed varied).
export function pptStageSweep(input,points=33){
 const base=pptStage(input),out=[];
 for(let i=1;i<=points;i++){const ratio=i/(points+1);try{const r=pptStage({...input,uOverride:ratio*base.cf});if(r.efficiency>=0)out.push([ratio,r.efficiency]);}catch{}}
 return out;
}

// Expansion p0,T0 → pk in N steps; local efficiency eta·(1 − a·ȳ) in the wet region.
export function pptBaumann({p0,T0,pk,eta=.85,a=1,steps=40}){
 const s0=pptStagnation(p0,T0,0);pptPositive('pressure',pk);if(pk>=p0)throw Error('pp.error.backPressure');
 if(!(eta>0&&eta<=1))throw Error('pp.error.coefficient');if(!(a>=0&&a<=2))throw Error('pp.error.coefficient');
 const N=Math.max(5,Math.min(200,Math.round(steps))),ratio=(pk/p0)**(1/N),y=st=>st.x!=null&&st.x<1?1-st.x:0;
 let st=s0.static,dry=s0.static;const line=[[st.s,st.h]],dryLine=[[st.s,st.h]];
 for(let i=1;i<=N;i++){
  const p=p0*ratio**i;
  const hs=pptState('ps',p,st.s).h,trial=pptState('ph',p,st.h-eta*(st.h-hs));
  const etaLocal=eta*(1-a*(y(st)+y(trial))/2),next=pptState('ph',p,st.h-etaLocal*(st.h-hs));
  st=next;line.push([st.s,st.h]);
  const hd=pptState('ps',p,dry.s).h;dry=pptState('ph',p,dry.h-eta*(dry.h-hd));dryLine.push([dry.s,dry.h]);
 }
 const ks=pptState('ps',pk,s0.s),Hs=s0.static.h-ks.h;
 return {h0:s0.static.h,s0:s0.static.s,hk:st.h,Tk:st.T,xk:st.x,xks:ks.x,work:s0.static.h-st.h,workDry:s0.static.h-dry.h,etaOverall:(s0.static.h-st.h)/Hs,etaDryOverall:(s0.static.h-dry.h)/Hs,Hs,line,dryLine,isentrope:[[s0.static.s,s0.static.h],[ks.s,ks.h]]};
}
