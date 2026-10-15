import {solveRegenerativeCycle} from './rankine-regeneration.js';
import {adiabaticMachine} from './adiabatic-machine.js';
import {rankineCycleTables,rankineCycleNotes} from './rankine-library.js';
import {readCycleLibraryWorkspace} from './cycle-library.js';
import {customCycleSVG,readCycleChartView} from './cycle-chart.js';
export {customCycleSVG};
import {calculate} from './engine.js';
import {processGas,PROCESS_MODELS,PROCESS_GASES} from './process-gas.js';
import {solveWaterProcess,WATER_PROCESS_ENDS} from './water-process.js';

const customCycleCache=new Map();
export function readCustomCycleInput(a){
 if(!a||typeof a!=='object'||!['water',...PROCESS_GASES].includes(a.fluid)||typeof a.closed!=='boolean'||!Number.isFinite(a.mass)||a.mass<=0||!Array.isArray(a.points)||a.points.length<(a.closed?3:2)||a.points.length>12)throw Error('Цикл: 2…12 станів (замкнений: від 3), речовина й додатна маса. / Cycle: 2–12 states (closed: at least 3), fluid and positive mass.');
 const points=a.points.map(p=>{
  if(!p||typeof p.name!=='string'||p.name.length<1||p.name.length>40||!['pt','ph','ps',...(a.fluid==='water'?['px']:[])].includes(p.mode)||![p.a,p.b].every(Number.isFinite)||!(Object.hasOwn(WATER_PROCESS_ENDS,p.kind)||a.fluid==='water'&&(p.kind==='adiabatic'||a.topology==='open-heater'&&p.kind==='mixing')))throw Error('Некоректний стан або закон процесу циклу. / Invalid cycle state or process law.');
  const q={name:p.name,mode:p.mode,a:p.a,b:p.b,kind:p.kind};if(p.kind==='polytropic'){if(!Number.isFinite(p.n)||Math.abs(p.n)>20)throw Error('Політропа: −20 ≤ n ≤ 20. / Polytrope: −20 ≤ n ≤ 20.');q.n=p.n;}if(p.kind==='adiabatic'){if(!Number.isFinite(p.eta)||p.eta<=0||p.eta>1)throw Error('0 < ηₛ ≤ 1');q.eta=p.eta;}return q;
 });
 if(new Set(points.map(p=>p.name)).size!==points.length)throw Error('Назви станів мають бути унікальними. / State names must be unique.');
 if(a.topology!=null&&(a.topology!=='open-heater'||a.fluid!=='water'||!a.closed||points.length!==7||points.some((p,i)=>p.kind!==['adiabatic','mixing','adiabatic','isobaric','adiabatic','adiabatic','isobaric'][i])))throw Error('Некоректна топологія відкритого підігрівача. / Invalid open-heater topology.');
 return {fluid:a.fluid,mass:a.mass,closed:a.closed,points,...(a.topology!=null?{topology:a.topology}:{})};
}
function customCycleState(p,fluid,model){
 if(fluid!=='water')return processGas(fluid,model).get(p.mode,p.a,p.b);
 if(!['IF97','IAPWS-95'].includes(model))throw Error('Оберіть формуляцію води. / Select a water model.');
 const r=calculate(p.mode,p.a,p.b,model);if(!r.state||r.alternatives?.length)throw Error('Стан неоднозначний; на насиченні задайте p–x. / Ambiguous state; use p–x at saturation.');return r.state;
}
export function customCycleGaps(a,b){
 const abs={p:1e-8,T:.002,h:.005,s:.00002,v:1e-9};
 return Object.keys(abs).map(key=>({key,delta:b[key]-a[key],tolerance:abs[key]+5e-6*Math.max(Math.abs(a[key]),Math.abs(b[key]))}));
}
export function rememberCustomCycle(q){const key=JSON.stringify([q.model,readCustomCycleInput(q.input)]);if(customCycleCache.size>=3)customCycleCache.delete(customCycleCache.keys().next().value);customCycleCache.set(key,q);return q;}
export function solveCustomCycle(value,model='IF97'){
 if(!PROCESS_MODELS.includes(model))throw Error('Unknown cycle model.');const input=readCustomCycleInput(value),key=JSON.stringify([model,input]);if(customCycleCache.has(key))return customCycleCache.get(key);
 const steadyFlow=input.points.some(p=>p.kind==='adiabatic');
 const states=input.points.map((p,i)=>{try{return {...customCycleState(p,input.fluid,model),name:p.name};}catch(e){throw Error(`${i+1}. ${p.name}: ${e.message}`);}}),edges=[];
 if(input.topology==='open-heater')return rememberCustomCycle(solveRegenerativeCycle(input,model,states));
 const count=input.closed?states.length:states.length-1;
 let heatIn=0,heatOut=0,netWork=0,technicalWork=0,heat=0,tolerance=0,endpointEnergyError=0;
 for(let i=0;i<count;i++){
  const j=(i+1)%states.length,p=input.points[i],a=states[i],b=states[j],end={isobaric:'h',isochoric:'T',isothermal:'v',isentropic:'p',isenthalpic:'p',polytropic:'v'}[p.kind];let q;
  try{
   q=p.kind==='adiabatic'?adiabaticMachine(a,b.p,p.eta,model):solveWaterProcess({fluid:input.fluid,mass:input.mass,mode:p.mode,a:p.a,b:p.b,kind:p.kind,...(p.kind==='polytropic'?{n:p.n}:{}),end,value:b[end]},model);
   if(p.kind==='adiabatic'&&b.s<a.s-2e-7)throw Error('Ентропія адіабатного виходу не може спадати. / Adiabatic outlet entropy cannot decrease.');
   const bad=customCycleGaps(q.states[1],b).find(g=>Math.abs(g.delta)>g.tolerance);
   if(bad)throw Error(`Кінцевий стан не узгоджується із законом ${p.kind}: Δ${bad.key} = ${bad.delta}, допуск ${bad.tolerance}. / End state does not match the process law.`);
  }catch(e){throw Error(`${a.name} → ${b.name}: ${e.message}`);}
  let qi=0,qo=0;for(let k=1;!q.schematic&&k<q.path.length;k++){const x=q.path[k-1],y=q.path[k],dq=(x.T+y.T)/2*(y.s-x.s);if(dq>=0)qi+=dq;else qo-=dq;}
  edges.push({from:i,to:j,kind:p.kind,n:p.n??null,result:q,heatIn:qi,heatOut:qo});heatIn+=qi;heatOut+=qo;netWork+=steadyFlow?q.technicalWork:q.boundaryWork;technicalWork+=q.technicalWork;heat+=q.heat;tolerance+=q.tolerance;endpointEnergyError+=Math.abs(q.states[1].u-b.u)+Math.abs(q.states[1].h-b.h);
 }
 const du=states.at(-1).u-states[0].u,dh=states.at(-1).h-states[0].h,residual=heat-netWork-(input.closed?0:steadyFlow?dh:du),flowResidual=heat-technicalWork-(input.closed?0:dh),numericalTolerance=tolerance+endpointEnergyError;
 const converged=edges.every(e=>e.result.converged)&&Math.max(Math.abs(residual),Math.abs(flowResidual))<=numericalTolerance;
 const engine=input.closed&&converged&&netWork>numericalTolerance&&heatIn>numericalTolerance&&heatOut>numericalTolerance;
 const efficiency=engine&&netWork/heatIn<=1?netWork/heatIn:null;
 const q={input,model,...(steadyFlow?{basis:'steady-flow'}:{}),states,edges,heatIn,heatOut,heat,netWork,technicalWork,residual,flowResidual,tolerance:numericalTolerance,endpointEnergyError,converged,efficiency,operation:!input.closed?'open':!converged?'unverified':engine?'engine':netWork<-numericalTolerance?'work-input':'zero-work',closure:customCycleGaps(input.closed?edges.at(-1).result.states[1]:states.at(-1),states[0]),total:{heatIn:heatIn*input.mass,heatOut:heatOut*input.mass,netWork:netWork*input.mass}};
 if(!Object.values(q.total).every(Number.isFinite))throw Error('Переповнення повних енергій. / Total energy overflow.');return rememberCustomCycle(q);
}
export function customCyclePreset(name,model='IF97'){
 if(!['water-five','gas-five','carnot','kpi-five'].includes(name))throw Error('Unknown cycle example.');
 if(name==='gas-five')return {fluid:'air',mass:1,closed:true,points:[[.1,300,'isochoric'],[.2,600,'isobaric'],[.2,750,'isobaric'],[.2,900,'isochoric'],[.1,450,'isobaric']].map(([a,b,kind],i)=>({name:String(i+1),mode:'pt',a,b,kind}))};
 if(name==='carnot'){
  const {get}=processGas('air',model),a=get('pt',.1,600),b=get('tv',600,2*a.v),c=get('ts',300,b.s),d=get('ts',300,a.s);
  return {fluid:'air',mass:1,closed:true,points:[a,b,c,d].map((q,i)=>({name:String(i+1),mode:'pt',a:q.p,b:q.T,kind:i%2===0?'isothermal':'isentropic'}))};
 }
 if(name==='kpi-five'){
  const get=(mode,a,b)=>customCycleState({mode,a,b},'water',model),a=get('pt',.1,433),e=get('tv',623,a.v),d=get('ps',.4,e.s),c=get('pv',.4,a.v/3.33),b=get('ts',433,c.s);
  return {fluid:'water',mass:1,closed:true,points:[a,b,c,d,e].map((q,i)=>({name:String(i+1),mode:'ph',a:q.p,b:q.h,kind:['isothermal','isentropic','isobaric','isentropic','isochoric'][i]}))};
 }
 const a=customCycleState({mode:'pt',a:.1,b:400},'water',model),b=customCycleState({mode:'pv',a:.2,b:a.v},'water',model),c=customCycleState({mode:'pt',a:.2,b:900},'water',model),d=customCycleState({mode:'pt',a:.2,b:1000},'water',model),e=customCycleState({mode:'pv',a:.1,b:d.v},'water',model);
 return {fluid:'water',mass:1,closed:true,points:[a,b,c,d,e].map((q,i)=>({name:String(i+1),mode:'ph',a:q.p,b:q.h,kind:['isochoric','isobaric','isobaric','isochoric','isobaric'][i]}))};
}
const customCycleEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customCycleRows(q,en=false){const t=(uk,eng)=>en?eng:uk;return [[t('Підведене тепло qᵢₙ','Heat input qᵢₙ'),q.heatIn,'kJ/kg'],[t('Відведене тепло qₒᵤₜ','Heat rejection qₒᵤₜ'),q.heatOut,'kJ/kg'],[t('Сумарна робота w','Net work w'),q.netWork,'kJ/kg'],[t('Технічна робота wₜ','Technical work wₜ'),q.technicalWork,'kJ/kg'],[t('Термічний ККД η','Thermal efficiency η'),q.efficiency,'fraction'],['Qᵢₙ',q.total.heatIn,'kJ'],['Qₒᵤₜ',q.total.heatOut,'kJ'],['W',q.total.netWork,'kJ'],[q.basis==='steady-flow'?t('Нев’язка енергії потоку','Flow energy residual'):t('Нев’язка енергії','Energy residual'),q.residual,'kJ/kg'],[t('Нев’язка потоку','Flow residual'),q.flowResidual,'kJ/kg'],[t('Допуск','Tolerance'),q.tolerance,'kJ/kg']];}
export function customCycleNotes(q,en=false){const t=(uk,eng)=>en?eng:uk;if(q.basis==='steady-flow')return [...rankineCycleNotes(q,en),t('Баланс усталеного потоку: q − wₜ = Δh; у замкненому циклі qᵢₙ − qₒᵤₜ = wₜ. Для адіабатного обладнання q = 0; ∫T ds не є теплом. Внутрішня траєкторія невідома: штрихові відрізки з’єднують лише входи й виходи. Площі p–v не є роботою цього циклу.','Steady-flow balance: q − wₜ = Δh; a closed cycle has qᵢₙ − qₒᵤₜ = wₜ. Adiabatic machinery has q = 0; ∫T ds is not its heat. Internal paths are unknown: dashed segments connect only inlets and outlets. The p–v area is not this cycle work.')];return [t('Стани задані незалежно; кожен шлях обчислено за вибраним законом. Останній стан з’єднується з першим лише в замкненому режимі та після перевірки узгодженості.','States are specified independently; each path follows its selected law. The last state connects to the first only in closed mode and after a consistency check.'),t('Оборотні рівноважні процеси. q = ∫T ds; w = 1000∫p dv; wₜ = −1000∫v dp. Підведене тепло та робота від речовини додатні.','Reversible equilibrium processes. q = ∫T ds; w = 1000∫p dv; wₜ = −1000∫v dp. Heat input and work output are positive.'),t('qᵢₙ та qₒᵤₜ підсумовано за знаком тепла на кожному інтервалі траєкторії, а не за сумарним теплом процесу. Для циклу qᵢₙ − qₒᵤₜ = w.','qᵢₙ and qₒᵤₜ are summed by the heat sign on each path interval, rather than by the net heat of a process. For a cycle qᵢₙ − qₒᵤₜ = w.'),t('η = w/qᵢₙ доступний лише для чисельно перевіреного замкненого теплового двигуна. Для відкритого шляху чи циклу зі споживанням роботи ККД двигуна не визначається.','η = w/qᵢₙ is available only for a numerically verified closed heat engine. Open paths and work-consuming cycles have no heat-engine efficiency.'),`qᵢₙ − qₒᵤₜ − w = ${q.residual.toPrecision(8)} kJ/kg; ε = ${q.tolerance.toPrecision(8)} kJ/kg.`,t('Числові допуски не є фізичною невизначеністю. Для ідеального газу склад сталий, фазові переходи й реакції не враховано; сталі cp/cv беруться при 300 K, NASA7 враховує cp(T).','Numerical tolerances are not physical uncertainty. Ideal-gas composition is fixed, with no phase changes or reactions; constant cp/cv use 300 K, NASA7 uses cp(T).'),...rankineCycleNotes(q,en),...(q.edges.some(e=>e.kind==='isenthalpic')?[t('h = const тут є оборотним шляхом, а не необоротним адіабатним дроселем.','h = const here is a reversible path, not an irreversible adiabatic throttle.')]:[])];}

export function readCustomCycleDraft(a){
 if(!a||!['water',...PROCESS_GASES].includes(a.fluid)||!PROCESS_MODELS.includes(a.model)||(a.fluid==='water')!==['IF97','IAPWS-95'].includes(a.model)||typeof a.closed!=='boolean'||typeof a.mass!=='string'||a.mass.length>80||!Array.isArray(a.points)||a.points.length>12)throw Error('Некоректна чернетка циклу. / Invalid cycle draft.');
 if(a.topology!=null&&(a.topology!=='open-heater'||a.fluid!=='water'||!a.closed||a.points.length!==7||a.points.some((p,i)=>p?.kind!==['adiabatic','mixing','adiabatic','isobaric','adiabatic','adiabatic','isobaric'][i])))throw Error('Invalid network draft.');
 const points=a.points.map(p=>{if(!p||!['pt','ph','ps',...(a.fluid==='water'?['px']:[])].includes(p.mode)||!(Object.hasOwn(WATER_PROCESS_ENDS,p.kind)||a.fluid==='water'&&(p.kind==='adiabatic'||a.topology==='open-heater'&&p.kind==='mixing'))||!['name','a','b','n'].every(k=>typeof p[k]==='string'&&p[k].length<=(k==='name'?40:80)))throw Error('Некоректна точка чернетки циклу. / Invalid cycle draft point.');if((p.kind==='adiabatic'||p.eta!=null)&&(typeof p.eta!=='string'||p.eta.length>80))throw Error('Invalid efficiency draft.');return {name:p.name,mode:p.mode,a:p.a,b:p.b,kind:p.kind,n:p.n,...(p.eta!=null?{eta:p.eta}:{})};});return {fluid:a.fluid,model:a.model,closed:a.closed,mass:a.mass,points,...(a.topology!=null?{topology:a.topology}:{}),...(a.chart!=null?{chart:readCycleChartView(a.chart)}:{}),...(a.library!=null?{library:readCycleLibraryWorkspace(a.library)}:{})};
}
export function customCycleTables(q,en=false){const t=(uk,eng)=>en?eng:uk;return [...rankineCycleTables(q,en),{title:t('Процеси циклу','Cycle processes'),headers:[t('Перехід','Transition'),t('Закон','Law'),'n / ηₛ',...(q.regeneration?['β [kg/kg boiler]']:[]),'qᵢₙ [kJ/kg]','qₒᵤₜ [kJ/kg]',q.basis==='steady-flow'?'wₜ [kJ/kg]':'w [kJ/kg]',t('Точність','Accuracy')],rows:q.edges.map(e=>[q.states[e.from].name+' → '+q.states[e.to].name,e.kind,q.input.points[e.from].eta??e.n??'—',...(q.regeneration?[e.flow]:[]),e.heatIn,e.heatOut,q.basis==='steady-flow'?(e.flow??1)*e.result.technicalWork:e.result.boundaryWork,e.result.converged?'OK':t('Допуск не досягнуто','Tolerance not achieved')])},{title:q.regeneration?t('Баланс вузлів мережі','Network node balances'):q.input.closed?t('Перевірка замикання останнього процесу','Last-process closure check'):t('Незамкнений шлях: від останнього стану до першого','Open path: last state to first'),headers:[t('Величина','Property'),'Δ',t('Допуск','Tolerance')],rows:q.closure.map(g=>[g.key,g.delta,g.tolerance])}];}
export function customCycleCSV(q){const row=a=>a.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');return [['model',q.model],['topology',q.input.topology??'single-loop'],['mass_basis',q.regeneration?'kg boiler steam':'kg'],['fluid',q.input.fluid],['mass_kg',q.input.mass],['closed',q.input.closed],['name','mode','a_MPa_abs','b_by_mode','outgoing_law','n','eta_s'],...q.input.points.map(p=>[p.name,p.mode,p.a,p.b,p.kind,p.n??'',p.eta??'']),[],['edge','sample','flow_fraction','path_type','p_MPa_abs','T_K','v_m3kg','h_kJkg','u_kJkg','s_kJkgK'],...q.edges.flatMap(e=>e.result.path.map((s,i)=>[q.states[e.from].name+' -> '+q.states[e.to].name,i,e.flow??1,e.result.schematic?'schematic endpoints':'equilibrium samples',s.p,s.T,s.v,s.h,s.u,s.s])),[],...customCycleRows(q,true),...rankineCycleTables(q,true).flatMap(t=>[[],[t.title],t.headers,...t.rows])].map(row).join('\n');}
