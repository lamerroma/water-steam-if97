import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {calculateGasTable} from '../src/gas-dissociation.js';
import {bswComposition} from '../src/gas-bsw2003.js';
const dir='.release/steam97-p04';await mkdir(dir,{recursive:true});
const version=JSON.parse(await readFile('package.json')).version,options={dissociation:true,combustion:'complete-air',excessAirLambda:1.2};
const mixtures=[{N2:.73,CO2:.1,H2O:.12,O2:.05},{N2:.8,H2O:.15,O2:.05},{N2:.75,CO2:.2,O2:.05},{N2:.7,O2:.01,CO2:.09,H2O:.2},{N2:.7,O2:.1,CO2:.1,H2O:.08,Ar:.01,Ne:.005,SO2:.005}];
const records=[];let inversions=0;
for(const [id,mole] of mixtures.entries())for(const basis of ['mole','mass'])for(const T of [1200,1200.00001,1400,1600,1800,1999.99999,2000])for(const p of [.01,.101325,1,5]){
 const fractions=basis==='mass'?bswComposition(mole).mass:mole,result=calculateGasTable('pt',p,T,fractions,basis,options);
 records.push({id:`${id}/${basis}/${T}/${p}`,p,T,fractions,basis,result});
 if(p===1)for(const mode of ['ph','ps']){const q=calculateGasTable(mode,p,result[mode==='ph'?'h':'s'],fractions,basis,options);assert.ok(Math.abs(q.T-T)<2e-9);inversions++;}
}
await writeFile(dir+'/values.json',JSON.stringify({version,records},null,2)+'\n');
const reference=spawnSync(process.env.P04_PYTHON||'python3',['scripts/reference/gas_dissociation_reference.py',dir+'/values.json'],{encoding:'utf8',timeout:120000});if(reference.status!==0)throw Error(reference.stderr||reference.stdout);
const report={status:'passed',version,cases:records.length,inversions,reference:JSON.parse(await readFile(dir+'/reference-report.json')),full_sprint_accepted:false,Steam97Web_parity:false};
await writeFile(dir+'/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:records.length,inversions}));
