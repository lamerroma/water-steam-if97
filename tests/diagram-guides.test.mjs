import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize,calculate,TC} from '../src/engine.js';
import {parseDiagramGuideValues,readDiagramTools,diagramIsotherm,diagramQualityLines,diagramRegionAnnotations,diagramGuideLabel} from '../src/diagram-guides.js';
import {readDiagramWorkspace,diagramWorkspaceSnapshot} from '../src/diagram-workspace.js';
import {chartDiagramDatasets} from '../src/diagram-chart-data.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b}`);
test('Guide input accepts decimal commas and temperature units, bounds work and lists stay bounded',()=>{
 assert.deepEqual(parseDiagramGuideValues('0,1; 0.5; 0,1','quality'),[.1,.5]);
 assert.deepEqual(parseDiagramGuideValues('212; 392','temperature','F'),[373.15,473.15]);
 assert.deepEqual(parseDiagramGuideValues('373,15 473.15','temperature','K'),[373.15,473.15]);
 for(const value of ['','0;1','-0.1','.1;.2;.3;.4;.5;.6;.7;.8;.9;.95','<script>'])assert.throws(()=>parseDiagramGuideValues(value,'quality'));
 assert.throws(()=>parseDiagramGuideValues('801','temperature'));assert.throws(()=>parseDiagramGuideValues('0','temperature','C','IAPWS-95'));
});
test('Isotherms include both saturated endpoints and break unsupported pressure samples',async()=>{
 const T=473.15,sat=calculate('satt',T).saturation;let yields=0;const line=await diagramIsotherm(T,'IF97',async()=>yields++);
 assert.ok(yields>=4);assert.ok(line.points.length>=80);assert.ok(line.points.filter(Boolean).every(q=>Math.abs(q.T-T)<1e-6));
 const i=line.points.findIndex(q=>q?.x===1);assert.ok(i>=0);assert.equal(line.points[i+1].x,0);close(line.points[i].p,sat.p);close(line.points[i+1].p,sat.p);
 close(line.points[i].h-line.points[i+1].h,T*(line.points[i].s-line.points[i+1].s),.01);
 const low=await diagramIsotherm(273.16,'IAPWS-95');assert.ok(low.points.includes(null));
 const above=await diagramIsotherm(700);assert.ok(above.points.every(q=>q?.x==null));
});
test('Dryness lines match engine equilibrium mixtures and critical samples are excluded',()=>{
 const temperatures=[300,400,600,TC],sats=temperatures.map(T=>calculate('satt',T).saturation),cache={dome:[sats.map(q=>q.liquid),sats.map(q=>q.vapor)]};
 const [line]=diagramQualityLines(cache,[.37]);assert.equal(line.points.at(-1),null);
 for(let i=0;i<3;i++){const ref=calculate('tx',temperatures[i],.37).state;close(line.points[i].h,ref.h);close(line.points[i].s,ref.s);close(line.points[i].p,ref.p);}
 const datasets=chartDiagramDatasets('phdiagram',{...cache,isobars:[]},[],{connectHistory:false},null,new Set(),[],null,{qualities:[line]});assert.equal(datasets.find(d=>d.role==='quality').spanGaps,false);
});
test('Guide settings survive old and new JSON projects and reject malformed imported data',()=>{
 const old=readDiagramWorkspace(null,[]);assert.equal(old.tools.isotherms,false);old.tools.temperatures=[300,500];old.tools.isotherms=true;old.tools.regions=false;
 const snap=diagramWorkspaceSnapshot(old,[]);assert.deepEqual(readDiagramWorkspace(JSON.parse(JSON.stringify(snap)),[]),old);
 for(const tools of [{regions:'false'},{temperatures:[NaN]},{dryness:[1]},{temperatureUnit:'psi'},{dryness:[.1,.1]}])assert.throws(()=>readDiagramTools(tools));
});
test('Region labels use states of the selected model; guide labels disappear outside the viewport',()=>{
 const sat=calculate('satt',TC).saturation,cache={dome:[[sat.liquid],[sat.vapor]]};const annotations=diagramRegionAnnotations(cache);
 assert.equal(annotations.length,5);assert.equal(annotations.find(a=>a.critical).state.p,22.064);assert.ok(annotations.filter(a=>!a.critical).every(a=>a.state.model==='IF97'));
 const line={points:[calculate('pt',3,400).state]};assert.equal(diagramGuideLabel('ts',line,{xmin:20,xmax:30,ymin:0,ymax:800}),null);
});
