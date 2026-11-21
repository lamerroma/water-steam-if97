// Surface condenser of a steam turbine and a counterflow wet cooling tower
// (Merkel method). Water/steam from IF97; moist air by ideal-gas psychrometrics
// with the IF97 saturation pressure.
// Units: p MPa (results also in kPa), T in °C at the interface, flows kg/s, kW.
//
// Sources: condenser — heat balance with the exponential terminal difference
// δt = Δtw/(exp(kF/(W·cw)) − 1) (Щегляєв А.В. «Парові турбіни», кн. 2;
// Берман Л.Д. «Испарительное охлаждение циркуляционной воды», 1957, for the
// cooling-water side). Cooling tower — Merkel F. «Verdunstungskühlung», VDI-
// Forschungsheft 275 (1925); Kröger D.G. «Air-cooled Heat Exchangers and Cooling
// Towers» (2004), ch. 4; moist air: ASHRAE Handbook — Fundamentals (2017), ch. 1:
// W = 0.621945·pw/(p − pw), h = 1.006·t + W·(2501 + 1.86·t) kJ/kg dry air.
import {calculate} from './engine.js';

const PPK_K=273.15;
function ppkPositive(name,v){if(!Number.isFinite(v)||v<=0)throw Error('pp.error.'+name);return v;}
// Saturation pressure over liquid water, MPa, for t in °C (IF97 region 4).
export function ppkPsat(t){if(!(t>.01&&t<373))throw Error('pp.error.airTemperature');return calculate('tx',t+PPK_K,0).state.p;}
export function ppkHumidity(t,p,phi=1){const pw=phi*ppkPsat(t);if(pw>=p)throw Error('pp.error.airTemperature');return .621945*pw/(p-pw);}
export function ppkAirEnthalpy(t,W){return 1.006*t+W*(2501+1.86*t);}
export function ppkSatEnthalpy(t,p){return ppkAirEnthalpy(t,ppkHumidity(t,p,1));}
function ppkSolve(f,target,lo,hi){for(let i=0;i<80;i++){const m=(lo+hi)/2;if(f(m)<target)lo=m;else hi=m;}return (lo+hi)/2;}

// Condenser: exhaust steam D (kg/s) at quality x; cooling water W (kg/s) enters
// at tw1 (°C); kF from k (kW/(m²·K)) and area F (m²).
export function ppkCondenser({D,x=.9,W,tw1,k=3,F}){
 for(const [n,v] of [['massFlow',D],['massFlow',W],['coefficient',k],['area',F]])ppkPositive(n,v);
 if(!(x>0&&x<=1))throw Error('pp.error.coefficient');if(!(tw1>0&&tw1<60))throw Error('pp.error.waterTemperature');
 const cw=calculate('pt',.2,tw1+PPK_K).state.cp,NTU=k*F/(W*cw);
 let ts=tw1+15,state;
 for(let i=0;i<100;i++){
  const sat=calculate('tx',ts+PPK_K,0).state,vap=calculate('tx',ts+PPK_K,1).state,r=vap.h-sat.h,Q=D*x*r;
  const dtw=Q/(W*cw),dt=dtw/(Math.exp(NTU)-1),next=tw1+dtw+dt;state={p:sat.p,Q,dtw,dt,r};
  if(Math.abs(next-ts)<1e-9){ts=next;break;}ts=next;
 }
 const lmtd=state.dtw/Math.log((ts-tw1)/(ts-tw1-state.dtw));
 return {pk:state.p,ts,Q:state.Q,dtw:state.dtw,dt:state.dt,tw2:tw1+state.dtw,m:W/D,lmtd,NTU,cw,latent:state.r};
}

// Counterflow wet cooling tower: water L enters at t1 and leaves at t2 (°C); air G
// enters at ta (°C) with relative humidity phi at pressure p (MPa).
export function ppkCoolingTower({L,t1,t2,G,ta,phi=.6,p=.101325,steps=40}){
 for(const [n,v] of [['massFlow',L],['massFlow',G],['pressure',p]])ppkPositive(n,v);
 if(!(t1>t2))throw Error('pp.error.range');if(!(phi>0&&phi<=1))throw Error('pp.error.coefficient');
 const cw=4.186,Win=ppkHumidity(ta,p,phi),hin=ppkAirEnthalpy(ta,Win),ratio=L/G;
 const twb=ppkSolve(t=>ppkSatEnthalpy(t,p),hin,.02,ta+1e-9);
 if(!(t2>twb))throw Error('pp.error.approach');
 const N=Math.max(4,Math.round(steps/2)*2),dt=(t1-t2)/N,curve=[],line=[];let sum=0;
 for(let i=0;i<=N;i++){
  const t=t2+i*dt,hs=ppkSatEnthalpy(t,p),ha=hin+ratio*cw*(t-t2);
  if(!(hs>ha))throw Error('pp.error.airLine');
  sum+=(i===0||i===N?1:i%2?4:2)*cw/(hs-ha);curve.push([t,hs]);line.push([t,ha]);
 }
 const merkel=sum*dt/3,hout=hin+ratio*cw*(t1-t2);
 const tout=ppkSolve(t=>ppkSatEnthalpy(t,p),hout,twb,t1),Wout=ppkHumidity(tout,p,1),evaporation=G*(Wout-Win);
 return {merkel,range:t1-t2,approach:t2-twb,twb,hin,hout,tout,Win,Wout,evaporation,evaporationShare:evaporation/L,Q:L*cw*(t1-t2),ratio,curve,line};
}
