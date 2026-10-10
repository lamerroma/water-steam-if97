import fs from 'node:fs';import {initialize,calculate} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const ref=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/water-conformance.json',import.meta.url)));
const result={source:ref.source,seed:ref.seed,forward:{count:0,errors:[],maxima:{}},inverse:{count:0,errors:[],maxima:{},states:[]}};
for(const r of ref.states){try{const q=calculate(r.mode,r.a,r.b,r.model).state;if(!q)throw Error('No state');result.forward.count++;
 for(const [k,value] of Object.entries(r.fundamental||r)){if(!['rho','h','s','u','cp','cv','w'].includes(k)||q[k]==null)continue;const relative=Math.abs(q[k]-value)/Math.max(Math.abs(value),1e-12),group=r.model+' '+k;if(relative>2e-7)result.forward.errors.push({model:r.model,mode:r.mode,a:r.a,b:r.b,property:k,relative,error:'Fundamental reference tolerance exceeded'});if(!result.forward.maxima[group]||relative>result.forward.maxima[group].relative)result.forward.maxima[group]={relative,mode:r.mode,a:r.a,b:r.b};}
}catch(e){result.forward.errors.push({model:r.model,mode:r.mode,a:r.a,b:r.b,error:e.message});}}
const modes={pt:['p','T'],ph:['p','h'],ps:['p','s'],hs:['h','s'],prho:['p','rho'],trho:['T','rho'],pv:['p','v'],pu:['p','u'],tv:['T','v'],tu:['T','u'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],th:['T','h'],ts:['T','s']};
for(const r of ref.states.filter(r=>r.inverse)){
 const target={...r,...r.fundamental,p:r.a,T:r.mode==='pt'?r.b:r.T};target.v=1/target.rho;
 target.x=r.mode==='px'?r.b:null;
 const available={...modes,...(target.x!==null?{px:['p','x'],tx:['T','x'],satp:['p'],satt:['T']}: {})};
 for(const [mode,keys] of Object.entries(available)){
 if(mode==='pt'&&target.x!==null)continue;
 const label={model:r.model,mode,p:target.p,T:target.T,x:r.mode==='px'?r.b:null};
 try{const q=calculate(mode,target[keys[0]],target[keys[1]],r.model);
 if(mode==='satp'||mode==='satt'){const s=q.saturation;if(!s||Math.abs(s.p-target.p)/target.p>1e-6||Math.abs(s.T-target.T)>1e-5)throw Error('Saturation state exceeds tolerance');result.inverse.count++;result.inverse.states.push({...label,deltaT:Math.abs(s.T-target.T),relativeP:Math.abs(s.p-target.p)/target.p,roots:2});continue;}
 const candidates=[q.state,...(q.alternatives||[])].filter(Boolean);
 for(const state of candidates)for(const key of keys){const residual=Math.abs(state[key]-target[key])/Math.max(Math.abs(target[key]),1e-8);if(residual>2e-7)throw Error(`Returned root violates input ${key}: ${residual}`);}
 const qBest=candidates.sort((a,b)=>Math.abs(a.T-target.T)+Math.abs(Math.log(a.p/target.p))-(Math.abs(b.T-target.T)+Math.abs(Math.log(b.p/target.p))))[0];
 const dT=Math.abs(qBest.T-target.T),dP=Math.abs(qBest.p-target.p)/target.p, entry={...label,deltaT:dT,relativeP:dP,roots:candidates.length};result.inverse.states.push(entry);result.inverse.count++;
 const group=r.model+' '+mode,score=Math.max(dT/1e-5,dP/1e-6);if(!result.inverse.maxima[group]||score>result.inverse.maxima[group].score)result.inverse.maxima[group]={...entry,score};
 if(dT>1e-5||dP>1e-6)result.inverse.errors.push({...entry,error:'Independent state error exceeds 1e-5 K or 1e-6 relative P'});
 }catch(e){result.inverse.errors.push({...label,error:e.message});}
 }
 console.log('Checked',r.model,r.mode,r.a,r.b);
}
fs.writeFileSync(process.argv[2]||new URL('../docs/water-all-modes-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({forward:result.forward,inverse:{count:result.inverse.count,errors:result.inverse.errors,maxima:result.inverse.maxima}},null,2));
if(result.forward.errors.length||result.inverse.errors.length)process.exitCode=1;
