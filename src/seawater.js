// IAPWS R13-08(2008), Release on the IAPWS Formulation 2008 for the Thermodynamic
// Properties of Seawater. g(S,T,p)=gW(T,p)+gS(S,T,p); gW reuses the verified IAPWS-95
// Helmholtz core (src/iapws95.js), gS is the saline-part Gibbs polynomial, Table 2/Eq.(4).
// Verified against all 3 official Table 8 check points (water/saline/seawater columns).
import {raw95} from './iapws95.js';

export const SW_SN=0.03516504, SW_SSTAR=SW_SN*40/35, SW_TSTAR=40, SW_T0=273.15, SW_PSTAR=1e8, SW_P0=101325;

// Table 2 — 64 coefficients [i,j,k,g_ijk] of the saline part of the Gibbs function, Eq. (4).
const SW_G=[
[1,0,0,0.581281456626732e4],[2,0,0,0.141627648484197e4],[3,0,0,-0.243214662381794e4],
[4,0,0,0.202580115603697e4],[5,0,0,-0.109166841042967e4],[6,0,0,0.374601237877840e3],
[7,0,0,-0.485891069025409e2],[1,1,0,0.851226734946706e3],[2,1,0,0.168072408311545e3],
[3,1,0,-0.493407510141682e3],[4,1,0,0.543835333000098e3],[5,1,0,-0.196028306689776e3],
[6,1,0,0.367571622995805e2],[2,2,0,0.880031352997204e3],[3,2,0,-0.430664675978042e2],
[4,2,0,-0.685572509204491e2],[2,3,0,-0.225267649263401e3],[3,3,0,-0.100227370861875e2],
[4,3,0,0.493667694856254e2],[2,4,0,0.914260447751259e2],[3,4,0,0.875600661808945],
[4,4,0,-0.171397577419788e2],[2,5,0,-0.216603240875311e2],[4,5,0,0.249697009569508e1],
[2,6,0,0.213016970847183e1],[2,0,1,-0.331049154044839e4],[3,0,1,0.199459603073901e3],
[4,0,1,-0.547919133532887e2],[5,0,1,0.360284195611086e2],[2,1,1,0.729116529735046e3],
[3,1,1,-0.175292041186547e3],[4,1,1,-0.226683558512829e2],[2,2,1,-0.860764303783977e3],
[3,2,1,0.383058066002476e3],[2,3,1,0.694244814133268e3],[3,3,1,-0.460319931801257e3],
[2,4,1,-0.297728741987187e3],[3,4,1,0.234565187611355e3],[2,0,2,0.384794152978599e3],
[3,0,2,-0.522940909281335e2],[4,0,2,-0.408193978912261e1],[2,1,2,-0.343956902961561e3],
[3,1,2,0.831923927801819e2],[2,2,2,0.337409530269367e3],[3,2,2,-0.541917262517112e2],
[2,3,2,-0.204889641964903e3],[2,4,2,0.747261411387560e2],[2,0,3,-0.965324320107458e2],
[3,0,3,0.680444942726459e2],[4,0,3,-0.301755111971161e2],[2,1,3,0.124687671116248e3],
[3,1,3,-0.294830643494290e2],[2,2,3,-0.178314556207638e3],[3,2,3,0.256398487389914e2],
[2,3,3,0.113561697840594e3],[2,4,3,-0.364872919001588e2],[2,0,4,0.158408172766824e2],
[3,0,4,-0.341251932441282e1],[2,1,4,-0.316569643860730e2],[2,2,4,0.442040358308000e2],
[2,3,4,-0.111282734326413e2],[2,0,5,-0.262480156590992e1],[2,1,5,0.704658803315449e1],
[2,2,5,-0.792001547211682e1],
];
const SW_LOG=new Map(), SW_POLY=[];
for(const [i,j,k,g] of SW_G){if(i===1)SW_LOG.set(j+','+k,g);else SW_POLY.push({i,j,k,g});}

function salinePart(S,T,p){
 const xi=Math.sqrt(S/SW_SSTAR),lnxi=Math.log(xi),tau=(T-SW_T0)/SW_TSTAR,pi=(p-SW_P0)/SW_PSTAR;
 let g=0,gT=0,gp=0,gTT=0,gTp=0,gpp=0,gS=0,gSp=0;
 for(let k=0;k<=5;k++)for(let j=0;j<=6;j++){
  const g1=SW_LOG.get(j+','+k)||0;
  let B=g1*xi*xi*lnxi,Si=g1*(2*lnxi+1);
  for(const t of SW_POLY)if(t.j===j&&t.k===k){B+=t.g*xi**t.i;Si+=t.i*t.g*xi**(t.i-2);}
  const tauJ=tau**j,piK=pi**k;
  g+=B*tauJ*piK;if(j>=1)gT+=j*B*tau**(j-1)*piK;gS+=Si*tauJ*piK;
 }
 gT/=SW_TSTAR;gS/=2*SW_SSTAR;
 for(const {i,j,k,g:gijk} of SW_POLY){
  const xiI=xi**i,tauJ=tau**j;
  if(k>=1)gp+=k*gijk*xiI*tauJ*pi**(k-1);
  if(j>=2)gTT+=j*(j-1)*gijk*xiI*tau**(j-2)*pi**k;
  if(j>=1&&k>=1)gTp+=j*k*gijk*xiI*tau**(j-1)*pi**(k-1);
  if(k>=2)gpp+=k*(k-1)*gijk*xiI*tauJ*pi**(k-2);
  if(k>=1)gSp+=i*k*gijk*xi**(i-2)*tauJ*pi**(k-1);
 }
 gp/=SW_PSTAR;gTT/=SW_TSTAR*SW_TSTAR;gTp/=SW_TSTAR*SW_PSTAR;gpp/=SW_PSTAR*SW_PSTAR;gSp/=2*SW_SSTAR*SW_PSTAR;
 return {g,gT,gp,gTT,gTp,gpp,gS,gSp};
}

function swRhoLiquid(T,pMPa){
 let rho=1000;
 for(let i=0;i<200;i++){
  const q=raw95(T,rho),err=q.p-pMPa;
  if(Math.abs(err)<Math.max(1e-10,Math.abs(pMPa)*1e-10))return rho;
  const h=rho*1e-6,dp=(raw95(T,rho+h).p-raw95(T,rho-h).p)/(2*h);
  rho-=Math.max(-50,Math.min(50,err/dp));
  if(!(rho>1))rho=1000;
 }
 throw Error('Морська вода: не вдалося визначити густину частини H2O.');
}

// gW(T,p) and its T-p derivatives, from the already-verified IAPWS-95 Helmholtz core.
// (dv/dT)_p=v*alpha and (dv/dp)_T=-v^2*(drho/dp)_T come directly from raw95's analytic A/B terms.
function waterPart(T,p){
 const q=raw95(T,swRhoLiquid(T,p/1e6));
 const v=q.v,s=q.s*1000,h=q.h*1000,u=q.u*1000,cp=q.cp*1000;
 const g=h-T*s,f=u-T*s,gT=-s,gp=v,gTT=-cp/T,gTp=v*q.alpha,gpp=-v*v*q.drhodp/1e6;
 return {g,gT,gp,gTT,gTp,gpp,s,v,h,u,f,cp,w:q.w};
}

// S: absolute salinity kg/kg, T: K (ITS-90), p: Pa.
export function seawater(S,T,p){
 if(!Number.isFinite(S)||!Number.isFinite(T)||!Number.isFinite(p)||S<0||S>0.12||T<265||T>353||p<611.655||p>1e8)
  throw Error('Морська вода (IAPWS R13-08): офіційний діапазон 0 ≤ S ≤ 0,12 кг/кг, точка замерзання…353 K, 611,655 Па ≤ p ≤ 10⁸ Па.');
 const W=waterPart(T,p);
 if(S===0)return decorate(S,T,p,W,{g:0,gT:0,gp:0,gTT:0,gTp:0,gpp:0,gS:0,gSp:0},W);
 const Sl=salinePart(S,T,p);
 const tot={g:W.g+Sl.g,gT:W.gT+Sl.gT,gp:W.gp+Sl.gp,gTT:W.gTT+Sl.gTT,gTp:W.gTp+Sl.gTp,gpp:W.gpp+Sl.gpp};
 return decorate(S,T,p,W,Sl,tot);
}
function decorate(S,T,p,W,Sl,tot){
 const v=W.v+Sl.gp,s=W.s-Sl.gT,h=W.h+(Sl.g-T*Sl.gT),u=h-p*v,f=u-T*s,cp=-T*tot.gTT;
 const rho=1/v,w2=-v*v*tot.gTT/(tot.gpp*tot.gTT-tot.gTp*tot.gTp),w=w2>0?Math.sqrt(w2):null;
 const muW=tot.g-S*Sl.gS;
 return {model:'IAPWS R13-08',S,T,p,g:tot.g,v,rho,s,h,u,f,cp,w,muW};
}
