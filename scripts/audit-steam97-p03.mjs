import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {BSW2003_DATA,BSW2003_SPECIES,bswGasState,bswGasInverse,bswComposition} from '../src/gas-bsw2003.js';
const dir='.release/steam97-p03';await mkdir(dir,{recursive:true});
assert.deepEqual(BSW2003_DATA,JSON.parse(await readFile('docs/steam97-p03/coefficients.json')),'Published transcription must be reviewed explicitly when coefficients change');
const mixtures=[...BSW2003_SPECIES.map(id=>({[id]:1})),{N2:.78084,O2:.20946,Ar:.00934,CO2:.00036},{N2:.73,CO2:.1,H2O:.12,O2:.05},Object.fromEntries(BSW2003_SPECIES.map(id=>[id,.125]))];
const temperatures=[200,200.001,273.149999,273.15,273.150001,298.15,500,1000,1073.2,2000,3299.999,3300],records=[];let inversions=0;
for(const [i,fractions]of mixtures.entries())for(const T of temperatures)for(const p of [.001,.101325,1,50]){
 const basis=i===10?'mass':'mole',result=bswGasState(p,T,fractions,basis);records.push({id:`${i}/${T}/${p}`,p,T,fractions,basis,result});
 if(p===1){for(const key of ['h','s']){const inverse=bswGasInverse(p,result[key],key,fractions,basis);assert.ok(Math.abs(inverse.T-T)<=2e-9,`${i} ${key} ${T}`);inversions++;}}
}
const version=JSON.parse(await readFile('package.json')).version;
await writeFile(dir+'/values.json',JSON.stringify({version,records},null,2)+'\n');
const ref=spawnSync(process.env.P03_PYTHON||'python3',['scripts/reference/bsw2003_reference.py',dir+'/values.json'],{encoding:'utf8',timeout:240000});if(ref.status!==0)throw Error(ref.stderr||ref.stdout);console.log(ref.stdout.trim());
const external=JSON.parse(await readFile('docs/steam97-p03/external-cp-controls.json')),differences={};
for(const row of external.records){const q=bswGasState(.101325,row.T,{[row.component]:1}),actual=q.cp*q.M,relative=(actual-row.cp_molar)/row.cp_molar;assert.ok(Math.abs(relative)<=row.model_comparison_envelope,`${row.component} ${row.T}: unexpected change against separate ideal-cp model`);differences[row.component]=Math.max(differences[row.component]||0,Math.abs(relative));}
const report={status:'passed',version,cases:records.length,inversions,reference:JSON.parse(await readFile(dir+'/reference-report.json')),external:{source:external.source,cases:external.records.length,max_absolute_relative_difference:differences,meaning:'Model-spread diagnostic, not BSW fit accuracy or Steam97Web parity.'},reference_parity_accepted:false};
await writeFile(dir+'/audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:records.length,inversions,externalCases:external.records.length}));
