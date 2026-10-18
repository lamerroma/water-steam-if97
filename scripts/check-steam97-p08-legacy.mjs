import {execFileSync} from 'node:child_process';
import {writeFile,unlink,readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initialize,calculate} from '../src/engine.js';
import {exportCSV} from '../src/export.js';
import {processCSV} from '../src/project.js';
import {diagramCSV} from '../src/diagram-workspace.js';
import {turbine,flash} from '../src/processes.js';
const baseline='133a58918162f4572174a7f6b2fa44be5f4b133a',tmp=[];
try{
 for(const file of ['export','project','diagram-workspace']){const name=new URL('../src/.p08-original-'+file+'.mjs',import.meta.url);await writeFile(name,execFileSync('git',['show',baseline+':src/'+file+'.js']));tmp.push(name);}
 const old=await import('../src/.p08-original-export.mjs'),op=await import('../src/.p08-original-project.mjs'),od=await import('../src/.p08-original-diagram-workspace.mjs');
 await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));let checks=0;
 for(const model of ['IF97','IAPWS-95'])for(const system of ['si','english'])for(const energy of ['J','kJ'])for(const result of [calculate('pt',3,300,model),calculate('px',20,.5,model),calculate('satp',1,undefined,model)]){assert.equal(exportCSV(result,energy,{p:.101325,T:298.15},system),old.exportCSV(result,energy,{p:.101325,T:298.15},system));checks++;}
 for(const system of ['si','english'])for(const [kind,result] of [['turbine',turbine(3,673.15,.1,.85,1)],['flash',flash(3,473.15,.1,1,2)]]){assert.equal(processCSV(kind,result,system),op.processCSV(kind,result,system));checks++;}
 const q=calculate('pt',3,300).state;for(const system of ['si','english']){assert.equal(diagramCSV([[q,'=Тест;"','history']],system),od.diagramCSV([[q,'=Тест;"','history']],system));checks++;}
 await mkdir('.release/steam97-p08',{recursive:true});await writeFile('.release/steam97-p08/legacy-csv.json',JSON.stringify({status:'passed',checks,baseline,meaning:'Byte-for-byte comparison against original baseline serializers on identical canonical results.'},null,2)+'\n');console.log('Legacy CSV identical:',checks);
}finally{for(const f of tmp)await unlink(f);}
