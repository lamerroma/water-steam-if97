// Two-phase thermal hydraulics of a heated channel (reactor coolant channel,
// boiler or steam-generator tube). Saturation properties come from the IF97
// engine at the system pressure; SI units: p MPa, T K, G kg/(m²·s), D and z m,
// q W/m², h J/kg inside the formulas.
//
// Sources (formulas follow the cited originals; the open-source fluids 1.3.1 and
// ht 1.2.0 implementations were used as numerical cross-checks in the tests):
//  - Void fraction: homogeneous; Zivi S.M., J. Heat Transfer 86 (1964) 247;
//    Smith S.L., Proc. IMechE 184 (1969) 647, K = 0.4; Chisholm D., Int. J. Heat
//    Mass Transfer 16 (1973) 347, S = sqrt(1 − x(1 − ρl/ρg)).
//  - Frictional pressure gradient: homogeneous model with McAdams mixture
//    viscosity 1/μ = x/μg + (1 − x)/μl; Lockhart R.W., Martinelli R.C., Chem.
//    Eng. Prog. 45 (1949) 39 with Chisholm's C = 5/10/12/20 and Blasius f;
//    Friedel L., European Two-Phase Flow Group Meeting, Ispra (1979), paper E2.
//  - Heat transfer: Dittus F.W., Boelter L.M.K. (1930), Nu = 0.023 Re^0.8 Pr^0.4;
//    Chen J.C., Ind. Eng. Chem. Process Des. Dev. 5 (1966) 322 with Edelstein's
//    fits for F and S and the Forster–Zuber nucleate term (AIChE J. 1 (1955) 531);
//    Jens W.H., Lottes P.A., ANL-4627 (1951): ΔTsat = 25 q^0.25 exp(−p/6.2);
//    Thom J.R.S. et al., Proc. IMechE 180 (1965): ΔTsat = 22.5 q^0.5 exp(−p/8.7),
//    q in MW/m², p in MPa, ΔT in K (Todreas & Kazimi, Nuclear Systems I, ch. 12).
//  - Critical heat flux: Biasi L. et al., Energia Nucleare 14 (1967) 530, in the
//    form used by RELAP5 and TRACE; Zuber N., AECU-4439 (1959) pool CHF, K = 0.131
//    (Kutateladze–Zuber; 0.149 per Lienhard–Dhir is an option).
import {calculate} from './engine.js';

const CH_G=9.80665;
// Darcy factor: laminar 64/Re below Re = 2040, Colebrook–White above (as fluids'
// friction_factor; no separate transition model).
function chDarcy(Re,eD=0){
 if(!(Re>0))throw Error('ch.error.massFlux');
 if(Re<2040)return 64/Re;
 const residual=y=>y+2*Math.log10(eD/3.7+2.51*y/Re);let lo=1e-8,hi=1000;
 for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(residual(mid)>0)hi=mid;else lo=mid;}
 return 1/((lo+hi)/2)**2;
}
export const CH_VOID_METHODS=['homogeneous','zivi','smith','chisholm'];
export const CH_FRICTION_METHODS=['homogeneous','lockhart-martinelli','friedel'];
export const CH_BOILING_METHODS=['jens-lottes','thom'];

function chFinite(name,value,positive=true){
 if(!Number.isFinite(value)||(positive&&value<=0))throw Error('ch.error.'+name);
 return value;
}

// Saturated liquid and vapor at pressure p (MPa). SI units: J/kg, W/(m·K), Pa·s, N/m.
export function chSaturation(p){
 chFinite('pressure',p);
 if(p>=22.064)throw Error('ch.error.supercritical');
 const l=calculate('px',p,0).state,g=calculate('px',p,1).state;
 return {p,Tsat:l.T,rhol:l.rho,rhog:g.rho,hl:l.h*1e3,hg:g.h*1e3,hfg:(g.h-l.h)*1e3,mul:l.mu,mug:g.mu,kl:l.lambda,kg:g.lambda,cpl:l.cp*1e3,cpg:g.cp*1e3,sigma:l.sigma,Prl:l.mu*l.cp*1e3/l.lambda};
}

export function chVoidFraction(method,x,sat){
 if(x<=0)return 0;if(x>=1)return 1;
 const r=sat.rhog/sat.rhol,xr=(1-x)/x;
 if(method==='homogeneous')return 1/(1+xr*r);
 if(method==='zivi')return 1/(1+xr*r**(2/3));
 if(method==='smith'){const K=.4,root=Math.sqrt((1/r+K*xr)/(1+K*xr));return 1/(1+xr*r*(K+(1-K)*root));}
 if(method==='chisholm'){const S=Math.sqrt(1-x*(1-sat.rhol/sat.rhog));return 1/(1+xr*r*S);}
 throw Error('ch.error.method');
}

// Mixture density from void fraction (used for gravity) and the momentum density
// 1/ρ' = x²/(αρg) + (1−x)²/((1−α)ρl) (used for acceleration).
export function chDensities(alpha,x,sat){
 const mixture=alpha*sat.rhog+(1-alpha)*sat.rhol;
 const momentum=x<=0?sat.rhol:x>=1?sat.rhog:1/(x*x/(alpha*sat.rhog)+(1-x)**2/((1-alpha)*sat.rhol));
 return {mixture,momentum};
}

// Frictional pressure gradient, Pa/m, for mass flux G in a tube of diameter D.
export function chFrictionGradient(method,{G,x,D,roughness=0,sat}){
 chFinite('massFlux',G);chFinite('diameter',D);
 const {rhol,rhog,mul,mug,sigma}=sat;
 if(method==='homogeneous'){
  const rho=1/(x/rhog+(1-x)/rhol),mu=1/(x/mug+(1-x)/mul),Re=G*D/mu,f=chDarcy(Re,roughness/D);
  return {gradient:f/D*G*G/(2*rho),Re,f};
 }
 if(method==='lockhart-martinelli'){
  const blasius=Re=>Re<2000?64/Re:.184*Re**-.2;
  const Gl=G*(1-x),Gg=G*x,Rel=Gl*D/mul,Reg=Gg*D/mug;
  const dPl=Gl>0?blasius(Rel)/D*Gl*Gl/(2*rhol):0,dPg=Gg>0?blasius(Reg)/D*Gg*Gg/(2*rhog):0;
  if(x<=0)return {gradient:dPl,X:Infinity,phi2:1};
  if(x>=1)return {gradient:dPg,X:0,phi2:null};
  const C=Rel<2000?(Reg<2000?5:12):(Reg<2000?10:20),X=Math.sqrt(dPl/dPg),phi2=1+C/X+1/(X*X);
  return {gradient:dPl*phi2,X,C,phi2,Rel,Reg};
 }
 if(method==='friedel'){
  const Relo=G*D/mul,Rego=G*D/mug,flo=chDarcy(Relo,roughness/D),fgo=chDarcy(Rego,roughness/D);
  const dPlo=flo/D*G*G/(2*rhol);
  const F=x**.78*(1-x)**.224,H=(rhol/rhog)**.91*(mug/mul)**.19*(1-mug/mul)**.7,E=(1-x)**2+x*x*rhol*fgo/(rhog*flo);
  const rhoH=1/(x/rhog+(1-x)/rhol),v=G/rhoH,Fr=v*v/(CH_G*D),We=v*v*D*rhoH/sigma;
  const phi2=E+3.24*F*H/(Fr**.0454*We**.035);
  return {gradient:phi2*dPlo,phi2,Fr,We};
 }
 throw Error('ch.error.method');
}

// Single-phase liquid heat transfer coefficient, W/(m²·K).
export function chDittusBoelter({G,D,mu,k,Pr}){const Re=G*D/mu;return {h:.023*Re**.8*Pr**.4*k/D,Re};}

// Wall superheat in subcooled/nucleate boiling, K; q in W/m², p in MPa.
export function chWallSuperheat(method,q,p){
 const qm=q/1e6;
 if(method==='jens-lottes')return 25*qm**.25*Math.exp(-p/6.2);
 if(method==='thom')return 22.5*qm**.5*Math.exp(-p/8.7);
 throw Error('ch.error.method');
}

// Chen flow-boiling coefficient (Edelstein fits) at wall superheat Te; with
// heat flux q instead, the superheat is solved from q = h(Te)·Te.
export function chChen({G,x,D,sat,Te,q}){
 const {rhol,rhog,mul,mug,kl,cpl,hfg,sigma,Tsat,p}=sat;
 const Rel=G*(1-x)*D/mul,hl=.023*Rel**.8*sat.Prl**.4*kl/D;
 const Xtt=((1-x)/x)**.9*(rhog/rhol)**.5*(mul/mug)**.1,F=(1+Xtt**-.5)**1.78,S=.9622-.5822*Math.atan(Rel*F**1.25/61800);
 const group=.00122*kl**.79*cpl**.45*rhol**.49/sigma**.5/mul**.29/hfg**.24/rhog**.24;
 const hAt=t=>{const dP=(t>0?(calculate('tx',Tsat+t,0).state.p-p)*1e6:0);return group*t**.24*Math.max(dP,0)**.75*S+hl*F;};
 if(Te==null){
  chFinite('heatFlux',q);let lo=1e-6,hi=1;while(hAt(hi)*hi<q&&hi<200)hi*=2;
  if(hAt(hi)*hi<q)throw Error('ch.error.chen');
  for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(hAt(mid)*mid<q)lo=mid;else hi=mid;}
  Te=(lo+hi)/2;
 }
 return {h:hAt(Te),Te,F,S,Xtt,hl};
}

// Biasi CHF, W/m². Original units: D cm, G g/(cm²·s), p bar, q W/cm².
export const CH_BIASI_RANGE={p:[.27,14],G:[100,6000],D:[.003,.0375]};
export function chBiasi({p,G,D,x}){
 chFinite('pressure',p);chFinite('massFlux',G);chFinite('diameter',D);
 const P=p*10,Gc=G/10,Dc=D*100,n=Dc>=1?.4:.6;
 const F=.7249+.099*P*Math.exp(-.032*P),H=-1.159+.149*P*Math.exp(-.019*P)+8.99*P/(10+P*P);
 const q1=1.883e3/(Dc**n*Gc**(1/6))*(F/Gc**(1/6)-x),q2=3.78e3*H/(Dc**n*Gc**.6)*(1-x);
 const q=(G<300?q2:Math.max(q1,q2))*1e4;
 const notes=[];
 if(p<CH_BIASI_RANGE.p[0]||p>CH_BIASI_RANGE.p[1])notes.push('ch.note.biasiPressure');
 if(G<CH_BIASI_RANGE.G[0]||G>CH_BIASI_RANGE.G[1])notes.push('ch.note.biasiMassFlux');
 if(D<CH_BIASI_RANGE.D[0]||D>CH_BIASI_RANGE.D[1])notes.push('ch.note.biasiDiameter');
 if(x<0)notes.push('ch.note.biasiSubcooled');
 return {q:Math.max(q,0),q1:q1*1e4,q2:q2*1e4,F,H,notes};
}

// Pool-boiling CHF on a large horizontal surface, W/m².
export function chZuber(sat,K=.131){return K*sat.hfg*Math.sqrt(sat.rhog)*(CH_G*sat.sigma*(sat.rhol-sat.rhog))**.25;}

// Axial heat-flux shape: uniform, or chopped cosine q(z) = qmax·cos(π(z − L/2)/Le)
// with extrapolated length Le ≥ L. Returns the peak-to-average ratio as well.
export function chHeatFluxShape(shape,L,Le){
 if(shape==='uniform')return {f:()=>1,peaking:1};
 chFinite('length',L);if(!(Le>=L))throw Error('ch.error.extrapolated');
 const a=Math.PI/Le,mean=2*Math.sin(a*L/2)/(a*L);
 return {f:z=>Math.cos(a*(z-L/2)),peaking:1/mean};
}

// March along a uniformly cooled round channel. Inputs: p (MPa), Tin (K), G,
// D, L, qAvg (W/m², average over the heated length), shape, Le, nodes, methods.
export function chChannel(o){
 const {p,Tin,G,D,L,qAvg,shape='cosine',Le=L,nodes=40,roughness=0,voidMethod='homogeneous',frictionMethod='friedel',boilingMethod='jens-lottes',inclination=90}=o;
 for(const [k,v] of [['massFlux',G],['diameter',D],['length',L],['heatFlux',qAvg],['temperature',Tin]])chFinite(k,v);
 const N=Math.max(4,Math.min(400,Math.round(nodes)));
 const sat=chSaturation(p),inlet=calculate('pt',p,Tin).state;
 if(inlet.T>=sat.Tsat||inlet.x!=null&&inlet.x>0)throw Error('ch.error.inletSubcooled');
 const shapeFn=chHeatFluxShape(shape,L,Le),qMax=qAvg*shapeFn.peaking,area=Math.PI*D*D/4,perimeter=Math.PI*D;
 const q=z=>shape==='uniform'?qAvg:qMax*shapeFn.f(z);
 const hin=inlet.h*1e3,sinA=Math.sin(inclination*Math.PI/180),out=[];
 let h=hin,dpFric=0,dpGrav=0,prev=null,minDNBR=Infinity,zMin=null,zSat=null,zBoil=null;
 const dz=L/N;
 for(let i=0;i<=N;i++){
  const z=i*dz;
  if(i>0){const zm=z-dz/2;h+=q(zm)*perimeter*dz/(G*area);}
  const xe=(h-sat.hl)/sat.hfg,x=Math.min(Math.max(xe,0),1),qz=q(z);
  let Tb,Tw,regime,rhoLiquid=null;
  if(xe<0){
   Tb=calculate('ph',p,h/1e3).state.T;
   const liq=calculate('pt',p,Math.min(Tb,sat.Tsat-1e-6)).state;rhoLiquid=liq.rho;
   const hsp=chDittusBoelter({G,D,mu:liq.mu,k:liq.lambda,Pr:liq.mu*liq.cp*1e3/liq.lambda}).h,Tsp=Tb+qz/hsp,Tnb=sat.Tsat+chWallSuperheat(boilingMethod,qz,p);
   if(Tsp<=Tnb){Tw=Tsp;regime='single';}else{Tw=Tnb;regime='subcooled';if(zBoil==null)zBoil=z;}
  }else{
   Tb=sat.Tsat;if(zSat==null)zSat=z;
   if(x>=1){Tw=null;regime='dry';}
   else{const c=chChen({G,x:Math.max(x,1e-6),D,sat,q:Math.max(qz,1)});Tw=sat.Tsat+c.Te;regime='saturated';}
  }
  const alpha=chVoidFraction(voidMethod,x,sat),dens=rhoLiquid?{mixture:rhoLiquid,momentum:rhoLiquid}:chDensities(alpha,x,sat);
  const fric=chFrictionGradient(frictionMethod,{G,x:Math.min(Math.max(x,0),.999999),D,roughness,sat}).gradient;
  const chf=chBiasi({p,G,D,x:xe}),dnbr=qz>0?chf.q/qz:Infinity;
  if(dnbr<minDNBR){minDNBR=dnbr;zMin=z;}
  if(prev){dpFric+=(prev.fric+fric)/2*dz;dpGrav+=(prev.rho+dens.mixture)/2*CH_G*sinA*dz;}
  prev={fric,rho:dens.mixture};
  out.push({z,q:qz,h:h/1e3,xe,x,alpha,Tb,Tw,regime,qchf:chf.q,dnbr,rho:dens.mixture,rhoMomentum:dens.momentum,fric});
 }
 const first=out[0],last=out.at(-1);
 const dpAcc=G*G*(1/last.rhoMomentum-1/first.rhoMomentum);
 const notes=[...new Set(out.flatMap((n,i)=>i===0||i===out.length-1?chBiasi({p,G,D,x:n.xe}).notes.filter(k=>k!=='ch.note.biasiSubcooled'):[]))];
 if(out.some(n=>n.xe<0))notes.push('ch.note.biasiSubcooled');
 if(last.xe>=1)notes.push('ch.note.dryout');
 return {sat,nodes:out,peaking:shapeFn.peaking,qMax,power:qAvg*perimeter*L,massFlow:G*area,
  Tout:last.Tb,hout:last.h,xOut:last.xe,minDNBR,zMin,zSat,zBoil,maxTw:Math.max(...out.map(n=>n.Tw??-Infinity)),
  dpFric,dpAcc,dpGrav,dpTotal:dpFric+dpAcc+dpGrav,notes};
}
