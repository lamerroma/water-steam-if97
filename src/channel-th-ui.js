import {CH_VOID_METHODS,CH_FRICTION_METHODS,CH_BOILING_METHODS,chSaturation,chVoidFraction,chDensities,chFrictionGradient,chDittusBoelter,chWallSuperheat,chChen,chBiasi,chZuber,chChannel} from './channel-th.js';
import {calcPanelLineChart} from './calc-panel-ui.js';
// Channel thermal hydraulics panel. Base units: pressure MPa (abs), temperature °C,
// mass flux kg/(m²·s), diameter mm, length m, heat flux kW/m², roughness mm.
const CH_K=273.15;
const chOptions=(list,prefix)=>list.map(v=>[v,prefix+v]);
export const CH_FIELDS={
 p:['p','МПа',7,null,'pressure','MPa'],G:['G','кг/(м²·с)',1500],D:['D','мм',12.5,null,'length','mm'],x:['x','',.2],
 roughness:['roughness','мм',0,null,'length','mm'],q:['q','кВт/м²',500],tin:['tin','°C',270,null,'temperature','C'],
 L:['L','м',3.7,null,'length','m'],Le:['Le','м',4.2,null,'length','m'],qAvg:['qAvg','кВт/м²',500],
 shape:['shape','',null,[['cosine','ch.shape.cosine'],['uniform','ch.shape.uniform']]],nodes:['nodes','',40],
 voidMethod:['voidMethod','',null,chOptions(CH_VOID_METHODS,'ch.void.')],frictionMethod:['frictionMethod','',null,chOptions(['friedel','lockhart-martinelli','homogeneous'],'ch.friction.')],
 boilingMethod:['boilingMethod','',null,chOptions(CH_BOILING_METHODS,'ch.boiling.')]
};
const chSatRows=s=>[['ch.r.Tsat',s.Tsat-CH_K,'°C'],['ch.r.rhol',s.rhol,'кг/м³'],['ch.r.rhog',s.rhog,'кг/м³'],['ch.r.hfg',s.hfg/1e3,'кДж/кг'],['ch.r.sigma',s.sigma*1e3,'мН/м']];
function chCheckQuality(x){if(!(x>=0&&x<=1))throw Error('ch.error.quality');}
export const CH_CALCS={
 'two-phase':{group:'flow',fields:['p','G','D','x','roughness'],run:v=>{
  chCheckQuality(v.x);const sat=chSaturation(v.p),D=v.D/1000,rows=chSatRows(sat);
  for(const m of CH_VOID_METHODS)rows.push(['ch.r.alpha.'+m,chVoidFraction(m,v.x,sat),'']);
  const a=chVoidFraction('smith',v.x,sat),d=chDensities(a,v.x,sat);rows.push(['ch.r.rhoMix',d.mixture,'кг/м³'],['ch.r.rhoMomentum',d.momentum,'кг/м³']);
  for(const m of CH_FRICTION_METHODS){const r=chFrictionGradient(m,{G:v.G,x:v.x,D,roughness:v.roughness/1000,sat});rows.push(['ch.r.dpdz.'+m,r.gradient/1e3,'кПа/м']);if(r.phi2!=null&&m!=='homogeneous')rows.push(['ch.r.phi2.'+m,r.phi2,'']);if(m==='lockhart-martinelli'&&Number.isFinite(r.X))rows.push(['ch.r.X',r.X,'']);}
  return {rows,notes:['ch.note.adiabatic']};}},
 'boiling':{group:'heat',fields:['p','G','D','x','q'],run:v=>{
  chCheckQuality(v.x);const sat=chSaturation(v.p),D=v.D/1000,q=v.q*1e3;
  const liq=chDittusBoelter({G:v.G,D,mu:sat.mul,k:sat.kl,Pr:sat.Prl}),rows=chSatRows(sat);
  rows.push(['ch.r.ReLiquid',liq.Re,''],['ch.r.hDB',liq.h/1e3,'кВт/(м²·K)']);
  for(const m of CH_BOILING_METHODS)rows.push(['ch.r.dT.'+m,chWallSuperheat(m,q,v.p),'K']);
  if(v.x>0&&v.x<1){const c=chChen({G:v.G,x:v.x,D,sat,q});rows.push(['ch.r.hChen',c.h/1e3,'кВт/(м²·K)'],['ch.r.dTChen',c.Te,'K'],['ch.r.TwChen',sat.Tsat+c.Te-CH_K,'°C'],['ch.r.chenF',c.F,''],['ch.r.chenS',c.S,''],['ch.r.Xtt',c.Xtt,'']);}
  return {rows,notes:v.x>0&&v.x<1?[]:['ch.note.chenQuality']};}},
 'chf':{group:'heat',fields:['p','G','D','x','q'],run:v=>{
  const sat=chSaturation(v.p),b=chBiasi({p:v.p,G:v.G,D:v.D/1000,x:v.x}),z=chZuber(sat),rows=chSatRows(sat);
  rows.push(['ch.r.biasi1',b.q1/1e3,'кВт/м²'],['ch.r.biasi2',b.q2/1e3,'кВт/м²'],['ch.r.qchf',b.q/1e3,'кВт/м²'],['ch.r.dnbr',v.q>0?b.q/(v.q*1e3):null,''],['ch.r.zuber',z/1e3,'кВт/м²']);
  return {rows,notes:b.notes};}},
 'channel':{group:'channel',fields:['p','tin','G','D','L','qAvg','shape','Le','roughness','nodes','voidMethod','frictionMethod','boilingMethod'],
  visible:v=>CH_CALCS.channel.fields.filter(k=>k!=='Le'||v.shape==='cosine'),
  run:v=>{
  const r=chChannel({p:v.p,Tin:v.tin+CH_K,G:v.G,D:v.D/1000,L:v.L,Le:v.shape==='cosine'?v.Le:v.L,qAvg:v.qAvg*1e3,shape:v.shape,nodes:v.nodes,roughness:v.roughness/1000,voidMethod:v.voidMethod,frictionMethod:v.frictionMethod,boilingMethod:v.boilingMethod});
  const rows=[['ch.r.Tsat',r.sat.Tsat-CH_K,'°C'],['ch.r.power',r.power/1e3,'кВт'],['ch.r.massFlow',r.massFlow,'кг/с'],['ch.r.peaking',r.peaking,''],['ch.r.qMax',r.qMax/1e3,'кВт/м²'],
   ['ch.r.Tout',r.Tout-CH_K,'°C'],['ch.r.xOut',r.xOut,''],['ch.r.zBoil',r.zBoil,'м'],['ch.r.zSat',r.zSat,'м'],['ch.r.maxTw',Number.isFinite(r.maxTw)?r.maxTw-CH_K:null,'°C'],
   ['ch.r.minDNBR',r.minDNBR,''],['ch.r.zMin',r.zMin,'м'],['ch.r.dpFric',r.dpFric/1e3,'кПа'],['ch.r.dpAcc',r.dpAcc/1e3,'кПа'],['ch.r.dpGrav',r.dpGrav/1e3,'кПа'],['ch.r.dpTotal',r.dpTotal/1e3,'кПа']];
  const step=Math.max(1,Math.round(r.nodes.length/20)),picked=r.nodes.filter((n,i)=>i%step===0||i===r.nodes.length-1);
  const table={columns:[['ch.c.z','м'],['ch.c.q','кВт/м²'],['ch.c.xe',''],['ch.c.alpha',''],['ch.c.Tb','°C'],['ch.c.Tw','°C'],['ch.c.regime',''],['ch.c.qchf','кВт/м²'],['ch.c.dnbr','']],
   rows:picked.map(n=>[n.z,n.q/1e3,n.xe,n.alpha,n.Tb-CH_K,n.Tw==null?null:n.Tw-CH_K,'ch.regime.'+n.regime,n.qchf/1e3,n.dnbr])};
  const svg=calcPanelLineChart({series:[{label:uiTranslator.t('ch.chart.q'),color:'#365e90',points:r.nodes.map(n=>[n.z,n.q/1e3])},{label:uiTranslator.t('ch.chart.qchf'),color:'#c0392b',dash:true,points:r.nodes.map(n=>[n.z,n.qchf/1e3])}],xLabel:uiTranslator.t('ch.chart.z'),yLabel:uiTranslator.t('ch.chart.flux')});
  return {rows,table,svg,notes:[...r.notes,'ch.note.constantPressure']};}}
};
export const CH_PANEL={action:'channel',prefix:'ch',i18n:'ch',fields:CH_FIELDS,calcs:CH_CALCS,groups:['flow','heat','channel']};
function showChannel(){calcPanelShow(CH_PANEL);}
globalThis.document?.addEventListener('languagechange',()=>{if(activeSection==='channel'){capturePanel();showChannel();}});
