// Fundamental equations of IAPWS R7-97(2012). MPa, K, kJ/kg.
import { R1, R2, R3, R5, R2J0, R2N0, R5J0, R5N0 } from './coefficients.js';
export const R = 0.461526, TC = 647.096, PC = 22.064, RHOC = 322;
export function polynomial(a,b,terms) {
  let g=0, x=0, y=0, xx=0, yy=0, xy=0;
  for (const [i,j,n] of terms) {
    g += n*a**i*b**j;
    if(i) x += n*i*a**(i-1)*b**j;
    if(j) y += n*j*a**i*b**(j-1);
    if(i && i!==1) xx += n*i*(i-1)*a**(i-2)*b**j;
    if(j && j!==1) yy += n*j*(j-1)*a**i*b**(j-2);
    if(i && j) xy += n*i*j*a**(i-1)*b**(j-1);
  }
  return {g,x,y,xx,yy,xy};
}
export function gibbs(p,T,region) {
  const pstar=region===1?16.53:1, tstar=region===1?1386:region===2?540:1000;
  const pi=p/pstar, tau=tstar/T;
  let d=polynomial(region===1?7.1-pi:pi,region===1?tau-1.222:region===2?tau-0.5:tau,region===1?R1:region===2?R2:R5);
  if(region===1) { d.x=-d.x; d.xy=-d.xy; }
  else {
    d.g+=Math.log(pi); d.x+=1/pi; d.xx-=1/pi**2;
    const js=region===2?R2J0:R5J0, ns=region===2?R2N0:R5N0;
    for(let k=0;k<js.length;k++) {
      const j=js[k],n=ns[k];d.g+=n*tau**j;
      if(j) d.y+=n*j*tau**(j-1);
      if(j && j!==1) d.yy+=n*j*(j-1)*tau**(j-2);
    }
  }
  const v=R*T*d.x/(pstar*1000), cp=-R*tau*tau*d.yy;
  const cv=cp+R*(d.x-tau*d.xy)**2/d.xx;
  const w=Math.sqrt(1000*R*T*d.x*d.x/((d.x-tau*d.xy)**2/(tau*tau*d.yy)-d.xx));
  const rho=1/v;
  return {p,T,v,rho,h:R*T*tau*d.y,u:R*T*(tau*d.y-pi*d.x),s:R*(tau*d.y-d.g),cp,cv,w,drhodp:-rho*d.xx/(pstar*d.x),alpha:(1-tau*d.xy/d.x)/T,region};
}
export function helmholtz(T,rho) {
  const delta=rho/RHOC,tau=TC/T,d=polynomial(delta,tau,R3),n=1.0658070028513;
  d.g+=n*Math.log(delta);d.x+=n/delta;d.xx-=n/delta**2;
  const a=delta*d.x-delta*tau*d.xy, b=2*delta*d.x+delta*delta*d.xx;
  return {T,rho,v:1/rho,p:rho*R*T*delta*d.x/1000,h:R*T*(tau*d.y+delta*d.x),u:R*T*tau*d.y,s:R*(tau*d.y-d.g),
    cp:R*(-tau*tau*d.yy+a*a/b),cv:-R*tau*tau*d.yy,w:Math.sqrt(1000*R*T*(b-a*a/(tau*tau*d.yy))),drhodp:1000/(R*T*b),alpha:a/(T*b),region:3};
}
const N=[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-3232555.0322333,14.91510861353,-4823.2657361591,405113.40542057,-0.23855557567849,650.17534844798];
export function saturationPressure(T) {
  if(!Number.isFinite(T)||T<273.15||T>TC) throw Error('Насичення: температура має бути від 273,15 до 647,096 K.');
  if(T===TC)return PC; // Exact declared critical endpoint; avoids Eq. 30 roundoff above PC.
  const theta=T+N[8]/(T-N[9]), A=theta*theta+N[0]*theta+N[1], B=N[2]*theta*theta+N[3]*theta+N[4], C=N[5]*theta*theta+N[6]*theta+N[7];
  return (2*C/(-B+Math.sqrt(B*B-4*A*C)))**4;
}
export const PMIN_SAT=saturationPressure(273.15);
export function saturationTemperature(p) {
  if(!Number.isFinite(p)||p<PMIN_SAT||p>PC) throw Error(`Насичення: тиск має бути від ${PMIN_SAT} до 22,064 МПа.`);
  if(p===PC)return TC;
  if(p===PMIN_SAT)return 273.15;
  const beta=p**0.25,E=beta*beta+N[2]*beta+N[5],F=N[0]*beta*beta+N[3]*beta+N[6],G=N[1]*beta*beta+N[4]*beta+N[7];
  const D=2*G/(-F-Math.sqrt(F*F-4*E*G));
  return (N[9]+D-Math.sqrt((N[9]+D)**2-4*(N[8]+N[9]*D)))/2;
}
export const boundary23Pressure=T=>348.05185628969-1.1671859879975*T+0.0010192970039326*T*T;
export const boundary23Temperature=p=>572.54459862746+Math.sqrt((p-13.91883977887)/0.0010192970039326);
