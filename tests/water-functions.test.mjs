import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize,calculate} from '../src/engine.js';
import {parseFnLine,evaluateFnProgram,buildFnFormula,fnProgramCSV,FN_PROPERTIES,FN_ARGUMENTS,FnError,FN_MAX_POINTS} from '../src/water-functions.js';
import {readWorkspace,WORKSPACE_PANELS} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const catalogs=Object.fromEntries(['uk','en'].map(l=>[l,JSON.parse(fs.readFileSync(new URL(`../src/locales/${l}.json`,import.meta.url),'utf8'))]));
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b} (±${tol})`);
const one=(text,model)=>{const l=evaluateFnProgram(text,{model}).lines[0];if(l.error)throw new Error(JSON.stringify(l.error));return l.value;};
const err=text=>evaluateFnProgram(text).lines[0].error?.code;

test('property functions reproduce the calculator and accept units on arguments',()=>{
 const q=calculate('pt',1,523.15).state;
 for(const f of ['h(p=1; t=250)','h(p=10 бар; t=250 °C)','h(p=1000 кПа; T=523,15)','h(t=482 °F; p=1 MPa)','h(T=523.15 K; p=1e6 Па)'])near(one(f),q.h,1e-9);
 near(one('v(p=145.0377377 psi; t=250)'),q.v,1e-9);
 near(one('t(p=1; h=2943.2221652337)'),250,1e-6);near(one('T(p=1; s=6.9266227397 kJ/(kg K))'),523.15,1e-6);
 near(one('t(h=2943.2221652337 кДж/кг; v=0.2327389333 м3/кг)'),250,1e-4);
 near(one('rho(p=1; t=250)'),q.rho,1e-9);near(one('k(p=1; t=250)'),q.isentropic,1e-12);near(one('a(p=1; t=250)'),q.diffusivity,1e-18);
 near(one('h(p=1; x=50 %)'),calculate('px',1,.5).state.h,1e-9);near(one('h(t=100; x=1)'),calculate('tx',373.15,1).state.h,1e-9);
 near(one('pKw(p=0.101325; t=25)'),13.995,3e-3);near(one('nD(p=0.101325; t=25; wl=589.29 нм)'),1.3329,2e-4);
 assert.ok(one('nD(p=0.1; t=25; wl=0.4 мкм)')>one('nD(p=0.1; t=25; wl=0.7 мкм)'));
 near(one('h(p=1; t=250; model=IAPWS-95)'),calculate('pt',1,523.15,'IAPWS-95').state.h,1e-9);
 near(one('h(p=1; t=250)','IAPWS-95'),calculate('pt',1,523.15,'IAPWS-95').state.h,1e-9);
});
test('saturation-line functions, expansion with efficiency and forced IF97 regions',()=>{
 const sat=calculate('satt',373.15).saturation;
 near(one('psat(t=100)'),sat.p,1e-12);near(one('tsat(p=0.101325)'),99.9743,1e-3);near(one('Tsat(p=1)'),calculate('satp',1).saturation.T,1e-9);
 near(one('r(t=100)'),sat.latentHeat,1e-9);near(one('dpsdt(T=373.15)'),sat.dpsdt,1e-12);near(one('sigma(t=25)'),.07197,1e-5);
 const h0=calculate('pt',10,823.15).state,h2s=calculate('ps',.005,h0.s).state.h,h2=h0.h-.85*(h0.h-h2s);
 near(one('h(p=10; t=550; p2=0.005; eta=0.85)'),h2,1e-9);near(one('h(p=10; t=550; p2=5 кПа; eta=85 %)'),h2,1e-9);
 near(one('x(p=10; t=550; p2=0.005; eta=0.85)'),calculate('ph',.005,h2).state.x,1e-12);
 near(one('s(p=10; t=550; p2=0.005)'),h0.s,1e-6);
 const l=evaluateFnProgram('h(p=10; t=550; p2=0.005; eta=0.85)').lines[0];assert.deepEqual(l.notes,['expansion']);
 near(one('h(p=1; t=250; region=2)'),calculate('pt',1,523.15).state.h,1e-9);
 const meta=evaluateFnProgram('h(p=1; t=150; region=2)').lines[0];assert.ok(meta.value>2600);assert.deepEqual(meta.notes,['regionForced']);
 assert.equal(err('mu(p=1; t=150; region=2)'),'regionProperty');assert.equal(err('h(p=1; h=500; region=1)'),'regionNeedsPT');assert.equal(err('h(p=1; t=150; region=3)'),'regionValue');
 assert.equal(err('h(p=1; t=150; eta=0.8)'),'etaNeedsP2');assert.equal(err('h(p=1; t=300; p2=0.1; eta=1.5)'),'etaRange');
});
test('arithmetic, variables, comments and math functions follow the line order',()=>{
 const r=evaluateFnProgram(`# цикл\nh1 = h(p=10; t=550)\n\n// кінець\nh2 = h(p=0.005; s=s(p=10; t=550))\ndh = h1 - h2\n-dh/2 + 2^3*1,5\nsqrt(4) + ln(exp(1)) + log10(100) + abs(-1)\nq = dh * 2`);
 assert.equal(r.lines.length,6);const [a,b,c,d,e,f]=r.lines;
 near(c.value,a.value-b.value,1e-12);near(d.value,-c.value/2+12,1e-12);near(e.value,6,1e-12);near(f.value,2*c.value,1e-12);
 assert.equal(a.target,'h1');assert.equal(r.variables.q,f.value);assert.equal(a.line,2);assert.equal(c.unit,'');assert.equal(a.unit,'кДж/кг');
 assert.equal(err('y + 1'),'unknownVariable');assert.equal(err('h = 5'),'reservedName');assert.equal(err('1/0'),'mathDomain');assert.equal(err('sqrt(-1)'),'mathDomain');
});
test('ranges produce series and keep errors per point',()=>{
 const l=evaluateFnProgram('cp(p=1; t=100..300 step 50)').lines[0];
 assert.deepEqual(l.rows.map(r=>r.argument),[100,150,200,250,300]);assert.equal(l.argument,'t');assert.equal(l.argumentUnit,'°C');
 for(const r of l.rows)near(r.value,calculate('pt',1,r.argument+273.15).state.cp,1e-12);
 const nested=evaluateFnProgram('h(p=0.005; s=s(p=10..12 step 1; t=550))').lines[0];assert.equal(nested.rows.length,3);assert.equal(nested.argument,'p');
 assert.equal(evaluateFnProgram('h(p=1; t=0..100)').lines[0].rows.length,11);
 const decreasing=evaluateFnProgram('h(p=1; t=300..100 step -100)').lines[0];assert.deepEqual(decreasing.rows.map(r=>r.argument),[300,200,100]);
 const partial=evaluateFnProgram('x(p=1; t=100..300 step 100)').lines[0];assert.equal(partial.rows[0].error.code,'unavailable');
 assert.equal(err('h(p=1..2; t=100..200)'),'oneRange');assert.equal(err('y = h(p=1; t=1..2)'),'rangeAssign');
 assert.equal(err(`h(p=1; t=0..${FN_MAX_POINTS} step 0.5)`),'tooManyPoints');assert.equal(err('h(p=1; t=0..10 step -1)'),'badRange');
});
test('syntax and argument errors carry stable translated codes',()=>{
 const cases={'foo(p=1; t=2)':'unknownFunction','h(p=1; q=2)':'unknownArgument','h(p=1; p=2)':'duplicateArgument','h(p=1; t=20 бар)':'wrongUnit','h(p=1; t=)':'unexpected','h(p=1; t=2':'expected','h(p=1)':'pairNeeded','h(h=1; x=0.5)':'unsupportedPair','psat(p=1; t=100)':'saturationArgs','h(p=1; t=100; model=XYZ)':'unknownModel','h(p=1; T=300; t=20)':'duplicateArgument','x(p=1; t=300)':'unavailable','h(p=1; t=100) 5':'unexpected'};
 for(const [text,code] of Object.entries(cases))assert.equal(err(text),code,text);
 assert.equal(evaluateFnProgram('h(p=1; t=-100)').lines[0].error.code,'engine');
 assert.throws(()=>parseFnLine('h(p=1;'),FnError);
 const codes=['expected','unexpectedEnd','unexpected','unknownFunction','duplicateArgument','wrongUnit','expectedArgument','unknownArgument','expectedModel','reservedName','badRange','tooManyPoints','unknownModel','saturationArgs','notNumber','unavailable','pairNeeded','unsupportedPair','regionNeedsPT','regionValue','regionExpansion','regionProperty','etaRange','etaNeedsP2','unknownVariable','mathDomain','oneRange','rangeAssign'];
 for(const code of codes)for(const l of ['uk','en'])assert.ok(catalogs[l]['fn.error.'+code],l+' '+code);
 const src=fs.readFileSync(new URL('../src/water-functions.js',import.meta.url),'utf8');for(const m of src.matchAll(/fnFail\('([a-zA-Z]+)'/g))assert.ok(codes.includes(m[1]),'untranslated '+m[1]);
});
test('every function and argument is documented in both languages; builder, CSV and workspace',()=>{
 for(const key of Object.keys(FN_PROPERTIES))for(const l of ['uk','en'])assert.ok(catalogs[l]['fn.prop.'+key],l+' prop '+key);
 for(const key of Object.keys(FN_ARGUMENTS))for(const l of ['uk','en'])assert.ok(catalogs[l]['fn.arg.'+key],l+' arg '+key);
 assert.equal(buildFnFormula('h',[{name:'p',value:'10',unit:'бар'},{name:'t',value:' 250 ',unit:''}],'IAPWS-95'),'h(p=10 бар; t=250; model=IAPWS-95)');
 near(one(buildFnFormula('s',[{name:'p',value:'1'},{name:'t',value:'250'}])),calculate('pt',1,523.15).state.s,1e-12);
 const csv=fnProgramCSV(evaluateFnProgram('h(p=1; t=250)\ncp(p=1; t=100..200 step 100)\nfoo(p=1)'));
 const rows=csv.trim().split('\n');assert.equal(rows.length,5);assert.match(rows[1],/^1;"h\(p=1; t=250\)";;;2943\.22/);assert.match(rows[4],/unknownFunction$/);
 assert.ok(WORKSPACE_PANELS.includes('functions'));
 const w=readWorkspace({active:'functions',panels:{functions:{inputs:{'fn-model':'IAPWS-95','fn-text':'h(p=1; t=250)\n'.repeat(500)},calculated:true}}});
 assert.equal(w.panels.functions.inputs['fn-model'],'IAPWS-95');
 assert.throws(()=>readWorkspace({active:'functions',panels:{functions:{inputs:{'fn-model':'X'},calculated:false}}}));
 assert.throws(()=>readWorkspace({active:'functions',panels:{functions:{inputs:{'fn-b-prop':'h'},calculated:false}}}));
});
