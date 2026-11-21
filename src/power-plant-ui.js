import {pptNozzle,pptStage,pptStageSweep,pptBaumann} from './pp-turbine.js';
import {ppcHrsg,ppcCombined,ppcSteamGenerator} from './pp-ccgt.js';
import {ppdHeatingGraph,ppdChpTurbine} from './pp-chp.js';
import {ppkCondenser,ppkCoolingTower} from './pp-condenser.js';
import {ppsScheme} from './pp-scheme.js';
import {calcPanelLineChart} from './calc-panel-ui.js';
// Power-plant panel ("Енергоблок"): turbine elements and plant components.
// Base units: pressure MPa (abs), temperature °C, mass flow kg/s, length m.
const PP_K=273.15;
export const PP_FIELDS={
 p0:['p0','МПа',9,null,'pressure','MPa'],t0:['t0','°C',535,null,'temperature','C'],c0:['c0','м/с',0],
 p1:['p1','МПа',3,null,'pressure','MPa'],m:['m','кг/с',100,null,'mass','kgs'],phi:['phi','',.97],mu:['mu','',.97],
 p2:['p2','МПа',7.5,null,'pressure','MPa'],reaction:['reaction','',.05],alpha1:['alpha1','°',13],d:['d','м',1,null,'length','m'],n:['n','об/хв',3000],psi:['psi','',.92],dBeta:['dBeta','°',3],
 pk:['pk','МПа',.005,null,'pressure','MPa'],eta:['eta','',.85],a:['a','',1],steps:['steps','',40],
 gasFlow:['gasFlow','кг/с',500,null,'mass','kgs'],gasT:['gasT','°C',600,null,'temperature','C'],cpGas:['cpGas','кДж/(кг·K)',1.1],ps:['ps','МПа',8,null,'pressure','MPa'],ts:['ts','°C',540,null,'temperature','C'],tfw:['tfw','°C',60,null,'temperature','C'],
 pinch:['pinch','K',10],approach:['approach','K',5],tamb:['tamb','°C',15,null,'temperature','C'],
 ratio:['ratio','',17],etaC:['etaC','',.88],etaT:['etaT','',.9],tit:['tit','°C',1300,null,'temperature','C'],airFlow:['airFlow','кг/с',500,null,'mass','kgs'],cpAir:['cpAir','кДж/(кг·K)',1.005],kAir:['kAir','',1.4],kGas:['kGas','',1.33],etaST:['etaST','',.88],etaPump:['etaPump','',.8],
 p1sg:['p1sg','МПа',15.7,null,'pressure','MPa'],t1in:['t1in','°C',320,null,'temperature','C'],t1out:['t1out','°C',290,null,'temperature','C'],gprim:['gprim','кг/с',4400,null,'mass','kgs'],p2sg:['p2sg','МПа',6.27,null,'pressure','MPa'],tfwsg:['tfwsg','°C',220,null,'temperature','C'],x2:['x2','',.998],blowdown:['blowdown','%',.5],U:['U','кВт/(м²·K)',5],
 ti:['ti','°C',20],toDesign:['toDesign','°C',-22],tau1:['tau1','°C',150],tau2:['tau2','°C',70],tau3:['tau3','°C',95],nRad:['nRad','',.25],tBreak:['tBreak','°C',70],toStart:['toStart','°C',8],stepT:['stepT','K',2],
 pt:['pt','МПа',.15,null,'pressure','MPa'],gt:['gt','кг/с',50,null,'mass','kgs'],etaHP:['etaHP','',.85],etaLP:['etaLP','',.8],etaEM:['etaEM','',.98],tsup:['tsup','°C',100,null,'temperature','C'],tret:['tret','°C',60,null,'temperature','C'],pnet:['pnet','МПа',1.6,null,'pressure','MPa'],etaB:['etaB','',.92],
 cD:['cD','кг/с',140,null,'mass','kgs'],cx:['cx','',.9],cW:['cW','кг/с',8000,null,'mass','kgs'],tw1:['tw1','°C',15],ck:['ck','кВт/(м²·K)',3],cF:['cF','м²',15000],
 ctL:['ctL','кг/с',1000,null,'mass','kgs'],ct1:['ct1','°C',40],ct2:['ct2','°C',28],ctG:['ctG','кг/с',900,null,'mass','kgs'],cta:['cta','°C',25],cphi:['cphi','%',60],cpa:['cpa','МПа',.101325,null,'pressure','MPa'],
 kp0:['kp0','МПа',5.88,null,'pressure','MPa'],kx0:['kx0','',.995],kpsep:['kpsep','МПа',1.2,null,'pressure','MPa'],ktrh:['ktrh','°C',250,null,'temperature','C'],kpk:['kpk','МПа',.004,null,'pressure','MPa'],kN:['kN','МВт',1000],ketaHP:['ketaHP','',.82],ketaLP:['ketaLP','',.85],kttd:['kttd','K',3],
 fp0:['fp0','МПа',23.5,null,'pressure','MPa'],ft0:['ft0','°C',540,null,'temperature','C'],fprh:['fprh','МПа',3.9,null,'pressure','MPa'],ftrh:['ftrh','°C',540,null,'temperature','C'],fpk:['fpk','МПа',.0034,null,'pressure','MPa'],fN:['fN','МВт',300],fetaHP:['fetaHP','',.84],fetaLP:['fetaLP','',.88],fttd:['fttd','K',3]
};
const ppRow=(k,v,u='')=>['pp.r.'+k,v,u];
const ppQuality=x=>x!=null&&x<1?x:null;
export const PP_CALCS={
 nozzle:{group:'turbine',fields:['p0','t0','c0','p1','m','phi','mu'],run:v=>{
  const r=pptNozzle({p0:v.p0,T0:v.t0+PP_K,c0:v.c0,p1:v.p1,m:v.m,phi:v.phi,mu:v.mu});
  return {rows:[ppRow('p0star',r.stagnation.p,'МПа'),ppRow('h0star',r.stagnation.h,'кДж/кг'),ppRow('ratio',r.critical.ratio),ppRow('pCrit',r.critical.p,'МПа'),ppRow('tCrit',r.critical.T-PP_K,'°C'),ppRow('cCrit',r.critical.c,'м/с'),ppRow('gCrit',r.critical.G,'кг/(м²·с)'),
   ppRow('type',r.converging?'pp.type.converging':'pp.type.laval'),ppRow('throatArea',r.throatArea*1e4,'см²'),ppRow('throatD',r.throatDiameter*1e3,'мм'),ppRow('exitArea',r.exitArea*1e4,'см²'),ppRow('exitD',r.exitDiameter*1e3,'мм'),ppRow('areaRatio',r.areaRatio),
   ppRow('c1t',r.exit.cIdeal,'м/с'),ppRow('c1',r.exit.c,'м/с'),ppRow('mach',r.mach),ppRow('t1',r.exit.T-PP_K,'°C'),ppRow('x1',ppQuality(r.exit.x)),ppRow('lossNozzle',r.loss,'кДж/кг')],notes:r.notes};}},
 stage:{group:'turbine',fields:['p0','t0','c0','p2','reaction','alpha1','d','n','phi','psi','dBeta'],run:v=>{
  const input={p0:v.p0,T0:v.t0+PP_K,c0:v.c0,p2:v.p2,reaction:v.reaction,alpha1:v.alpha1,d:v.d,n:v.n,phi:v.phi,psi:v.psi,dBeta:v.dBeta},r=pptStage(input);
  const sweep=pptStageSweep(input);
  const svg=calcPanelLineChart({series:[{label:uiTranslator.t('pp.chart.etaU'),color:'#365e90',points:sweep},{label:uiTranslator.t('pp.chart.design'),color:'#c0392b',dash:true,points:[[r.uRatio,0],[r.uRatio,r.efficiency]]}],xLabel:'u/cf',yLabel:uiTranslator.t('pp.chart.etaU')});
  return {rows:[ppRow('H0',r.H0,'кДж/кг'),ppRow('cf',r.cf,'м/с'),ppRow('u',r.u,'м/с'),ppRow('uRatio',r.uRatio),ppRow('uRatioOpt',r.uRatioOpt),ppRow('p1stage',r.p1,'МПа'),
   ppRow('c1',r.c1,'м/с'),ppRow('w1',r.w1,'м/с'),ppRow('beta1',r.beta1,'°'),ppRow('w2',r.w2,'м/с'),ppRow('beta2',r.beta2,'°'),ppRow('c2',r.c2,'м/с'),ppRow('alpha2',r.alpha2,'°'),
   ppRow('lossNozzle',r.lossNozzle,'кДж/кг'),ppRow('lossBlade',r.lossBlade,'кДж/кг'),ppRow('lossLeaving',r.lossLeaving,'кДж/кг'),ppRow('work',r.work,'кДж/кг'),ppRow('etaU',r.efficiency),ppRow('t2',r.exit.T-PP_K,'°C'),ppRow('x2',ppQuality(r.exit.x))],svg,notes:r.notes};}},
 baumann:{group:'turbine',fields:['p0','t0','pk','eta','a','steps'],run:v=>{
  const r=pptBaumann({p0:v.p0,T0:v.t0+PP_K,pk:v.pk,eta:v.eta,a:v.a,steps:v.steps});
  const svg=calcPanelLineChart({series:[{label:uiTranslator.t('pp.chart.baumann'),color:'#365e90',points:r.line},{label:uiTranslator.t('pp.chart.dry'),color:'#7f8c8d',dash:true,points:r.dryLine},{label:uiTranslator.t('pp.chart.isentrope'),color:'#c0392b',dash:true,points:r.isentrope}],xLabel:uiTranslator.t('pp.chart.s'),yLabel:uiTranslator.t('pp.chart.h'),yFromZero:false});
  return {rows:[ppRow('Hs',r.Hs,'кДж/кг'),ppRow('workWet',r.work,'кДж/кг'),ppRow('workDry',r.workDry,'кДж/кг'),ppRow('etaWet',r.etaOverall),ppRow('etaDry',r.etaDryOverall),ppRow('hk',r.hk,'кДж/кг'),ppRow('tk',r.Tk-PP_K,'°C'),ppRow('xk',ppQuality(r.xk)),ppRow('xks',ppQuality(r.xks))],svg,notes:['pp.note.reheat']};}}
};
const ppTQ=(hot,cold,hotLabel,coldLabel)=>calcPanelLineChart({series:[{label:uiTranslator.t(hotLabel),color:'#c0392b',points:hot.map(([q,T])=>[q/1e3,T-PP_K])},{label:uiTranslator.t(coldLabel),color:'#365e90',points:cold.map(([q,T])=>[q/1e3,T-PP_K])}],xLabel:uiTranslator.t('pp.chart.Q'),yLabel:uiTranslator.t('pp.chart.T'),yFromZero:false});
const ppHrsgRows=h=>[ppRow('Ts',h.Ts-PP_K,'°C'),ppRow('steamFlow',h.steamFlow,'кг/с'),ppRow('Qsh',h.Qsh/1e3,'МВт'),ppRow('Qev',h.Qev/1e3,'МВт'),ppRow('Qeco',h.Qeco/1e3,'МВт'),ppRow('Qhrsg',h.Q/1e3,'МВт'),ppRow('TgSh',h.TgSh-PP_K,'°C'),ppRow('Tpinch',h.Tpinch-PP_K,'°C'),ppRow('stackT',h.stackT-PP_K,'°C'),ppRow('approachHot',h.approachHot,'K'),ppRow('etaHrsg',h.efficiency)];
Object.assign(PP_CALCS,{
 hrsg:{group:'ccgt',fields:['gasFlow','gasT','cpGas','ps','ts','tfw','pinch','approach','tamb'],run:v=>{
  const h=ppcHrsg({gasFlow:v.gasFlow,gasT:v.gasT+PP_K,cpGas:v.cpGas,p:v.ps,steamT:v.ts+PP_K,feedT:v.tfw+PP_K,pinch:v.pinch,approach:v.approach,ambientT:v.tamb+PP_K});
  return {rows:ppHrsgRows(h),svg:ppTQ(h.gas,h.water,'pp.chart.gas','pp.chart.water'),notes:h.notes};}},
 combined:{group:'ccgt',fields:['tamb','ratio','etaC','etaT','tit','airFlow','cpAir','kAir','cpGas','kGas','ps','ts','pinch','approach','pk','etaST','etaPump'],run:v=>{
  const r=ppcCombined({ambientT:v.tamb+PP_K,ratio:v.ratio,etaC:v.etaC,etaT:v.etaT,tit:v.tit+PP_K,airFlow:v.airFlow,cpAir:v.cpAir,kAir:v.kAir,cpGas:v.cpGas,kGas:v.kGas,p:v.ps,steamT:v.ts+PP_K,pinch:v.pinch,approach:v.approach,pk:v.pk,etaST:v.etaST,etaPump:v.etaPump});
  return {rows:[ppRow('T2',r.T2-PP_K,'°C'),ppRow('T4',r.T4-PP_K,'°C'),ppRow('Q1',r.Q1/1e3,'МВт'),ppRow('Ngt',r.Ngt/1e3,'МВт'),ppRow('etaGT',r.etaGT),...ppHrsgRows(r.hrsg),ppRow('x2st',ppQuality(r.x2)),ppRow('Nst',r.Nst/1e3,'МВт'),ppRow('etaSteam',r.etaSteam),ppRow('condenserQ',r.condenser/1e3,'МВт'),ppRow('Ncc',r.N/1e3,'МВт'),ppRow('etaCC',r.eta)],
   svg:ppTQ(r.hrsg.gas,r.hrsg.water,'pp.chart.gas','pp.chart.water'),notes:[...r.notes,'pp.note.airStandard']};}},
 'steam-generator':{group:'ccgt',fields:['p1sg','t1in','t1out','gprim','p2sg','tfwsg','x2','blowdown','U'],run:v=>{
  const r=ppcSteamGenerator({p1:v.p1sg,T1in:v.t1in+PP_K,T1out:v.t1out+PP_K,primaryFlow:v.gprim,p2:v.p2sg,Tfw:v.tfwsg+PP_K,x2:v.x2,blowdown:v.blowdown/100,U:v.U});
  return {rows:[ppRow('Qsg',r.Q/1e3,'МВт'),ppRow('D',r.D,'кг/с'),ppRow('Dt',r.D*3.6,'т/год'),ppRow('Gfw',r.Gfw,'кг/с'),ppRow('Ts',r.Ts-PP_K,'°C'),ppRow('Tp',r.Tp-PP_K,'°C'),ppRow('dHot',r.dHot,'K'),ppRow('dPinch',r.dPinch,'K'),ppRow('dCold',r.dCold,'K'),ppRow('Qeco',r.Qeco/1e3,'МВт'),ppRow('Qev',r.Qev/1e3,'МВт'),ppRow('lmtd',r.lmtd,'K'),ppRow('UA',r.UA/1e3,'МВт/K'),ppRow('area',r.area,'м²')],
   svg:ppTQ(r.primary,r.secondary,'pp.chart.primary','pp.chart.secondary'),notes:['pp.note.sgSections']};}}
});
Object.assign(PP_CALCS,{
 'heating-graph':{group:'chp',fields:['ti','toDesign','tau1','tau2','tau3','nRad','tBreak','toStart','stepT'],run:v=>{
  const g=ppdHeatingGraph({ti:v.ti,toDesign:v.toDesign,tau1:v.tau1,tau2:v.tau2,tau3:v.tau3,n:v.nRad,tBreak:v.tBreak,toStart:v.toStart,step:v.stepT});
  const svg=calcPanelLineChart({series:[{label:'τ₁',color:'#c0392b',points:g.rows.map(r=>[r.to,r.supply])},{label:'τ₃',color:'#e67e22',dash:true,points:g.rows.map(r=>[r.to,r.tau3])},{label:'τ₂',color:'#365e90',points:g.rows.map(r=>[r.to,r.tau2])}],xLabel:uiTranslator.t('pp.chart.outdoor'),yLabel:uiTranslator.t('pp.chart.T'),yFromZero:false});
  return {rows:[ppRow('dtRad',g.dt,'K'),ppRow('dTau',g.dTau,'K'),ppRow('theta',g.theta,'K'),ppRow('mixing',g.mixing),ppRow('toBreak',g.toBreak,'°C')],
   table:{columns:[['pp.c.to','°C'],['pp.c.Q',''],['pp.c.tau1','°C'],['pp.c.tau1q','°C'],['pp.c.tau3','°C'],['pp.c.tau2','°C']],rows:g.rows.map(r=>[r.to,r.Q,r.supply,r.tau1,r.tau3,r.tau2])},svg,notes:['pp.note.break']};}},
 'chp-turbine':{group:'chp',fields:['p0','t0','m','pt','gt','pk','etaHP','etaLP','etaEM','tsup','tret','pnet','etaB'],run:v=>{
  const r=ppdChpTurbine({p0:v.p0,T0:v.t0+PP_K,G0:v.m,pt:v.pt,Gt:v.gt,pk:v.pk,etaHP:v.etaHP,etaLP:v.etaLP,etaEM:v.etaEM,tSupply:v.tsup+PP_K,tReturn:v.tret+PP_K,pNet:v.pnet,etaBoiler:v.etaB});
  return {rows:[ppRow('tt',r.Tt-PP_K,'°C'),ppRow('xt',ppQuality(r.xt)),ppRow('xk',ppQuality(r.xk)),ppRow('gk',r.Gk,'кг/с'),ppRow('Nhp',r.Nhp/1e3,'МВт'),ppRow('Nlp',r.Nlp/1e3,'МВт'),ppRow('Ne',r.N/1e3,'МВт'),ppRow('Qt',r.Qt/1e3,'МВт'),ppRow('Qk',r.Qk/1e3,'МВт'),
   ppRow('Nt',r.Nt/1e3,'МВт'),ppRow('W',r.W),ppRow('Gnet',r.Gnet,'кг/с'),ppRow('Qfuel',r.Qfuel/1e3,'МВт'),ppRow('etaE',r.etaE),ppRow('etaEPhys',r.etaEPhysical),ppRow('utilization',r.utilization)],notes:r.notes};}}
});
Object.assign(PP_CALCS,{
 condenser:{group:'cooling',fields:['cD','cx','cW','tw1','ck','cF'],run:v=>{
  const r=ppkCondenser({D:v.cD,x:v.cx,W:v.cW,tw1:v.tw1,k:v.ck,F:v.cF});
  return {rows:[ppRow('pkCond',r.pk*1e3,'кПа'),ppRow('tsCond',r.ts,'°C'),ppRow('Qcond',r.Q/1e3,'МВт'),ppRow('dtw',r.dtw,'K'),ppRow('tw2',r.tw2,'°C'),ppRow('dtTerminal',r.dt,'K'),ppRow('lmtdCond',r.lmtd,'K'),ppRow('multiplicity',r.m),ppRow('ntu',r.NTU)],notes:['pp.note.condenser']};}},
 'cooling-tower':{group:'cooling',fields:['ctL','ct1','ct2','ctG','cta','cphi','cpa'],run:v=>{
  const r=ppkCoolingTower({L:v.ctL,t1:v.ct1,t2:v.ct2,G:v.ctG,ta:v.cta,phi:v.cphi/100,p:v.cpa});
  const svg=calcPanelLineChart({series:[{label:uiTranslator.t('pp.chart.saturated'),color:'#c0392b',points:r.curve},{label:uiTranslator.t('pp.chart.airLine'),color:'#365e90',points:r.line}],xLabel:uiTranslator.t('pp.chart.waterT'),yLabel:uiTranslator.t('pp.chart.hAir'),yFromZero:false});
  return {rows:[ppRow('merkel',r.merkel),ppRow('range',r.range,'K'),ppRow('twb',r.twb,'°C'),ppRow('approachTower',r.approach,'K'),ppRow('ratioLG',r.ratio),ppRow('hin',r.hin,'кДж/кг'),ppRow('hout',r.hout,'кДж/кг'),ppRow('tout',r.tout,'°C'),ppRow('evaporation',r.evaporation,'кг/с'),ppRow('evaporationShare',r.evaporationShare*100,'%'),ppRow('Qtower',r.Q/1e3,'МВт')],svg,notes:['pp.note.merkel']};}}
});
function ppSchemeResult(r){
 const kgs=r.D0,rows=[ppRow('etaScheme',r.eta),ppRow('D0',kgs,'кг/с'),ppRow('D0t',kgs*3.6,'т/год'),ppRow('Qscheme',r.Q/1e3,'МВт'),ppRow('netWork',r.net,'кДж/кг'),ppRow('steamRate',3600/r.net,'кг/(кВт·год)'),ppRow('heatRate',3600/r.eta,'кДж/(кВт·год)'),
  ppRow('tfwScheme',r.TfeedOut-PP_K,'°C'),ppRow('xExhaust',ppQuality(r.exhaust.x)),ppRow('condFlow',r.condFlow*kgs,'кг/с'),ppRow('pumpWork',r.pumpWork*kgs/1e3,'МВт')];
 if(r.nuclear)rows.push(ppRow('msrSteam',r.alphaRh*kgs,'кг/с'),ppRow('sepWater',r.sepWater*kgs,'кг/с'),ppRow('xHpExhaust',ppQuality(r.hpExhaust.x)));
 const label=h=>h.kind==='deaerator'?uiTranslator.t('pp.heater.deaerator'):uiTranslator.t('pp.heater.'+h.kind,{n:h.name.replace(/\D/g,'')});
 const table={columns:[['pp.c.heater',''],['pp.c.p','МПа'],['pp.c.tsat','°C'],['pp.c.tout','°C'],['pp.c.alpha',''],['pp.c.flow','кг/с'],['pp.c.xExt','']],
  rows:r.heaters.map(h=>[label(h),h.p,h.sat.T-PP_K,h.Tout-PP_K,h.alpha,h.alpha*kgs,ppQuality(h.ext.x)])};
 const svg=calcPanelLineChart({series:[{label:uiTranslator.t('pp.chart.expansion'),color:'#365e90',points:r.line}],xLabel:uiTranslator.t('pp.chart.s'),yLabel:uiTranslator.t('pp.chart.h'),yFromZero:false});
 return {rows,table,svg,notes:[...r.notes,'pp.note.scheme']};
}
Object.assign(PP_CALCS,{
 k1000:{group:'schemes',fields:['kp0','kx0','kpsep','ktrh','kpk','kN','ketaHP','ketaLP','etaEM','etaPump','kttd'],run:v=>ppSchemeResult(ppsScheme({template:'k1000',p0:v.kp0,x0:v.kx0,pRh:v.kpsep,Trh:v.ktrh+PP_K,pk:v.kpk,power:v.kN*1e3,etaHP:v.ketaHP,etaLP:v.ketaLP,etaEM:v.etaEM,etaPump:v.etaPump,ttd:v.kttd}))},
 k300:{group:'schemes',fields:['fp0','ft0','fprh','ftrh','fpk','fN','fetaHP','fetaLP','etaEM','etaPump','fttd'],run:v=>ppSchemeResult(ppsScheme({template:'k300',p0:v.fp0,T0:v.ft0+PP_K,pRh:v.fprh,Trh:v.ftrh+PP_K,pk:v.fpk,power:v.fN*1e3,etaHP:v.fetaHP,etaLP:v.fetaLP,etaEM:v.etaEM,etaPump:v.etaPump,ttd:v.fttd}))}
});
export const PP_GROUPS=['turbine','ccgt','chp','cooling','schemes'];
export const PP_PANEL={action:'power-plant',prefix:'pp',i18n:'pp',fields:PP_FIELDS,calcs:PP_CALCS,groups:PP_GROUPS};
function showPowerPlant(){calcPanelShow(PP_PANEL);}
globalThis.document?.addEventListener('languagechange',()=>{if(activeSection==='power-plant'){capturePanel();showPowerPlant();}});
