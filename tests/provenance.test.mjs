import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportMetadata,exportWithMetadata,readExportMetadata} from '../src/provenance.js';
const metadata=exportMetadata({version:'1.16.5',id:'test-build'},'reactor-course-3','IF97');
test('JSON keeps schema version and separates export from original save',()=>{
 const original={...metadata,appVersion:'1.14.0'};
 const result=JSON.parse(exportWithMetadata(JSON.stringify({version:1,savedWith:original}), 'application/json',metadata));
 assert.equal(result.version,1);assert.deepEqual(result.savedWith,original);assert.deepEqual(result.exportedWith,metadata);
});
test('CSV preserves escaped quotes, delimiters, multiline text and original values',()=>{
 for(const delimiter of [',',';']){
  const csv='\uFEFFname'+delimiter+'value\r\n"a ""quote""\nline"'+delimiter+'12.34\r\n';
  const output=exportWithMetadata(csv,'text/csv',metadata);
  assert.ok(output.startsWith('\uFEFFname'+delimiter+'value'+delimiter+'"export_app_version"'));
  assert.ok(output.includes('"a ""quote""\nline"'+delimiter+'12.34'+delimiter+'"1.16.5"'));
  assert.ok(output.endsWith('\r\n'));assert.equal(output.match(/test-build/g).length,1);
 }
 assert.throws(()=>exportWithMetadata('name\n"unclosed','text/csv',metadata));
});
test('HTML escapes metadata and states that original calculation version is unknown',()=>{
 const output=exportWithMetadata('<html><body>result</body></html>','text/html',{...metadata,method:'<script>x</script>'});
 assert.ok(output.includes('&lt;script&gt;'));assert.ok(output.includes('data-export-provenance'));assert.ok(output.includes('Версія експорту'));assert.ok(!output.includes('<script>'));assert.ok(exportWithMetadata('<html>implicit body</html>','text/html',metadata).includes('data-export-provenance'));
});
test('metadata is optional for old files and rejects invalid or excessive imported text',()=>{
 assert.equal(readExportMetadata(undefined),null);
 for(const value of [[],{}, {...metadata,method:'a\nscript'}, {...metadata,buildId:'x'.repeat(161)}])assert.throws(()=>readExportMetadata(value));
 assert.deepEqual(readExportMetadata({...metadata,untrusted:'ignored'}),metadata);
});
