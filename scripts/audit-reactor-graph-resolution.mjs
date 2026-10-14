import fs from 'node:fs/promises';import {initialize} from '../src/engine.js';import {reactorCourse,reactorApplyVariant,REACTOR_DEFAULT} from '../src/reactor-course.js';
await initialize(await fs.readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const report={created:new Date().toISOString(),referencePoints:201,comparisons:[]};
for(const variant of [5,28,45]){
 const input=reactorApplyVariant(variant,REACTOR_DEFAULT),reference=reactorCourse({...input,points:201});
 for(const points of [7,25,101]){const q=reactorCourse({...input,points}),errors={};
  for(const key of ['t','qLinear','cladOuter','fuelSurface','fuelCenter']){let worst=0;for(const r of reference.profile){const fraction=(r.z/q.metrics.height+.5)*(points-1),i=Math.min(points-2,Math.max(0,Math.floor(fraction))),a=q.profile[i],b=q.profile[i+1],estimate=a[key]+(b[key]-a[key])*(r.z-a.z)/(b.z-a.z);worst=Math.max(worst,Math.abs(estimate-r[key]));}errors[key]=worst;}
  report.comparisons.push({variant,points,errors,fuelPeakDifference:reference.metrics.maxFuelCenter-q.metrics.maxFuelCenter,cladPeakDifference:reference.metrics.maxCladOuter-q.metrics.maxCladOuter});
 }
}
await fs.mkdir(new URL('../.release/graph-audit/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../.release/graph-audit/reactor-resolution.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report.comparisons,null,2));
