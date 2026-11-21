// Heat-recovery steam generator (single pressure), simple combined cycle and the
// steam generator of a PWR/VVER plant, with T–Q diagrams. Water/steam from IF97;
// gas with a constant mean cp (input) as in hand calculations of HRSGs.
// Units: p MPa, T K, flows kg/s, cp kJ/(kg·K), heat kW (= kJ/s).
//
// Sources: Kehlhofer R. et al. «Combined-Cycle Gas & Steam Turbine Power Plants»,
// 3rd ed. (2009), ch. 5–6 (pinch and approach method, T–Q diagram);
// Ganapathy V. «Industrial Boilers and Heat Recovery Steam Generators» (2003),
// ch. 1 (design-point method); Рассохин Н.Г. «Парогенераторные
// установки атомных электростанций» (1987), гл. 3 (тепловий баланс і T–Q діаграма
// горизонтального ПГ ВВЕР); Brayton cycle with isentropic efficiencies (any
// engineering thermodynamics text, e.g. Çengel & Boles, ch. 9).
import {calculate} from './engine.js';

function ppcState(mode,a,b){const s=calculate(mode,a,b).state;if(!Number.isFinite(s?.h))throw Error('pp.error.state');return s;}
function ppcPositive(name,v){if(!Number.isFinite(v)||v<=0)throw Error('pp.error.'+name);return v;}
const ppcLmtd=(a,b)=>Math.abs(a-b)<1e-9?a:(a-b)/Math.log(a/b);

// Single-pressure HRSG with superheater, evaporator and economizer.
export function ppcHrsg({gasFlow,gasT,cpGas=1.1,p,steamT,feedT,pinch=10,approach=5,ambientT=288.15}){
 for(const [k,v] of [['massFlow',gasFlow],['temperature',gasT],['coefficient',cpGas],['pressure',p],['temperature',steamT],['temperature',feedT]])ppcPositive(k,v);
 if(!(pinch>0)||!(approach>=0))throw Error('pp.error.pinch');if(p>=22.064)throw Error('pp.error.supercritical');
 const sat=ppcState('px',p,0),vap=ppcState('px',p,1),Ts=sat.T;
 if(!(steamT>Ts))throw Error('pp.error.steamT');if(!(feedT<Ts-approach))throw Error('pp.error.feedT');
 const sh=ppcState('pt',p,steamT),fw=ppcState('pt',p,feedT),ecoOut=approach>0?ppcState('pt',p,Ts-approach):sat;
 const Tpinch=Ts+pinch;if(!(gasT>Tpinch)||!(gasT>steamT))throw Error('pp.error.gasT');
 const steamFlow=gasFlow*cpGas*(gasT-Tpinch)/(sh.h-ecoOut.h);
 const Qsh=steamFlow*(sh.h-vap.h),Qev=steamFlow*(vap.h-ecoOut.h),Qeco=steamFlow*(ecoOut.h-fw.h);
 const TgSh=gasT-Qsh/(gasFlow*cpGas),stackT=Tpinch-Qeco/(gasFlow*cpGas);
 const Q=Qsh+Qev+Qeco,notes=[];
 if(stackT<=feedT)throw Error('pp.error.stack');
 if(stackT-273.15<90)notes.push('pp.note.stackLow');
 const approachHot=gasT-steamT;if(approachHot<20)notes.push('pp.note.hotApproach');
 // T–Q points from the cold end: water line and gas line share the heat axis.
 const water=[[0,feedT],[Qeco,Ts-approach],[Qeco,Ts-approach],[Qeco+(sat.h-ecoOut.h)*steamFlow,Ts],[Qeco+Qev,Ts],[Q,steamT]];
 const gas=[[0,stackT],[Qeco,Tpinch],[Qeco+Qev,TgSh],[Q,gasT]];
 return {Ts,steamFlow,Qsh,Qev,Qeco,Q,stackT,TgSh,Tpinch,approachHot,efficiency:Q/(gasFlow*cpGas*(gasT-ambientT)),steam:{h:sh.h,s:sh.s},feed:{h:fw.h},water,gas,notes};
}

// Air-standard gas turbine (cp, kappa for air and gas) + HRSG + condensing steam turbine.
export function ppcCombined({ambientT=288.15,ratio=17,etaC=.88,etaT=.9,tit=1573.15,airFlow=500,cpAir=1.005,kAir=1.4,cpGas=1.15,kGas=1.33,
 p,steamT,pinch=10,approach=5,pk=.005,etaST=.88,etaPump=.8}){
 for(const [k,v] of [['temperature',ambientT],['ratio',ratio],['temperature',tit],['massFlow',airFlow],['pressure',pk]])ppcPositive(k,v);
 for(const e of [etaC,etaT,etaST,etaPump])if(!(e>0&&e<=1))throw Error('pp.error.coefficient');
 const T2=ambientT*(1+(ratio**((kAir-1)/kAir)-1)/etaC),T4=tit*(1-etaT*(1-ratio**(-(kGas-1)/kGas)));
 if(!(tit>T2))throw Error('pp.error.tit');
 const wC=cpAir*(T2-ambientT),wT=cpGas*(tit-T4),Q1=airFlow*cpGas*(tit-T2),Ngt=airFlow*(wT-wC);
 // Steam cycle without regeneration, as usual in combined cycles: the condensate
 // pump feeds the HRSG directly, and its economizer heats the condensate.
 const cond=ppcState('px',pk,0),wPump=cond.v*(p-pk)*1e3/etaPump,feed=ppcState('ph',p,cond.h+wPump);
 const h=ppcHrsg({gasFlow:airFlow,gasT:T4,cpGas,p,steamT,feedT:feed.T,pinch,approach,ambientT});
 const s1=h.steam,h2s=ppcState('ps',pk,s1.s).h,h2=s1.h-etaST*(s1.h-h2s);
 const st2=ppcState('ph',pk,h2),Nst=h.steamFlow*((s1.h-h2)-wPump);
 return {T2,T4,wC,wT,Q1,Ngt,etaGT:Ngt/Q1,hrsg:h,Nst,etaSteam:Nst/h.Q,N:Ngt+Nst,eta:(Ngt+Nst)/Q1,x2:st2.x,condenser:h.steamFlow*(h2-cond.h),notes:h.notes};
}

// Horizontal steam generator of a PWR/VVER: primary water cools from T1in to
// T1out at p1; secondary feedwater at Tfw boils at p2 to steam of quality x2.
export function ppcSteamGenerator({p1=15.7,T1in=593.15,T1out=563.15,primaryFlow=4400,p2=6.27,Tfw=493.15,x2=.998,blowdown=.005,U=null}){
 for(const [k,v] of [['pressure',p1],['temperature',T1in],['temperature',T1out],['massFlow',primaryFlow],['pressure',p2],['temperature',Tfw]])ppcPositive(k,v);
 if(!(T1in>T1out))throw Error('pp.error.primaryT');if(!(x2>0&&x2<=1)||!(blowdown>=0&&blowdown<.2))throw Error('pp.error.coefficient');
 const a=ppcState('pt',p1,T1in),b=ppcState('pt',p1,T1out),sat=ppcState('px',p2,0),st=ppcState('px',p2,x2),fw=ppcState('pt',p2,Tfw),Ts=sat.T;
 if(!(Tfw<Ts))throw Error('pp.error.feedT');if(!(T1out>Tfw))throw Error('pp.error.primaryT');
 const Q=primaryFlow*(a.h-b.h);
 // Feed G_fw = D + G_blowdown; blowdown leaves as saturated water.
 const D=Q/((st.h-fw.h)+blowdown*(sat.h-fw.h)),Gfw=D*(1+blowdown);
 const Qeco=Gfw*(sat.h-fw.h),Qev=Q-Qeco;
 // Primary temperature where the secondary side reaches saturation (pinch point).
 const hPinch=b.h+Qeco/primaryFlow,Tp=ppcState('ph',p1,hPinch).T;
 const dHot=T1in-Ts,dPinch=Tp-Ts,dCold=T1out-Tfw;if(!(dPinch>0))throw Error('pp.error.pinchNegative');
 const lmEco=ppcLmtd(dPinch,dCold),lmEv=ppcLmtd(dHot,dPinch),UA=Qeco/lmEco+Qev/lmEv;
 const primary=[[0,T1out],[Qeco,Tp],[Q,T1in]],secondary=[[0,Tfw],[Qeco,Ts],[Q,Ts]];
 return {Q,D,Gfw,Ts,Tp,dHot,dPinch,dCold,Qeco,Qev,lmEco,lmEv,UA,area:U>0?UA/U:null,lmtd:Q/UA,primary,secondary,notes:[]};
}
