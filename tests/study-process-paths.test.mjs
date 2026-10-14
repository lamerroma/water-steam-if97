import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {initialize,calculate} from '../src/engine.js';import {solveCycle,CYCLE_DEFAULT} from '../src/cycle-study.js';import {solveNuclear,NPP_MSR_DEFAULT} from '../src/nuclear.js';import {buildStudyProcessPaths,studyProcessEdges,studyPathsCSV} from '../src/study-process-paths.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
for(const type of ['rankine','rankine-reheat','rankine-regen','brayton'])test(type+' paths preserve endpoints and isobaric/ideal invariants',async()=>{
 const q=solveCycle({...CYCLE_DEFAULT,type,...(type==='brayton'?{pHigh:8,pLow:.101325,Tmax:1400}:{})});const scene=await buildStudyProcessPaths(q);
 assert.equal(scene.paths.filter(p=>!p.reference).length,studyProcessEdges(q).length);assert.equal(scene.stats.gaps,0);assert.equal(scene.stats.limited,false);
 for(const p of scene.paths){assert.equal(p.points[0],q.states[p.from]);if(!p.reference)assert.equal(p.points.at(-1),q.states[p.to]);
  if(p.mode==='isobaric'){assert.ok(p.points.length>=17);for(const s of p.points)close(s.p,p.points[0].p);}
  if(p.mode==='isentropic')for(const s of p.points)close(s.s,p.points[0].s);
  if(p.type==='mixing')assert.equal(p.points.length,2);
 }
});
test('NPP separators stay schematic, drains conserve h, first loop and steam generator conserve p',async()=>{
 const q=solveNuclear(NPP_MSR_DEFAULT),scene=await buildStudyProcessPaths(q,{npp:true,kind:'hs'});assert.equal(scene.stats.gaps,0);
 for(const p of scene.paths){if(p.type==='separation'){assert.equal(p.mode,'schematic');assert.equal(p.points.length,2);}if(p.mode==='isenthalpic'){assert.ok(p.points.length>2);for(const s of p.points)close(s.h,p.points[0].h);}if(p.mode==='isobaric')for(const s of p.points)close(s.p,p.points[0].p);}
 assert.ok(studyPathsCSV(scene).includes('p_MPa_abs'));assert.ok(studyPathsCSV(scene).includes('isenthalpic'));
});
test('Boiler curve explicitly passes through both phase boundaries instead of cutting across the dome',async()=>{
 const q=solveCycle(CYCLE_DEFAULT),scene=await buildStudyProcessPaths(q),boiler=scene.paths.find(p=>p.from===1&&p.to===2&&!p.reference),sat=calculate('satp',q.input.pHigh).saturation;
 for(const end of [sat.liquid,sat.vapor])assert.ok(boiler.points.some(s=>Math.abs(s.h-end.h)<1e-6));
 const mid=boiler.points.find(s=>s.x>0&&s.x<1);assert.ok(mid);close(mid.T,sat.T);
});
test('Optional efficiency path is explicitly modeled and matches the selected machine law',async()=>{
 const q=solveCycle(CYCLE_DEFAULT),scene=await buildStudyProcessPaths(q,{equipment:'efficiency'});
 for(const p of scene.paths.filter(p=>p.mode==='efficiency-model'))for(const s of p.points.slice(1,-1)){const inlet=q.states[p.from],ideal=calculate('ps',s.p,inlet.s).state,eta=p.type==='compression'?q.input.etaC:q.input.etaT;close(s.h,inlet.h+(ideal.h-inlet.h)*(p.type==='compression'?1/eta:eta));}
 const defaultScene=await buildStudyProcessPaths(q);assert.ok(defaultScene.paths.filter(p=>p.type==='expansion'&&!p.reference).every(p=>p.mode==='schematic'));
});
test('Work is bounded and cancellation propagates',async()=>{
 const q=solveCycle(CYCLE_DEFAULT);const limited=await buildStudyProcessPaths(q,{budget:10});assert.ok(limited.stats.limited);assert.ok(limited.stats.evaluations<=10);
 await assert.rejects(()=>buildStudyProcessPaths(q,{yieldFrame:()=>{const e=Error('cancel');e.name='AbortError';throw e;}}),/cancel/);
});
test('Ideal efficiency draws the actual isentrope without a duplicate reference',async()=>{
 const q=solveCycle({...CYCLE_DEFAULT,etaT:1,etaC:1}),scene=await buildStudyProcessPaths(q);assert.equal(scene.paths.some(p=>p.reference),false);assert.equal(scene.paths.filter(p=>p.mode==='isentropic').length,2);
});
test('IAPWS-95 and a supercritical boiler retain model-consistent paths',async()=>{
 for(const [model,pHigh] of [['IAPWS-95',10],['IF97',30]]){
  const q=solveCycle({...CYCLE_DEFAULT,pHigh,Tmax:873.15},model),scene=await buildStudyProcessPaths(q,{equipment:'efficiency'});assert.equal(scene.stats.gaps,0);assert.equal(scene.stats.limited,false);
  for(const p of scene.paths.filter(p=>p.mode==='isobaric'))for(const s of p.points){const expected=calculate('ph',s.p,s.h,model).state;close(s.s,expected.s,2e-5);close(s.T,expected.T,2e-4);}
 }
});
test('IAPWS-95 low-pressure compressed-liquid inverse brackets are valid at saturation endpoints',()=>{
 for(const p of [.015399265258760685,.02371373705398027,.03651741272171407,.056234132513676385]){
  const forward=calculate('pt',p,318.96,'IAPWS-95').state;
  for(const [mode,key] of [['ps','s'],['ph','h'],['pu','u']]){const inverse=calculate(mode,p,forward[key],'IAPWS-95').state;close(inverse.T,forward.T,1e-6);close(inverse[key],forward[key],1e-7);}
 }
});
