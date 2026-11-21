import {pptNozzle,pptStage,pptStageSweep,pptBaumann} from './pp-turbine.js';
import {calcPanelLineChart} from './calc-panel-ui.js';
// Power-plant panel ("Енергоблок"): turbine elements and plant components.
// Base units: pressure MPa (abs), temperature °C, mass flow kg/s, length m.
const PP_K=273.15;
export const PP_FIELDS={
 p0:['p0','МПа',9,null,'pressure','MPa'],t0:['t0','°C',535,null,'temperature','C'],c0:['c0','м/с',0],
 p1:['p1','МПа',3,null,'pressure','MPa'],m:['m','кг/с',10,null,'mass','kgs'],phi:['phi','',.97],mu:['mu','',.97],
 p2:['p2','МПа',7.5,null,'pressure','MPa'],reaction:['reaction','',.05],alpha1:['alpha1','°',13],d:['d','м',1,null,'length','m'],n:['n','об/хв',3000],psi:['psi','',.92],dBeta:['dBeta','°',3],
 pk:['pk','МПа',.005,null,'pressure','MPa'],eta:['eta','',.85],a:['a','',1],steps:['steps','',40]
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
  const svg=calcPanelLineChart({series:[{label:uiTranslator.t('pp.chart.baumann'),color:'#365e90',points:r.line},{label:uiTranslator.t('pp.chart.dry'),color:'#7f8c8d',dash:true,points:r.dryLine},{label:uiTranslator.t('pp.chart.isentrope'),color:'#c0392b',dash:true,points:r.isentrope}],xLabel:uiTranslator.t('pp.chart.s'),yLabel:uiTranslator.t('pp.chart.h')});
  return {rows:[ppRow('Hs',r.Hs,'кДж/кг'),ppRow('workWet',r.work,'кДж/кг'),ppRow('workDry',r.workDry,'кДж/кг'),ppRow('etaWet',r.etaOverall),ppRow('etaDry',r.etaDryOverall),ppRow('hk',r.hk,'кДж/кг'),ppRow('tk',r.Tk-PP_K,'°C'),ppRow('xk',ppQuality(r.xk)),ppRow('xks',ppQuality(r.xks))],svg,notes:['pp.note.reheat']};}}
};
export const PP_GROUPS=['turbine'];
export const PP_PANEL={action:'power-plant',prefix:'pp',i18n:'pp',fields:PP_FIELDS,calcs:PP_CALCS,groups:PP_GROUPS};
function showPowerPlant(){calcPanelShow(PP_PANEL);}
globalThis.document?.addEventListener('languagechange',()=>{if(activeSection==='power-plant'){capturePanel();showPowerPlant();}});
