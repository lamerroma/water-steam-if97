import test from 'node:test';import assert from 'node:assert/strict';
import {calculatorCopyValue,calculatorHistoryInput} from '../src/calculator-result-tools.js';
test('clipboard preserves displayed significant digits, decimal locale and selected units',()=>{
 assert.equal(calculatorCopyValue(12345.6789,'kPa',{digits:6,locale:'en-US'}),'12345.7 kPa');
 assert.equal(calculatorCopyValue(1.23456789,'MPa',{digits:6,locale:'uk-UA'}),'1,23457 MPa');
 assert.equal(calculatorCopyValue(0,'°C',{locale:'en-US'}),'0 °C');assert.equal(calculatorCopyValue(.91,'–',{locale:'en-US'}),'0.91');
 assert.equal(calculatorCopyValue(12,'MPa',{locale:'en-US',includeUnit:false}),'12');assert.equal(calculatorCopyValue(null,'MPa'),null);
});
test('history retains recorded independent inputs, including saturation and reversed display pairs',()=>{
 assert.deepEqual(calculatorHistoryInput({p:3,T:373.15,h:400,source:{mode:'pt',a:3,b:373.15}}),{mode:'pt',a:3,b:373.15});
 assert.deepEqual(calculatorHistoryInput({source:{mode:'satt',a:373.15}}),{mode:'satt',a:373.15,b:0});
 assert.deepEqual(calculatorHistoryInput({p:.2,x:.91}),{mode:'px',a:.2,b:.91});
 assert.deepEqual(calculatorHistoryInput({p:22.064,T:647.096,critical:true}),{mode:'pt',a:22.064,b:647.096});
 assert.deepEqual(calculatorHistoryInput({p:3,h:400,source:{mode:'unknown'}}),{mode:'ph',a:3,b:400});
});
