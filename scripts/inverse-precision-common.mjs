// Shared acceptance criteria for Node, regression tests and real browsers.
const floors={p:1e-11,T:2e-8,h:2e-7,s:2e-10,u:2e-7,v:2e-12,rho:1e-8};
function gradient(q,k){switch(k){case'p':return[1,0];case'T':return[0,1];case'v':return[q.dvdp,q.dvdt];case'rho':return[q.drhodp,-q.rho*q.alpha];case'h':return[1000*q.v*(1-q.T*q.alpha),q.cp];case's':return[-1000*q.v*q.alpha,q.cp/q.T];case'u':return[-1000*(q.T*q.dvdt+q.p*q.dvdp),q.cp-1000*q.p*q.dvdt];}}
export function assess(result,c,keys){
 const target=c.expected,roots=[result.state,...result.alternatives||[]].filter(Boolean);
 const distance=q=>Math.abs(q.T-target.T)/Math.max(target.T,1)+Math.abs(Math.log(q.p/target.p))+Math.abs(Math.log(q.rho/target.rho));
 roots.sort((a,b)=>distance(a)-distance(b));const q=roots[0];if(!q)throw Error('No state');
 let pTolerance=Math.max(1e-9,target.p*2e-7),tTolerance=2e-5;
 // Reference and final Number roundoff can be amplified in ill-conditioned
 // inverses. Propagate a declared input uncertainty through the analytic Jacobian.
 if(q.cp!=null){const[a,b]=gradient(q,keys[0]),[d,e]=gradient(q,keys[1]),det=a*e-b*d;
  const uncertainty=keys.map(k=>Math.max({p:2e-12,T:2e-11,h:2e-9,s:2e-12,u:2e-9,v:2e-15,rho:2e-9}[k],Math.abs(target[k])*5e-12));
  const dp=(Math.abs(e)*uncertainty[0]+Math.abs(b)*uncertainty[1])/Math.abs(det),dt=(Math.abs(d)*uncertainty[0]+Math.abs(a)*uncertainty[1])/Math.abs(det);
  if(Number.isFinite(dp)&&Number.isFinite(dt)){pTolerance=Math.max(pTolerance,8*dp);tTolerance=Math.max(tTolerance,8*dt);}
 }
 const residuals=keys.map(key=>({key,error:Math.abs(q[key]-target[key]),tolerance:Math.max(floors[key],Math.abs(target[key])*2e-9)}));
 const phaseCorrect=c.x==null?q.cp!=null:q.x!=null&&Math.abs(q.x-c.x)<2e-5;
 const valid=residuals.every(r=>r.error<=r.tolerance)&&Math.abs(q.p-target.p)<=pTolerance&&Math.abs(q.T-target.T)<=tTolerance&&phaseCorrect;
 return {status:valid?'passed':'different',actual:{p:q.p,T:q.T,rho:q.rho,x:q.x,region:q.region},errors:{p:Math.abs(q.p-target.p),T:Math.abs(q.T-target.T),rhoRelative:Math.abs(q.rho/target.rho-1)},tolerances:{p:pTolerance,T:tTolerance},phaseCorrect,residuals,roots:roots.length};
}

// A reference may identify any physical root; every returned root must ALSO
// satisfy both supplied inputs and single-phase stability, independently of it.
export function assessAllRoots(result,targets,keys){
 return [result.state,...result.alternatives||[]].filter(Boolean).map(q=>{
  const residuals=keys.map((key,i)=>({key,error:Math.abs(q[key]-targets[i]),tolerance:Math.max(floors[key],Math.abs(targets[i])*2e-9)}));
  const stable=q.critical?null:q.x!=null?q.x>=0&&q.x<=1:q.cp>0&&q.cv>0&&q.drhodp>0;
  return {valid:residuals.every(x=>Number.isFinite(x.error)&&x.error<=x.tolerance)&&stable!==false,stable,residuals};
 });
}
