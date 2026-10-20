import {toCanonical} from './units.js';

// Public adapter protocol. Adapter versions describe this interface, not upstream library releases.
export const CALCULATION_PROTOCOL_VERSION=1;
// The bundler fingerprints Worker sources and its WASM. Direct source imports
// use null; shipped UI and Worker always carry the same exact revision.
export function calculationImplementationRevision(){return typeof CALCULATION_IMPLEMENTATION_REVISION==='string'?CALCULATION_IMPLEMENTATION_REVISION:null;}
const calculationWaterPairs={pt:['p','T'],ph:['p','h'],ps:['p','s'],pv:['p','v'],pu:['p','u'],th:['T','h'],ts:['T','s'],tv:['T','v'],tu:['T','u'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],satp:['p'],satt:['T'],px:['p','x'],tx:['T','x'],prho:['p','rho'],trho:['T','rho']};
const calculationUnitGroups={
 p:{canonical:'MPa',accepted:['MPa','kPa','Pa','bar','atm','psi']},
 T:{canonical:'K',accepted:['K','C','F']},
 h:{canonical:'kJkg',accepted:['kJkg','Jkg','Btulb']},
 s:{canonical:'kJkgK',accepted:['kJkgK','JkgK','BtulbR']},
 v:{canonical:'m3kg',accepted:['m3kg','ft3lb']},
 rho:{canonical:'kgm3',accepted:['kgm3','lbft3']},
 x:{canonical:'fraction',accepted:['fraction','percent']}
};
calculationUnitGroups.u=calculationUnitGroups.h;
const calculationOutputUnits={p:'MPa',T:'K',rho:'kg/m3',v:'m3/kg',h:'kJ/kg',u:'kJ/kg',A:'kJ/kg',G:'kJ/kg',s:'kJ/(kg K)',cp:'kJ/(kg K)',cv:'kJ/(kg K)',w:'m/s',x:'1',Z:'1',gamma:'1',caloricRatio:'1',isentropic:'1',mu:'Pa s',lambda:'W/(m K)',nu:'m2/s',diffusivity:'m2/s',Pr:'1',sigma:'N/m',dc:'1',alpha:'1/K',kappa:'1/MPa',dvdt:'m3/(kg K)',dvdp:'m3/(kg MPa)',dpdt:'MPa/K',dpdv:'MPa kg/m3',jt:'K/MPa',ijt:'kJ/(kg MPa)',latentHeat:'kJ/kg',M:'kg/kmol',R:'kJ/(kg K)',mixingEntropy:'kJ/(kg K)',excessAirLambda:'1',dissociationDeltaH:'kJ/kg',dissociationDeltaS:'kJ/(kg K)',dissociationDeltaCp:'kJ/(kg K)'};
function calculationFreeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))calculationFreeze(item);Object.freeze(value);}return value;}
export const CALCULATION_MODULES=calculationFreeze([
 {id:'water',engineVersion:'1.0.0',runtime:'javascript-wasm',methods:['calculate'],models:['IF97','IAPWS-95'],resultFormat:'water-state',
  inputSchemas:{calculate:{selector:'mode',cases:Object.fromEntries(Object.entries(calculationWaterPairs).map(([mode,pair])=>[mode,Object.fromEntries(pair.map((quantity,i)=>[i===0?'a':'b',quantity]))]))}},
  validity:{authority:'Existing engine domain checks are authoritative; ranges are not rectangular guarantees.',models:{
   IF97:{temperature:{unit:'K',min:273.15,max:2273.15},pressure:{unit:'MPa',minExclusive:0,max:100},conditions:['Above 1073.15 K: pressure <= 50 MPa.','Saturation and inverse input pairs have their own domains.']},
   'IAPWS-95':{temperature:{unit:'K',min:251.165,max:1273},pressure:{unit:'MPa',minExclusive:0,max:1000},conditions:['Stable fluid above the implemented melting boundary.','Exact critical point excluded; transport properties have separate limits.']}}}},
 {id:'gas-tables',engineVersion:'1.0.0',runtime:'javascript',methods:['calculate'],models:['BSW2003-technical','BSW2003-VDI4670-caloric-experimental'],resultFormat:'gas-state',
  inputSchemas:{calculate:{selector:'mode',cases:{pt:{p:'p',value:'T',fractions:'x'},ph:{p:'p',value:'h',fractions:'x'},ps:{p:'p',value:'s',fractions:'x'}}}},
  validity:{authority:'Existing BSW2003 and VDI4670 domain checks are authoritative.',temperature:{unit:'K',min:200,max:3300},pressure:{unit:'MPa',minExclusive:0},
   dissociation:{experimental:true,temperature:{unit:'K',min:1200,max:2000},pressure:{unit:'MPa',min:.01,max:5},conditions:['Complete combustion in ordinary air; explicit lambda > 1.05.','Initial mole fractions: N2 > 0, O2 >= 0.01, CO = 0.'],unavailableOutputs:['w','isentropic'],composition:'initial-frozen',equilibriumCompositionComputed:false},steam97WebParityVerified:false}},
 {id:'workflows',engineVersion:'1.0.0',runtime:'javascript-wasm',methods:['project','rankine-sweep','study-report-html','water-process','custom-cycle','library-cycle','cycle-comparison','cycle-preset'],resultFormat:'native',
  validity:{authority:'Each existing workflow validates its own input and physical model.',units:'Native method-specific schemas are preserved; no generic numeric-unit inference.'}},
 ...[['ht','1.2.0'],['fluids','1.3.1']].map(([id,engineVersion])=>({id,engineVersion,runtime:'pyodide',methods:['catalog','describe','call','get','release'],resultFormat:'python-json',
  validity:{authority:'Pinned, unmodified upstream package. Consult the selected function documentation and its correlation domain.',units:'Upstream documented units; no automatic conversion.',numericalAcceptance:'pending',optionalDependencies:'Numba, Pint, plotting and other extras are not bundled.'}}))
]);
export class CalculationModuleError extends Error{
 constructor(code,message,details={}){super(message);this.name='CalculationModuleError';this.code=code;this.details=details;}
}
export function calculationModuleDescriptor(moduleId){
 const descriptor=CALCULATION_MODULES.find(module=>module.id===moduleId);
 if(!descriptor)throw new CalculationModuleError('unsupported-module','Unknown calculation module.',{moduleId});
 return descriptor;
}
function calculationInputSchema(moduleId,methodId,payload){
 const schemas=calculationModuleDescriptor(moduleId).inputSchemas;
 const schema=schemas&&Object.hasOwn(schemas,methodId)?schemas[methodId]:null;
 if(!schema)return {};
 if(!schema.selector)return schema.fields??{};
 const value=payload?.[schema.selector];
 if(typeof value!=='string'||!Object.hasOwn(schema.cases,value))throw new CalculationModuleError('unsupported-method','Unknown calculation input pair.',{field:schema.selector,value});
 return schema.cases[value];
}
export function createCalculationRequest({id,moduleId,methodId,payload,engineVersion,inputUnits}){
 const descriptor=calculationModuleDescriptor(moduleId);
 const schema=calculationInputSchema(moduleId,methodId,payload);
 return {protocolVersion:CALCULATION_PROTOCOL_VERSION,id,moduleId,engineVersion:engineVersion??descriptor.engineVersion,implementationRevision:calculationImplementationRevision(),methodId,payload,
  inputUnits:inputUnits??Object.fromEntries(Object.entries(schema).map(([field,quantity])=>[field,calculationUnitGroups[quantity].canonical]))};
}
export function createLegacyCalculationRequest(id,type,payload){
 const moduleId=type==='calculate'?'water':type==='gas-bsw2003'?'gas-tables':'workflows';
 return {...createCalculationRequest({id,moduleId,methodId:moduleId==='workflows'?type:'calculate',payload}),type};
}
function calculationObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function normalizeCalculationRequest(request){
 if(!calculationObject(request)||request.protocolVersion!==CALCULATION_PROTOCOL_VERSION)throw new CalculationModuleError('protocol','Unsupported calculation protocol.');
 if(!Number.isSafeInteger(request.id)||request.id<1)throw new CalculationModuleError('protocol','Invalid calculation request id.');
 const descriptor=calculationModuleDescriptor(request.moduleId);
 if(request.engineVersion!==descriptor.engineVersion)throw new CalculationModuleError('version-mismatch','Calculation adapter version does not match.',{expected:descriptor.engineVersion,received:request.engineVersion});
 const revision=calculationImplementationRevision();
 if(revision!==null&&request.implementationRevision!==revision)throw new CalculationModuleError('version-mismatch','Calculation implementation revision does not match.',{expected:revision,received:request.implementationRevision});
 if(!descriptor.methods.includes(request.methodId))throw new CalculationModuleError('unsupported-method','Unknown module method.',{methodId:request.methodId});
 if(!calculationObject(request.payload))throw new CalculationModuleError('invalid-input','Calculation arguments must be an object.');
 if(!calculationObject(request.inputUnits))throw new CalculationModuleError('invalid-units','Explicit input units are required.');
 if(request.moduleId!=='workflows'&&request.payload.pressureBasis!==undefined&&request.payload.pressureBasis!=='absolute')throw new CalculationModuleError('invalid-input','Module pressure must be absolute.',{field:'pressureBasis'});
 const schema=calculationInputSchema(request.moduleId,request.methodId,request.payload),payload={...request.payload},canonicalUnits={};
 if(Object.keys(request.inputUnits).some(field=>!Object.hasOwn(schema,field)))throw new CalculationModuleError('invalid-units','Unknown input unit field.');
 for(const [field,quantity] of Object.entries(schema)){
  const spec=calculationUnitGroups[quantity],unit=request.inputUnits[field];
  if(!spec.accepted.includes(unit))throw new CalculationModuleError('invalid-units','Unit does not match the input quantity.',{field,unit,accepted:[...spec.accepted]});
  canonicalUnits[field]=spec.canonical;
  const convert=value=>{if(!Number.isFinite(value))throw new CalculationModuleError('invalid-input','A finite numeric argument is required.',{field});const out=toCanonical(value,unit);if(!Number.isFinite(out))throw new CalculationModuleError('invalid-input','Input unit conversion overflow.',{field});return out;};
  if(field==='fractions'){
   if(!calculationObject(payload.fractions))throw new CalculationModuleError('invalid-input','Gas composition must be an object.',{field});
   payload.fractions=Object.fromEntries(Object.entries(payload.fractions).map(([species,value])=>[species,convert(value)]));
  }else payload[field]=convert(payload[field]);
 }
 if(request.moduleId==='water'&&!['IF97','IAPWS-95'].includes(payload.model??'IF97'))throw new CalculationModuleError('unsupported-model','Unknown water model.',{model:payload.model});
 if(request.moduleId==='gas-tables'&&!['mole','mass'].includes(payload.basis??'mole'))throw new CalculationModuleError('invalid-input','Unknown gas composition basis.',{basis:payload.basis});
 return {descriptor,payload,canonicalUnits};
}
export function calculationReplyIdentity(request){return {protocolVersion:CALCULATION_PROTOCOL_VERSION,id:request?.id,moduleId:request?.moduleId,engineVersion:request?.engineVersion,implementationRevision:request?.implementationRevision,methodId:request?.methodId};}
export function calculationErrorReply(request,error){
 const known=error instanceof CalculationModuleError;
 return {...calculationReplyIdentity(request),status:'error',error:{code:known?error.code:'calculation',message:typeof error?.message==='string'?error.message:'Calculation failed.',details:known?error.details:{}}};
}
export function validateCalculationReply(request,reply){
 if(!calculationObject(reply)||Object.entries(calculationReplyIdentity(request)).some(([key,value])=>reply[key]!==value)||!['ok','error','progress'].includes(reply.status))throw new CalculationModuleError('protocol','Invalid calculation response.');
 if(reply.status==='progress'&&(!calculationObject(reply.progress)||typeof reply.progress.stage!=='string'))throw new CalculationModuleError('protocol','Invalid calculation progress.');
 if(reply.status==='error'&&(!calculationObject(reply.error)||typeof reply.error.code!=='string'||typeof reply.error.message!=='string'))throw new CalculationModuleError('protocol','Invalid calculation error response.');
 if(reply.status==='ok'&&!Object.hasOwn(reply,'result'))throw new CalculationModuleError('protocol','Missing calculation result.');
 return reply;
}
export function calculationQuantities(result,format){
 const quantities={};
 const collect=(state,prefix)=>{if(!calculationObject(state))return;for(const [key,unit] of Object.entries(calculationOutputUnits)){
  if(!Object.hasOwn(state,key))continue;const value=state[key];
  if(value!==null&&!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite calculation output.',{field:prefix+key});
  quantities[prefix+key]={value,unit,status:value===null?'unavailable':'available'};
 }};
 if(format==='gas-state'){
  collect(result,'');
  for(const [field,basis] of [['composition','mole'],['massComposition','mass']]){
   if(!calculationObject(result[field]))continue;
   for(const [species,value] of Object.entries(result[field])){
    if(!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite composition output.',{field:field+'.'+species});
    quantities[field+'.'+species]={value,unit:'1',basis,status:'available'};
   }
  }
  if(result.reference){
   for(const [key,unit] of [['T0','K'],['p0','MPa']])if(Object.hasOwn(result.reference,key)){
    const value=result.reference[key];if(!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite reference output.',{field:'reference.'+key});
    quantities['reference.'+key]={value,unit,status:'available'};
   }
  }
 }
 if(format==='water-state'){
  collect(result.state,'state.');collect(result.saturation,'saturation.');
  collect(result.saturation?.liquid,'saturation.liquid.');collect(result.saturation?.vapor,'saturation.vapor.');
 }
 return quantities;
}
