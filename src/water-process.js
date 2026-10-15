import {calculate} from './engine.js';

const waterProcessResults=new Map();
// Only local solver/Worker output enters this cache; project imports contain inputs.
export function rememberWaterProcessResult(q){const key=JSON.stringify([q.model,readWaterProcessInput(q.input)]);if(waterProcessResults.size>=4)waterProcessResults.delete(waterProcessResults.keys().next().value);waterProcessResults.set(key,q);return q;}

export const WATER_PROCESS_ENDS={isobaric:['T','h','x','v'],isochoric:['T','p'],isothermal:['v','p','x'],isentropic:['p','T']};
export function readWaterProcessInput(value){
 const a=value;if(!a||!Object.hasOwn(WATER_PROCESS_ENDS,a.kind)||!['pt','ph','ps','px'].includes(a.mode)||!WATER_PROCESS_ENDS[a.kind].includes(a.end))throw Error('Некоректний вид процесу або гранична умова. / Invalid process or boundary condition.');
 const out={kind:a.kind,mode:a.mode,a:a.a,b:a.b,end:a.end,value:a.value,mass:a.mass??1};
 if(![out.a,out.b,out.value,out.mass].every(Number.isFinite)||out.mass<=0)throw Error('Введіть скінченні числа та додатну масу. / Enter finite numbers and positive mass.');
 return out;
}
function waterProcessState(mode,a,b,model){
 const r=calculate(mode,a,b,model);
 if(!r.state||r.alternatives?.length)throw Error('Стан неоднозначний; задайте іншу пару параметрів. / Ambiguous state; choose another input pair.');
 const q=r.state;if(!['p','T','v','h','u','s'].every(k=>Number.isFinite(q[k])))throw Error('Неповний термодинамічний стан. / Incomplete thermodynamic state.');return q;
}
// Reversible equilibrium paths; MPa*m³/kg becomes kJ/kg with factor 1000.
// Independent integrals are retained: no algebraic correction hides their residual.
export function solveWaterProcess(value,model='IF97'){
 if(!['IF97','IAPWS-95'].includes(model))throw Error('Unknown water model.');
 const input=readWaterProcessInput(value),cacheKey=JSON.stringify([model,input]);
 if(waterProcessResults.has(cacheKey))return waterProcessResults.get(cacheKey);
 const q1=waterProcessState(input.mode,input.a,input.b,model),get=(m,a,b)=>waterProcessState(m,a,b,model);
 const q2=input.kind==='isobaric'?get('p'+input.end.toLowerCase(),q1.p,input.value):input.kind==='isochoric'?get(input.end==='T'?'tv':'pv',input.value,q1.v):input.kind==='isothermal'?(input.end==='p'?get('pt',input.value,q1.T):get(input.end==='x'?'tx':'tv',q1.T,input.value)):get(input.end==='T'?'ts':'ps',input.value,q1.s);
 const dh=q2.h-q1.h,du=q2.u-q1.u,ds=q2.s-q1.s;
 const key={isobaric:'h',isochoric:'T',isothermal:'v',isentropic:'p'}[input.kind],log=['v','p'].includes(key),start=q1[key],finish=q2[key];
 const coordinate=t=>log?start*Math.exp(t*Math.log(finish/start)):start+t*(finish-start);
 const at=t=>t===0?q1:t===1?q2:input.kind==='isobaric'?get('ph',q1.p,coordinate(t)):input.kind==='isochoric'?get('tv',coordinate(t),q1.v):input.kind==='isothermal'?get('tv',q1.T,coordinate(t)):get('ps',coordinate(t),q1.s);
 const anchors=[0,1],cache=new Map([[0,q1],[1,q2]]);
 // Explicit saturated endpoints preserve latent heat plateaus and their corners.
 if(finish!==start&&['isobaric','isothermal'].includes(input.kind)){
  let sat;try{sat=calculate(input.kind==='isobaric'?'satp':'satt',input.kind==='isobaric'?q1.p:q1.T,undefined,model).saturation;}catch{}
  if(sat)for(const q of [sat.liquid,sat.vapor]){const t=log?Math.log(q[key]/start)/Math.log(finish/start):(q[key]-start)/(finish-start);if(t>0&&t<1){anchors.push(t);cache.set(t,q);}}
 }
 anchors.sort((a,b)=>a-b);let previous=null,result;
 for(let n=16;n<=1024;n*=2){
  const times=[...new Set([...anchors,...Array.from({length:n+1},(_,i)=>i/n)])].sort((a,b)=>a-b);
  const path=times.map(t=>{if(!cache.has(t))cache.set(t,at(t));return cache.get(t);});
  let boundaryWork=0,technicalWork=0,heat=0;
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];boundaryWork+=500*(a.p+b.p)*(b.v-a.v);technicalWork-=500*(a.v+b.v)*(b.p-a.p);heat+=(a.T+b.T)/2*(b.s-a.s);}
  const residual=heat-du-boundaryWork,flowResidual=heat-dh-technicalWork;
  const tolerance=.005+1e-5*Math.max(Math.abs(heat),Math.abs(boundaryWork),Math.abs(technicalWork),Math.abs(du),Math.abs(dh));
  const refinement=previous?Math.max(...['heat','boundaryWork','technicalWork'].map(k=>Math.abs(previous[k]-({heat,boundaryWork,technicalWork})[k]))):Infinity;
  const referenceHeat=input.kind==='isobaric'?dh:input.kind==='isochoric'?du:input.kind==='isothermal'?q1.T*ds:0;
  const heatError=heat-referenceHeat;
  const converged=refinement<=tolerance&&Math.max(Math.abs(residual),Math.abs(flowResidual),Math.abs(heatError))<=tolerance;
  result={input,model,states:[{...q1,name:'1'},{...q2,name:'2'}],path,dh,du,ds,heat,boundaryWork,technicalWork,residual,flowResidual,referenceHeat,heatError,tolerance,refinement,converged,segments:path.length-1};
  if(converged)break;previous={heat,boundaryWork,technicalWork};
 }
 result.total={heat:input.mass*result.heat,boundaryWork:input.mass*result.boundaryWork,technicalWork:input.mass*result.technicalWork,dh:input.mass*dh,du:input.mass*du,ds:input.mass*ds};return rememberWaterProcessResult(result);
}
export function waterProcessSteps(q,english=false){
 const t=(uk,en)=>english?en:uk,n=x=>Number(x.toPrecision(8));
 return [t('1. Початковий стан 1 визначено за заданою парою; кінцевий стан 2 — за незмінною величиною процесу та граничною умовою.','1. State 1 is calculated from the input pair; state 2 from the process invariant and end condition.'),
 t('2. Зміни властивостей','2. Property changes')+`: Δh = ${n(q.dh)} kJ/kg; Δu = ${n(q.du)} kJ/kg; Δs = ${n(q.ds)} kJ/(kg K).`,
 t('3. Оборотний рівноважний процес: тепло q = ∫T ds; робота розширення w = 1000∫p dv; технічна робота wₜ = −1000∫v dp. Тепло до води й робота від води — додатні.','3. Reversible equilibrium process: heat q = ∫T ds; boundary work w = 1000∫p dv; technical work wₜ = −1000∫v dp. Heat into water and work out of water are positive.'),
 t('4. Закрита система: q = Δu + w. Усталений потік: q = Δh + wₜ; зміни кінетичної та потенціальної енергії не враховано.','4. Closed system: q = Δu + w. Steady flow: q = Δh + wₜ; kinetic and potential energy changes are neglected.'),
 ({isobaric:'p = const: q = Δh; w = 1000p(v₂−v₁); wₜ = 0.',isochoric:'v = const: q = Δu; w = 0.',isothermal:'T = const: q = T(s₂−s₁).',isentropic:'s = const: q = 0; w = −Δu; wₜ = −Δh.'})[q.input.kind],
 t('5. Інтегрування методом трапецій із подвоєнням сітки. Нев’язки та зміна інтегралів мають бути менші за допуск.','5. Trapezoidal integration with grid doubling. Residuals and changes in the integrals must be smaller than the tolerance.')+` ${q.segments}; ε = ${n(q.tolerance)} kJ/kg.`,
 t('6. Повні енергії: Q = mq; W = mw. Для усталеного потоку потужність дорівнює питомій енергії, помноженій на масову витрату; введена тут маса не є витратою.','6. Total energies: Q = mq; W = mw. Steady-flow rates equal specific energies times mass flow; the mass entered here is not a flow rate.'),
 t('Ізоентропний шлях тут оборотний і адіабатний. Для необоротної адіабати ентропія може зростати; цей модуль її не моделює.','The isentropic path here is reversible and adiabatic. Irreversible adiabatic processes can increase entropy and are outside this model.')];
}
export function waterProcessRows(q,english=false){
 const t=(uk,en)=>english?en:uk;
 return [['Δh',q.dh,'kJ/kg'],['Δu',q.du,'kJ/kg'],['Δs',q.ds,'kJ/(kg K)'],[t('Питоме тепло q','Specific heat q'),q.heat,'kJ/kg'],[t('Робота розширення w','Boundary work w'),q.boundaryWork,'kJ/kg'],[t('Технічна робота wₜ','Technical work wₜ'),q.technicalWork,'kJ/kg'],['Q',q.total.heat,'kJ'],['W',q.total.boundaryWork,'kJ'],['Wₜ',q.total.technicalWork,'kJ'],[t('Нев’язка закритої системи','Closed-system residual'),q.residual,'kJ/kg'],[t('Нев’язка потоку','Flow residual'),q.flowResidual,'kJ/kg'],[t('Похибка відносно точної формули тепла','Heat identity error'),q.heatError,'kJ/kg'],[t('Зміна при згущенні','Refinement change'),q.refinement,'kJ/kg'],[t('Допуск','Tolerance'),q.tolerance,'kJ/kg']];
}
export function waterProcessSVG(q,kind='ts',english=false){
 if(!['ts','hs'].includes(kind))throw Error('Unknown chart.');const ykey=kind==='ts'?'T':'h',xs=q.path.map(s=>s.s),ys=q.path.map(s=>s[ykey]);
 const x0=Math.min(...xs),y0=Math.min(...ys),dx=Math.max(Math.max(...xs)-x0,.1),dy=Math.max(Math.max(...ys)-y0,1),x=v=>85+590*(v-x0)/dx,y=v=>335-280*(v-y0)/dy;
 const n=v=>Number(v.toPrecision(6)),points=q.path.map(s=>`${x(s.s).toFixed(3)},${y(s[ykey]).toFixed(3)}`).join(' ');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 410" role="img" aria-label="${kind==='ts'?'T–s':'h–s'} ${english?'process path, states 1 to 2':'траєкторія процесу, стани 1 та 2'}"><rect width="760" height="410" fill="white"/><g font-family="Arial" font-size="13" fill="#18364e"><path d="M75 35V345H700" fill="none" stroke="#708090"/>${Array.from({length:5},(_,i)=>{const t=i/4;return `<text x="${85+590*t}" y="365" text-anchor="middle">${n(x0+t*dx)}</text><text x="65" y="${340-280*t}" text-anchor="end">${n(y0+t*dy)}</text>`;}).join('')}<text x="360" y="395">s [kJ/(kg K)]</text><text x="80" y="23">${ykey} [${ykey==='T'?'K':'kJ/kg'}]</text><polyline data-process-path="${kind}" points="${points}" fill="none" stroke="#0067a5" stroke-width="2.5"/>${q.states.map((s,i)=>`<circle cx="${x(s.s)}" cy="${y(s[ykey])}" r="4" fill="#b04020"/><text x="${x(s.s)+8}" y="${y(s[ykey])-8}">${i+1}</text>`).join('')}</g></svg>`;
}
