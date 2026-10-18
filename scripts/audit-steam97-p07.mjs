import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialize,calculate} from '../src/engine.js';
import {diagramData} from '../src/processes.js';
import {diagramAxes,diagramPoint} from '../src/diagram-coordinates.js';
import {chartDiagramPoint} from '../src/diagram-chart-data.js';
import {diagramQuantity} from '../src/diagram-units.js';
import {diagramSeriesPath} from '../src/diagram-series.js';
import {assessDiagramState,assessDiagramCurve} from './steam97-p07-common.mjs';
await initialize(await readFile('vendor/seuif97_bg.wasm'));const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile('tests/fixtures/steam97-p07-reference.json'),fixture=JSON.parse(bytes),records=[],caches=new Map();
for(const c of fixture.records){const row={id:c.id,model:c.model,checks:[]};try{
 const q=calculate(c.mode,c.a,c.b,c.model).state;row.checks.push(...assessDiagramState(q,c.expected,fixture.policy));
 for(const kind of ['ts','hsdiagram','phdiagram']){
  const p=diagramPoint(kind,q),canvas=chartDiagramPoint(kind,q),expected={x:kind==='phdiagram'?c.expected.h:c.expected.s,y:kind==='ts'?c.expected.T-273.15:kind==='phdiagram'?Math.log10(c.expected.p):c.expected.h};
  for(const key of ['x','y']){const tolerance=key==='x'&&kind!=='phdiagram'?fixture.policy.s_absolute:kind==='phdiagram'&&key==='y'?1e-5:Math.max(2e-5,Math.abs(expected[key])*fixture.policy.relative);row.checks.push({key:kind+'.'+key,actual:p[key],expected:expected[key],tolerance,passed:Math.abs(p[key]-expected[key])<=tolerance});}
  row.checks.push({key:kind+'.canvas',passed:Math.abs(canvas.x-p.x)<1e-10&&Math.abs((kind==='phdiagram'?Math.log10(canvas.y):canvas.y)-p.y)<1e-10});
 }
 const lb=.45359237,btu=1055.05585262,psi=lb*9.80665/(.3048/12)**2;
 for(const [key,value,wanted]of [['p',q.p,c.expected.p*1e6/psi],['T',q.T-273.15,(c.expected.T-273.15)*1.8+32],['h',q.h,c.expected.h*1000*lb/btu],['s',q.s,c.expected.s*1000*lb/btu/1.8]]){const [v]=diagramQuantity(key,value,'english');row.checks.push({key:'English.'+key,actual:v,expected:wanted,passed:Math.abs(v-wanted)<=Math.max(2e-5,Math.abs(wanted)*fixture.policy.relative)});}
 if(c.background){if(!caches.has(c.model))caches.set(c.model,diagramData(c.model));const cache=caches.get(c.model),b=c.background,state=b.kind==='dome'?cache.dome[b.branch][b.slot]:cache.isobars.find(l=>l.p===b.p).points.find(q=>q&&Math.abs(q.T-b.T)<1e-7);row.background=assessDiagramState(state,c.expected,fixture.policy);row.checks.push(...row.background.map(c=>({...c,key:'background.'+c.key})));}
 row.passed=row.checks.every(c=>c.passed);
 }catch(e){row.passed=false;row.error=e.message;}records.push(row);
}
for(const c of fixture.curves)for(const width of [320,1280]){
 const range=diagramAxes(c.kind).initial,height=600,path=diagramSeriesPath(c.kind,c.states,'spline',{range,width,height}),error=assessDiagramCurve(path.points,c.expected,range,width,height);
 records.push({id:`spline-${c.kind}-${c.closed?'closed':'open'}-${width}`,kind:'drawing',vertices:path.points.length,limited:path.limited,error,tolerance:fixture.policy.spline_pixel,passed:!path.limited&&error<=fixture.policy.spline_pixel});
}
const sources=Object.fromEntries(await Promise.all((await readdir('src')).filter(p=>p.endsWith('.js')).sort().map(async p=>[p,sha(await readFile('src/'+p))]))),summary={queries:records.length,passed:records.filter(r=>r.passed).length,failed:records.filter(r=>!r.passed).length,states:fixture.records.length,background_controls:fixture.records.filter(c=>c.background).length,drawing_controls:fixture.curves.length*2};
await mkdir('.release/steam97-p07',{recursive:true});await writeFile('.release/steam97-p07/numeric.json',JSON.stringify({summary,sources,reference_sha256:sha(bytes),policy:fixture.policy,records},null,2)+'\n');console.log(JSON.stringify({summary,failures:records.filter(r=>!r.passed)},null,2));process.exitCode=summary.failed?1:0;
