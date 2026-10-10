import fs from 'node:fs';
import {initializeHumidAir} from '../src/humid-air-scientific.js';import {realGasState} from '../src/real-gases.js';
await initializeHumidAir(fs.readFileSync(new URL('../vendor/coolprop.wasm',import.meta.url)));
const data=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/nist-gases.json',import.meta.url))),rows=[];
for(const r of data.states){try{const q=realGasState(r.id,r.p,r.T),errors={};for(const k of ['rho','cp','cv','w','mu','lambda','h','s'])if(r[k]!=null&&q[k]!=null)errors[k]=Math.abs(q[k]-r[k])/Math.max(1e-30,Math.abs(r[k]));rows.push({id:r.id,p:r.p,T:r.T,phase:q.phase,errors});}catch(e){rows.push({id:r.id,p:r.p,T:r.T,error:e.message});}}
fs.writeFileSync(new URL('../docs/NIST_GAS_AUDIT.json',import.meta.url),JSON.stringify({source:data.source,rows},null,2)+'\n');
for(const id of new Set(rows.map(r=>r.id))){const rs=rows.filter(r=>r.id===id),max={};for(const r of rs)for(const [k,v] of Object.entries(r.errors||{}))max[k]=Math.max(max[k]||0,v);console.log(id,JSON.stringify(max));}
