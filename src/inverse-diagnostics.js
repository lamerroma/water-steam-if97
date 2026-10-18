// Canonical MPa, K, kJ/kg. Rounding scenarios are NOT measurement uncertainty.
export const DIAGNOSTIC_PAIRS={pt:['p','T'],ph:['p','h'],ps:['p','s'],pu:['p','u'],th:['T','h'],ts:['T','s'],tu:['T','u'],pv:['p','v'],tv:['T','v'],prho:['p','rho'],trho:['T','rho'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']};
export const DIAGNOSTIC_UNITS={p:'MPa',T:'K',h:'kJ/kg',s:'kJ/(kg K)',u:'kJ/kg',v:'m3/kg',rho:'kg/m3'};
export function diagnosticGradient(q,key){
 switch(key){case'p':return[1,0];case'T':return[0,1];case'v':return[q.dvdp,q.dvdt];case'rho':return[q.drhodp,-q.rho*q.alpha];case'h':return[1000*q.v*(1-q.T*q.alpha),q.cp];case's':return[-1000*q.v*q.alpha,q.cp/q.T];case'u':return[-1000*(q.T*q.dvdt+q.p*q.dvdp),q.cp-1000*q.p*q.dvdt];default:return[NaN,NaN];}
}
function diagnosticFloor(q,key){return 128*Number.EPSILON*Math.max(Math.abs(q[key]),key==='v'?.001:key==='s'?1:key==='h'||key==='u'?.461526*q.T:1);}
function diagnosticJacobian(q,keys){
 if(q.cp==null||q.critical)return null;
 const [a,b]=diagnosticGradient(q,keys[0]),[c,d]=diagnosticGradient(q,keys[1]),det=a*d-b*c;
 if(![a,b,c,d,det].every(Number.isFinite)||Math.abs(det)<=128*Number.EPSILON*(Math.abs(a*d)+Math.abs(b*c)))return null;
 return {a,b,c,d,det};
}
function diagnosticResponse(q,keys,halfWidths){
 const j=diagnosticJacobian(q,keys);if(!j)return null;
 const {a,b,c,d,det}=j,dp=[d/det,-b/det],dt=[-c/det,a/det],response={};
 for(const key of Object.keys(DIAGNOSTIC_UNITS)){
  const [g,h]=diagnosticGradient(q,key),weights=[g*dp[0]+h*dt[0],g*dp[1]+h*dt[1]];
  // Fixed input coordinates are exact identities, avoiding cancellation noise.
  if(keys.includes(key)){weights[0]=key===keys[0]?1:0;weights[1]=key===keys[1]?1:0;}
  response[key]=Math.abs(weights[0])*halfWidths[0]+Math.abs(weights[1])*halfWidths[1];
 }
 return Object.values(response).every(Number.isFinite)?response:null;
}
function diagnosticStable(q){return q.x!=null&&!q.critical?q.x>=0&&q.x<=1:q.cp>0&&q.cv>0&&q.drhodp>0;}
const diagnosticAcceptanceFloors={p:1e-11,T:2e-8,h:2e-7,s:2e-10,u:2e-7,v:2e-12,rho:1e-8};
function diagnosticInputValid(q,keys,targets){return keys.every((k,i)=>Number.isFinite(q[k])&&Math.abs(q[k]-targets[i])<=Math.max(diagnosticAcceptanceFloors[k],Math.abs(targets[i])*2e-9));}
function diagnosticScore(q,keys,targets){return Math.hypot(...keys.map((key,i)=>(q[key]-targets[i])/diagnosticFloor(q,key)));}
function diagnosticDuplicates(a,b,keys){
 if(a.model!==b.model||a.region!==b.region||a.phase!==b.phase||a.cp==null||b.cp==null)return false;
 const ja=diagnosticJacobian(a,keys),jb=diagnosticJacobian(b,keys);
 // Opposite sides of a turning point represent separate physical roots.
 if(!ja||!jb||Math.sign(ja.det)!==Math.sign(jb.det))return false;
 const ea=diagnosticResponse(a,keys,keys.map(k=>diagnosticFloor(a,k))),eb=diagnosticResponse(b,keys,keys.map(k=>diagnosticFloor(b,k)));
 if(!ea||!eb)return false;
 return Math.abs(a.p-b.p)<=Math.min(.01*Math.max(a.p,b.p),4*(ea.p+eb.p))&&Math.abs(a.T-b.T)<=Math.min(1e-5,4*(ea.T+eb.T))&&Math.abs(a.rho-b.rho)<=1e-7*Math.max(a.rho,b.rho);
}
export function diagnoseCalculation(result,mode,a,b,options){
 const keys=DIAGNOSTIC_PAIRS[mode];if(!result.state||!keys)return result;
 const candidates=[result.state,...result.alternatives||[]],targets=[a,b];
 const accepted=candidates.filter(q=>diagnosticInputValid(q,keys,targets));
 if(!accepted.length)throw Error('Не знайдено стан, що узгоджується з обома вхідними значеннями. Перевірте одиниці та межі моделі.');
 const ranked=accepted.map(q=>({q,score:diagnosticScore(q,keys,targets),stable:diagnosticStable(q)})).sort((x,y)=>Number(y.stable)-Number(x.stable)||x.score-y.score);
 const groups=[];
 for(const item of ranked){const group=groups.find(g=>g.every(z=>diagnosticDuplicates(z.q,item.q,keys)));if(group)group.push(item);else groups.push([item]);}
 const rounding=options?.inputRounding;
 const validRounding=Array.isArray(rounding)&&rounding.length===2&&rounding.every(x=>Number.isFinite(x?.halfWidth)&&x.halfWidth>0&&typeof x.unit==='string');
 const states=groups.map(group=>{
  const q={...group[0].q,notes:(group[0].q.notes||[]).filter(n=>!/^Знайдено \d+ станів/.test(n)&&!n.includes('Показано корінь з нижчою температурою'))};
  if(groups.length>1)q.notes.push('Вхідним значенням відповідають кілька коренів. Перевірте інші знайдені стани та виберіть потрібну фізичну гілку.');
  if(validRounding){const halfWidths=rounding.map(x=>x.halfWidth),response=q.x!=null?null:diagnosticResponse(q,keys,halfWidths);
   const limited=response&&(response.p>.05*q.p||response.T>1||response.rho>.01*q.rho);
   const numericalResponse=response?diagnosticResponse(q,keys,keys.map(k=>diagnosticFloor(q,k))):null;
   q.inputSensitivity={numericalResponse,status:response?(limited?'limited':'local'):'unavailable',reason:response?(limited?'large-perturbation':null):q.cp==null||q.x!=null?'phase-coexistence':'singular-jacobian',response,units:DIAGNOSTIC_UNITS};
  }
  return q;
 });
 const out={...result,state:states[0]},diagnostics={version:1,mode,keys,targets,candidates:candidates.length,roots:states.length,rejected:candidates.length-accepted.length,merged:accepted.length-states.length,selection:'stability-then-normalized-input-residual',assessments:groups.map(g=>({stable:g[0].stable,normalizedResidual:g[0].score,members:g.length,candidatePressureRange:[Math.min(...g.map(x=>x.q.p)),Math.max(...g.map(x=>x.q.p))]})),numericalFloor:'128 * Number.EPSILON * thermodynamic scale'};
 if(validRounding)diagnostics.roundingScenario={assumption:'independent half of last typed decimal place; local linear response, not measurement uncertainty or an error bound',inputs:rounding.map((x,i)=>({key:keys[i],halfWidth:x.halfWidth,unit:DIAGNOSTIC_UNITS[keys[i]],enteredUnit:x.unit,enteredText:String(x.text??'')}))};
 if(states.length>1)out.alternatives=states.slice(1);else delete out.alternatives;
 if(mode!=='pt'||validRounding)out.diagnostics=diagnostics;
 return out;
}
// Suggested display precision only; engine and machine-readable exports stay raw.
export function sensitivityDigits(value,halfWidth,maximum=8){
 if(!Number.isFinite(value)||!Number.isFinite(halfWidth)||halfWidth<=0)return maximum;
 if(value===0)return 1;
 return Math.max(1,Math.min(maximum,Math.floor(Math.log10(Math.abs(value)/halfWidth))+1));
}

export function selectCalculatedAlternative(result,index){
 if(!Number.isInteger(index)||index<0||!result.alternatives?.[index])return result;
 const states=[result.state,...result.alternatives],chosen=index+1,order=[chosen,...states.map((_,i)=>i).filter(i=>i!==chosen)];
 return {...result,state:states[chosen],alternatives:order.slice(1).map(i=>states[i]),...(result.diagnostics?{diagnostics:{...result.diagnostics,selection:'manual',assessments:order.map(i=>result.diagnostics.assessments[i])}}:{})};
}
