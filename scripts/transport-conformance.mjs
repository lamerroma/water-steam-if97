import fs from 'node:fs';import {initialize,calculate} from '../src/engine.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const ref=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/water-conformance.json',import.meta.url)));
const result={source:ref.source,count:0,unavailable:0,errors:[],maxima:{}};
for(const r of ref.states.filter(r=>r.mode==='pt')){const q=calculate('pt',r.a,r.b,r.model).state;
 for(const key of ['mu','lambda']){const want=r.fundamental?.[key];if(want==null)continue;if(q[key]==null){result.unavailable++;continue;}
 const relative=Math.abs(q[key]-want)/Math.abs(want),group=r.model+' '+key;result.count++;
 if(!result.maxima[group]||relative>result.maxima[group].relative)result.maxima[group]={relative,p:r.a,T:r.b};
 if(relative>2e-6)result.errors.push({model:r.model,key,p:r.a,T:r.b,relative});
 }}
fs.writeFileSync(process.argv[2]||new URL('../docs/transport-conformance-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
