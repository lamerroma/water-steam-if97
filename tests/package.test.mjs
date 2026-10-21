import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root));

test('Spreadsheet backend is an exact local asset, separately versioned and prepared offline',()=>{
 const bytes=read('assets/sheetjs.js'),code=read('assets/app.js').toString(),worker=read('service-worker.js').toString();
 assert.deepEqual(bytes,read('vendor/sheetjs.cjs'));assert.deepEqual(bytes,read('dist/assets/sheetjs.js'));
 const url='assets/sheetjs.js?v='+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
 assert.ok(code.includes(JSON.stringify(url)));assert.ok(worker.includes(JSON.stringify(url)));
 assert.equal(code.includes(bytes.toString()),false);new vm.Script(bytes.toString());
});

test('PWA release is complete, syntactically valid and includes licenses',()=>{
 const html=read('index.html').toString(),code=read('assets/app.js').toString();
 assert.equal(html,read('dist/index.html').toString());
 assert.ok(html.includes('Copyright © 2023 Cheng Maohua'));
 assert.ok(html.includes('International Association for the Properties of Water and Steam'));
 assert.match(html,/<!doctype html>/);assert.match(html,/<html lang="uk">/);
 assert.doesNotMatch(html,/<(?:script|link|img)[^>]+(?:src|href)="https?:/i);
 new vm.Script(code);assert.doesNotMatch(code,/^import |^export /m);
 const base64=code.match(/const WASM_BASE64 = "([^"]+)"/)[1];
 assert.deepEqual(Buffer.from(base64,'base64'),read('vendor/seuif97_bg.wasm'));
 for(const file of ['standalone.html','dist/standalone.html'])assert.equal(fs.existsSync(new URL(file,root)),false,file);
});

test('Vendored artifacts match pinned SHA256 manifest',()=>{
 const manifest=JSON.parse(read('vendor/SHA256.json'));
 for(const [p,hash] of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(read('vendor/'+p)).digest('hex'),hash,p);
});

test('PWA page uses matching local assets and same-origin CSP',()=>{
 const html=read('index.html').toString();
 const version=p=>crypto.createHash('sha256').update(read(p)).digest('hex').slice(0,16);
 assert.ok(html.includes(`href="assets/styles.css?v=${version('assets/styles.css')}"`));
 assert.ok(html.includes(`src="assets/app.js?v=${version('assets/app.js')}" defer`));
 assert.deepEqual(read('assets/app.js'),read('dist/assets/app.js'));
 assert.deepEqual(read('assets/styles.css'),read('src/styles.css'));
 assert.match(html,/script-src 'self'/);assert.match(html,/style-src 'self'/);
 assert.match(html,/connect-src 'self'/);assert.match(html,/rel="manifest"/);
});

test('Background kernel is versioned and shipped as a local PWA resource',()=>{
 const source=read('assets/calculator-worker.js').toString();new vm.Script(source);
 assert.equal(source,read('dist/assets/calculator-worker.js').toString());
 const url='assets/calculator-worker.js?v='+crypto.createHash('sha256').update(source).digest('hex').slice(0,16);
 assert.ok(read('assets/app.js').toString().includes(JSON.stringify(url)));
 assert.doesNotMatch(read('assets/app.js').toString(),/CALCULATOR_WORKER_SOURCE/);
 assert.match(read('index.html').toString(),/worker-src 'self'/);
});

test('PWA pages show the version and identity of the running bundle',()=>{
 const code=read('assets/app.js').toString();
 const initialization=code.match(/const APP_BUILD = ([^\n]+);\n([\s\S]*?)const LOCALIZATION_CATALOGS/);
 assert.ok(initialization);
 const metadata=JSON.parse(initialization[1]);
 assert.equal(metadata.version,JSON.parse(read('package.json')).version);
 assert.match(metadata.id,/^[a-f0-9]{12}$/);
 for(const path of ['index.html','dist/index.html']){
  const html=read(path).toString();
  assert.ok(html.includes(`id="app-version-value" data-i18n-ignore>${metadata.version}</span>`),path);
  assert.ok(html.includes(`id="app-build-value" data-i18n-ignore>${metadata.id}</span>`),path);
  assert.doesNotMatch(html,/\{\{APP_(?:VERSION|BUILD_ID)\}\}/);
 }
 const labels={'app-version-value':{textContent:'old version'},'app-build-value':{textContent:'old build'}};
 vm.runInNewContext('const APP_BUILD = '+initialization[1]+';\n'+initialization[2],{document:{getElementById:id=>labels[id]}});
 assert.equal(labels['app-version-value'].textContent,metadata.version);
 assert.equal(labels['app-build-value'].textContent,metadata.id);
});

test('CoolProp WASM ships as an exact local asset without base64 duplication',()=>{
 const code=read('assets/app.js').toString();
 assert.doesNotMatch(code,/COOLPROP_WASM_BASE64/);assert.doesNotMatch(code,/new Function\(/);
 assert.ok(code.includes('coolpropStaticFunction'));
 assert.deepEqual(read('assets/coolprop.wasm'),read('vendor/coolprop.wasm'));
 assert.deepEqual(read('assets/coolprop.wasm'),read('dist/assets/coolprop.wasm'));
 assert.ok(code.includes('fetch(COOLPROP_WASM_URL)'));
 const pageURL=code.match(/const COOLPROP_WASM_URL = "(assets\/coolprop.wasm\?v=[a-f0-9]{16})";/)?.[1];
 assert.ok(pageURL);
 const worker=read('assets/heos-calculator-worker.js').toString();
 assert.ok(worker.includes('const COOLPROP_WASM_URL = "'+pageURL.replace('assets/','./')+'";'));
 assert.doesNotMatch(worker,/new Function\(/);
 assert.doesNotMatch(read('assets/calculator-worker.js').toString(),/coolpropStaticFunction|function calculateWaterHeos/);
});
