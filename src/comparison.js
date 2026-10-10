import {calculate} from './engine.js';
export const COMPARISON_PROPERTIES=[['T','Температура','K'],['p','Тиск','МПа'],['h','Ентальпія','кДж/кг'],['s','Ентропія','кДж/(кг·K)'],['rho','Густина','кг/м³'],['v','Питомий об’єм','м³/кг'],['cp','Cp','кДж/(кг·K)'],['cv','Cv','кДж/(кг·K)'],['w','Швидкість звуку','м/с']];
export function compareModels(mode,a,b){
 const models=['IF97','IAPWS-95'].map(model=>{try{const result=calculate(mode,a,b,model);return {model,result};}catch(e){return {model,error:e.message};}});
 const state=r=>r.result?.state;
 const left=state(models[0]),right=state(models[1]);
 const rows=COMPARISON_PROPERTIES.map(([key,label,unit])=>{const x=left?.[key],y=right?.[key],valid=Number.isFinite(x)&&Number.isFinite(y);return {key,label,unit,if97:x??null,iapws95:y??null,delta:valid?x-y:null,relative:valid&&Math.abs(y)>1e-12?100*(x-y)/Math.abs(y):null};});
 const notes=['Δ = IF97 − IAPWS-95; відносне відхилення = 100·Δ/|IAPWS-95|. Відмінність моделей не є оцінкою похибки вимірювання.'];
 if(models.some(z=>z.result?.ambiguous||(!z.result?.state&&z.result?.saturation)))notes.push('На лінії насичення p–T не визначає частку пари. Оберіть p–x або T–x для порівняння однакової сухості.');
 if(left&&right&&left.phase!==right.phase)notes.push('Фазові позначення моделей можуть відрізнятися; поблизу насичення перевірте стан кожної моделі.');
 return {model:'Порівняння IF97 / IAPWS-95',mode,a,b,models,rows,notes};
}
