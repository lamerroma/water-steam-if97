import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));
test('Standalone HTML is complete, syntactically valid and includes licenses',()=>{
 const html=read('standalone.html').toString();assert.equal(html,read('dist/standalone.html').toString());
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
test('standalone page has embedded script, styles and WASM with no remote runtime assets',()=>{const html=fs.readFileSync(new URL('../standalone.html',import.meta.url),'utf8');assert.equal((html.match(/<script\b/g)||[]).length,1);assert.ok(!/<(?:script|link|img|iframe)\b[^>]*(?:src|href)\s*=\s*["']https?:/i.test(html));assert.ok(html.includes('const WASM_BASE64'));assert.ok(html.includes('await initialize(bytes)'));assert.ok(!/^import /m.test(html));});

test('Multi-file site uses matching local assets and the same application core as standalone',()=>{
 const html=read('index.html').toString();assert.equal(html,read('dist/index.html').toString());
 assert.match(html,/href="assets\/styles.css"/);assert.match(html,/src="assets\/app.js" defer/);
 assert.doesNotMatch(html,/<(?:script|link|img)[^>]+(?:src|href)="https?:/i);
 const code=read('assets/app.js').toString();new vm.Script(code);
 assert.equal(code,read('dist/assets/app.js').toString());assert.deepEqual(read('assets/styles.css'),read('src/styles.css'));
 // The multi-file app.js intentionally omits the embedded CoolProp WASM (fetched lazily,
 // see below) and is otherwise the same bundle as the one inlined into standalone.html.
 const embedded=read('standalone.html').toString().match(/<script>([\s\S]*?)<\/script>/)[1];
 const withoutCoolProp=embedded.replace(/const COOLPROP_WASM_BASE64 = "[^"]+";\n/,'');
 assert.equal(withoutCoolProp,code.replace(/<\/script/gi,'<\\/script'));
 assert.match(html,/script-src 'self'/);assert.match(html,/style-src 'self'/);
 // Unlike standalone.html, the multi-file site fetches its own assets/coolprop.wasm, so it needs connect-src 'self'.
 assert.match(html,/connect-src 'self'/);
 assert.match(read('standalone.html').toString(),/connect-src 'none'/);
});
test('CoolProp WASM is embedded exactly in standalone.html and shipped as a matching lazy asset for the multi-file site',()=>{
 const standaloneScript=read('standalone.html').toString().match(/<script>([\s\S]*?)<\/script>/)[1];
 const base64=standaloneScript.match(/const COOLPROP_WASM_BASE64 = "([^"]+)"/)[1];
 assert.deepEqual(Buffer.from(base64,'base64'),read('vendor/coolprop.wasm'));
 assert.doesNotMatch(standaloneScript,/new Function\(/);assert.ok(standaloneScript.includes('coolpropStaticFunction'));
 const code=read('assets/app.js').toString();
 assert.doesNotMatch(code,/const COOLPROP_WASM_BASE64 = "/);assert.ok(code.includes("typeof COOLPROP_WASM_BASE64==='string'"));assert.ok(code.includes('coolpropStaticFunction'));
 assert.deepEqual(read('assets/coolprop.wasm'),read('vendor/coolprop.wasm'));
 assert.deepEqual(read('assets/coolprop.wasm'),read('dist/assets/coolprop.wasm'));
 assert.ok(code.includes("fetch('assets/coolprop.wasm')"));
});
