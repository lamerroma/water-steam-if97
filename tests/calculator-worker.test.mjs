import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {initialize,calculate} from '../src/engine.js';
import {buildLibraryCycle,compareLibraryCycles} from '../src/cycle-library.js';
import {readProject} from '../src/project.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const source=await readFile(new URL('../assets/calculator-worker.js',import.meta.url),'utf8');
test('Built background kernel preserves all 20 modes for both water models',async()=>{
 const worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=data=>parentPort.postMessage(data);parentPort.on('message',data=>self.onmessage({data}));\n"+source,{eval:true});
 let id=0;
 const execute=(type,payload)=>new Promise((resolve,reject)=>{const onError=e=>{worker.off('message',onMessage);reject(e);};const onMessage=data=>{worker.off('error',onError);if(data.error)reject(Error(data.error));else resolve(data.result);};worker.once('error',onError);worker.once('message',onMessage);worker.postMessage({id:++id,type,payload});});
 try{
  const pairs={pt:['p','T'],ph:['p','h'],ps:['p','s'],hs:['h','s'],prho:['p','rho'],trho:['T','rho'],pv:['p','v'],pu:['p','u'],tv:['T','v'],tu:['T','u'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],th:['T','h'],ts:['T','s'],px:['p','x'],tx:['T','x'],satp:['p'],satt:['T']};
  let count=0;
  for(const model of ['IF97','IAPWS-95']){
   const vapor=calculate('pt',.1,500,model).state,mixture=calculate('px',.1,.4,model).state;
   for(const [mode,keys] of Object.entries(pairs)){
    const q=['px','tx','satp','satt'].includes(mode)?mixture:vapor,a=q[keys[0]],b=q[keys[1]];
    assert.deepEqual(await execute('calculate',{mode,a,b,model}),structuredClone(calculate(mode,a,b,model)),model+' '+mode);count++;
   }
  }
  assert.equal(count,40);
  for(const model of ['IF97','IAPWS-95'])for(const [a,b] of [[22.064,647.096],[100,623.16]])assert.deepEqual(await execute('calculate',{mode:'pt',a,b,model}),structuredClone(calculate('pt',a,b,model)));

  const config={kind:'otto',fluid:'air',model:'IDEAL-NASA7',p1:.1,T1:300,mass:1,ratio:8,heatMode:'heat',heat:600},cycle=await execute('library-cycle',{input:config});assert.deepEqual(cycle,structuredClone(buildLibraryCycle(config)));
  const comparison={kind:'pv',slots:[{name:'A',model:cycle.model,input:cycle.input},{name:'B',model:cycle.model,input:cycle.input}]};assert.deepEqual(await execute('cycle-comparison',{input:comparison}),structuredClone(compareLibraryCycles(comparison)));
  for(const kind of ['rankine','rankine-reheat']){const input={kind,fluid:'water',model:'IF97',mass:1,pLow:.01,pHigh:10,pReheat:2,Tsteam:773.15,Treheat:773.15,steamMode:'superheated'};assert.deepEqual(await execute('library-cycle',{input}),structuredClone(buildLibraryCycle(input)));}
  const machinery={kind:'rankine-reheat',fluid:'water',model:'IF97',mass:1,pLow:.01,pHigh:10,pReheat:2,Tsteam:773.15,Treheat:773.15,steamMode:'superheated',equipment:'actual',etaPump:.85,etaHP:.88,etaLP:.9};assert.deepEqual(await execute('library-cycle',{input:machinery}),structuredClone(buildLibraryCycle(machinery)));
  const anchor=calculate('pt',100,623.16).state;
  assert.deepEqual(await execute('calculate',{mode:'ph',a:100,b:anchor.h,model:'IF97'}),structuredClone(calculate('ph',100,anchor.h)));
  const project={format:'water-steam-if97',version:1,history:[{p:anchor.p,h:anchor.h,source:{mode:'pt',a:100,b:623.16}}],form:{mode:'satp',a:'10',b:'unused',ua:'bar',ub:'C',calculated:true}};
  const text=JSON.stringify(project);assert.deepEqual(await execute('project',{text}),structuredClone(readProject(text)));
  await assert.rejects(execute('calculate',{mode:'pt',a:-1,b:300,model:'IF97'}),/Тиск/);
  await assert.rejects(execute('project',{text:'{"format":"invalid","version":99}'}),/формат|версія/);
 }finally{await worker.terminate();}
});
