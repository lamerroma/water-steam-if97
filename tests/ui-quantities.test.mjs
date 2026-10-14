import test from 'node:test';
import assert from 'node:assert/strict';
import {uiConvertQuantity,uiDisplayQuantity,readUIUnits} from '../src/ui-quantities.js';
import {readWorkspace} from '../src/workspace.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('Absolute temperatures round-trip and temperature differences have no offset',()=>{
 close(uiConvertQuantity(100,'temperature','C','F'),212);close(uiConvertQuantity(212,'temperature','F','K'),373.15);
 close(uiConvertQuantity(18,'temperatureDifference','dF','dK'),10);
 assert.deepEqual(uiDisplayQuantity(10,'K',{...readUIUnits(null),temperature:'F'},{difference:true}),[18,'°F']);
});
test('Mixed preferences convert pressure, temperatures, energy and mass independently',()=>{
 const prefs=readUIUnits({temperature:'F',pressure:'bar',mass:'kgh',energy:'Jkg'});
 assert.ok(Number.isNaN(uiDisplayQuantity(NaN,'°C',prefs)[0]));assert.equal(uiDisplayQuantity(undefined,'MPa',prefs)[0],undefined);close(uiDisplayQuantity(3,'МПа',prefs)[0],30);close(uiDisplayQuantity(100,'°C',prefs)[0],212);
 close(uiDisplayQuantity(1,'кг/с',prefs)[0],3600);close(uiDisplayQuantity(2,'кДж/кг',prefs)[0],2000);
 close(uiDisplayQuantity(2,'кДж/(кг·K)',prefs)[0],2000);
 assert.deepEqual(uiDisplayQuantity(null,'°C',prefs),[null,'°F']);
});
test('Power and lengths round-trip without changing canonical physical quantities',()=>{
 for(const x of [0,1,12345]){close(uiConvertQuantity(uiConvertQuantity(x,'length','mm','ft'),'length','ft','mm'),x);close(uiConvertQuantity(uiConvertQuantity(x,'power','kW','Btuh'),'power','Btuh','kW'),x);}
});
test('Invalid preferences and cross-dimension conversions fail before application',()=>{
 for(const x of [[],{temperature:'bar'},{unknown:'C'}])assert.throws(()=>readUIUnits(x));
 assert.throws(()=>uiConvertQuantity(3,'pressure','MPa','F'));assert.throws(()=>uiConvertQuantity(Infinity,'pressure','MPa','bar'));
});
test('Local units accompany native workspace numbers and old workspaces remain valid',()=>{
 const old={active:'turbine',panels:{turbine:{inputs:{'process-p2':'0.1','process-pressure':'MPa'},calculated:false}}};
 assert.equal(readWorkspace(old).panels.turbine.inputs['process-p2'],'0.1');
 old.panels.turbine.inputs['ui-unit-process-p2']='kPa';assert.equal(readWorkspace(old).panels.turbine.inputs['ui-unit-process-p2'],'kPa');
 old.panels.turbine.inputs['ui-unit-process-p2']='garbage';assert.throws(()=>readWorkspace(old));
});
