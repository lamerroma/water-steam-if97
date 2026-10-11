import {solveCycle,CYCLE_DEFAULT} from './cycle-study.js';
import {solveNuclear,NPP_DEFAULT,NPP_MSR_DEFAULT} from './nuclear.js';
import {exchangerDesign,EXCHANGER_DEFAULT} from './exchanger-design.js';
export const RESEARCH_PARAMETERS={cycles:['pLow','pHigh','pMid','Tmin','Tmax','Tmid','etaT','etaC','flow'],npp:['thermalMW','primaryP','coldC','hotC','steamP','condenserP','etaT','etaPump','pMid','reheatC','etaLP'],exchanger:['hotIn','hotOut','coldIn','coldOut','heatKW','U']};
export function solveStudyModule(module,input,model='IF97'){
 if(!['IF97','IAPWS-95'].includes(model))throw Error('Невідома модель дослідження.');
 if(module==='cycles')return solveCycle(input,model);if(module==='npp')return solveNuclear(input,model);if(module==='exchanger')return exchangerDesign(input);throw Error('Невідомий модуль дослідження.');
}
export function researchMetrics(module,q){return module==='exchanger'?{area:q.area,lmtd:q.lmtd}:{netKW:module==='npp'?q.netKW:q.power,efficiency:q.efficiency,outletX:module==='npp'?(q.states.find(s=>s.name===(q.mode==='msr'?'L1':'S4'))?.x??null):((q.input.type==='rankine-regen'?q.states[2]:q.states.at(-1)).x??null)};}
export function validateSweep(a){
 if(!a||!RESEARCH_PARAMETERS[a.module]?.includes(a.parameter)||!Number.isFinite(a.start)||!Number.isFinite(a.end)||a.start===a.end||!Number.isInteger(a.count)||a.count<2||a.count>41)throw Error('Дослідження: оберіть параметр, різні межі й 2…41 точку.');
 const active=a.module==='npp'?(a.base?.mode==='msr'?Object.keys(NPP_MSR_DEFAULT):Object.keys(NPP_DEFAULT)):a.module==='cycles'?(a.base?.type==='brayton'?['pLow','pHigh','Tmin','Tmax','etaT','etaC','flow']:a.base?.type==='rankine-reheat'?Object.keys(CYCLE_DEFAULT):a.base?.type==='rankine-regen'?Object.keys(CYCLE_DEFAULT).filter(k=>!['Tmin','Tmid'].includes(k)):['pLow','pHigh','Tmax','etaT','etaC','flow']):Object.keys(EXCHANGER_DEFAULT);
 if(!active.includes(a.parameter))throw Error('Цей параметр не діє на обраний режим.');
 solveStudyModule(a.module,a.base,a.model);return a;
}
export function sweepPoint(a,i){const value=i===a.count-1?a.end:a.start+(a.end-a.start)*i/(a.count-1);try{return {value,...researchMetrics(a.module,solveStudyModule(a.module,{...a.base,[a.parameter]:value},a.model)),error:null};}catch(e){return {value,error:e.message};}}
export function researchSeries(a){validateSweep(a);return Array.from({length:a.count},(_,i)=>sweepPoint(a,i));}
export function readResearch(value){
 if(value==null)return {variants:[],sweep:null};if(!value||!Array.isArray(value.variants)||value.variants.length>8||JSON.stringify(value).length>50000)throw Error('Дослідження: максимум 8 варіантів.');
 const variants=value.variants.map(v=>{if(typeof v.title!=='string'||v.title.length>120)throw Error('Некоректна назва варіанта.');const q=solveStudyModule(v.module,v.input,v.model);return {title:v.title,module:v.module,input:q.input,model:v.model||'IF97'};});
 const sweep=value.sweep?JSON.parse(JSON.stringify(validateSweep(value.sweep))):null;return {variants,sweep};
}
export const researchUnit=k=>({netKW:'kW',efficiency:'-',outletX:'-',area:'m²',lmtd:'K',pLow:'MPa abs',pHigh:'MPa abs / ratio',pMid:'MPa abs',Tmin:'K',Tmax:'K',Tmid:'K',etaT:'-',etaC:'-',flow:'kg/s',thermalMW:'MW',primaryP:'MPa abs',coldC:'°C',hotC:'°C',steamP:'MPa abs',condenserP:'MPa abs',etaPump:'-',reheatC:'°C',etaLP:'-',hotIn:'K',hotOut:'K',coldIn:'K',coldOut:'K',heatKW:'kW',U:'W/(m² K)'}[k]||'-');
