import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {refineDiagramSamples,refineDiagramScene,diagramProcessDescription} from '../src/diagram-refinement.js';
import {diagramIsotherm} from '../src/diagram-guides.js';
import {turbine,throttle} from '../src/processes.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const range={xmin:0,xmax:1,ymin:0,ymax:1};
const config={parameter:q=>q?.x,evaluate:x=>({x,y:x*x}),project:q=>q,range,width:600,height:400};
test('Adaptive samples follow the function with greater detail at larger screen scale',async()=>{
 const seed=[{x:0,y:0},{x:1,y:1}];
 const small=await refineDiagramSamples(seed,{...config,width:40,height:30});const large=await refineDiagramSamples(seed,config);
 assert.ok(large.points.length>small.points.length);assert.equal(large.points[0],seed[0]);assert.equal(large.points.at(-1),seed[1]);
 for(const q of large.points)assert.equal(q.y,q.x*q.x);
 for(let i=1;i<large.points.length;i++){const a=large.points[i-1],b=large.points[i],mid=(a.x+b.x)/2;assert.ok(Math.abs(mid*mid-(a.y+b.y)/2)*400<1);}
});
test('Known gaps and failures remain gaps, offscreen curves do not cost evaluations',async()=>{
 const a={x:0,y:0},b={x:1,y:1};const gap=await refineDiagramSamples([a,null,b],config);assert.deepEqual(gap.points,[a,null,b]);assert.equal(gap.evaluations,0);
 const failed=await refineDiagramSamples([a,b],{...config,evaluate:()=>{throw Error('domain')}});assert.deepEqual(failed.points,[a,null,b]);
 const outside=await refineDiagramSamples([a,b],{...config,range:{xmin:3,xmax:4,ymin:3,ymax:4}});assert.equal(outside.evaluations,0);
});
test('Work is bounded and cancellation propagates without committing a partial scene',async()=>{
 const limited=await refineDiagramSamples([{x:0,y:0},{x:1,y:1}],{...config,budget:2});assert.ok(limited.limited);assert.equal(limited.evaluations,2);
 await assert.rejects(()=>refineDiagramSamples([{x:0,y:0},{x:1,y:1}],{...config,tolerance:1e-8,yieldFrame:()=>{throw Error('cancelled')}}),/cancelled/);
});
const temperatures=[300,400,500,600,647.096],sats=temperatures.map(T=>calculate('satt',T).saturation);
const cache={dome:[sats.map(q=>q.liquid),sats.map(q=>q.vapor)],isobars:[]};
test('Refined thermodynamic samples stay on saturation, isotherms and equilibrium mixtures',async()=>{
 const line=await diagramIsotherm(473.15);
 const scene=await refineDiagramScene(cache,[line],null,'hsdiagram',{xmin:0,xmax:11,ymin:0,ymax:4500},{width:900,height:600},'IF97',new Set(),[.3],()=>Promise.resolve());
 assert.ok(scene.cache.dome[0].length>cache.dome[0].length);assert.equal(scene.cache.dome[0].length,scene.cache.dome[1].length);
 for(let i=0;i<scene.cache.dome[0].length;i++){const a=scene.cache.dome[0][i],b=scene.cache.dome[1][i],q=scene.qualities[0].points[i];if(q){assert.equal(a.T,b.T);assert.ok(Math.abs(q.h-(a.h+.3*(b.h-a.h)))<1e-8);}}
 assert.ok(scene.isotherms[0].points.filter(Boolean).every(q=>Math.abs(q.T-473.15)<1e-6));
 const endpoints=scene.isotherms[0].points.filter(q=>q?.x===0||q?.x===1);assert.equal(endpoints.length,2);
 assert.ok(scene.stats.evaluations<=3600);
});
test('Process curves calculate only defined invariants; turbine actual path stays unspecified',async()=>{
 const view={xmin:0,xmax:4500,ymin:-3,ymax:2},size={width:800,height:500},empty={dome:[[],[]],isobars:[]};
 const t={result:turbine(3,673.15,.1,.85)};const scene=await refineDiagramScene(empty,[],t,'phdiagram',view,size,'IF97',new Set(),[],()=>Promise.resolve());
 assert.ok(scene.paths.ideal.length>2);assert.equal(scene.paths.process,undefined);assert.equal(scene.paths.ideal[0],t.result.inlet);assert.equal(scene.paths.ideal.at(-1),t.result.ideal);
 for(const q of scene.paths.ideal.filter(Boolean))assert.ok(Math.abs(q.s-t.result.inlet.s)<1e-5);
 const f={result:throttle(1,.1,.1)};const throttled=await refineDiagramScene(empty,[],f,'ts',{xmin:0,xmax:10,ymin:0,ymax:400},size,'IF97',new Set(),[],()=>Promise.resolve());
 assert.ok(throttled.paths.process.length>2);for(const q of throttled.paths.process.filter(Boolean))assert.ok(Math.abs(q.h-f.result.inlet.h)<1e-5);
 assert.ok(diagramProcessDescription(t).includes('не проміжний шлях'));assert.ok(diagramProcessDescription(f).includes('h = const'));
});
