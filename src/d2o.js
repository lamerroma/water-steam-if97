import {meltingTemperature,sublimationPressure,D2O_PHASE_NOTE} from './phase-boundaries.js';
// IAPWS R16-17(2018), Revised Release on the IAPWS Formulation 2017 for the
// Thermodynamic Properties of Heavy Water. Molar Helmholtz free energy alpha(delta,tau);
// verified against the official Tables 6-8 (ideal/residual derivatives, single-phase
// p/cv/w/s, and saturation p/rho/h/s via the Maxwell criterion).
export const D2O_TC=643.847, D2O_RHOC=17.77555, D2O_R=8.3144598, D2O_M=20.027508;
const D2O_C0=4.0, D2O_A1=-8.67099402264600, D2O_A2=6.96033578458778;
const D2O_V=[0.10633e-1,0.99787,0.21483e1,0.3549], D2O_U=[308,1695,3949,10317];
const D2O_GAM=D2O_U.map(u=>u/D2O_TC);
function d2oPhi0(delta,tau){
 let phi=Math.log(delta)+D2O_A1+D2O_A2*tau+(D2O_C0-1)*Math.log(tau);
 let phi_t=D2O_A2+(D2O_C0-1)/tau, phi_tt=-(D2O_C0-1)/(tau*tau);
 for(let i=0;i<4;i++){const g=D2O_GAM[i],v=D2O_V[i],e=Math.exp(-g*tau);phi+=v*Math.log(1-e);phi_t+=v*g*e/(1-e);phi_tt-=v*g*g*e/((1-e)*(1-e));}
 return {phi,phi_d:1/delta,phi_dd:-1/(delta*delta),phi_t,phi_tt,phi_dt:0};
}
// Residual part, Table 2: i=1-6 power terms, i=7-12 power*exp(-delta^l), i=13-24 Gaussian bell terms.
const D2O_T1=[[0.122082060e-1,1.0000,4],[0.296956870e1,0.6555,1],[-0.379004540e1,0.9369,1],[0.941089600,0.5610,2],[-0.922466250,0.7017,2],[-0.139604190e-1,1.0672,3]];
const D2O_T2=[[-0.125203570,3.9515,1,1],[-0.555391500e1,4.6000,1,2],[-0.493009740e1,5.1590,3,2],[-0.359470240e-1,0.2000,2,1],[-0.936172870e1,5.4644,2,2],[-0.691835150,2.3660,1,2]];
const D2O_T3=[[-0.456110600e-1,3.4553,1,0.6014,0.4200,1.5414,1.8663],[-0.224513300e1,1.4150,3,1.4723,2.4318,1.3794,0.2895],[0.860006070e1,1.5745,1,1.5305,1.2888,1.7385,0.5803],[-0.248410420e1,3.4540,3,2.4297,8.2710,1.3045,0.2236],[0.164476900e2,3.8106,1,1.3086,0.3673,2.7242,0.6815],[0.270393360e1,4.8950,1,1.3528,0.9504,3.5321,0.9495],[0.375637470e2,1.4300,2,3.4456,7.8318,2.4552,1.1158],[-0.177607760e1,1.5870,2,1.2645,3.3281,0.8319,0.1607],[0.220924640e1,3.7900,2,2.5547,7.1753,1.3500,0.4144],[0.519652000e1,2.6200,1,1.2148,0.9465,2.5617,0.9683],[0.421097400,1.9000,1,18.738,1177.0,1.0491,0.9488],[-0.391921100,4.3200,1,18.677,1167.0,1.0486,0.9487]];
function d2oPhiR(delta,tau){
 let phi=0,phi_d=0,phi_t=0,phi_dd=0,phi_dt=0,phi_tt=0;
 for(const [n,t,d] of D2O_T1){const P=delta**d,Q=tau**t;phi+=n*P*Q;phi_d+=n*d*delta**(d-1)*Q;phi_t+=n*t*P*tau**(t-1);phi_dd+=n*d*(d-1)*delta**(d-2)*Q;phi_dt+=n*d*t*delta**(d-1)*tau**(t-1);phi_tt+=n*t*(t-1)*P*tau**(t-2);}
 for(const [n,t,d,l] of D2O_T2){const E=Math.exp(-(delta**l)),Q=tau**t,Qm1=tau**(t-1),Qm2=tau**(t-2),A=d-l*delta**l;
  phi+=n*delta**d*Q*E;phi_d+=n*Q*E*delta**(d-1)*A;phi_dd+=n*Q*E*delta**(d-2)*(A*(A-1)-l*l*delta**l);phi_t+=n*t*delta**d*Qm1*E;phi_tt+=n*t*(t-1)*delta**d*Qm2*E;phi_dt+=n*t*delta**(d-1)*Qm1*E*A;}
 for(const [n,t,d,eta,beta,gamma,eps] of D2O_T3){const dd=delta-eps,dt=tau-gamma,psi=Math.exp(-eta*dd*dd-beta*dt*dt),P=delta**d,Q=tau**t;
  const dFac=d*delta**(d-1)-2*eta*dd*P, tFac=t*tau**(t-1)-2*beta*dt*Q;
  phi+=n*P*Q*psi;phi_d+=n*Q*psi*dFac;phi_dd+=n*Q*psi*(d*(d-1)*delta**(d-2)-4*eta*d*delta**(d-1)*dd-2*eta*P+4*eta*eta*P*dd*dd);
  phi_t+=n*P*psi*tFac;phi_tt+=n*P*psi*(t*(t-1)*tau**(t-2)-4*beta*t*tau**(t-1)*dt-2*beta*Q+4*beta*beta*Q*dt*dt);phi_dt+=n*psi*dFac*tFac;}
 return {phi,phi_d,phi_t,phi_dd,phi_dt,phi_tt};
}
function d2oDecorate(T,rhoMolar){
 const tau=D2O_TC/T, delta=rhoMolar/D2O_RHOC, o=d2oPhi0(delta,tau), r=d2oPhiR(delta,tau);
 const p=rhoMolar*D2O_R*T*(1+delta*r.phi_d)/1000; // MPa
 const u=D2O_R*T*tau*(o.phi_t+r.phi_t), h=D2O_R*T*(1+tau*(o.phi_t+r.phi_t)+delta*r.phi_d);
 const s=D2O_R*(tau*(o.phi_t+r.phi_t)-o.phi-r.phi);
 const cv=-D2O_R*tau*tau*(o.phi_tt+r.phi_tt);
 const a=1+delta*r.phi_d-delta*tau*r.phi_dt, b=1+2*delta*r.phi_d+delta*delta*r.phi_dd;
 const cp=cv+D2O_R*a*a/b;
 const w=Math.sqrt(D2O_R*T*(b-a*a/(tau*tau*(o.phi_tt+r.phi_tt)))*1000/D2O_M);
 const rho=rhoMolar*D2O_M; // kg/m3 (mol/dm3 * g/mol numerically equals kg/m3)
 return {model:'D2O (важка вода) · IAPWS R16-17(2018)',T,p,rho,v:1/rho,h:h/D2O_M,u:u/D2O_M,s:s/D2O_M,cv:cv/D2O_M,cp:cp/D2O_M,w,region:rhoMolar};
}
// side-aware Newton with a bracket safeguard: never let a step cross past the saturation
// density of the OTHER phase, so a liquid solve can't collapse onto the vapor root and vice versa.
function d2oDensityAt(p,T,rhoGuess,side,satRho){
 let rho=rhoGuess;
 for(let i=0;i<100;i++){
  const tau=D2O_TC/T,delta=rho/D2O_RHOC,r=d2oPhiR(delta,tau);
  const pCalc=rho*D2O_R*T*(1+delta*r.phi_d)/1000, dpdrho=D2O_R*T*(1+2*delta*r.phi_d+delta*delta*r.phi_dd)/1000;
  const err=pCalc-p; if(Math.abs(err)<Math.max(1e-10,Math.abs(p)*1e-12)&&dpdrho>0)return rho;
  let next=dpdrho>0?rho-err/dpdrho:rho*(err>0?1.5:0.5);
  if(side==='liquid'&&satRho&&next<satRho*(1-1e-9))next=(rho+satRho)/2;
  if(side==='vapor'&&satRho&&next>satRho*(1+1e-9))next=(rho+satRho)/2;
  rho=next>0?next:rho/2;
 }
 throw Error('D2O: не вдалося знайти густину для заданих p, T.');
}
export function d2oPT(p,T){
 if(!Number.isFinite(p)||!Number.isFinite(T)||p<=0||T<=0||T>825||p>1200)throw Error('D2O (IAPWS R16-17): потрібно 0 < p ≤ 1200 МПа, 0 < T ≤ 825 K.');
 if(T<210)throw Error('D2O: фазова перевірка підтримує T ≥ 210 K; нижчі температури тут не реалізовані.');
 if(p>=.00066159&&T<=315){const m=meltingTemperature(p,'D2O');if(T<=m.T)throw Error(`D2O: тверда область або межа плавлення льоду ${m.phase} (Tm=${m.T.toFixed(6)} K); властивості твердої D2O не моделюються.`);}
 if(T<=276.97){
  let side='liquid';
  if(p<.00066159){if(p>=sublimationPressure(Math.min(T,276.969),'D2O'))throw Error('D2O: тверда область або межа сублімації; властивості твердої D2O не моделюються.');side='vapor';}
  const rho=d2oDensityAt(p,T,side==='liquid'?55:p*1000/(D2O_R*T));
  return {...d2oDecorate(T,rho),phase:side==='liquid'?'Стійка рідина':'Стійка пара',notes:[D2O_PHASE_NOTE]};
 }
 if(T<D2O_TC){
  const sat=d2oSaturation(T);
  const satRl=sat.liquid.rho/D2O_M, satRv=sat.vapor.rho/D2O_M;
  if(Math.abs(p-sat.p)<Math.max(1e-10,sat.p*1e-9))throw Error('D2O: на лінії насичення p–T не визначає фазу; оберіть режим насичення за T.');
  const side=p>=sat.p?'liquid':'vapor';
  const guess=side==='liquid'?satRl*1.01:satRv*(satRv>0?0.99:1);
  const rho=d2oDensityAt(p,T,guess,side,side==='liquid'?satRv:satRl);
  return {...d2oDecorate(T,rho),phase:side==='liquid'?'Стійка рідина':'Стійка пара',notes:[D2O_PHASE_NOTE]};
 }
 const guess=Math.max(p*1000/(D2O_R*T),D2O_RHOC*(p>D2O_RHOC*D2O_R*D2O_TC/1000?1.5:0.3));
 const rho=d2oDensityAt(p,T,guess);
 return d2oDecorate(T,rho);
}
function d2oMaxwellStep(T,rl,rv){
 const tau=D2O_TC/T;
 const phase=rho=>{const d=rho/D2O_RHOC,r=d2oPhiR(d,tau),o=d2oPhi0(d,tau);
  return {p:rho*(1+d*r.phi_d),g:1+o.phi+r.phi+d*r.phi_d,b:1+2*d*r.phi_d+d*d*r.phi_dd};};
 const residual=(l,v)=>{const L=phase(l),V=phase(v);return {L,V,f:L.p-V.p,g:L.g-V.g};};
 // Dividing by the phase separation prevents the trivial equal-density root
 // from satisfying convergence merely because both residuals approach zero.
 const norm=(q,l,v)=>Math.max(Math.abs(q.f),Math.abs(q.g)*D2O_RHOC)/(l-v);
 for(let i=0;i<100;i++){
  const q=residual(rl,rv),n=norm(q,rl,rv);
  if(rl>rv&&q.L.b>0&&q.V.b>0&&n<1e-11)return [rl,rv];
  // Analytic Jacobian: d(p/RT)/drho=b; d(g/RT)/drho=b/rho.
  const A=q.L.b,B=-q.V.b,C=A/rl,D=B/rv,det=A*D-B*C;
  if(!Number.isFinite(det)||det===0)return null;
  const dl=(-q.f*D+q.g*B)/det,dv=(-A*q.g+C*q.f)/det;
  let accepted=false;
  for(let scale=1;scale>=2**-24;scale/=2){
   const l=rl+scale*dl,v=rv+scale*dv;
   if(!(l>v&&v>0))continue;
   const next=residual(l,v);
   if(next.L.b>0&&next.V.b>0&&norm(next,l,v)<n){rl=l;rv=v;accepted=true;break;}
  }
  if(!accepted)return null;
 }
 return null;
}
// Anchor point from the official Table 8 (T=280 K), used as a known-good seed for the
// continuation below. Starting from a well phase-separated state and marching toward the
// target T tracks the true liquid/vapor branch; seeding directly near Tc instead lands on
// the spurious rl=rv trivial root, which also satisfies equal-p/equal-g but is unphysical.
const D2O_ANCHOR_T=280, D2O_ANCHOR_RL=55.2072786, D2O_ANCHOR_RV=0.353747143e-3;
export function d2oSaturation(T){
 if(!Number.isFinite(T)||T<=276.97||T>=D2O_TC)throw Error('D2O (IAPWS R16-17): насичення визначено для 276,97 K < T < 643,847 K.');
 // Double precision cannot reliably distinguish coexisting phases arbitrarily
 // close to Tc. Report a numerical limit instead of publishing a spurious root.
 if(D2O_TC-T<1e-5)throw Error('D2O: надто близько до критичної точки для надійного розділення фаз (Tc − T < 0,00001 K).');
 let [rl,rv]=d2oMaxwellStep(D2O_ANCHOR_T,D2O_ANCHOR_RL,D2O_ANCHOR_RV);
 let current=D2O_ANCHOR_T;
 while(current!==T){
  const direction=Math.sign(T-current);
  let size=Math.min(Math.abs(T-current),2,direction>0?(D2O_TC-current)*0.15:2);
  let step=null,Tk;
  for(let retry=0;retry<30;retry++){
   Tk=size===Math.abs(T-current)?T:current+direction*size;
   step=d2oMaxwellStep(Tk,rl,rv);
   if(step)break;
   size/=2;
   if(size<1e-8)break;
  }
  if(!step)throw Error('D2O: не вдалося надійно розділити стійкі фази насичення для заданої температури.');
  [rl,rv]=step;current=Tk;
 }
 const liquid=d2oDecorate(T,rl), vapor=d2oDecorate(T,rv);
 if(!(liquid.rho>vapor.rho&&vapor.h>liquid.h&&liquid.cp>0&&vapor.cp>0&&Number.isFinite(liquid.w)&&Number.isFinite(vapor.w)))throw Error('D2O: рівновага не пройшла перевірку фізичної стійкості фаз.');
 return {model:liquid.model,T,p:(liquid.p+vapor.p)/2,liquid:{...liquid,phase:'Насичена рідина',x:0},vapor:{...vapor,phase:'Насичена пара',x:1},latentHeat:vapor.h-liquid.h};
}
