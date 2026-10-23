import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('PWA activation waits for startup restoration before saving or replacing a live page',async()=>{
 const nodes=new Map(),messages=[];let saves=0;
 const get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false});return nodes.get(id);};
 const registration={active:{scriptURL:'https://example.test/app/service-worker.js',postMessage(){}},waiting:{postMessage:message=>messages.push(message)},addEventListener(){}};
 const context=vm.createContext({document:{getElementById:get,addEventListener(){}},window:{addEventListener(){}},navigator:{onLine:true,serviceWorker:{addEventListener(){},getRegistration:async()=>registration,register:async()=>registration}},location:{protocol:'https:',href:'https://example.test/app/'},URL,isSecureContext:true,APP_BUILD:{id:'test'},uiTranslator:{t:key=>key},persistenceReady:false,unsavedProject:false,saveProject:()=>saves++});
 vm.runInContext(await readFile(new URL('../src/pwa.js',import.meta.url),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));
 get('pwa-update').onclick();assert.equal(saves,0);assert.equal(messages.length,0);assert.equal(get('pwa-status').textContent,'pwa.waitForProject');
 context.persistenceReady=true;get('pwa-update').onclick();assert.equal(saves,1);assert.equal(messages.length,1);assert.equal(messages[0].type,'PWA_ACTIVATE');
 context.unsavedProject=true;get('pwa-update').onclick();assert.equal(saves,2);assert.equal(messages.length,1);assert.equal(get('pwa-status').textContent,'pwa.saveFailed');
});
