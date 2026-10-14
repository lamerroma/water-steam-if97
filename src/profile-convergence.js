// Numerical grid comparison only; it does not validate thermal correlations.
export function compareProfileMeshes(coarse,fine){
 if(!coarse.profile?.length||fine.profile?.length<coarse.profile.length||coarse.model!==fine.model)throw Error('Incompatible profile grids.');
 const inputs=q=>JSON.stringify(Object.entries(q.input||{}).filter(([k])=>k!=='points').sort(([a],[b])=>a.localeCompare(b)));if(inputs(coarse)!==inputs(fine))throw Error('Profile inputs differ.');
 const a=coarse.profile,b=fine.profile,span=a.at(-1).z-a[0].z;
 if(!(span>0)||Math.abs(b[0].z-a[0].z)>1e-9||Math.abs(b.at(-1).z-a.at(-1).z)>1e-9)throw Error('Profile domains differ.');
 const temperatureKeys=['t','cladOuter','cladInner','fuelSurface','fuelCenter'].filter(k=>a.every(r=>Number.isFinite(r[k]))&&b.every(r=>Number.isFinite(r[k]))),keys=[...temperatureKeys,'qLinear'];
 const differences={};
 for(const key of keys){let max=0,j=0;for(const r of b){while(j<a.length-2&&a[j+1].z<r.z)j++;const left=a[j],right=a[j+1],estimate=left[key]+(right[key]-left[key])*(r.z-left.z)/(right.z-left.z);if(!Number.isFinite(estimate)||!Number.isFinite(r[key]))throw Error('Non-finite profile comparison.');max=Math.max(max,Math.abs(estimate-r[key]));}differences[key]=max;}
 const peakDifferences=Object.fromEntries(temperatureKeys.map(k=>[k,Math.abs(Math.max(...a.map(r=>r[k]))-Math.max(...b.map(r=>r[k])))]));
 const coarseCHF=coarse.chf?.length?Math.min(...coarse.chf.map(r=>r.ratio)):null,fineCHF=fine.chf?.length?Math.min(...fine.chf.map(r=>r.ratio)):null;
 return {coarsePoints:a.length,finePoints:b.length,differences,peakDifferences,temperatureChange:Math.max(...temperatureKeys.map(k=>differences[k])),chfMinimumChange:coarseCHF!=null&&fineCHF!=null?Math.abs(fineCHF-coarseCHF):null};
}
export async function analyzeProfileConvergence(base,solve,{tolerance=.5,yieldFrame=()=>Promise.resolve()}={}){
 if(!Number.isFinite(tolerance)||tolerance<=0||!base.profile||base.profile.length<7||base.profile.length>201)throw Error('Invalid mesh comparison settings.');
 const cache=new Map([[base.profile.length,base]]),rows=[];let n=base.profile.length===201?101:base.profile.length;
 const get=async count=>{if(!cache.has(count)){await yieldFrame();cache.set(count,solve({...base.input,points:count},base.model));}return cache.get(count);};
 for(let step=0;step<8;step++){
  const next=Math.min(201,2*(n-1)+1),coarse=await get(n),fine=await get(next),comparison=compareProfileMeshes(coarse,fine);rows.push(comparison);
  if(comparison.temperatureChange<=tolerance||next===201)break;n=next;
 }
 await yieldFrame();const last=rows.at(-1),meetsTolerance=last.temperatureChange<=tolerance;
 return {tolerance,currentPoints:base.profile.length,finestPoints:last.finePoints,rows,meetsTolerance,limitReached:!meetsTolerance&&last.finePoints===201};
}
export function profileConvergenceCSV(result){
 const headers=['coarse_points','fine_points','maximum_temperature_difference_K','coolant_K','clad_outer_K','clad_inner_K','fuel_surface_K','fuel_maximum_K','linear_heat_kWm','minimum_CHF_ratio_difference'];
 return '\uFEFF'+[headers,...result.rows.map(r=>[r.coarsePoints,r.finePoints,r.temperatureChange,...['t','cladOuter','cladInner','fuelSurface','fuelCenter','qLinear'].map(k=>r.differences[k]??''),r.chfMinimumChange??''])].map(row=>row.join(';')).join('\r\n');
}
