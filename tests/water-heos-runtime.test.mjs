import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
for(const mode of ['low-level','high-level','batch','shared-main'])test(`An actual C++ ${mode} failure quarantines every shared CoolProp consumer`,()=>{
 const child=spawnSync(process.execPath,[fileURLToPath(new URL('helpers/heos-native-failure.mjs',import.meta.url)),mode],{encoding:'utf8',timeout:30000});
 assert.equal(child.status,0,child.stderr);
 const reply=JSON.parse(child.stdout.trim());assert.equal(reply.status,'error');assert.equal(reply.error.code,'unavailable');assert.equal(reply.error.details.resetWorker,true);assert.ok(reply.error.details.upstream.length>0);
 assert.equal(reply.faultCalls,1);assert.equal(reply.followup.status,'error');assert.equal(reply.followup.error.details.resetWorker,true);
 assert.equal(reply.followupNativeCalls,0);
 assert.equal(Object.keys(reply.consumers).length,5);
 for(const consumer of Object.values(reply.consumers)){assert.equal(consumer.rejected,true);assert.equal(consumer.resetWorker,true);assert.equal(consumer.reloadPage,mode==='shared-main');}
 if(mode==='shared-main'){assert.equal(reply.error.details.reloadPage,true);assert.match(reply.error.message,/Оновіть сторінку/);}
});
