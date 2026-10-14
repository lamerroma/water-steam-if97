import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initialize} from '../src/engine.js';
import {coursework} from '../src/coursework.js';
import {REACTOR_DEFAULT,reactorApplyVariant} from '../src/reactor-course.js';
import {reactorReferenceChecks,reactorCalculationChecks} from '../src/reactor-verification.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const references=reactorReferenceChecks(),variants=[];
for(let variant=1;variant<=45;variant++){
 const q=coursework(reactorApplyVariant(variant,REACTOR_DEFAULT)),r=reactorCalculationChecks(q);
 variants.push({variant,model:q.model,method:q.methodVersion,...r});
}
const files=['src/reactor-reference-data.js','src/reactor-verification.js','src/reactor-course.js','src/reactor-neutronics.js','src/reactor-methods.js','scripts/audit-reactor-validation.mjs'];
const sourceSHA256=Object.fromEntries(await Promise.all(files.map(async path=>[path,createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')])));
const report={appVersion:JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version,status:references.arithmeticStatus==='passed'&&variants.every(r=>r.status==='passed')?'arithmetic-passed':'arithmetic-failed',physicalStatus:references.physicalStatus,scope:'Equation and analytical verification is separate from physical validation. Reconstructed cases are not exact input-deck replays.',references,variants,sourceSHA256};
if(process.argv.includes('--write-report'))await writeFile(new URL('../docs/REACTOR_VALIDATION_1_20.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.status!=='arithmetic-passed'||process.argv.includes('--physical')&&references.physicalStatus!=='screening-passed-not-full-validation')process.exitCode=1;
