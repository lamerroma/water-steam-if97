import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readLibraryRecipe,exampleTankRecipe,LIBRARY_RECIPE_MAX_STEPS} from '../src/library-recipe.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base='docs/library-recipes/';
const sha=raw=>createHash('sha256').update(raw).digest('hex');
export async function checkLibraryRecipeEvidence(){
 const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
 const acceptance=await read(base+'acceptance.json'),contract=await read(base+'contract.json');
 assert.equal(acceptance.contractSHA256,sha(await readFile(path.join(root,base,'contract.json'))));assert.equal(acceptance.exampleSHA256,sha(await readFile(path.join(root,base,'tank-example.json'))));
 assert.equal(acceptance.schemaVersion,1);assert.equal(acceptance.status,'local_replay_project_offline_accepted');
 assert.equal(contract.format,'thermocalc-library-recipe');assert.equal(contract.version,1);assert.equal(contract.maxSteps,LIBRARY_RECIPE_MAX_STEPS);
 assert.equal(contract.fullTANKNumericalAcceptance,false);assert.equal(contract.wholeLibraryNumericalAcceptance,false);
 const required=['src/library-recipe.js','src/library-recipe-runner.js','src/python-library-recipes-ui.js','src/python-libraries-ui.js','src/project.js','src/styles.css'];
 assert.deepEqual(Object.keys(acceptance.sources).sort(),required.sort());
 for(const [file,digest] of Object.entries(acceptance.sources))assert.equal(sha(await readFile(path.join(root,file))),digest,'Stale scenario source: '+file);
 const config=await read('assets/python-package.json'),example=await read(base+'tank-example.json');
 assert.deepEqual(readLibraryRecipe(example),exampleTankRecipe(config));
 const registry=await read('docs/library-registry/surface.json');assert.equal(registry.sourceFiles[contract.modelSource.path],contract.modelSource.sha256,'Pinned geometry source changed');
 for(const [file,identity] of Object.entries(acceptance.evidence)){
  assert.equal(path.basename(file),file);const raw=await readFile(path.join(root,base,'evidence',file));assert.equal(raw.length,identity.bytes);assert.equal(sha(raw),identity.sha256,'Changed scenario evidence: '+file);
 }
 for(const browser of ['chromium','firefox']){const report=await read(base+'evidence/'+browser+'.json');assert.equal(report.status,'passed');assert.equal(report.build,acceptance.build);assert.equal(report.checks.length,15);assert.equal(report.offline.networkProbeBlocked,true);const raw=await read(base+'evidence/'+browser+'-raw.json');assert.equal(raw.status,'passed');assert.equal(raw.build,acceptance.build);assert.equal(raw.checks.length,14);assert.equal(raw.recipeIsolation.originalObjectStillReadable,true);}
 return {status:'passed',maxSteps:LIBRARY_RECIPE_MAX_STEPS,browserGroups:15,fullLibraryNumericalAcceptance:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))checkLibraryRecipeEvidence().then(value=>console.log('Library recipe evidence '+JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
