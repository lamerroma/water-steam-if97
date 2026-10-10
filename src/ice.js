// IAPWS R10-06(2009), Revised Release on the Equation of State 2006 for H2O Ice Ih.
// Gibbs energy g(T,p), Eq. (1); complex constants per Table 2; verified against the
// official Table 6 check values (triple point, normal-pressure melting point, 100 K/100 MPa).
export const TT_ICE=273.16, PT_ICE=611.657, P0_ICE=101325, PI0_ICE=P0_ICE/PT_ICE;
const G0K=[-0.632020233335886e6,0.655022213658955,-0.189369929326131e-7,0.339746123271053e-14,-0.556464869058991e-21];
const R2K=[[-0.725974574329220e2,-0.781008427112870e2],[-0.557107698030123e-4,0.464578634580806e-4],[0.234801409215913e-10,-0.285651142904972e-10]];
export const ICE_S0_IAPWS95=-0.332733756492168e4, ICE_S0_ABSOLUTE=0.18913e3;
const T1=[0.368017112855051e-1,0.510878114959572e-1], ICE_R1=[0.447050716285388e2,0.656876847463481e2], T2=[0.337315741065416,0.335449415919309];
const cadd=(a,b)=>[a[0]+b[0],a[1]+b[1]], csub=(a,b)=>[a[0]-b[0],a[1]-b[1]], cmul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]], cscale=(a,s)=>[a[0]*s,a[1]*s], re=a=>a[0];
const cln=a=>[Math.log(Math.hypot(a[0],a[1])),Math.atan2(a[1],a[0])]; // principal value, Im in (-pi,pi]
const cinv=a=>{const d=a[0]*a[0]+a[1]*a[1];return [a[0]/d,-a[1]/d];};
const rMinusTau=(t,tau)=>[t[0]-tau,t[1]]; // t - tau, tau real
function g0(pi){let s=0;for(let k=0;k<5;k++)s+=G0K[k]*(pi-PI0_ICE)**k;return s;}
function g0p(pi){let s=0;for(let k=1;k<5;k++)s+=k*G0K[k]*(pi-PI0_ICE)**(k-1);return s/PT_ICE;}
function g0pp(pi){let s=0;for(let k=2;k<5;k++)s+=k*(k-1)*G0K[k]*(pi-PI0_ICE)**(k-2);return s/(PT_ICE*PT_ICE);}
function r2(pi){let re_=0,im=0;for(let k=0;k<3;k++){const w=(pi-PI0_ICE)**k;re_+=R2K[k][0]*w;im+=R2K[k][1]*w;}return [re_,im];}
function r2p(pi){let re_=0,im=0;for(let k=1;k<3;k++){const w=k*(pi-PI0_ICE)**(k-1);re_+=R2K[k][0]*w;im+=R2K[k][1]*w;}return [re_/PT_ICE,im/PT_ICE];}
const r2pp=()=>[2*R2K[2][0]/(PT_ICE*PT_ICE),2*R2K[2][1]/(PT_ICE*PT_ICE)];
// bracket(t,tau) = (t-tau)ln(t-tau) + (t+tau)ln(t+tau) - 2t ln(t) - tau^2/t ; and its tau-derivatives.
function bracket(t,tau){const a=rMinusTau(t,tau),b=cadd(t,[tau,0]);return csub(csub(cadd(cmul(a,cln(a)),cmul(b,cln(b))),cscale(cmul(t,cln(t)),2)),cscale(cinv(t),tau*tau));}
function dBracket(t,tau){const a=rMinusTau(t,tau),b=cadd(t,[tau,0]);return csub(csub(cln(b),cln(a)),cscale(cinv(t),2*tau));}
function d2Bracket(t,tau){const a=rMinusTau(t,tau),b=cadd(t,[tau,0]);return csub(cadd(cinv(a),cinv(b)),cscale(cinv(t),2));}
export function ice(T,p,s0=ICE_S0_IAPWS95){
 if(!Number.isFinite(T)||!Number.isFinite(p)||T<=0||T>TT_ICE||p<0||p>210e6)throw Error('Лід Ih (IAPWS R10-06): потрібно 0 < T ≤ 273,16 K і 0 ≤ p ≤ 210 МПа.');
 const tau=T/TT_ICE, pi=p/PT_ICE, r2v=r2(pi), r2pv=r2p(pi), r2ppv=r2pp();
 const g=g0(pi)-s0*TT_ICE*tau+TT_ICE*(re(cmul(ICE_R1,bracket(T1,tau)))+re(cmul(r2v,bracket(T2,tau))));
 const gp=g0p(pi)+TT_ICE*re(cmul(r2pv,bracket(T2,tau)));
 const gpp=g0pp(pi)+TT_ICE*re(cmul(r2ppv,bracket(T2,tau)));
 const gT=-s0+re(cmul(ICE_R1,dBracket(T1,tau)))+re(cmul(r2v,dBracket(T2,tau)));
 const gTp=re(cmul(r2pv,dBracket(T2,tau)));
 const gTT=(re(cmul(ICE_R1,d2Bracket(T1,tau)))+re(cmul(r2v,d2Bracket(T2,tau))))/TT_ICE;
 const rho=1/gp, s=-gT, cp=-T*gTT, h=g-T*gT, u=g-T*gT-p*gp, f=g-p*gp;
 const alpha=gTp/gp, beta=-gTp/gpp, kappaT=-gpp/gp, kappaS=(gTp*gTp-gpp*gTT)/(gp*gTT);
 return {model:'Лід Ih · IAPWS R10-06(2009)',T,p,g,v:gp,rho,s,cp,h,u,f,alpha,beta,kappaT,kappaS};
}
