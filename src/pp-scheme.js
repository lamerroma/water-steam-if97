// Thermal scheme of a condensing power unit with regenerative feedwater heating:
// closed HP heaters with drains cascaded to the deaerator, an open deaerator,
// closed LP heaters with drains cascaded to the condenser, and either steam
// reheat (fossil unit) or a moisture separator–reheater heated by live steam
// (nuclear unit with saturated live steam). Water and steam from IF97.
// Units: p MPa, T K, h kJ/kg; flows per kg of live steam, then scaled to power.
//
// Method: Рыжкин В.Я. «Тепловые электрические станции» (1987), гл. 4–5
// (розрахунок теплової схеми: баланси підігрівачів зверху вниз, деаератор як
// змішувач, потужність через витрати по відсіках); Маргулова Т.Х. «Атомные
// электрические станции» (1994), гл. 5 (схема К-1000-60 із СПП). Template
// pressures are rounded teaching values from these textbooks, not design data.
import {calculate} from './engine.js';

const PPS_DRAIN_COOLER=10;
function ppsState(mode,a,b){const s=calculate(mode,a,b).state;if(!Number.isFinite(s?.h))throw Error('pp.error.state');return s;}

// Templates: extraction heaters from the highest pressure down.
export const PP_SCHEME_TEMPLATES={
 k1000:{nuclear:true,heaters:[['ПВД-7','hp',2.8],['ПВД-6','hp',1.8],['Д','deaerator',.69],['ПНД-4','lp',.5],['ПНД-3','lp',.26],['ПНД-2','lp',.12],['ПНД-1','lp',.05]],pFeed:8,pCondensate:1.6},
 k300:{nuclear:false,heaters:[['ПВД-8','hp',6.1],['ПВД-7','hp',3.9],['ПВД-6','hp',1.6],['Д','deaerator',.7],['ПНД-4','lp',.53],['ПНД-3','lp',.26],['ПНД-2','lp',.12],['ПНД-1','lp',.02]],pFeed:30,pCondensate:1.5}
};

// o: {template, p0, T0 | x0, pRh, Trh, pk, power (kW), etaHP, etaLP, etaEM, etaPump, ttd, xSep}
export function ppsScheme(o){
 const tpl=PP_SCHEME_TEMPLATES[o.template];if(!tpl)throw Error('pp.error.template');
 const {p0,pRh,Trh,pk,power,etaHP=.85,etaLP=.85,etaEM=.98,etaPump=.8,ttd=3,xSep=.995}=o;
 for(const [k,v] of [['pressure',p0],['pressure',pRh],['temperature',Trh],['pressure',pk],['power',power]])if(!Number.isFinite(v)||v<=0)throw Error('pp.error.'+k);
 for(const e of [etaHP,etaLP,etaEM,etaPump])if(!(e>0&&e<=1))throw Error('pp.error.coefficient');
 if(!(ttd>=0&&ttd<30)||!(xSep>.9&&xSep<=1))throw Error('pp.error.coefficient');
 const heaters=tpl.heaters.map(([name,kind,p])=>({name,kind,p}));
 if(!(p0>heaters[0].p))throw Error('pp.error.schemeP0');
 if(heaters.some((h,i)=>i&&h.p>=heaters[i-1].p)||!(heaters.at(-1).p>pk))throw Error('pp.error.schemeOrder');
 const hpHeaters=heaters.filter(h=>h.p>=pRh);if(!hpHeaters.length||heaters.find(h=>h.kind==='deaerator').p>=pRh)throw Error('pp.error.schemeReheat');
 const live=tpl.nuclear?ppsState('px',p0,o.x0??.995):ppsState('pt',p0,o.T0);
 if(!tpl.nuclear&&!(Trh>ppsState('px',pRh,1).T))throw Error('pp.error.steamT');
 // Expansion line: segment efficiencies between successive extraction pressures.
 const expand=(st,p,eta)=>ppsState('ph',p,st.h-eta*(st.h-ppsState('ps',p,st.s).h));
 const line=[[live.s,live.h]];let st=live;
 for(const h of hpHeaters){if(h.p<st.p){st=expand(st,h.p,etaHP);line.push([st.s,st.h]);}h.ext=st;}
 if(st.p>pRh){st=expand(st,pRh,etaHP);line.push([st.s,st.h]);}
 const hpExhaust=st;let sep=null,afterSep=st,rh;
 if(tpl.nuclear){
  const x=st.x??1;if(x<xSep){sep={water:(xSep-x)/xSep};afterSep=ppsState('px',pRh,xSep);}
  if(!(Trh>afterSep.T))throw Error('pp.error.steamT');
 }
 rh=ppsState('pt',pRh,Trh);line.push([rh.s,rh.h]);st=rh;
 for(const h of heaters.filter(h=>h.p<pRh)){st=expand(st,h.p,etaLP);line.push([st.s,st.h]);h.ext=st;}
 const exhaust=expand(st,pk,etaLP);line.push([exhaust.s,exhaust.h]);
 // Water side: condensate pump to pCondensate, feed pump after the deaerator.
 const cond=ppsState('px',pk,0),dea=heaters.find(h=>h.kind==='deaerator'),deaSat=ppsState('px',dea.p,0);
 const pump=(st,p)=>({h:st.h+st.v*(p-st.p)*1e3/etaPump,w:st.v*(p-st.p)*1e3/etaPump});
 const cp=pump(cond,tpl.pCondensate),fp=pump(deaSat,tpl.pFeed);
 if(!(tpl.pFeed>p0)||!(tpl.pCondensate>dea.p))throw Error('pp.error.schemePumps');
 for(const h of heaters){
  h.sat=ppsState('px',h.p,0);h.drain=h.sat.h;
  if(h.kind==='deaerator'){h.out=deaSat.h;h.Tout=deaSat.T;continue;}
  const pw=h.kind==='hp'?tpl.pFeed:tpl.pCondensate,Tout=h.sat.T-ttd;h.out=ppsState('pt',pw,Tout).h;h.Tout=Tout;
 }
 // Inlet water enthalpy of each heater: outlet of the next heater down its line.
 const hp=heaters.filter(h=>h.kind==='hp'),lp=heaters.filter(h=>h.kind==='lp');
 hp.forEach((h,i)=>h.in=i<hp.length-1?hp[i+1].out:fp.h);lp.forEach((h,i)=>h.in=i<lp.length-1?lp[i+1].out:cp.h);
 for(const h of [...hp,...lp])if(!(h.out>h.in))throw Error('pp.error.schemeHeater');
 // HP heaters have built-in drain coolers: drain leaves 10 K above the inlet water.
 for(const h of hp){const Tin=ppsState('ph',tpl.pFeed,h.in).T,Td=Tin+PPS_DRAIN_COOLER;if(Td<h.sat.T)h.drain=ppsState('pt',h.p,Td).h;}
 // Reheater of a nuclear unit: live steam condenses at p0; drain to the top HP heater.
 let alphaRh=0,drainIn=0,drainH=0;
 if(tpl.nuclear){const liveSat=ppsState('px',p0,0);alphaRh=null;rh.liveDrain=liveSat.h;}
 // Unknowns depend on the reheater flow (nuclear): iterate on the HP-cylinder flow.
 let result;
 for(let iter=0;iter<60;iter++){
  const flowHP=1-(alphaRh??0);
  drainIn=tpl.nuclear?(alphaRh??0):0;drainH=tpl.nuclear?rh.liveDrain:0;
  for(const h of hp){const a=(h.out-h.in-drainIn*(drainH-h.drain))/(h.ext.h-h.drain);h.alpha=a;drainIn+=a;drainH=h.drain;}
  const hpDrains=drainIn,hpDrainH=drainH;
  // Separator and reheater act on the steam left after the HP extractions.
  const flowAtSep=flowHP-hpHeaters.reduce((s,h)=>s+h.alpha,0);
  const sepWater=sep?flowAtSep*sep.water:0,flowRh=flowAtSep-sepWater;
  let newAlphaRh=0;if(tpl.nuclear)newAlphaRh=flowRh*(rh.h-afterSep.h)/(live.h-rh.liveDrain);
  // Deaerator: mass and energy with HP drains, separator water (saturated at pRh).
  const sepH=sep?ppsState('px',pRh,0).h:0,lpIn=lp.length?lp[0].out:cp.h;
  // 1 = αd + Gc + hpDrains + sepWater; 1·h'd = αd·hd + Gc·lpIn + hpDrains·hpDrainH + sepWater·sepH
  const rest=1-hpDrains-sepWater,ad=(deaSat.h-rest*lpIn-hpDrains*hpDrainH-sepWater*sepH)/(dea.ext.h-lpIn);
  dea.alpha=ad;const Gc=rest-ad;
  let dIn=0,dH=0;for(const h of lp){const a=(Gc*(h.out-h.in)-dIn*(dH-h.drain))/(h.ext.h-h.drain);h.alpha=a;dIn+=a;dH=h.drain;}
  result={flowHP,flowAtSep,sepWater,flowRh,Gc,lpDrains:dIn,lpDrainH:dH};
  if(!tpl.nuclear||Math.abs(newAlphaRh-(alphaRh??0))<1e-12){alphaRh=newAlphaRh;break;}
  alphaRh=newAlphaRh;
 }
 if(heaters.some(h=>!(h.alpha>=0)))throw Error('pp.error.schemeHeater');
 // Turbine work per kg live steam, section by section.
 let flow=result.flowHP,work=0,prev=live;
 for(const h of hpHeaters){work+=flow*(prev.h-h.ext.h);prev=h.ext;flow-=h.alpha;}
 work+=flow*(prev.h-hpExhaust.h);
 prev=rh;flow=result.flowRh;
 for(const h of heaters.filter(h=>h.p<pRh)){work+=flow*(prev.h-h.ext.h);prev=h.ext;flow-=h.alpha;}
 work+=flow*(prev.h-exhaust.h);const condFlow=flow;
 const pumpWork=result.Gc*cp.w+1*fp.w,net=work*etaEM-pumpWork;
 const feedOut=hp[0].out,qIn=(live.h-feedOut)+(tpl.nuclear?0:result.flowRh*(rh.h-hpExhaust.h));
 const eta=net/qIn,D0=power/net;
 // Balance check: heat in = net work + condenser loss + generator loss.
 const qCond=condFlow*(exhaust.h-cond.h)+result.lpDrains*(result.lpDrainH-cond.h);
 const notes=[];if(exhaust.x!=null&&exhaust.x<.86)notes.push('pp.note.exhaustMoisture');
 return {template:o.template,nuclear:tpl.nuclear,live,hpExhaust,afterSep,rh,exhaust,feedOut,TfeedOut:hp[0].Tout,alphaRh,sepWater:result.sepWater,heaters,work,pumpWork,net,qIn,eta,D0,Q:D0*qIn,condFlow,qCond,
  balance:qIn-net-qCond-work*(1-etaEM),line,notes};
}
