import test from 'node:test';import assert from 'node:assert/strict';
import {encodeShareLink,decodeShareLink,SHARE_HASH_PREFIX,SHARE_MAX_LENGTH} from '../src/share-link.js';

const base='https://example.test/water-steam-if97/?x=1#old';
test('Main calculator inputs round-trip through the URL fragment only',()=>{
 const url=encodeShareLink({module:'general',form:{model:'IAPWS-95',mode:'pt',a:'10',b:'540,5',ua:'MPa',ub:'C'}},base);
 assert.ok(url.startsWith('https://example.test/water-steam-if97/?x=1'+SHARE_HASH_PREFIX));assert.ok(!url.includes('#old'));
 assert.deepEqual(decodeShareLink(new URL(url).hash),{module:'general',form:{model:'IAPWS-95',mode:'pt',a:'10',b:'540,5',ua:'MPa',ub:'C'}});
});
test('Panel inputs are validated by the calculation reader and keep Unicode',()=>{
 const inputs={'fn-model':'IF97','fn-text':'h1 = h_pt(10; 540) # Тест ✓'};
 const url=encodeShareLink({module:'functions',inputs,model:'IF97'},base);
 const shared=decodeShareLink(new URL(url).hash);
 assert.equal(shared.module,'functions');assert.deepEqual(shared.record.inputs,inputs);assert.equal(shared.record.calculated,true);
});
test('Foreign or damaged fragments are rejected without guessing',()=>{
 assert.equal(decodeShareLink(''),null);assert.equal(decodeShareLink('#section'),null);
 assert.throws(()=>decodeShareLink(SHARE_HASH_PREFIX+'%%%'),/share.invalid/);
 const encode=o=>SHARE_HASH_PREFIX+Buffer.from(JSON.stringify(o)).toString('base64url');
 assert.throws(()=>decodeShareLink(encode({v:2,module:'general'})),/share.invalid/);
 assert.throws(()=>decodeShareLink(encode({v:1,module:'general',form:{mode:'zz',a:'1',b:'2',ua:'MPa',ub:'C'}})),/share.invalid/);
 assert.throws(()=>decodeShareLink(encode({v:1,module:'general',form:{mode:'pt',a:'1',b:'2',ua:'<img>',ub:'C'}})),/share.invalid/);
 assert.throws(()=>decodeShareLink(encode({v:1,module:'npp',inputs:{}})),/Навчання/);
 assert.throws(()=>decodeShareLink(encode({v:1,module:'cycles',inputs:{'cycle-kind':'evil'}})),/Невідомий режим/);
 assert.throws(()=>decodeShareLink(encode({v:1,module:'batch',inputs:{},source:'csv'})),/share.invalid/);
 assert.throws(()=>decodeShareLink(SHARE_HASH_PREFIX+'A'.repeat(SHARE_MAX_LENGTH)),/share.tooLong/);
});
test('Links that would be too long or depend on a local CSV file are refused',()=>{
 assert.throws(()=>encodeShareLink({module:'functions',inputs:{'fn-text':'x = 1\n'.repeat(4000)},model:'IF97'},base),/share.tooLong/);
 assert.throws(()=>encodeShareLink({module:'batch',inputs:{},model:'IF97',source:'csv'},base),/share.csv/);
 assert.throws(()=>encodeShareLink({module:'general',form:{model:'IF97',mode:'pt',a:'1'.repeat(81),b:'1',ua:'MPa',ub:'C'}},base),/share.invalid/);
});
