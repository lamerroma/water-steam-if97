import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const report=JSON.parse(await readFile('docs/STEAMTABLES_P08_ACCEPTANCE.json'));
const build=JSON.parse((await readFile('assets/app.js','utf8')).match(/const APP_BUILD = ([^\n]+);/)[1]);assert.deepEqual(build,report.build);assert.equal(report.version,JSON.parse(await readFile('package.json')).version);
for(const [p,e] of Object.entries(report.artifacts)){const b=await readFile(p);assert.equal(b.length,e.bytes,p);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256,p);}
let raw=0;for(const [p,e]of Object.entries(report.rawEvidence)){try{await stat(p);}catch{continue;}const b=await readFile(p);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256,p);raw++;}
assert.equal(report.verification.core.status,'passed');assert.equal(report.verification.core.unitTests,report.verification.core.unitPassed);
console.log(JSON.stringify({status:'passed',build:report.build,artifacts:Object.keys(report.artifacts).length,rawEvidence:raw,files:report.verification.fileAudit.files,browserFiles:Object.values(report.verification.browsers).reduce((n,r)=>n+r.files,0),unitTests:report.verification.core.unitTests}));
