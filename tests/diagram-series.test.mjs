import test from 'node:test';
import assert from 'node:assert/strict';
import {readDiagramWorkspace,syncDiagramWorkspace,diagramWorkspaceSnapshot,diagramCSV,diagramReport} from '../src/diagram-workspace.js';
import {diagramChoices,setDiagramPoints,saveDiagramSeries,diagramSeriesPath} from '../src/diagram-series.js';
import {chartDiagramDatasets} from '../src/diagram-chart-data.js';
import {diagramViewport} from '../src/diagram-coordinates.js';
const states=[{model:'IF97',p:.1,T:373,h:2600,s:7,x:1},{model:'IF97',p:3,T:700,h:3300,s:6.9},{model:'IF97',p:10,T:800,h:3400,s:6.5},{model:'IAPWS-95',p:1,T:600,h:3000,s:7.1}];
const plan=()=>syncDiagramWorkspace(readDiagramWorkspace(null,states),states);
test('Labeled point selection, named line/spline edits and styles round-trip through native references',()=>{
 const p=plan();setDiagramPoints(p,states,'IF97','4, 3, 2','A; B; C');let e=diagramChoices(p,states,'IF97');assert.deepEqual(e.map(x=>x[1]),['A','B','C']);
 const i=saveDiagramSeries(p,'IF97',null,{name:'Цикл <α>',kind:'spline',labels:'A; B; C; A'},e);saveDiagramSeries(p,'IF97',i,{name:'Змінено',kind:'line',labels:'C; B'},e);
 p.drawingStyle={radius:9,pointColor:'#112233',width:3.5,lineColor:'#abcdef'};
 p.views['IF97:hsdiagram']={range:diagramViewport('hsdiagram','vapor'),preset:'vapor',hiddenIsobars:[0,2],point:states[0],processIndex:null};
 const raw=diagramWorkspaceSnapshot(p,states),r=readDiagramWorkspace(JSON.parse(JSON.stringify(raw)),states);
 assert.deepEqual(r,p);assert.equal(r.series[0].points[0],states[2]);assert.equal(r.series[0].name,'Змінено');assert.deepEqual(r.views['IF97:hsdiagram'].hiddenIsobars,[0,2]);
 const csv=diagramCSV(e,'english','kJ',{...p,exportModel:'IF97'}),html=diagramReport('Title','<svg/>',e,'si','kJ','',null,{plan:p,model:'IF97'});
 assert.ok(csv.includes('not a thermodynamic path'));assert.ok(csv.includes('C → B'));assert.ok(html.includes('Іменовані серії'));assert.ok(html.includes('Змінено'));
});
test('Invalid labels, cross-model IDs and removing used points fail atomically',()=>{
 const p=plan(),before=JSON.stringify(diagramWorkspaceSnapshot(p,states));
 for(const [ids,labels]of [['4;3','A'],['4;4','A;B'],['4;3','A;A'],['0','A'],['1','A'],['4.5','A'],['4',' ']]){assert.throws(()=>setDiagramPoints(p,states,'IF97',ids,labels));assert.equal(JSON.stringify(diagramWorkspaceSnapshot(p,states)),before);}
 setDiagramPoints(p,states,'IF97','4;3;2','A;B;C');const e=diagramChoices(p,states,'IF97');saveDiagramSeries(p,'IF97',null,{name:'One',kind:'line',labels:'A;B'},e);
 const saved=JSON.stringify(diagramWorkspaceSnapshot(p,states));assert.throws(()=>setDiagramPoints(p,states,'IF97','2','C'));assert.equal(JSON.stringify(diagramWorkspaceSnapshot(p,states)),saved);
 for(const input of [{name:'Two',kind:'spline',labels:'A;B'}, {name:'One',kind:'line',labels:'A;C'}, {name:'Two',kind:'line',labels:'A;missing'}])assert.throws(()=>saveDiagramSeries(p,'IF97',null,input,e));
});
test('History pruning retains incomplete series for repair and separates formulations',()=>{
 const p=plan();setDiagramPoints(p,states,'IF97','4;3;2','A;B;C');saveDiagramSeries(p,'IF97',null,{name:'Curve',kind:'spline',labels:'A;B;C'},diagramChoices(p,states,'IF97'));
 const smaller=[states[0],states[3]];syncDiagramWorkspace(p,smaller);assert.equal(p.series[0].points.length,1);const r=readDiagramWorkspace(diagramWorkspaceSnapshot(p,smaller),smaller);assert.equal(r.series[0].name,'Curve');
 const cache={isobars:[],dome:[]};assert.equal(chartDiagramDatasets('ts',cache,diagramChoices(r,smaller,'IF97'),r,null,new Set(),[],null).filter(d=>d.role==='series').length,0);
 assert.equal(diagramChoices(r,smaller,'IAPWS-95').length,1);
});
test('Importer rejects forged indices, styles, series and viewport variants',()=>{
 for(const d of [{pointSets:{other:[]}}, {pointSets:{IF97:[{historyIndex:3,label:'A'}]}}, {series:[{name:'A',model:'IF97',kind:'spline',points:[7]}]}, {drawingStyle:{pointColor:'url(javascript:x)'}}, {drawingStyle:{radius:Infinity}}, {drawingStyle:{width:0}}, {views:{'IF97:ts':{range:diagramViewport('ts'),preset:'vapor'}}}, {views:{'IF97:hsdiagram':{range:diagramViewport('hsdiagram'),hiddenIsobars:[7]}}}])assert.throws(()=>readDiagramWorkspace(d,states));
});
test('One geometry feeds all renderers, preserves anchors and handles loops and repeated points',()=>{
 for(const kind of ['ts','hsdiagram','phdiagram']){
  const p=plan();setDiagramPoints(p,states,'IF97','4;3;2','A;B;C');saveDiagramSeries(p,'IF97',null,{name:'Cycle',kind:'spline',labels:'A;B;C;A'},diagramChoices(p,states,'IF97'));
  const g=diagramSeriesPath(kind,p.series[0].points,'spline');assert.equal(g.limited,false);assert.ok(g.points.length>4);assert.ok(g.points.length<=4096);assert.deepEqual(g.points[0],g.points.at(-1));
  const ds=chartDiagramDatasets(kind,{isobars:[],dome:[]},diagramChoices(p,states,'IF97'),p,null,new Set(),[],null),line=ds.find(d=>d.role==='series');assert.equal(line.tension,0);assert.equal(line.seriesName,'Cycle');assert.ok(line.data.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  const duplicate=diagramSeriesPath(kind,[states[0],states[0],states[1],states[2]],'spline');assert.ok(duplicate.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
});
test('Extreme spline detail stays bounded and preserves every original anchor',()=>{
 const input=Array.from({length:60},(_,i)=>states[i%3]),path=diagramSeriesPath('hsdiagram',input,'spline',{width:1e6,height:1e6});
 assert.equal(path.limited,true);assert.ok(path.points.length<=4096);
 for(const q of input)assert.ok(path.points.some(p=>p.x===q.s&&p.y===q.h));
});
