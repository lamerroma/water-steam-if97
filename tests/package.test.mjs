import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
test('Standalone HTML is complete, syntactically valid and includes licenses',()=>{
 const html=read('index.html').toString();assert.equal(html,read('dist/index.html').toString());
 assert.ok(html.includes('Copyright © 2023 Cheng Maohua'));assert.ok(html.includes('International Association for the Properties of Water and Steam'));
 assert.match(html,/<!doctype html>/);assert.match(html,/<html lang="uk">/);
 assert.equal((html.match(/<script>/g)||[]).length,1);assert.doesNotMatch(html,/<(?:script|link|img)[^>]+(?:src|href)="https?:/i);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
 assert.doesNotMatch(script,/^import /m);assert.doesNotMatch(script,/^export /m);
 const base64=script.match(/const WASM_BASE64 = "([^"]+)"/)[1];assert.deepEqual(Buffer.from(base64,'base64'),read('vendor/seuif97_bg.wasm'));
});
test('Vendored artifacts match pinned SHA256 manifest',()=>{
 const manifest=JSON.parse(read('vendor/SHA256.json'));
 for(const [p,hash] of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(read('vendor/'+p)).digest('hex'),hash,p);
});
