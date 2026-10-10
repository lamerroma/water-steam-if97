// IAPWS R12-08 (industrial, mu2=1) and R15-11 section 3 including lambda2.
import { MU } from './coefficients.js';
import { polynomial, TC, PC, RHOC } from './equations.js';
export function viscosity(T,rho) {
  const t=T/TC,d=rho/RHOC;
  const mu0=100*Math.sqrt(t)/[1.67752,2.20462,0.6366564,-0.241605].reduce((s,n,i)=>s+n/t**i,0);
  return 1e-6*mu0*Math.exp(d*polynomial(1/t-1,d-1,MU).g);
}
const L=[[1.60397357,-0.646013523,0.111443906,0.102997357,-0.0504123634,0.00609859258],[2.33771842,-2.78843778,1.53616167,-0.463045512,0.0832827019,-0.00719201245],[2.19650529,-4.54580785,3.55777244,-1.40944978,0.275418278,-0.0205938816],[-1.21051378,1.60812989,-0.621178141,0.0716373224,0,0],[-2.720337,4.57586331,-3.18369245,1.1168348,-0.19268305,0.012913842]];
const A=[[6.53786807199516,-5.61149954923348,3.39624167361325,-2.27492629730878,10.2631854662709,1.97815050331519],[6.52717759281799,-6.30816983387575,8.08379285492595,-9.82240510197603,12.1358413791395,-5.54349664571295],[5.35500529896124,-3.96415689925446,8.91990208918795,-12.033872950579,9.19494865194302,-2.16866274479712],[1.55225959906681,0.464621290821181,8.93237374861479,-11.0321960061126,6.16780999933360,-0.965458722086812],[1.11999926419994,0.595748562571649,9.88952565078920,-10.325505114704,4.66861294457414,-0.503243546373828]];
export function conductivity(state,referenceDerivative=null,scientificMu=null) {
  const {T,rho,cp,cv,drhodp,region}=state,t=T/TC,d=rho/RHOC;
  const l0=Math.sqrt(t)/[0.002443221,0.01323095,0.006770357,-0.003454586,0.0004096266].reduce((s,n,i)=>s+n/t**i,0);
  const l1=Math.exp(d*L.reduce((s,row,i)=>s+(1/t-1)**i*row.reduce((r,n,j)=>r+n*(d-1)**j,0),0));
  let l2=0;
  if(rho>0 && region!==5) {
    let c=cp/0.46151805,zeta=drhodp*PC/RHOC;
    if(c<0||c>1e13)c=1e13;if(zeta<0||zeta>1e13)zeta=1e13;
    const j=d<=0.310559006?0:d<=0.776397516?1:d<=1.242236025?2:d<=1.863354037?3:4;
    const ref=referenceDerivative==null?1/A[j].reduce((s,n,i)=>s+n*d**i,0):referenceDerivative*PC/RHOC;
    const dx=Math.max(0,d*(zeta-ref*1.5/t)),y=0.13/0.4*(dx/0.06)**(0.630/1.239);
    if(y>=1.2e-7) {
      const invK=cv/cp;
      const z=2/(Math.PI*y)*((1-invK)*Math.atan(y)+invK*y+Math.expm1(-1/(1/y+y*y/(3*d*d))));
      l2=177.8514*d*c*t/((scientificMu??viscosity(T,rho))*1e6)*z;
    }
  }
  return (l0*l1+l2)*1e-3;
}

// IAPWS R1-76(2014): N/m, equilibrium interface only; no supercooled extrapolation.
export function surfaceTension(T) {
 if(!Number.isFinite(T)||T<273.16-1e-10||T>647.096)return null;
 const tau=1-Math.max(T,273.16)/647.096;return 0.2358*tau**1.256*(1-0.625*tau);
}

// R12-08 Eqs. (14)-(21), scientific critical enhancement with EOS derivative at TR.
export function viscosityScientific(state,referenceDerivative){
 const t=state.T/TC,d=state.rho/RHOC,dx=Math.max(0,d*PC/RHOC*(state.drhodp-referenceDerivative*1.5/t));
 const xi=.13*(dx/.06)**(.630/1.239),c=xi/1.9,z=xi/1.1;let Y=0;
 if(xi<=.3817016416)Y=c*z**5/5*(1-c+c*c-765/504*z*z);
 else{const psi=Math.acos(1/Math.sqrt(1+z*z)),w=Math.sqrt(Math.abs((c-1)/(c+1)))*Math.tan(psi/2),L=c>1?Math.log((1+w)/(1-w)):2*Math.atan(w);
 Y=Math.sin(3*psi)/12-Math.sin(2*psi)/(4*c)+(1/(c*c)-5/4)*Math.sin(psi)-((1-1.5*c*c)*psi-Math.abs(c*c-1)**1.5*L)/(c*c*c);}
 return viscosity(state.T,state.rho)*Math.exp(.068*Y);
}
