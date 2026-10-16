import {readRankineLibraryConfig,buildRankineLibraryCycle} from './rankine-library.js';

export const RANKINE_SWEEP_LIMIT=41;
export function readRankineSweepWorkspace(value){
 const v=value??{},min=v.min??'.1',max=v.max??'3',count=v.count??'11',metric=v.metric??'efficiency';
 if(!v||typeof v!=='object'||Array.isArray(v)||![min,max,count].every(s=>typeof s==='string'&&s.length<=80)||!['efficiency','work','y','moisture'].includes(metric))throw Error('Некоректна чернетка дослідження. / Invalid study draft.');
 return {min,max,count,metric,input:v.input==null?null:readRankineSweepInput(v.input)};
}
export function readRankineSweepInput(value){
 const seed=value?.config;
 const config=readRankineLibraryConfig({...seed,pBleed:(seed?.pLow+seed?.pHigh)/2});
 delete config.pBleed; // The sampled pressure is not a fixed study parameter.
 if(config.kind!=='rankine-regenerative')throw Error('Потрібен Ренкін з відкритим підігрівачем. / Open-heater Rankine required.');
 const {min,max,count}=value,selected=value.selected??0;
 if(!Number.isFinite(min)||!Number.isFinite(max)||!(min>0&&max>min)||!Number.isInteger(count)||count<2||count>RANKINE_SWEEP_LIMIT||!Number.isInteger(selected)||selected<0||selected>=count)throw Error('Діапазон: 0 < min < max, 2…41 точка; вибрана точка в межах сітки. / Range: 0 < min < max, 2–41 points; selected index must be in range.');
 const pressures=Array.from({length:count},(_,i)=>i===count-1?max:min+(max-min)*i/(count-1));
 if(pressures.some((p,i)=>!Number.isFinite(p)||i>0&&p<=pressures[i-1]))throw Error('Точки діапазону мають бути різними скінченними числами. / Grid pressures must be distinct finite numbers.');
 return {config,min,max,count,selected};
}
export function solveRankineSweep(value){
 const input=readRankineSweepInput(value),points=[];let bestIndex=null;
 for(let i=0;i<input.count;i++){
  const p=i===input.count-1?input.max:input.min+(input.max-input.min)*i/(input.count-1);
  try{
   const q=buildRankineLibraryCycle({...input.config,pBleed:p}).result,d=q.regeneration,x=q.states[6].x;
   if(!q.converged||!d||![d.efficiency,d.net,d.y].every(Number.isFinite))throw Error('Точність циклу не підтверджено. / Cycle accuracy unverified.');
   points.push({index:i,p,valid:true,efficiency:d.efficiency,work:d.net,y:d.y,quality:x,moisture:x===null?null:1-x,error:''});
   if(bestIndex===null||d.efficiency>points[bestIndex].efficiency)bestIndex=i;
  }catch(error){points.push({index:i,p,valid:false,efficiency:null,work:null,y:null,quality:null,moisture:null,error:error.message});}
 }
 return {input,points,bestIndex};
}
export function rankineSweepPointConfig(q,index){
 if(!Number.isInteger(index)||!q.points[index]?.valid)throw Error('Оберіть допустиму точку. / Select a valid point.');
 return readRankineLibraryConfig({...q.input.config,pBleed:q.points[index].p});
}
export function rankineSweepNotes(en=false){return en?[
 'Uniform extraction-pressure grid including both endpoints. Only extraction pressure varies; condenser and boiler pressures, inlet steam condition, both pump and both turbine efficiencies, water model and boiler reference steam mass remain fixed.',
 'Efficiency and specific work use the enthalpy balance per kg boiler steam; each valid point also passes the full cycle integration and mass/energy/entropy checks. Mass is kg boiler steam, not kg/s; specific work is not power.',
 'The highlighted maximum is only among valid sampled points, not a continuous or global optimum. Invalid points are excluded from the maximum and shown as gaps; curves merely connect adjacent samples.',
 'Quality and moisture are undefined outside saturation and remain blank. No turbine moisture limit or equipment suitability is inferred. One idealized open heater, no pressure losses or reheat.'
 ]:[
 'Рівномірна сітка тиску відбору включно з обома межами. Змінюється лише тиск відбору; тиски котла й конденсатора, стан пари на вході, ККД обох насосів і обох ступенів турбіни, водяна модель та базисна маса пари котла сталі.',
 'ККД і питома робота — за ентальпійним балансом на kg пари котла; кожна допустима точка також проходить повне інтегрування циклу та перевірки маси, енергії й ентропії. Маса — kg пари котла, не kg/s; питома робота не є потужністю.',
 'Позначений максимум — лише серед допустимих розрахованих точок, не неперервний чи глобальний оптимум. Недопустимі точки виключені з максимуму та показані розривами; лінії лише з’єднують сусідні розраховані точки.',
 'Сухість і вологість поза насиченням не визначені та залишаються порожніми. Граничну вологість чи придатність турбіни не встановлюємо. Один ідеалізований відкритий підігрівач, без втрат тиску й перегріву.'
 ];}
export function rankineSweepTable(q,en=false){
 const t=(uk,eng)=>en?eng:uk;
 return {title:t('Вплив тиску відбору','Extraction pressure study'),headers:['№','p [MPa abs]','ηₕ [%]','wₕ [kJ/kg boiler]','y [kg/kg boiler]','x [0…1]','1−x [0…1]',t('Статус','Status')],rows:q.points.map(r=>[r.index+1,r.p,r.efficiency===null?null:100*r.efficiency,r.work,r.y,r.quality,r.moisture,r.valid?t('Допустимо','Valid'):r.error])};
}
export function rankineSweepInputRows(a){return [...Object.entries(a.config).map(([k,v])=>[k,String(v),['pLow','pBleed','pHigh'].includes(k)?'MPa abs':k==='Tsteam'?'K':k==='mass'?'kg boiler':k.startsWith('eta')?'fraction':'–']),['min',a.min,'MPa abs'],['max',a.max,'MPa abs'],['count',a.count,'points'],['grid','linear; endpoints included','–'],['selected',a.selected+1,'point']];}
export function rankineSweepCSV(q){
 const cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const table=rankineSweepTable(q,true),rows=[['Extraction pressure study'],...rankineSweepInputRows(q.input),['best_sampled_point',q.bestIndex===null?'':q.bestIndex+1],...rankineSweepNotes(true).map(n=>['note',n]),table.headers,...table.rows];
 return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
const sweepEscape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rankineSweepSVG(q,metric='efficiency',en=false,selected=q.input.selected){
 const labels={efficiency:['ККД ηₕ [%]','Efficiency ηₕ [%]',100],work:['Корисна робота [kJ/kg пари котла]','Net work [kJ/kg boiler]',1],y:['Частка відбору y [kg/kg пари котла]','Extraction fraction y [kg/kg boiler]',1],moisture:['Вологість на виході ЦНТ 1−x [%]','LP exit moisture 1−x [%]',100]};
 if(!Object.hasOwn(labels,metric))throw Error('Unknown sweep chart metric.');
 const [uk,eng,factor]=labels[metric],title=en?eng:uk,vals=q.points.filter(p=>p.valid&&p[metric]!==null).map(p=>p[metric]*factor),low=vals.length?Math.min(...vals):0,high=vals.length?Math.max(...vals):1,pad=Math.max((high-low)*.08,Math.abs(high)*.005,1e-5),ymin=low-pad,ymax=high+pad;
 const x=p=>85+610*(p-q.input.min)/(q.input.max-q.input.min),y=v=>285-220*(v-ymin)/(ymax-ymin),num=v=>Number(v.toPrecision(5)).toString();
 let path='',previous=false;
 for(const p of q.points){const valid=p.valid&&p[metric]!==null;if(valid)path+=(previous?'L':'M')+x(p.p).toFixed(3)+','+y(p[metric]*factor).toFixed(3);previous=valid;}
 const ticks=Array.from({length:5},(_,i)=>{const px=q.input.min+(q.input.max-q.input.min)*i/4,v=ymin+(ymax-ymin)*i/4;return `<path d="M85 ${y(v)}H695" stroke="#e0e7ef"/><text x="78" y="${y(v)+4}" text-anchor="end">${num(v)}</text><text x="${x(px)}" y="310" text-anchor="middle">${num(px)}</text>`;}).join('');
 const marks=q.points.map(p=>{const px=x(p.p),valid=p.valid&&p[metric]!==null,py=valid?y(p[metric]*factor):285,desc=`${p.index+1}: p=${p.p} MPa; ${!p.valid?p.error:valid?title+'='+num(p[metric]*factor):en?'Undefined outside saturation':'Не визначено поза насиченням'}`;return `<g data-sweep-point="${p.index}" tabindex="0" role="button" aria-label="${sweepEscape(desc)}" aria-pressed="${p.index===selected}"><title>${sweepEscape(desc)}</title><circle cx="${px}" cy="${py}" r="13" fill="transparent"/>${valid?`<circle cx="${px}" cy="${py}" r="${p.index===selected?6:4}" fill="${p.index===q.bestIndex?'#a04e00':'#176baa'}" stroke="${p.index===selected?'#111':'white'}" stroke-width="2"/>`:`<path d="M${px-4} ${py-5}l8 8m-8 0l8 -8" stroke="${p.valid?'#727b85':'#a22'}" stroke-width="2"/>`}</g>`;}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 365" data-sweep-chart="${metric}" role="group" aria-label="${sweepEscape(title)}"><metadata>${sweepEscape(JSON.stringify({input:q.input,notes:rankineSweepNotes(en)}))}</metadata><rect width="760" height="365" fill="white"/><g font-family="Arial" font-size="12" fill="#23445f"><text x="85" y="22" font-size="15">${sweepEscape(title)}</text><text x="85" y="43">${en?'Orange: largest sampled η; crosses: invalid / undefined':'Помаранчеве: найбільший розрахований η; ×: недопустимо / не визначено'}</text>${ticks}<path d="M85 60V285H695" stroke="#42627d" fill="none"/><path data-sweep-line="${metric}" d="${path}" fill="none" stroke="#176baa" stroke-width="2"/>${marks}<text x="390" y="342" text-anchor="middle">${en?'Extraction pressure':'Тиск відбору'} [MPa abs]</text></g></svg>`;
}
