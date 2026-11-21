import {PIPE_SCHEDULES,RECOMMENDED_VELOCITY,KV_TO_CV,pipeFluid,sizePipe,pipePressureDrop,condensateReturn,valve,orificeFlow,orificeDischarge} from './steam-system.js';
import {parseNumber} from './units.js';
import {condensateLoad,separatorDryness,airInSteam,steamCost,boilerEfficiency,condensateRecovery} from './steam-plant.js';
// Steam-system calculator panel: one selector of engineering calculations in the
// style of steam-system calculators, each with its inputs, formula and results.
// Base units: pressure MPa (abs), temperature °C, mass flow kg/h, diameters mm,
// pressure differences kPa, heat kW, time min. Fields with a physical quantity get
// the shared local unit selector; the panel always reads canonical base values.
// Inputs, units and the calculated flag are saved in the project workspace.
const STEAM_SYS_K=273.15;
const steamSysFluidOptions=[['steam-sat','steam.fluid.steamSat'],['steam-sh','steam.fluid.steamSh'],['water','steam.fluid.water'],['air','steam.fluid.air']];
const steamSysScheduleOptions=Object.entries(PIPE_SCHEDULES).map(([k,v])=>[k,v.label]);
// Field: [id, unit, default, options?]. Options turn the field into a select.
export const STEAM_SYS_FIELDS={
 fluid:['fluid','',null,steamSysFluidOptions],p:['p','МПа',1],t:['t','°C',250],flow:['flow','кг/год',3600],
 velocity:['velocity','м/с',25],schedule:['schedule','',null,steamSysScheduleOptions],d:['d','мм',100],length:['length','м',100],
 roughness:['roughness','мм',.045],localK:['localK','',2],p1:['p1','МПа',1],p2:['p2','МПа',.101325],subcooling:['subcooling','K',0],
 valveMode:['valveMode','',null,[['kv','steam.valveMode.kv'],['flow','steam.valveMode.flow'],['dp','steam.valveMode.dp']]],
 kv:['kv','м³/год',20],dp:['dp','кПа',200],xT:['xT','',.72],FL:['FL','',.9],
 orifice:['orifice','мм',50],pipeD:['pipeD','мм',100],C:['C','',.61],dpOrifice:['dpOrifice','кПа',20],hole:['hole','мм',5],
 loadKind:['loadKind','',null,[['warmup','steam.load.warmup'],['pipe-loss','steam.load.pipeLoss'],['tank','steam.load.tank'],['exchanger','steam.load.exchanger'],['air-heater','steam.load.airHeater'],['duty','steam.load.duty']]],
 massPerMetre:['massPerMetre','кг/м',16.1],t0:['t0','°C',10],time:['time','хв',30],outerD:['outerD','мм',114.3],tamb:['tamb','°C',20],
 insulation:['insulation','мм',50],insulationK:['insulationK','Вт/(м·K)',.04],surfaceH:['surfaceH','Вт/(м²·K)',10],
 mass:['mass','кг',1000],cp:['cp','кДж/(кг·K)',4.19],t1:['t1','°C',10],t2:['t2','°C',60],liquidFlow:['liquidFlow','кг/год',2000],
 airFlow:['airFlow','м³/год',5000],heat:['heat','кВт',100],safety:['safety','',1.2],
 x:['x','',.95],efficiency:['efficiency','%',90],airFraction:['airFraction','%',5],
 feedT:['feedT','°C',80],boilerEta:['boilerEta','%',85],fuelPrice:['fuelPrice','/од.',.4],lhv:['lhv','МДж/од.',35],waterCost:['waterCost','/т',2],
 fuelFlow:['fuelFlow','од./год',300],blowdown:['blowdown','%',3],condT:['condT','°C',90],makeupT:['makeupT','°C',15],hours:['hours','год/рік',8000],investment:['investment','',10000]
};
function steamSysFluid(v){
 const kind=v.fluid,p=v.p;
 if(kind==='steam-sat')return pipeFluid({kind:'steam',p});
 if(kind==='steam-sh')return pipeFluid({kind:'steam',p,T:v.t+STEAM_SYS_K});
 if(kind==='water')return pipeFluid({kind:'water',p,T:v.t+STEAM_SYS_K});
 return pipeFluid({kind:'air',p,T:v.t+STEAM_SYS_K});
}
const steamSysFluidRows=f=>[['steam.r.density',f.rho,'кг/м³'],['steam.r.temperature',f.T-STEAM_SYS_K,'°C'],...(f.x!=null?[['steam.r.quality',f.x,'']]:[]),['steam.r.viscosity',f.mu*1e6,'мкПа·с']];
const steamSysVelocityKey=f=>f.kind==='air'?'air':f.kind==='water'?'water':f.x!=null?'saturated-steam':'superheated-steam';
// Each calculation: group, fields, formula key, run(values) -> {rows, notes}.
export const STEAM_SYS_CALCS={
 'pipe-size':{group:'pipes',fields:['fluid','p','t','flow','velocity','schedule'],run:v=>{
  const f=steamSysFluid(v),r=sizePipe({fluid:f,massFlow:v.flow/3600,velocity:v.velocity,schedule:v.schedule}),rec=RECOMMENDED_VELOCITY[steamSysVelocityKey(f)];
  return {rows:[...steamSysFluidRows(f),['steam.r.requiredId',r.requiredId*1000,'мм'],['steam.r.pipe',r.pipe?.name??'—',''],['steam.r.pipeId',r.pipe?.id??null,'мм'],['steam.r.velocity',r.velocity,'м/с'],['steam.r.recommended',rec.min+'…'+rec.max,'м/с']],notes:r.notes};}},
 'pipe-drop':{group:'pipes',fields:['fluid','p','t','flow','d','length','roughness','localK'],run:v=>{
  const f=steamSysFluid(v),r=pipePressureDrop({fluid:f,massFlow:v.flow/3600,diameter:v.d/1000,length:v.length,roughness:v.roughness/1000,localK:v.localK});
  return {rows:[...steamSysFluidRows(f),['steam.r.velocity',r.velocity,'м/с'],['steam.r.outletVelocity',r.outletVelocity,'м/с'],['steam.r.Re',r.Re,''],['steam.r.friction',r.frictionPressure/1000,'кПа'],['steam.r.local',r.localPressure/1000,'кПа'],['steam.r.loss',r.lossPressure/1000,'кПа'],['steam.r.gradient',r.pressureGradient==null?null:r.pressureGradient*0.1,'кПа/100 м'],['steam.r.outletPressure',r.outletPressure,'МПа'],['steam.r.outletTemperature',r.outletTemperature-STEAM_SYS_K,'°C'],...(r.outletQuality!=null?[['steam.r.outletQuality',r.outletQuality,'']]:[])],notes:r.notes};}},
 'condensate-line':{group:'pipes',fields:['p1','p2','flow','subcooling','velocity','schedule'],run:v=>{
  const r=condensateReturn({p1:v.p1,p2:v.p2,massFlow:v.flow/3600,subcooling:v.subcooling}),s=sizePipe({fluid:r.fluid,massFlow:v.flow/3600,velocity:v.velocity,schedule:v.schedule});
  return {rows:[['steam.r.flashFraction',r.flashFraction*100,'%'],['steam.r.flashSteam',r.flashSteam*3600,'кг/год'],['steam.r.T2',r.T2-STEAM_SYS_K,'°C'],['steam.r.mixtureDensity',r.mixtureDensity,'кг/м³'],['steam.r.volumeFlow',r.volumeFlow*3600,'м³/год'],['steam.r.requiredId',s.requiredId*1000,'мм'],['steam.r.pipe',s.pipe?.name??'—',''],['steam.r.velocity',s.velocity,'м/с']],notes:[...r.notes,...s.notes]};}},
 'valve':{group:'valves',fields:['fluid','p','t','valveMode','kv','dp','flow','xT','FL'],run:v=>{
  const f=steamSysFluid(v),mode=v.valveMode,r=valve({fluid:f,mode,dp:mode==='dp'?null:v.dp/1000,kv:mode==='kv'?null:v.kv,massFlow:mode==='flow'?null:v.flow/3600,xT:v.xT,FL:v.FL});
  return {rows:[...steamSysFluidRows(f),['steam.r.kv',r.kv,'м³/год'],['steam.r.cv',r.cv,'US gal/min'],['steam.r.massFlow',r.massFlow*3600,'кг/год'],['steam.r.dp',r.dp*1000,'кПа'],...(r.Y!=null?[['steam.r.Y',r.Y,''],['steam.r.xRatio',r.x,''],['steam.r.xChoked',r.xChoked,'']]:[]),...(r.dpChoked!=null?[['steam.r.dpChoked',r.dpChoked*1000,'кПа']]:[]),['steam.r.choked',r.choked?'steam.yes':'steam.no','']],notes:r.notes};}},
 'orifice':{group:'valves',fields:['fluid','p','t','orifice','pipeD','dpOrifice','C'],run:v=>{
  const f=steamSysFluid(v),r=orificeFlow({fluid:f,d:v.orifice/1000,D:v.pipeD/1000,dp:v.dpOrifice*1000,C:v.C});
  return {rows:[...steamSysFluidRows(f),['steam.r.beta',r.beta,''],['steam.r.epsilon',r.epsilon,''],['steam.r.massFlow',r.massFlow*3600,'кг/год'],['steam.r.volumeFlow',r.volumeFlow*3600,'м³/год']],notes:r.notes};}},
 'discharge':{group:'valves',fields:['fluid','p','t','hole','p2','C'],run:v=>{
  if(v.fluid==='water')throw Error(uiTranslator.t('steam.error.dischargeWater'));
  const f=steamSysFluid(v),r=orificeDischarge({fluid:f,d:v.hole/1000,p2:v.p2,C:v.C});
  return {rows:[...steamSysFluidRows(f),['steam.r.criticalRatio',r.criticalRatio,''],['steam.r.pressureRatio',r.pressureRatio,''],['steam.r.choked',r.choked?'steam.yes':'steam.no',''],['steam.r.massFlow',r.massFlow*3600,'кг/год'],['steam.r.annual',r.massFlow*3600*8760/1000,'т/рік']],notes:r.notes};}},
 'condensate-load':{group:'condensate',fields:['p','loadKind','massPerMetre','length','t0','time','outerD','tamb','insulation','insulationK','surfaceH','mass','cp','t1','t2','liquidFlow','airFlow','heat','safety'],
  visible:v=>({warmup:['massPerMetre','length','t0','time'],'pipe-loss':['outerD','length','tamb','insulation','insulationK','surfaceH'],tank:['mass','cp','t1','t2','time'],exchanger:['liquidFlow','cp','t1','t2'],'air-heater':['airFlow','t1','t2'],duty:['heat']}[v.loadKind]),
  run:v=>{
  const K=STEAM_SYS_K,kind=v.loadKind,base={steam:{p:v.p},safetyFactor:v.safety};
  const input={warmup:{massPerMetre:v.massPerMetre,length:v.length,T0:v.t0+K,time:v.time*60},'pipe-loss':{outerDiameter:v.outerD/1000,length:v.length,Tamb:v.tamb+K,insulationThickness:v.insulation/1000,insulationConductivity:v.insulationK,surfaceCoefficient:v.surfaceH},
   tank:{mass:v.mass,cp:v.cp,T1:v.t1+K,T2:v.t2+K,time:v.time*60},exchanger:{flow:v.liquidFlow/3600,cp:v.cp,T1:v.t1+K,T2:v.t2+K},'air-heater':{volumeFlow:v.airFlow/3600,T1:v.t1+K,T2:v.t2+K},duty:{heat:v.heat}}[kind];
  const r=condensateLoad(kind,{...base,...input});
  return {rows:[['steam.r.Tsat',r.Tsat-K,'°C'],['steam.r.latent',r.q,'кДж/кг'],['steam.r.heat',r.heat,'кВт'],...(r.perMetre!=null?[['steam.r.perMetre',r.perMetre*1000,'Вт/м'],['steam.r.surfaceTemperature',r.surfaceTemperature-K,'°C']]:[]),['steam.r.condensate',r.condensate*3600,'кг/год'],['steam.r.design',r.design*3600,'кг/год']],notes:[]};}},
 'separator':{group:'condensate',fields:['p','x','efficiency','flow'],run:v=>{
  const r=separatorDryness({p:v.p,x:v.x,efficiency:v.efficiency/100,massFlow:v.flow/3600});
  return {rows:[['steam.r.x1',r.x1,''],['steam.r.x2',r.x2,''],['steam.r.removed',r.removed*3600,'кг/год'],['steam.r.outFlow',r.outFlow*3600,'кг/год'],['steam.r.heatGain',r.heatGainPerKg,'кДж/кг']],notes:[]};}},
 'air-in-steam':{group:'condensate',fields:['p','airFraction'],run:v=>{
  const r=airInSteam({p:v.p,airFraction:v.airFraction/100});
  return {rows:[['steam.r.partialPressure',r.steamPartialPressure,'МПа'],['steam.r.Tpure',r.Tpure-STEAM_SYS_K,'°C'],['steam.r.Tmix',r.Tmix-STEAM_SYS_K,'°C'],['steam.r.temperatureDrop',r.temperatureDrop,'K'],['steam.r.massFractionAir',r.massFractionAir*100,'%']],notes:[]};}},
 'steam-cost':{group:'costs',fields:['fluid','p','t','feedT','boilerEta','fuelPrice','lhv','waterCost'],steamOnly:true,run:v=>{
  const r=steamCost({p:v.p,T:v.fluid==='steam-sh'?v.t+STEAM_SYS_K:null,feedT:v.feedT+STEAM_SYS_K,efficiency:v.boilerEta/100,fuelPrice:v.fuelPrice,lhv:v.lhv*1000,waterCost:v.waterCost});
  return {rows:[['steam.r.dh',r.dh,'кДж/кг'],['steam.r.fuelPerTonne',r.fuelPerTonne,'од./т'],['steam.r.fuelCost',r.fuelCostPerTonne,'/т'],['steam.r.costPerTonne',r.costPerTonne,'/т'],['steam.r.energyCost',r.energyCostPerGJ,'/ГДж']],notes:[]};}},
 'boiler':{group:'costs',fields:['fluid','p','t','feedT','flow','fuelFlow','lhv','blowdown'],steamOnly:true,run:v=>{
  const r=boilerEfficiency({p:v.p,T:v.fluid==='steam-sh'?v.t+STEAM_SYS_K:null,feedT:v.feedT+STEAM_SYS_K,steamFlow:v.flow/3600,fuelFlow:v.fuelFlow/3600,lhv:v.lhv*1000,blowdown:v.blowdown/100});
  return {rows:[['steam.r.efficiency',r.efficiency*100,'%'],['steam.r.useful',r.useful,'кВт'],['steam.r.input',r.input,'кВт'],['steam.r.feedFlow',r.feedFlow*3600,'кг/год'],['steam.r.blowdownFlow',r.blowdownFlow*3600,'кг/год']],notes:[]};}},
 'recovery':{group:'costs',fields:['p','flow','condT','makeupT','boilerEta','fuelPrice','lhv','waterCost','hours','investment'],run:v=>{
  const r=condensateRecovery({p:v.p,condensateFlow:v.flow/3600,condensateT:v.condT+STEAM_SYS_K,makeupT:v.makeupT+STEAM_SYS_K,efficiency:v.boilerEta/100,fuelPrice:v.fuelPrice,lhv:v.lhv*1000,waterCost:v.waterCost,hours:v.hours,investment:v.investment});
  return {rows:[['steam.r.tonnes',r.tonnesPerYear,'т/рік'],['steam.r.heatYear',r.heatPerYear/1e6,'ГДж/рік'],['steam.r.fuelYear',r.fuelPerYear,'од./рік'],['steam.r.fuelSaving',r.fuelSaving,'/рік'],['steam.r.waterSaving',r.waterSaving,'/рік'],['steam.r.annualSaving',r.annualSaving,'/рік'],['steam.r.payback',r.paybackYears,'steam.unit.years']],notes:[]};}}
};
export const STEAM_SYS_GROUPS=['pipes','valves','condensate','costs'];
let steamSysResult=null;
function steamSysFieldHTML(key){
 const [id,unit,def,opts]=STEAM_SYS_FIELDS[key],label=escapeHTML(uiTranslator.t('steam.f.'+id))+(unit?', '+escapeHTML(unit.startsWith('steam.')?uiTranslator.t(unit):unit):'');
 if(opts)return `<label data-steam-field="${key}">${label}<select id="steam-${id}">${opts.map(([v,l])=>`<option value="${v}">${escapeHTML(l.startsWith('steam.')?uiTranslator.t(l):l)}</option>`).join('')}</select></label>`;
 return `<label data-steam-field="${key}">${label}<input id="steam-${id}" value="${def}" inputmode="decimal"></label>`;
}
// Pure: values from raw strings for the visible fields of a calculation.
export function steamSysValues(calc,raw){
 const spec=STEAM_SYS_CALCS[calc],out={};
 for(const key of spec.fields){const [,,,opts]=STEAM_SYS_FIELDS[key];out[key]=opts?raw[key]:parseNumber(String(raw[key]??''));}
 return out;
}
export function steamSysVisible(calc,values){
 const spec=STEAM_SYS_CALCS[calc],extra=spec.visible?.(values);
 return spec.fields.filter(k=>{
  if(extra&&!['p','loadKind','safety'].includes(k)&&!extra.includes(k))return false;
  if(k==='t'&&values.fluid==='steam-sat')return false;
  if(calc==='valve'){if(k==='kv'&&values.valveMode==='kv')return false;if(k==='dp'&&values.valveMode==='dp')return false;if(k==='flow'&&values.valveMode==='flow')return false;if(k==='xT'&&values.fluid==='water')return false;if(k==='FL'&&values.fluid!=='water')return false;}
  return true;
 });
}
export function steamSysRun(calc,values){return STEAM_SYS_CALCS[calc].run(values);}
function steamSysFormat(value){if(value==null)return '—';if(typeof value==='string')return value.startsWith('steam.')?uiTranslator.t(value):value;return format(value);}
function showSteamSystem(){
 selectView('panel');activeSection='steam-system';steamSysResult=null;$('calculator-view').hidden=true;$('process-view').hidden=false;document.querySelector('[role=tab][data-action=steam-system]').setAttribute('aria-selected','true');
 const t=k=>escapeHTML(uiTranslator.t(k));
 const calcOptions=STEAM_SYS_GROUPS.map(g=>`<optgroup label="${t('steam.group.'+g)}">${Object.entries(STEAM_SYS_CALCS).filter(([,c])=>c.group===g).map(([id])=>`<option value="${id}">${t('steam.calc.'+id)}</option>`).join('')}</optgroup>`).join('');
 $('process-view').innerHTML=`<section class="method"><h2 data-i18n="steam.title">${t('steam.title')}</h2><p data-i18n="steam.intro">${t('steam.intro')}</p><form id="steam-form" novalidate><div class="process-grid"><label>${t('steam.f.calc')}<select id="steam-calc">${calcOptions}</select></label>${Object.keys(STEAM_SYS_FIELDS).map(steamSysFieldHTML).join('')}</div><details class="steam-formula" open><summary>${t('steam.formula')}</summary><p id="steam-formula-text"></p></details><button type="submit" id="steam-calculate">${t('steam.calculate')}</button> <button type="button" id="steam-copy" disabled>${t('steam.copy')}</button><p id="steam-error" role="alert" hidden></p></form><div id="steam-results" aria-live="polite"></div></section>`;
 const form=$('steam-form');
 // uiStoredValue returns the value in the field's base unit whatever unit is selected.
 const raw=()=>Object.fromEntries(Object.entries(STEAM_SYS_FIELDS).map(([k,[id]])=>[k,uiStoredValue($('steam-'+id))]));
 function layout(){
  const calc=$('steam-calc').value,spec=STEAM_SYS_CALCS[calc],r=raw();
  const fluidSelect=$('steam-fluid');for(const o of fluidSelect.options)o.disabled=!!spec.steamOnly&&!o.value.startsWith('steam');if(fluidSelect.selectedOptions[0]?.disabled)fluidSelect.value='steam-sat';
  const visible=steamSysVisible(calc,{...r,fluid:fluidSelect.value});
  for(const label of form.querySelectorAll('[data-steam-field]')){const show=visible.includes(label.dataset.steamField);label.hidden=!show;label.querySelector('input,select').disabled=!show;}
  $('steam-formula-text').textContent=uiTranslator.t('steam.formula.'+(calc==='condensate-load'?'load.'+r.loadKind:calc));
 }
 function invalidate(){steamSysResult=null;$('steam-results').replaceChildren();$('steam-copy').disabled=true;$('steam-error').hidden=true;}
 function edited(){invalidate();if(!restoringWorkspace){panelEdited(form);capturePanel();saveProject();}}
 // A unit change converts the shown number only: keep the result, save the unit.
 form.addEventListener('change',e=>{layout();if(e.target.id.startsWith('ui-unit-')){if(!restoringWorkspace){capturePanel();saveProject();}}else edited();});
 form.addEventListener('input',e=>{if(e.target.tagName!=='SELECT'&&e.isTrusted)edited();});
 form.onsubmit=e=>{e.preventDefault();invalidate();const calc=$('steam-calc').value;
  try{const values=steamSysValues(calc,raw()),visible=steamSysVisible(calc,values);for(const k of visible){const [, , ,opts]=STEAM_SYS_FIELDS[k];if(!opts&&!Number.isFinite(values[k]))throw Error(uiTranslator.t('steam.error.number',{field:uiTranslator.t('steam.f.'+STEAM_SYS_FIELDS[k][0])}));}
   const r=steamSysRun(calc,values);steamSysResult={calc,values,...r};
   const rows=r.rows.map(([k,v,u])=>`<tr><td>${t(k)}</td><td>${escapeHTML(steamSysFormat(v))}</td><td>${escapeHTML(u.startsWith('steam.')?uiTranslator.t(u):u)}</td></tr>`).join('');
   $('steam-results').innerHTML=`<table class="sat-table"><thead><tr><th>${t('steam.r.name')}</th><th>${t('steam.r.value')}</th><th>${t('steam.r.unit')}</th></tr></thead><tbody>${rows}</tbody></table>${notes(r.notes.map(escapeHTML))}`;
   $('steam-copy').disabled=false;panelCalculated(form);
  }catch(err){$('steam-error').textContent=err.message;$('steam-error').hidden=false;}
 };
 $('steam-copy').onclick=()=>{if(!steamSysResult)return;const text=steamSysResult.rows.map(([k,v,u])=>[uiTranslator.t(k),steamSysFormat(v),u.startsWith('steam.')?uiTranslator.t(u):u].join('\t')).join('\n');navigator.clipboard?.writeText(text).catch(()=>{});};
 restorePanelInputs('steam-system',form);layout();restorePanelResult('steam-system',form);
}
globalThis.document?.addEventListener('languagechange',()=>{if(activeSection==='steam-system'){capturePanel();showSteamSystem();}});
