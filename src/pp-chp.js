// Combined heat and power: heating-network temperature graph (central quality
// regulation) and a condensing turbine with a controlled heating extraction.
// Units: p MPa, T K (graph in °C), flows kg/s, heat and power kW.
//
// Sources: Соколов Е.Я. «Теплофикация и тепловые сети», 7-е изд. (2001), гл. 4
// (температурний графік якісного регулювання опалювального навантаження:
// τ₁ = tв + Δt′·Q̄^(1/(1+n)) + (δτ′ − 0,5θ′)·Q̄, τ₂ = tв + Δt′·Q̄^(1/(1+n)) − 0,5θ′·Q̄,
// τ₃ = tв + Δt′·Q̄^(1/(1+n)) + 0,5θ′·Q̄, Q̄ = (tв − tз)/(tв − tз.р)); Рыжкин В.Я.
// «Тепловые электрические станции» (1987), гл. 3 (вироблення електроенергії на
// тепловому споживанні, фізичний метод розподілу витрати палива).
import {calculate} from './engine.js';

function ppdState(mode,a,b){const s=calculate(mode,a,b).state;if(!Number.isFinite(s?.h))throw Error('pp.error.state');return s;}
function ppdPositive(name,v){if(!Number.isFinite(v)||v<=0)throw Error('pp.error.'+name);return v;}

// Temperatures in °C. n is the heater exponent in Q ∝ Δt^(1+n) (0.25–0.35 for radiators).
export function ppdHeatingGraph({ti=20,toDesign=-22,tau1=150,tau2=70,tau3=95,n=.25,tBreak=70,toStart=8,step=2}){
 for(const v of [ti,toDesign,tau1,tau2,tau3,n,tBreak,toStart,step])if(!Number.isFinite(v))throw Error('pp.error.number');
 if(!(ti>toStart&&toStart>toDesign))throw Error('pp.error.outdoor');if(!(tau1>=tau3&&tau3>tau2&&tau2>ti))throw Error('pp.error.graph');if(!(n>=0&&n<1)||!(step>0))throw Error('pp.error.coefficient');
 const dt=(tau3+tau2)/2-ti,dTau=tau1-tau2,theta=tau3-tau2,e=1/(1+n),rows=[];
 const at=to=>{const Q=(ti-to)/(ti-toDesign),base=ti+dt*Q**e,t1=base+(dTau-.5*theta)*Q;return {to,Q,tau1:t1,tau2:base-.5*theta*Q,tau3:base+.5*theta*Q,supply:Math.max(t1,tBreak),broken:t1<tBreak};};
 for(let to=toStart;to>toDesign-1e-9;to-=step)rows.push(at(+to.toFixed(6)));
 if(rows.at(-1).to!==toDesign)rows.push(at(toDesign));
 // Outdoor temperature of the break point, where the qualitative supply equals tBreak.
 let toBreak=null;if(at(toStart).tau1<tBreak&&at(toDesign).tau1>tBreak){let lo=toDesign,hi=toStart;for(let i=0;i<60;i++){const m=(lo+hi)/2;if(at(m).tau1>tBreak)lo=m;else hi=m;}toBreak=(lo+hi)/2;}
 return {rows,toBreak,mixing:(tau1-tau3)/(tau3-tau2),dt,dTau,theta};
}

// Condensing turbine with a controlled heating extraction (type "Т").
export function ppdChpTurbine({p0,T0,G0,pt,Gt,pk,etaHP=.85,etaLP=.8,etaEM=.98,tSupply,tReturn,pNet=1.6,etaBoiler=.92}){
 for(const [k,v] of [['pressure',p0],['temperature',T0],['massFlow',G0],['pressure',pt],['pressure',pk],['temperature',tSupply],['temperature',tReturn]])ppdPositive(k,v);
 if(!(Gt>=0&&Gt<G0))throw Error('pp.error.extraction');if(!(p0>pt&&pt>pk))throw Error('pp.error.pressureOrder');
 for(const e of [etaHP,etaLP,etaEM,etaBoiler])if(!(e>0&&e<=1))throw Error('pp.error.coefficient');
 const s0=ppdState('pt',p0,T0),ht=s0.h-etaHP*(s0.h-ppdState('ps',pt,s0.s).h),st=ppdState('ph',pt,ht);
 const hk=st.h-etaLP*(st.h-ppdState('ps',pk,st.s).h),sk=ppdState('ph',pk,hk),drain=ppdState('px',pt,0),cond=ppdState('px',pk,0);
 const Gk=G0-Gt,Nhp=G0*(s0.h-ht)*etaEM,Nlp=Gk*(ht-hk)*etaEM,N=Nhp+Nlp;
 const Qt=Gt*(ht-drain.h),Qk=Gk*(hk-cond.h),Nt=Gt*(s0.h-ht)*etaEM;
 const hfw=(Gk*cond.h+Gt*drain.h)/G0,Qfuel=G0*(s0.h-hfw)/etaBoiler;
 if(!(tSupply>tReturn))throw Error('pp.error.network');
 const supply=ppdState('pt',pNet,tSupply),ret=ppdState('pt',pNet,tReturn),Gnet=Qt/(supply.h-ret.h);
 const notes=[];if(drain.T<=tSupply)notes.push('pp.note.heaterTemperature');
 // Physical method: the heat supply takes fuel Qt/ηb, the rest is charged to electricity.
 const QfuelHeat=Qt/etaBoiler;
 return {ht,Tt:st.T,xt:st.x,hk,xk:sk.x,Gk,Nhp,Nlp,N,Qt,Qk,Nt,W:Qt>0?Nt/Qt:null,hfw,Qfuel,etaE:N/Qfuel,utilization:(N+Qt)/Qfuel,etaEPhysical:N/(Qfuel-QfuelHeat),QfuelHeat,Gnet,Tdrain:drain.T,notes};
}
