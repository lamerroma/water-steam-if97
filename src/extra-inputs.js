// Numerical inversions of the selected fundamental model, with explicit multiple roots.
export function extraInputs(mode,a,b,model,calc){
 if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Параметри мають бути скінченними.');
 const fixedT=mode!=='prho',key=mode==='th'?'h':mode==='ts'?'s':'rho';
 if(key==='rho'&&b<=0)throw Error('Густина має бути додатною.');
 const roots=[];let sat;try{sat=calc(fixedT?'satt':'satp',a,undefined,model).saturation;}catch{}
 const keep=r=>{if(r?.state&&!roots.some(z=>Math.abs(z.state.p-r.state.p)<Math.max(1e-7,r.state.p*1e-7)&&Math.abs(z.state.T-r.state.T)<1e-6))roots.push(r);};
 if(sat){const l=sat.liquid,v=sat.vapor,x=key==='rho'?(1/b-l.v)/(v.v-l.v):(b-l[key])/(v[key]-l[key]);if(x>=0&&x<=1)keep(calc('px',sat.p,x,model));}
 const values=fixedT?Array.from({length:193},(_,i)=>10**(-9+(Math.log10(model==='IF97'?100:1000)+9)*i/192)):Array.from({length:257},(_,i)=>(model==='IF97'?273.15:273.16)+((model==='IF97'?(a<=50?2273.15:1073.15):1273)-(model==='IF97'?273.15:273.16))*i/256);
 if(!fixedT)values.push(274,275,276,277,277.13,277.5,278,279,280,623.15,647.096,1073.15);
 if(sat){const q=fixedT?sat.p:sat.T;values.push(q*(1-2e-8),q*(1+2e-8));}
 values.sort((x,y)=>x-y);let prev=null;
 const evaluate=z=>calc('pt',fixedT?z:a,fixedT?a:z,model);
 for(const z of values){let r;try{r=evaluate(z);}catch{prev=null;continue;}if(!r.state){prev=null;continue;}const e=r.state[key]-b,tol=Math.max(1e-9,Math.abs(b)*2e-9);
 if(Math.abs(e)<tol)keep(r);
 if(prev&&prev.e*e<0&&prev.phase===r.state.phase){let lo=prev.z,hi=z,elo=prev.e;for(let i=0;i<70;i++){const mid=fixedT?Math.sqrt(lo*hi):(lo+hi)/2;let q;try{q=evaluate(mid);}catch{break;}if(!q.state)break;const err=q.state[key]-b;if(Math.abs(err)<tol){keep(q);break;}if(err*elo>0){lo=mid;elo=err;}else hi=mid;}}
 prev={z,e,phase:r.state.phase};
 }
 if(!roots.length)throw Error('Не знайдено стан у межах обраної моделі. Перевірте одиниці та параметри.');
 roots.sort((x,y)=>fixedT?x.state.p-y.state.p:x.state.T-y.state.T);const result=roots[0];if(roots.length>1){result.alternatives=roots.slice(1).map(q=>q.state);result.state={...result.state,notes:[...result.state.notes,`Знайдено ${roots.length} станів. Показано стан із найменшим ${fixedT?'тиском':'значенням температури'}; інші корені наведені окремо.`]};}return result;
}
