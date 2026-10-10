import {test} from 'node:test';
import assert from 'node:assert/strict';
import {printableReport} from '../src/print-report.js';
test('print report escapes user names and converts units without external resources',()=>{const html=printableReport('<test>',[{name:'<script>bad</script>',p:3,T:300,h:2326,s:4.1868,phase:'Рідина'}],'english');assert.ok(html.includes('&lt;test&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('h [Btu/lb]'));assert.ok(html.includes('<td>1000</td>'));assert.ok(html.includes('@page{size:A4 landscape'));assert.ok(!html.includes('https://'));});
