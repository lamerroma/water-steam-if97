import test from 'node:test';
import assert from 'node:assert/strict';
import {chartDiagramPoint,chartDiagramDatasets,diagramPhaseColor} from '../src/diagram-chart-data.js';
const a={p:3,T:673.15,h:3231,s:6.9,x:null,phase:'пара'},b={p:.1,T:372.76,h:2500,s:6.9,x:.91,phase:'двофазна суміш'};
const cache={isobars:[{p:3,points:[a,null,b]}],dome:[[a,null],[b]]};
const choices=[[a,'A','history'],[b,'B','history']];const plan={connectHistory:true,excluded:[]};
test('Canvas coordinates keep canonical units and real positive pressure for log P–h',()=>{
 assert.deepEqual(chartDiagramPoint('phdiagram',a),{x:3231,y:3});
 assert.deepEqual(chartDiagramPoint('ts',a),{x:6.9,y:400});
 assert.deepEqual(chartDiagramPoint('hsdiagram',a),{x:6.9,y:3231});
 assert.ok(Number.isNaN(chartDiagramPoint('ts',null).y));
 assert.ok(Number.isNaN(chartDiagramPoint('phdiagram',{...a,p:0}).y));
});
test('Chart data preserves gaps, process endpoints, ideal/cold branches and journal order',()=>{
 const p={result:{inlet:a,outlet:b,ideal:{...b,h:2400},coldInlet:b,coldOutlet:a}};
 const ds=chartDiagramDatasets('phdiagram',cache,choices,plan,p,new Set([0]),['red'],1);
 assert.equal(ds[0].hidden,true);assert.equal(ds[0].spanGaps,false);assert.equal(ds[0].tension,0);assert.ok(Number.isNaN(ds[0].data[1].y));
 assert.deepEqual(ds.find(d=>d.role==='history').data,[{x:3231,y:3},{x:2500,y:.1}]);
 assert.equal(ds.find(d=>d.role==='process').arrows,true);assert.deepEqual(ds.find(d=>d.role==='ideal').borderDash,[6,4]);assert.equal(ds.find(d=>d.role==='cold').data.length,2);
 assert.equal(ds.at(-1).data[1].choiceIndex,1);assert.equal(ds.at(-1).pointBackgroundColor[1],'#f09a00');
 const filtered=chartDiagramDatasets('ts',cache,choices,{...plan,excluded:[a]},null,new Set(),['red'],null);
 assert.deepEqual(filtered.find(d=>d.role==='history').data,[{x:6.9,y:99.61000000000001}]);assert.equal(filtered.at(-1).data.length,2);
});
test('Phase colours distinguish liquid, vapor, wet steam and supercritical states',()=>{
 const states=[{...a,x:0,phase:'рідина'},a,b,{...a,p:25,T:700}];assert.equal(new Set(states.map(diagramPhaseColor)).size,4);
});
