import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialize,calculate} from '../src/engine.js';
import {tabularDocument,resultTabular,historyTabular,saturationTabular,processTabular,diagramTabular,batchTabular} from '../src/tabular-data.js';
import {writeTabular} from '../src/spreadsheet.js';
import {saturationGrid} from '../src/saturation-grid.js';
import {turbine,flash} from '../src/processes.js';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname),dir=path.resolve(process.env.P08_AUDIT_DIR||'.release/steam97-p08/files');
await mkdir(dir,{recursive:true});await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version;
const build=JSON.parse((await readFile(new URL('../service-worker.js',import.meta.url),'utf8')).match(/const BUILD=(\{[^;]+\});/)[1]);
if(build.version!==version)throw Error('Build the current release before auditing exports.');
const context={appVersion:version,buildId:build.id,model:'IF97',system:'si',energy:'kJ',p0:.101325,T0:298.15};
const cases=[];
for(const model of ['IF97','IAPWS-95'])for(const [tag,mode,a,b] of [['liquid','pt',3,300],['region3','pt',25,650],['wet','px',20,.5],['near-critical','tx',647.0959,1]]){
 cases.push({id:model+'-'+tag,document:resultTabular(calculate(mode,a,b,model),{...context,model})});
}
cases.push({id:'hot-region5',document:resultTabular(calculate('pt',30,1500),context)});
cases.push({id:'critical',document:resultTabular(calculate('pt',22.064,647.096),context)});
const q=calculate('pt',3,673.15).state,wet=calculate('px',1,.5).state;
cases.push({id:'history-unicode-formula-text',document:historyTabular([{...q,name:'=SUM(A1:A2) Україна; "тест"\nновий рядок'},{...wet,name:'@пар'}],context)});
for(const system of ['si','english']){
 cases.push({id:'state-'+system+'-J',document:resultTabular({state:q},{...context,system,energy:'J'})});
 cases.push({id:'saturation-'+system,document:saturationTabular([...saturationGrid({basis:'temperature',unit:'K',start:640,end:647,step:1}),{input:700,error:'Недоступно; "test"'}],'IF97',{...context,system,input_basis:'temperature',input_unit:'K'})});
 for(const [kind,r] of [['turbine',turbine(3,673.15,.1,.85,1)],['flash',flash(3,473.15,.1,1,2)]])cases.push({id:kind+'-'+system,document:processTabular(kind,r,{...context,system})});
}
cases.push({id:'diagram-series',document:diagramTabular([[q,'А','history'],[wet,'Б','history']],{excluded:[],series:[{name:'=1+2',model:'IF97',kind:'line',points:[q,wet]}],drawingStyle:{radius:5,pointColor:'#123456',width:2,lineColor:'#abcdef'}},context)});
cases.push({id:'batch-errors',document:batchTabular([{input:{name:'-text'},result:{state:q}},{input:{name:'error'},error:'No state'}],context)});
cases.push({id:'text-types',document:tabularDocument('text',[{name:'Україна',rows:[['text','value'],...['=1+1','+1','-1','@SUM(A1)','\t=1+1','00123','1e10','<xml>&"','рядок\nдругий'].map(x=>[x,x]),['zero',0],['negative',-1.25],['boolean',true],['unavailable',null]]}],context)});
cases.push({id:'long-unicode',document:tabularDocument('text',[{name:'Unicode',rows:[['long Unicode','Україна '.repeat(2048)]]}],context)});
const files=[],rejections=[];
for(const c of cases)for(const format of ['xlsx','ods','xls','csv']){
 if(c.id==='long-unicode'&&format==='xls'){
  try{writeTabular(c.document,format);throw Error('Expected the documented XLS text limit.');}catch(e){if(!e.message.includes('4000'))throw e;rejections.push({id:c.id,format,reason:e.message});}continue;
 }
 const content=writeTabular(c.document,format),file=path.join(dir,c.id+'.'+format);await writeFile(file,content);
 files.push({id:c.id,format,file,sha256:createHash('sha256').update(content).digest('hex'),document:c.document});
}
const manifest=path.join(dir,'manifest.json');await writeFile(manifest,JSON.stringify({version,files,rejections},null,2)+'\n');
const run=spawnSync(process.env.P08_PYTHON||'python3',[path.join(root,'scripts/reference/spreadsheet_readers.py'),manifest],{encoding:'utf8',env:process.env,timeout:120000});
process.stdout.write(run.stdout);process.stderr.write(run.stderr);if(run.status!==0)process.exitCode=run.status||1;
