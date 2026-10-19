// Independent dimensional verification is performed by Python Decimal, not these conversions.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {initialize,calculate} from '../src/engine.js';
import {UI_UNIT_GROUPS,readUIUnits} from '../src/ui-quantities.js';
import {resultExportRows} from '../src/export.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const cases=[['pt',3,300],['pt',3,673.15],['pt',25,650],['pt',22.064,647.096],['pt',22.064,647.097],['pt',1,1200],['px',1,.5],['px',1,0],['satp',1],['pt',1,1500]];
const specs=[['mu','dynamicViscosity'],['nu','kinematicViscosity'],['diffusivity','kinematicViscosity'],['sigma','surfaceTension']],records=[];
for(const model of ['IF97','IAPWS-95'])for(const [mode,a,b] of cases){
 if(model==='IAPWS-95'&&b===1500){assert.throws(()=>calculate(mode,a,b,model),/1273 K/);continue;}
 if(model==='IAPWS-95'&&a===22.064&&b===647.096){assert.throws(()=>calculate(mode,a,b,model),/критична точка/);continue;}
 const result=calculate(mode,a,b,model),states=result.state?[['state',result.state]]:[['saturated_liquid',result.saturation.liquid],['saturated_vapor',result.saturation.vapor]];
 for(const system of ['si','english'])for(const [key,group] of specs)for(const unit of Object.keys(UI_UNIT_GROUPS[group]).filter(u=>u!=='auto')){
  const rows=resultExportRows(result,'kJ',null,system,readUIUnits({[group]:unit}));
  for(const [name,q] of states){const r=rows.find(r=>r[0]===name&&r[1]===key);records.push({model,mode,a,b:b??null,system,key,unit,canonical:q[key]??null,value:r[2],label:r[3]});}
 }
}
const dir='.release/steam97-p09';await mkdir(dir,{recursive:true});
const version=JSON.parse(await readFile('package.json')).version;await writeFile(dir+'/unit-values.json',JSON.stringify({version,records},null,2)+'\n');
const r=spawnSync(process.env.P09_PYTHON||'python3',['scripts/reference/transport_unit_reference.py',dir+'/unit-values.json'],{stdio:'inherit'});if(r.status!==0)throw Error('Independent conversion audit failed.');
