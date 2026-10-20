import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialize,calculate} from '../src/engine.js';
import {calculateGasTable} from '../src/gas-dissociation.js';
import {dispatchCalculation} from '../src/calculation-modules.js';
import {CALCULATION_MODULES,createCalculationRequest,normalizeCalculationRequest,calculationQuantities} from '../src/calculation-protocol.js';
await initialize(await readFile(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const water=(payload={mode:'pt',a:3,b:373.15},extra={})=>createCalculationRequest({id:1,moduleId:'water',methodId:'calculate',payload,...extra});
const gas=(payload,extra={})=>createCalculationRequest({id:2,moduleId:'gas-tables',methodId:'calculate',payload,...extra});

test('Immutable module catalog names existing adapters and does not claim optional Python libraries',()=>{
 assert.deepEqual(CALCULATION_MODULES.map(module=>module.id),['water','gas-tables','workflows']);
 assert.throws(()=>CALCULATION_MODULES[0].models.push('other'),TypeError);
 assert.equal(CALCULATION_MODULES[1].validity.steam97WebParityVerified,false);
 assert.equal(CALCULATION_MODULES[2].resultFormat,'native');
});

test('Water quantity conversion agrees exactly with the native kernel and preserves input spelling metadata',async()=>{
 const options={inputRounding:[{text:'30.000',unit:'bar',halfWidth:.00005},{text:'100.0',unit:'C',halfWidth:.05}]};
 const request=water({mode:'pt',a:30,b:100,model:'IF97',options},{inputUnits:{a:'bar',b:'C'}}),original=structuredClone(request);
 const reply=await dispatchCalculation(request);assert.equal(reply.status,'ok');assert.deepEqual(reply.result,calculate('pt',3,373.15,'IF97',options));assert.deepEqual(request,original);
 assert.deepEqual(reply.units.inputs,{a:'MPa',b:'K'});assert.equal(reply.units.pressureBasis,'absolute');assert.equal(reply.model,'IF97');assert.equal(reply.validity.selectedModel,'IF97');
 assert.deepEqual(reply.quantities['state.h'],{value:reply.result.state.h,unit:'kJ/kg',status:'available'});
 assert.ok(reply.warnings.every(note=>note.code==='model-note'&&typeof note.message==='string'));
 assert.deepEqual(structuredClone(reply),reply);
});

test('Every water input pair declares compatible units, including saturation without an unused argument',()=>{
 for(const mode of ['pt','ph','ps','pv','pu','th','ts','tv','tu','hs','us','vs','hv','uv','satp','satt','px','tx','prho','trho']){
  const request=water({mode,a:1,b:2}),normalized=normalizeCalculationRequest(request);
  assert.equal(Object.keys(normalized.canonicalUnits).length,['satp','satt'].includes(mode)?1:2);
 }
 const request=water({mode:'px',a:1,b:40},{inputUnits:{a:'bar',b:'percent'}});
 assert.deepEqual(normalizeCalculationRequest(request).payload,{mode:'px',a:.1,b:.4});
 assert.throws(()=>water({mode:'__proto__',a:1,b:2}),{code:'unsupported-method'});
});

test('Null two-phase properties remain unavailable rather than becoming zero',async()=>{
 const reply=await dispatchCalculation(water({mode:'px',a:.1,b:.4}));assert.equal(reply.status,'ok');
 assert.deepEqual(reply.quantities['state.cp'],{value:null,unit:'kJ/(kg K)',status:'unavailable'});
 assert.equal(reply.quantities['saturation.liquid.cp'].status,'available');assert.equal(reply.quantities['saturation.vapor.cp'].status,'available');
 assert.ok(reply.warnings.length>0);
});

test('Gas percent conversion preserves explicit mole and mass bases and thermodynamic references',async()=>{
 for(const basis of ['mole','mass']){
  const reply=await dispatchCalculation(gas({mode:'pt',p:1.01325,value:726.85,fractions:{N2:80,O2:20},basis},{inputUnits:{p:'bar',value:'C',fractions:'percent'}}));
  assert.equal(reply.status,'ok');assert.deepEqual(reply.result,calculateGasTable('pt',.101325,1000,{N2:.8,O2:.2},basis));
  assert.equal(reply.units.inputCompositionBasis,basis);assert.deepEqual(reply.units.outputCompositionBasis,{composition:'mole',massComposition:'mass'});assert.equal(reply.quantities.M.unit,'kg/kmol');assert.equal(reply.validity.reference.T0,273.15);assert.equal(reply.validity.steam97WebParityVerified,false);
  assert.deepEqual(reply.quantities['composition.N2'],{value:reply.result.composition.N2,unit:'1',basis:'mole',status:'available'});assert.equal(reply.quantities['massComposition.N2'].basis,'mass');
  assert.equal(reply.quantities['reference.T0'].unit,'K');assert.equal(reply.quantities['reference.p0'].unit,'MPa');
 }
});

test('VDI4670 metadata carries experimental bounds and unavailable acoustic outputs',async()=>{
 const fractions={N2:.72633612,O2:.03219575,CO2:.08048938,H2O:.16097875},options={dissociation:true,combustion:'complete-air',excessAirLambda:1.2};
 const reply=await dispatchCalculation(gas({mode:'pt',p:1,value:1600,fractions,basis:'mole',options}));assert.equal(reply.status,'ok');
 assert.equal(reply.model,'BSW2003-VDI4670-caloric-experimental');assert.equal(reply.validity.dissociationApplied,true);assert.equal(reply.validity.dissociation.equilibriumCompositionComputed,false);
 assert.deepEqual(reply.quantities.w,{value:null,unit:'m/s',status:'unavailable'});assert.equal(reply.quantities.isentropic.status,'unavailable');assert.equal(reply.quantities.dissociationDeltaH.unit,'kJ/kg');
 const invalid=await dispatchCalculation(gas({mode:'pt',p:1,value:2000.001,fractions,basis:'mole',options}));assert.equal(invalid.status,'error');assert.equal(invalid.error.code,'calculation');assert.match(invalid.error.message,/1200.*2000/);
});

test('Protocol, module, adapter version, method and model failures have distinct stable codes',async()=>{
 const request=water();
 for(const [mutation,code] of [[{protocolVersion:99},'protocol'],[{id:0},'protocol'],[{moduleId:'ht'},'unsupported-module'],[{engineVersion:'future'},'version-mismatch'],[{methodId:'unknown'},'unsupported-method'],[{payload:{mode:'pt',a:3,b:300,model:'unknown'}},'unsupported-model']]){
  const reply=await dispatchCalculation({...request,...mutation});assert.equal(reply.status,'error');assert.equal(reply.error.code,code);assert.equal(typeof reply.error.message,'string');
 }
});

test('Dimension errors, missing units and nonfinite inputs are rejected before kernel execution',async()=>{
 for(const units of [{a:'K',b:'MPa'},{a:'MPa'},null,{a:'MPa',b:'K',toString:'K'}]){
  const reply=await dispatchCalculation({...water(),inputUnits:units});assert.equal(reply.error.code,'invalid-units');
 }
 for(const a of [NaN,Infinity,'3',null]){const reply=await dispatchCalculation(water({mode:'pt',a,b:300}));assert.equal(reply.error.code,'invalid-input');}
 const overflow=await dispatchCalculation(water({mode:'ph',a:1,b:Number.MAX_VALUE},{inputUnits:{a:'MPa',b:'Btulb'}}));assert.equal(overflow.error.code,'invalid-input');
 const gauge=await dispatchCalculation(water({mode:'pt',a:1,b:300,pressureBasis:'gauge'}));assert.equal(gauge.error.code,'invalid-input');
});

test('Nonfinite model outputs are rejected, while undefined optional outputs are not invented',()=>{
 assert.throws(()=>calculationQuantities({p:1,h:Infinity},'gas-state'),{code:'invalid-result'});
 assert.deepEqual(calculationQuantities({p:1},'gas-state'),{p:{value:1,unit:'MPa',status:'available'}});
});

test('Native workflows retain their original error text and explicitly do not infer units',async()=>{
 const reply=await dispatchCalculation(createCalculationRequest({id:3,moduleId:'workflows',methodId:'project',payload:{text:'{"format":"invalid","version":99}'}}));
 assert.equal(reply.status,'error');assert.equal(reply.error.code,'calculation');assert.match(reply.error.message,/формат|версія/);
 const text=await dispatchCalculation(createCalculationRequest({id:4,moduleId:'workflows',methodId:'study-report-html',payload:{title:'Contract',report:{entries:[]},options:{language:'en'}}}));
 assert.equal(text.status,'ok');assert.equal(typeof text.result,'string');assert.deepEqual(text.quantities,{});assert.equal(text.units.pressureBasis,null);
});
