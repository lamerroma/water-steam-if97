import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {initializeWaterHeos} from '../src/water-heos.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {createCalculationRequest} from '../src/calculation-protocol.js';
import {waterCalculationRuntime} from '../src/water-models.js';
const reference=JSON.parse(await readFile(new URL('fixtures/engineering-reference.json',import.meta.url),'utf8'));
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
await initializeWaterHeos(await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)));
const near=(a,b,t=2e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} versus ${b}`);
async function run(method,payload){const request=createCalculationRequest({id:1,moduleId:'workflows',methodId:method,payload});assert.equal(waterCalculationRuntime(request),payload.model==='HEOS::Water'?'heos':'default');const reply=await dispatchCalculation(request);assert.equal(reply.status,'ok',JSON.stringify(reply.error));assert.deepEqual(structuredClone(reply),reply);return reply.result;}
for(const model of ['IF97','IAPWS-95','HEOS::Water']){
 test(`Engineering Worker: independent controls, balances and explicit model / ${model}`,async()=>{
  for(const record of reference.records){const r=await run('engineering',{kind:record.kind,args:record.args,model});
   for(const key of ['inlet','ideal','outlet','coldInlet','coldOutlet'])if(record.expected[key]){
    assert.equal(r[key].model||'IF97',model);
    if(model!=='IF97')for(const [k,v] of Object.entries(record.expected[key]))near(r[key][k==='P'?'p':k],v,k==='s'?2e-8:2e-6);
   }
   if(model!=='IF97')for(const key of ['power','work','flow','coldFlow','eta'])if(key in record.expected)near(r[key],record.expected[key]);
   near(r.power,r.flow*(r.ideal?r.outlet.h-r.inlet.h:r.inlet.h-r.outlet.h),1e-7);
   if(r.ideal){near(r.ideal.s,r.inlet.s,1e-8);near(r.eta,(r.ideal.h-r.inlet.h)/r.work,1e-8);}
   else near(r.power,r.coldFlow*(r.coldOutlet.h-r.coldInlet.h),1e-7);
  }
 });
 test(`Diagram Worker: base grid, independent labels, isotherms, gaps and bounded refinement / ${model}`,async()=>{
  const base=await run('diagram-base',{model});assert.equal(base.dome[0].length,181);assert.equal(base.dome[1].length,181);assert.equal(base.isobars.length,7);
  if(model!=='IF97')for(const expected of reference.diagramAnnotations){const q=base.annotations.find(a=>a.state.p===expected.P&&a.state.T===expected.T)?.state;assert.ok(q);for(const key of ['h','rho','s'])near(q[key],expected[key],key==='s'?2e-8:2e-6);}
  const line=await run('diagram-isotherm',{T:473.15,model});assert.ok(line.points.filter(Boolean).every(q=>Math.abs(q.T-473.15)<1e-7));assert.equal(line.points.filter(q=>q?.x===0||q?.x===1).length,2);
  const pairs=[300,473.15,600].map(T=>calculate('satt',T,undefined,model).saturation);
  const cache={dome:[pairs.map(q=>q.liquid),pairs.map(q=>q.vapor)],isobars:[{p:1,points:[null,pairs[0].liquid,null]}]};
  const scene=await run('diagram-refine',{cache,isotherms:[],process:null,kind:'phdiagram',range:{xmin:0,xmax:3500,ymin:-3,ymax:2},size:{width:800,height:500},model,hidden:[0],dryness:[.3]});
  assert.ok(scene.stats.evaluations<=scene.stats.budget);assert.deepEqual(scene.cache.isobars[0].points,cache.isobars[0].points);
  assert.equal(scene.cache.dome[0].length,scene.cache.dome[1].length);
  for(const q of scene.qualities[0].points.filter(Boolean)){assert.equal(q.model,model);assert.equal(q.x,.3);}
 });
}
test('Auxiliary adapters reject wrong models, process modes and malformed argument lists',async()=>{
 for(const [method,payload] of [['diagram-base',{model:'unknown'}],['engineering',{kind:'unknown',args:[],model:'IF97'}],['engineering',{kind:'pump',args:[.1,300,1,.8],model:'IF97'}]]){
  const reply=await dispatchCalculation(createCalculationRequest({id:1,moduleId:'workflows',methodId:method,payload}));assert.equal(reply.status,'error');
 }
});
