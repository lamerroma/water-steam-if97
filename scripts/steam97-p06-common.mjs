export function runP06(c,mode,api){
 const i=c.input;
 return c.kind==='flash'?api.flash(i.p1,i.T1,i.p2,i.flow,i.flag,c.model):mode==='power'?api.turbine(i.p1,i.T1,i.p2,i.eta,i.flow,c.model):api.turbineInverse(mode,i.p1,i.T1,i.p2,c.expected.power,mode==='flow'?i.eta:i.flow,c.model);
}
export function assessP06(r,c,policy){
 const checks=[],e=c.expected;
 const check=(key,actual,wanted,floor)=>{const tolerance=wanted==null?null:Math.max(floor,Math.abs(wanted)*policy.relative);
  checks.push({key,actual:actual??null,expected:wanted,tolerance,passed:wanted===null?actual===null:Number.isFinite(actual)&&Math.abs(actual-wanted)<=tolerance});};
 for(const name of ['inlet',...(c.kind==='turbine'?['ideal']:[]),'outlet']){
  for(const k of ['p','T','h','s','rho'])check(name+'.'+k,r[name]?.[k],e[name][k],k==='T'?policy.temperature_absolute:k==='h'?policy.energy_absolute:k==='s'?policy.entropy_absolute:policy.scalar_absolute);
  const x=e[name].x;
  if(x!==null)check(name+'.x',r[name]?.x,x,policy.quality_absolute);
  else if(r[name]?.x!=null)checks.push({key:name+'.phase',actual:r[name].x,expected:null,passed:r[name].x<policy.endpoint_quality_snap||r[name].x>1-policy.endpoint_quality_snap});
 }
 for(const k of c.kind==='turbine'?['work','power','eta','flow','inletTsat','outletSuperheat','specificConsumption']:['flow','vaporFlow','liquidFlow'])check(k,r[k],e[k],k==='power'?policy.power_absolute:k==='work'?policy.energy_absolute:k==='inletTsat'||k==='outletSuperheat'?policy.temperature_absolute:policy.scalar_absolute);
 check('enthalpy-balance',c.kind==='turbine'?r.inlet.h-r.outlet.h-r.work:r.inlet.h-r.outlet.h,0,policy.energy_absolute);
 if(c.kind==='turbine'){
  check('power-balance',r.power-r.flow*(r.inlet.h-r.outlet.h),0,Math.max(policy.power_absolute,Math.abs(r.power)*2e-9));
  check('ideal-entropy',r.ideal.s,r.inlet.s,policy.entropy_absolute);
 }else if(r.vaporFlow!=null){
  check('mass-balance',r.vaporFlow+r.liquidFlow-r.flow,0,Math.max(1e-10,r.flow*2e-12));
  if(r.saturation)check('separation-energy',r.vaporFlow*r.saturation.vapor.h+r.liquidFlow*r.saturation.liquid.h-r.flow*r.inlet.h,0,Math.max(policy.power_absolute,Math.abs(r.flow*r.inlet.h)*2e-9));
 }
 return {passed:checks.every(c=>c.passed),checks};
}
