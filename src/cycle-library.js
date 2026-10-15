import {RANKINE_LIBRARY_TYPES,readRankineLibraryConfig,buildRankineLibraryCycle,rankineCycleDetails,rankineCycleNotes} from './rankine-library.js';
import {processGas,PROCESS_GASES,PROCESS_MODELS} from './process-gas.js';
import {readCustomCycleInput,solveCustomCycle} from './custom-cycle.js';
import {CYCLE_CHARTS,customCycleSVG,cycleChartGuides} from './cycle-chart.js';

export const LIBRARY_CYCLE_TYPES=['carnot','otto','diesel','brayton','rankine','rankine-reheat'];
export function libraryCycleName(kind,en=false){return ({rankine:['Ренкіна','Rankine'],'rankine-reheat':['Ренкіна з перегрівом','Rankine with reheat'],carnot:['Карно','Carnot'],otto:['Отто','Otto'],diesel:['Дізеля','Diesel'],brayton:['Брайтона','Brayton']})[kind]?.[en?1:0]??kind;}
export function defaultCycleBuilder(){return {kind:'otto',fluid:'air',model:'IDEAL-CP',p1:'.1',T1:'300',mass:'1',ratio:'8',heatMode:'temperature',Tmax:'1500',heat:'800',Tlow:'200',pLow:'.01',pHigh:'10',pReheat:'2',Tsteam:'773.15',Treheat:'773.15',steamMode:'superheated',equipment:'ideal',etaPump:'.85',etaHP:'.85',etaLP:'.85'};}
export function readCycleBuilderDraft(value){
 const d=value==null?defaultCycleBuilder():{pLow:'.01',pHigh:'10',pReheat:'2',Tsteam:'773.15',Treheat:'773.15',steamMode:'superheated',equipment:'ideal',etaPump:'.85',etaHP:'.85',etaLP:'.85',...value};if(!d||!LIBRARY_CYCLE_TYPES.includes(d.kind)||!(RANKINE_LIBRARY_TYPES.includes(d.kind)?d.fluid==='water'&&['IF97','IAPWS-95'].includes(d.model):PROCESS_GASES.includes(d.fluid)&&['IDEAL-CP','IDEAL-NASA7'].includes(d.model))||!['ideal','actual'].includes(d.equipment)||!['superheated','saturated'].includes(d.steamMode)||!['temperature','heat'].includes(d.heatMode)||!['p1','T1','mass','ratio','Tmax','heat','Tlow','pLow','pHigh','pReheat','Tsteam','Treheat','etaPump','etaHP','etaLP'].every(k=>typeof d[k]==='string'&&d[k].length<=80))throw Error('Некоректна чернетка шаблону. / Invalid cycle builder draft.');
 return Object.fromEntries(['kind','fluid','model','p1','T1','mass','ratio','heatMode','Tmax','heat','Tlow','pLow','pHigh','pReheat','Tsteam','Treheat','steamMode','equipment','etaPump','etaHP','etaLP'].map(k=>[k,d[k]]));
}
export function readLibraryCycleConfig(a){
 if(RANKINE_LIBRARY_TYPES.includes(a?.kind))return readRankineLibraryConfig(a);
 if(!a||!LIBRARY_CYCLE_TYPES.includes(a.kind)||!PROCESS_GASES.includes(a.fluid)||!['IDEAL-CP','IDEAL-NASA7'].includes(a.model)||!['p1','T1','mass','ratio'].every(k=>Number.isFinite(a[k]))||a.p1<=0||a.mass<=0||a.ratio<=1||a.ratio>1000)throw Error('Цикл: p₁ > 0, m > 0, 1 < r ≤ 1000; скінченні входи та модель ідеального газу. / Cycle: positive pressure/mass, 1 < ratio ≤ 1000 and finite inputs.');
 const out=Object.fromEntries(['kind','fluid','model','p1','T1','mass','ratio'].map(k=>[k,a[k]]));
 if(a.kind==='carnot'){if(!Number.isFinite(a.Tlow)||a.Tlow>=a.T1)throw Error('Карно: Tхол < Tнагр. / Carnot requires cold temperature below hot temperature.');out.Tlow=a.Tlow;}
 else {if(!['temperature','heat'].includes(a.heatMode))throw Error('Оберіть Tmax або qᵢₙ. / Select Tmax or heat input.');out.heatMode=a.heatMode;const key=a.heatMode==='temperature'?'Tmax':'heat';if(!Number.isFinite(a[key])||a[key]<=0)throw Error('Tmax та qᵢₙ мають бути додатними. / Tmax and heat input must be positive.');out[key]=a[key];}
 return out;
}
function libraryGasRoot(g,fn,target){
 let lo=g.limits.min,hi=g.limits.max,a=fn(lo),b=fn(hi);if(target<a-1e-9||target>b+1e-9)throw Error('Потрібний стан поза діапазоном температур моделі. / Required state is outside the model temperature range.');
 for(let i=0;i<70;i++){const t=(lo+hi)/2;if(fn(t)<target)lo=t;else hi=t;}return (lo+hi)/2;
}
export function buildLibraryCycle(value){
 if(RANKINE_LIBRARY_TYPES.includes(value?.kind))return buildRankineLibraryCycle(value);
 const config=readLibraryCycleConfig(value),a=config,g=processGas(a.fluid,a.model),get=g.get,one=get('pt',a.p1,a.T1);let states,kinds;
 const sv=(s,v)=>get('tv',libraryGasRoot(g,T=>get('tv',T,v).s,s),v);
 if(a.kind==='carnot'){
  const two=get('tv',a.T1,one.v*a.ratio),three=get('ts',a.Tlow,two.s),four=get('ts',a.Tlow,one.s);states=[one,two,three,four];kinds=['isothermal','isentropic','isothermal','isentropic'];
 }else{
  const two=a.kind==='brayton'?get('ps',one.p*a.ratio,one.s):sv(one.s,one.v/a.ratio),volumeHeating=a.kind==='otto';
  const temperature=a.heatMode==='temperature'?a.Tmax:libraryGasRoot(g,T=>(volumeHeating?get('tv',T,two.v):get('pt',two.p,T))[volumeHeating?'u':'h'],two[volumeHeating?'u':'h']+a.heat);
  if(temperature<=two.T+1e-7)throw Error('Tmax має перевищувати температуру після стискання. / Tmax must exceed the compression outlet temperature.');
  const three=volumeHeating?get('tv',temperature,two.v):get('pt',two.p,temperature);
  if(a.kind==='diesel'&&three.v>=one.v*(1-1e-9))throw Error('Дізель: об’єм після підведення тепла має бути меншим за v₁ (1 < ρ < r). / Diesel requires cutoff ratio below compression ratio.');
  const four=a.kind==='brayton'?get('ps',one.p,three.s):sv(three.s,one.v);states=[one,two,three,four];kinds=['isentropic',volumeHeating?'isochoric':'isobaric','isentropic',a.kind==='brayton'?'isobaric':'isochoric'];
 }
 const input={fluid:a.fluid,mass:a.mass,closed:true,points:states.map((s,i)=>({name:String(i+1),mode:'pt',a:s.p,b:s.T,kind:kinds[i]}))},result=solveCustomCycle(input,a.model);
 if(!result.converged||result.efficiency===null)throw Error('Цикл не є перевіреним тепловим двигуном. / Cycle is not a verified heat engine.');
 return {config,input:result.input,model:a.model,result:{...result,guides:cycleChartGuides(result)}};
}
export function readCycleTemplate(value){
 if(!value||typeof value.name!=='string'||!value.name.trim()||value.name.length>60||!PROCESS_MODELS.includes(value.model))throw Error('Шаблон: назва 1…60 символів та відома модель. / Template requires a name (1–60 characters) and known model.');
 const input=readCustomCycleInput(value.input);if(!input.closed||(input.fluid==='water')!==['IF97','IAPWS-95'].includes(value.model))throw Error('Шаблон потребує замкненого циклу й сумісної моделі. / Template requires a closed cycle and matching model.');
 return {name:value.name.trim(),model:value.model,input};
}
export function readCycleLibraryWorkspace(value){
 const v=value??{};if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid cycle library.');
 if(v.templates!=null&&(!Array.isArray(v.templates)||v.templates.length>8))throw Error('Бібліотека: максимум 8 власних шаблонів. / Maximum 8 personal templates.');
 const templates=(v.templates??[]).map(readCycleTemplate);if(new Set(templates.map(t=>t.name)).size!==templates.length)throw Error('Назви шаблонів мають бути унікальними. / Template names must be unique.');
 const slots=v.slots??[null,null];if(!Array.isArray(slots)||slots.length!==2)throw Error('Порівняння потребує двох варіантів. / Comparison needs two variants.');
 if(v.label!=null&&(typeof v.label!=='string'||v.label.length>60))throw Error('Invalid cycle label.');
 const kind=v.kind??'ts';if(!Object.hasOwn(CYCLE_CHARTS,kind)||v.compared!=null&&typeof v.compared!=='boolean')throw Error('Invalid comparison view.');
 return {label:v.label??'',builder:readCycleBuilderDraft(v.builder),templates,slots:slots.map(s=>s==null?null:readCycleTemplate(s)),kind,compared:v.compared===true};
}
export function readCycleComparisonInput(a){
 if(!a||!Array.isArray(a.slots)||a.slots.length!==2||a.slots.some(s=>!s))throw Error('Збережіть обидва варіанти A і B. / Capture both variants A and B.');
 const slots=a.slots.map(readCycleTemplate),kind=a.kind??'ts';if(!Object.hasOwn(CYCLE_CHARTS,kind)||slots[0].input.fluid!==slots[1].input.fluid)throw Error('Порівнюйте цикли однієї речовини. / Compare cycles of the same fluid.');return {slots,kind};
}
export function compareLibraryCycles(value){
 const input=readCycleComparisonInput(value),results=input.slots.map(t=>solveCustomCycle(t.input,t.model));if(results.some(q=>!q.converged))throw Error('Порівняння потребує підтвердженої числової точності. / Comparison requires verified numerical accuracy.');
 return {input,results};
}
export function cycleComparisonTable(q,en=false){
 const t=(uk,eng)=>en?eng:uk,[a,b]=q.results,ra=rankineCycleDetails(a),rb=rankineCycleDetails(b),delta=(x,y)=>x===null||y===null?null:y-x,rankineRows=ra&&rb?[[t('Робота насоса (споживання)','Pump work input'),ra.pump,rb.pump,rb.pump-ra.pump,'kJ/kg'],[t('Робота турбін','Turbine work'),ra.hp+ra.lp,rb.hp+rb.lp,rb.hp+rb.lp-ra.hp-ra.lp,'kJ/kg'],[t('Проміжний перегрів','Reheat input'),ra.reheater,rb.reheater,rb.reheater-ra.reheater,'kJ/kg'],[t('Сухість останнього виходу','Final turbine exit quality'),ra.outlets.at(-1).x,rb.outlets.at(-1).x,delta(ra.outlets.at(-1).x,rb.outlets.at(-1).x),'0…1'],[t('Вологість останнього виходу','Final turbine exit moisture'),ra.outlets.at(-1).x===null?null:1-ra.outlets.at(-1).x,rb.outlets.at(-1).x===null?null:1-rb.outlets.at(-1).x,delta(rb.outlets.at(-1).x,ra.outlets.at(-1).x),'0…1']]:[];
 return {title:t('Порівняння циклів','Cycle comparison'),headers:[t('Величина','Quantity'),'A','B','Δ B − A',t('Одиниця','Unit')],rows:[['qᵢₙ',a.heatIn,b.heatIn,b.heatIn-a.heatIn,'kJ/kg'],['qₒᵤₜ',a.heatOut,b.heatOut,b.heatOut-a.heatOut,'kJ/kg'],['w',a.netWork,b.netWork,b.netWork-a.netWork,'kJ/kg'],['η',a.efficiency===null?null:a.efficiency*100,b.efficiency===null?null:b.efficiency*100,a.efficiency===null||b.efficiency===null?null:100*(b.efficiency-a.efficiency),'%; Δ: '+t('відс. пункти','percentage points')],['m',a.input.mass,b.input.mass,b.input.mass-a.input.mass,'kg'],...rankineRows]};
}
export function cycleComparisonSVG(q,kind=q.input.kind,en=false){
 const [a,b]=q.results,combined={model:`A: ${a.model}; B: ${b.model}`,input:a.input,states:q.results.flatMap((r,i)=>r.states.map(s=>({...s,name:(i?'B:':'A:')+s.name}))),edges:[...a.edges,...b.edges]};
 return customCycleSVG(combined,kind,en,-1,{seriesBreak:a.edges.length,stateBreak:a.states.length});
}

export function cycleComparisonNotes(q,en=false){const t=(uk,eng)=>en?eng:uk;return [t('A та B — зафіксовані канонічні входи; результати обчислюються повторно. Питомі енергії — kJ/kg. Δ = B − A; різниця ККД — у відсоткових пунктах.','A and B are frozen canonical inputs; results are recomputed. Specific energies use kJ/kg. Delta = B minus A; efficiency delta uses percentage points.'),t('Оборотні шляхи інтегруються; адіабатне обладнання використовує баланс ентальпії й схематичні відрізки. Підведене тепло та робота від речовини додатні. Для режиму зі споживанням роботи ККД теплового двигуна не визначається.','Reversible paths use integration; adiabatic machinery uses enthalpy balances and schematic segments. Heat input and work output are positive. Work-consuming cycles have no heat-engine efficiency.'),q.results[0].input.fluid==='water'?t('Для водяних циклів моделі й маси наведено окремо. Сухість не визначається для перегрітої пари; порожні x і різниці x не заміняються одиницею.','Water models and masses are shown separately. Superheated steam has no defined quality; missing x and quality differences are not replaced by one.'):t('Моделі й маси наведено окремо для A та B. Сталі cp/cv взято при 300 K; NASA7 враховує cp(T) без реакцій і конденсації. Допоміжні лінії до порівняння не додаються; кожна проєкція використовує ті самі обчислені траєкторії.','Models and masses are shown separately for A and B. Constant cp/cv use 300 K; NASA7 includes cp(T) without reactions or condensation. Overlays omit auxiliary lines; all projections use the same calculated paths.'),...q.results.flatMap(r=>rankineCycleNotes(r,en)),...q.results.map((r,i)=>`${i?'B':'A'}: qᵢₙ − qₒᵤₜ − w = ${r.residual.toPrecision(8)} kJ/kg; ε = ${r.tolerance.toPrecision(8)} kJ/kg.`),t('Числові допуски не є фізичною невизначеністю.','Numerical tolerances are not physical uncertainty.')];}
