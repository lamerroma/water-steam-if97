import test from 'node:test';
import assert from 'node:assert/strict';
import {coursework,COURSE_DEFAULTS,courseworkTables} from '../src/coursework.js';
import {reactorApplyVariant,reactorTemperatureRise,reactorConductivity,reactorAnnulusFactor} from '../src/reactor-course.js';
import {REACTOR_VARIANTS,reactorVariant} from '../src/reactor-variants.js';
import {reactorGFactors,reactorBesselJ0,reactorCampaign} from '../src/reactor-neutronics.js';
import {readStudyReport,studyReportHTML} from '../src/study-report.js';
import {readCalculation,readWorkspace} from '../src/workspace.js';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`),run=(patch={},model='IF97')=>coursework({...COURSE_DEFAULTS.reactor,...patch},model);

test('Guide input table has 45 distinct variants with electrical MW and correct lattice',()=>{
 assert.equal(REACTOR_VARIANTS.length,45);assert.deepEqual(REACTOR_VARIANTS.map(r=>r[0]),Array.from({length:45},(_,i)=>i+1));assert.equal(reactorVariant(1).electricalMW,1100);assert.equal(reactorVariant(25).lattice,'hex');assert.equal(reactorVariant(26).layers,17);assert.equal(reactorVariant(45).electricalMW,450);assert.equal(reactorVariant(3).gapMethod,'contact');assert.throws(()=>reactorVariant(46));
});
test('Every supplied variant recalculates geometry, temperatures and neutron results',()=>{
 for(let n=1;n<=45;n++){
 const input=reactorApplyVariant(n,{...COURSE_DEFAULTS.reactor,points:7}),q=coursework(input),m=q.metrics;
 near(m.thermalMW,input.electricalMW/input.plantEfficiency);assert.equal(m.rods,(n<=25?3*input.layers*(input.layers-1)+1:input.layers**2)-input.guides-input.centralTubes);near(m.flow*(q.states[1].h-q.states[0].h),1000*m.thermalMW,1e-7);near(m.fuelPowerResidual,0,1e-5);near(q.controlProfile[0].z,-m.height/2);near(q.controlProfile[6].z,m.height/2);assert.ok(q.neutronics.hot.keff>0);assert.ok(m.maxFuelCenter>=m.maxFuelSurface);
 }
});
test('Constant-conductivity temperature rises independently satisfy cylinder and annular equations',()=>{
 const q=run({points:7,cladMethod:'constant',gapMethod:'constant',fuelMethod:'constant',neutronMethod:'off'}),r=q.profile[3],g=q.geometry,a=q.input;
 near(r.cladInner-r.cladOuter,a.conductionFactor*r.qLinear*1000*Math.log(g.d/g.di)/(2*Math.PI*a.cladConductivity));near(r.fuelSurface-r.cladInner,a.conductionFactor*r.qLinear*1000*Math.log(g.di/g.df)/(2*Math.PI*a.gapConductivity));near(r.fuelCenter-r.fuelSurface,a.conductionFactor*r.qLinear*1000/(4*Math.PI*a.fuelConductivity));
 near(reactorAnnulusFactor(0,1),1);near(reactorAnnulusFactor(.5,1),1+2*.25*Math.log(.5)/.75);assert.ok(reactorAnnulusFactor(.99,1)>0&&reactorAnnulusFactor(.99,1)<.02);
 const annulus=run({holeDiameter:2,fuelMethod:'constant',neutronMethod:'off'});assert.ok(annulus.metrics.maxFuelCenter<q.metrics.maxFuelCenter+1000);
});
test('Material polynomials use mean layer temperature and bracketed residuals',()=>{
 near(reactorConductivity('clad',300),20.0726);near(reactorConductivity('gap',600),.32496);near(reactorConductivity('fuel',1000),3.2561);
 const r=reactorTemperatureRise(350,500,'clad');near(reactorConductivity('clad',350+r.rise/2)*r.rise,500,1e-8);
 const q=run();for(const p of q.profile)for(const key of ['cladResidual','gapResidual','fuelResidual'])near(p[key],0,1e-7);
 assert.throws(()=>reactorTemperatureRise(10000,5,'clad'));
});
test('Zero gap is an explicit contact model and the solid fuel bore limit works',()=>{
 assert.throws(()=>run({gap:0,gapMethod:'guide'}));const p=run({gap:0,gapMethod:'perfect',neutronMethod:'off'}),c=run({gap:0,gapMethod:'contact',neutronMethod:'off'});near(p.profile[3].fuelSurface,p.profile[3].cladInner);assert.ok(c.profile[3].fuelSurface>c.profile[3].cladInner);
});
test('Neutron area conservation, isotope concentrations, k decomposition and initial campaign agree',()=>{
 const q=run(),n=q.neutronics,h=n.hot,c=n.controls;near(h.V0+h.V1+h.V2,h.Vcell,1e-12);near(h.N5/(h.N5+h.N8)*100,n.zones.enrichment);near(h.kinf,h.kinfThermal+h.kinfResonance);near(h.keff,h.kinf*Math.exp(-h.Bsq*h.age)/(1+h.Bsq*h.Lsq));near(n.campaign.profile[0].keff,h.keff,1e-12);near(n.campaign.normalization,1);assert.ok(n.campaign.profile.at(-1).N5<h.N5);assert.ok(n.campaign.profile.at(-1).N9>0);
 const targetThermal=n.cold.nuEff*n.cold.mu*n.cold.phi*c.thetaTarget;near((targetThermal+n.cold.kinfResonance)*n.cold.nonLeak-c.totalWorth,q.input.shutdownTarget,1e-10);near(c.boricAcid/c.boron,61.83/10.81);
});
test('Campaign crossing is located, and a horizon without crossing returns null',()=>{
 const q=run();assert.ok(q.metrics.campaignDays>0&&q.metrics.campaignDays<600);const short=run({campaignMaxDays:10});assert.equal(short.metrics.campaignDays,null);assert.equal(run({campaignTarget:2}).metrics.campaignDays,0);
});
test('g table interpolation is bounded; J0 matches independent mathematical references',()=>{
 near(reactorGFactors(600)[0],.9337);near(reactorGFactors(625)[0],(.9337+.9309)/2);assert.throws(()=>reactorGFactors(299));assert.throws(()=>reactorGFactors(1301));near(reactorBesselJ0(0),1);near(reactorBesselJ0(1),.7651976865579666,1e-14);near(reactorBesselJ0(2.4048255577),0,1e-10);
});
test('Hydraulics exposes separate loss contributions and does not overwrite given pressure drop',()=>{
 const q=run({neutronMethod:'off'}),m=q.metrics;near(m.calculatedDrop,m.frictionDrop+m.localDrop+m.gravityDrop+m.accelerationDrop);near(m.pressureMismatch,m.calculatedDrop-q.input.pressureDrop);assert.equal(q.input.pressureDrop,.3);assert.ok(run({gridCount:0,neutronMethod:'off'}).metrics.localDrop<m.localDrop);
 // Independent substitution of the guide's equivalent pitch and bundle multiplier.
 const pitch=1.27*(1+Math.sqrt(3)/2)/2,pipe=1/(1.82*Math.log10(m.meanRe)-1.64)**2;
 near(m.fBundle,pipe*(.57+.18*(pitch-1)+.53*(1-Math.exp(-(.58+9.2*(pitch-1))))));
 const state=q.states[2],velocity=m.massFlux*state.v;
 near(m.frictionDrop,m.fBundle*m.height/(m.hydraulicDiameter/1000)*velocity**2/(2*state.v)*1e-6);
});
test('CHF can be disabled; the published formula and legacy candidate remain distinct',()=>{
 assert.equal(run({chfMethod:'off'}).chf,null);assert.equal(run().chf.length,25);assert.ok(run().warnings.some(n=>n[1].includes('Eq. (15)')));const q=run({chfMethod:'candidate'});assert.equal(q.chf.length,25);assert.ok(q.warnings.some(n=>n[1].includes('experimental interpretation'))||q.warnings.some(n=>n[1].includes('experimental')));assert.ok(q.chf.every(r=>r.qCritical>0));
});
test('Report recomputes the full reactor draft, retains choices and escapes text',()=>{
 const report=readStudyReport({entries:[{kind:'coursework',input:{...COURSE_DEFAULTS.reactor,evil:'<script>x</script>'},title:'<img src=x>',comment:'<script>x</script>'}]});assert.equal(report.entries[0].input.evil,undefined);const html=studyReportHTML('Course',report,{language:'en'});assert.ok(html.includes('Neutron gas temperature'));assert.ok(html.includes('Campaign'));assert.ok(html.includes('g H₃BO₃/kg'));assert.ok(html.includes('experimental')||html.includes('Experimental'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('t fuel max'));
 const tables=courseworkTables(run());assert.equal(tables[2].rows.length,25);assert.equal(tables[3].rows.length,7);
});
test('Calculation JSON and workspace allow new method choices and reject injected options',()=>{
 const inputs={'cw-resonanceMethod':'gp','cw-boilingMethod':'guide','cw-rodLayout':'effective','cw-controlLayout':'','cw-kind':'reactor','cw-lattice':'square','cw-gapMethod':'contact','cw-cladMethod':'guide','cw-neutronMethod':'course','cw-rodMethod':'course','cw-electricalMW':'1100'};assert.deepEqual(readCalculation(JSON.stringify({module:'coursework',inputs})).record.inputs,inputs);assert.throws(()=>readWorkspace({active:'coursework',panels:{coursework:{inputs:{'cw-kind':'reactor','cw-gapMethod':'evil'},calculated:true}}}));
});
test('Invalid geometries, isotope settings, finite values and table extrapolations are rejected',()=>{
 for(const patch of [{plantEfficiency:0},{plantEfficiency:2},{holeDiameter:9},{guides:500},{points:8},{freshEnrichment:0},{reloadZones:0},{coldC:20},{controlAssemblies:9999},{plutoniumShare:1},{campaignMaxDays:1e6},{controlRadiusFraction:1},{gap:0},{tOut:400},{electricalMW:Infinity}])assert.throws(()=>run(patch));
});
test('IF97 and IAPWS-95 independently give consistent water-driven reactor results',()=>{
 const a=run({points:7}),b=run({points:7},'IAPWS-95');assert.ok(Math.abs(a.metrics.flow/b.metrics.flow-1)<.003);assert.ok(Math.abs(a.metrics.maxFuelCenter/b.metrics.maxFuelCenter-1)<.005);near(b.metrics.balanceResidual,0,1e-7);
});

import {reactorResonanceIntegral,reactorBoiling,reactorCHF,reactorReadLayout} from '../src/reactor-methods.js';
import {reactorCoverage} from '../src/reactor-coverage.js';
import {reactorCHFSVG,reactorLayoutSVG} from '../src/reactor-course-tables.js';

test('Published CHF substitution resolves both exponent mistakes with explicit units',()=>{
 const r=reactorCHF(15.55,4358.55,-.01389);
 near(r.m,.18831979,1e-10);near(r.n,1.13275);
 // Independent printed operands: .795*4358.55^.18831979*1.01389^1.13275*.712325.
 near(r.qCritical,2.7873503913244444,1e-10);
 const correctX=(1498.1-1631.8)/962.9;near(correctX,-.1388513864368055,1e-12);
 assert.ok(reactorCHF(15.55,4358.55,correctX).qCritical>r.qCritical);
 assert.notEqual(reactorCHF(15.55,4358.55,correctX,'candidate').m,reactorCHF(15.55,4358.55,correctX).m);
 assert.throws(()=>reactorCHF(22.064,4358,0));assert.throws(()=>reactorCHF(15.5,0,0));assert.throws(()=>reactorCHF(15.5,4000,1));
});
test('Boiling does not activate below onset, is continuous, and uses pressure in bar',()=>{
 const a={pMPa:15.5,coolantC:327.1,saturationC:344.8,alphaConv:59177.46,method:'guide'},threshold=59177.46*17.7;
 const below=reactorBoiling({...a,designFlux:987608});assert.equal(below.active,false);near(below.alpha,a.alphaConv);near(below.wall,327.1+987608/59177.46);
 const onset=reactorBoiling({...a,designFlux:threshold});near(onset.wall,344.8,1e-10);
 const above=reactorBoiling({...a,designFlux:threshold+100000});near(above.alphaBoiling,.027*155**1.33*100000**(2/3),1e-8);near(above.wall,344.8+100000/Math.hypot(a.alphaConv,above.alphaBoiling));assert.ok(above.wall>344.8&&above.wall<above.convectiveWall);
 const outside=reactorBoiling({...a,pMPa:7,designFlux:threshold+100000});assert.equal(outside.outside,true);assert.equal(outside.active,false);
});
test('GP/Dancoff/Doppler uses calculated geometry and changes with lattice, fuel temperature and Bell factor',()=>{
 const a=run(),h=a.neutronics.hot,r=h.resonance;
 near(r.shapeBeta,17/3);near(h.baseI8,19.68524996801194,1e-9);near(h.I8*1e24,h.baseI8*h.KT,1e-10);
 near(r.chordFuel,4*h.V0/(Math.PI*(a.geometry.df+a.geometry.hole)*100));
 near(r.baseBarn,5.55+26.6*Math.sqrt(r.surfaceMass*r.scatteringFactor*r.shielding));
 assert.notEqual(run({lattice:'square',layers:18}).neutronics.hot.resonance.shapeBeta,r.shapeBeta);
 assert.notEqual(run({bellFactor:1.5}).neutronics.hot.baseI8,h.baseI8);
 near(run({resonanceMethod:'given',resonanceI8:22}).neutronics.hot.baseI8,22);
 assert.ok(a.neutronics.cold.KT<h.KT);assert.ok(h.resonance.dancoff>=0&&h.resonance.dancoff<=1);
});
test('Ring table and coordinate layout sum individual Bessel weights and constrain counts',()=>{
 const ring=run({controlAssemblies:7,rodLayout:'rings',controlLayout:'0;1\n0,4;6'}),c=ring.neutronics.controls,R=ring.metrics.diameter*50+ring.neutronics.cold.extension;
 near(c.totalWorth,c.centralWorth*18*(1+6*reactorBesselJ0(2.405*40/R)**2));assert.equal(c.rings.length,2);
 const coords=run({controlAssemblies:2,rodLayout:'coordinates',controlLayout:'0;0\n0,4;0'}),d=coords.neutronics.controls;
 near(d.rings[1].radius,.4);near(d.weightedRods,18*(1+reactorBesselJ0(d.rings[1].argument)**2));assert.ok(reactorLayoutSVG(coords).includes('cx="'));
 for(const text of ['', '0;2', '-1;7', '99;7', '0;1\n0,4;6.5', '<img>;7'])assert.throws(()=>run({controlAssemblies:7,rodLayout:'rings',controlLayout:text}));
 assert.throws(()=>reactorReadLayout('0;0\n0;0','coordinates',1,2,18));
});
test('Full draft tables and report include boiling, layout, CHF and per-section statuses',()=>{
 const q=run({controlAssemblies:7,rodLayout:'rings',controlLayout:'0;1\n0.4;6'}),tables=courseworkTables(q,true);
 assert.ok(tables.some(t=>t.title.includes('boiling')));assert.ok(tables.some(t=>t.title.includes('layout')));assert.ok(tables.some(t=>t.title.includes('coverage')));assert.equal(reactorCoverage(q).length,13);assert.equal(reactorCoverage(q).find(r=>r[0]==='6')[3],'layout');
 assert.equal(reactorCoverage(run({lattice:'square',layers:18})).find(r=>r[0]==='4.4 boundary')[3],'given');
 const html=studyReportHTML('Reactor',readStudyReport({entries:[{kind:'coursework',input:q.input}]}),{language:'en'});assert.ok(html.includes('0;1'));assert.equal((html.match(/<svg /g)||[]).length,4);assert.ok(reactorCHFSVG(q).includes('CHF/q'));
});
test('Older reactor report inputs and workspace retain explicitly given resonance and no boiling correction',()=>{
 const input={...COURSE_DEFAULTS.reactor};for(const k of ['bellFactor','chfLimit','resonanceMethod','boilingMethod','rodLayout','controlLayout'])delete input[k];const r=readStudyReport({entries:[{kind:'coursework',input}]});assert.equal(r.entries[0].input.resonanceMethod,'given');assert.equal(r.entries[0].input.boilingMethod,'off');
 const p=readWorkspace({active:'coursework',panels:{coursework:{inputs:{'cw-kind':'reactor'},calculated:true}}});assert.equal(p.panels.coursework.inputs['cw-resonanceMethod'],'given');
});

test('Rod count search only uses the supplied layout and reports an unmet boron limit',()=>{
 const q=run({controlAssemblies:7,rodLayout:'rings',controlLayout:'0;1\n0.4;6'}),search=q.neutronics.controlStudy;
 assert.equal(search.rows.length,8);assert.equal(search.rows.at(-1).assemblies,7);near(search.rows.at(-1).rodWorth,q.neutronics.controls.totalWorth);near(search.rows.at(-1).boron,q.metrics.boron);
 assert.ok(search.rows.every((r,i)=>i===0||r.boron<=search.rows[i-1].boron));assert.equal(search.required,null);
 const easy=run({controlAssemblies:7,rodLayout:'rings',controlLayout:'0;1\n0.4;6',boronLimit:100});assert.equal(easy.neutronics.controlStudy.required,0);
});


test('Boundary correction is exposed in both states and report; square gamma remains an explicit input',()=>{
 const hex=run(),square=coursework(reactorApplyVariant(28,{...COURSE_DEFAULTS.reactor,squareBoundaryGamma:1.12}));
 near(square.neutronics.hot.boundaryGamma,1.12);near(square.neutronics.cold.boundaryGamma,1.12);
 const hot=hex.neutronics.hot,r0=Math.sqrt(hot.V0/Math.PI),psi=Math.sqrt((hot.V0+hot.V1+hot.V2)/hot.V0);
 near(hot.boundaryGamma,.64+(1.6745/psi-.3114)/(r0*hot.str1+3.217/psi-.5202));
 assert.ok(square.neutronSteps.some(r=>r.key==='boundaryGamma'&&r.value===1.12&&r.formula.includes('вручну')));
 const changed=coursework({...square.input,squareBoundaryGamma:.9});assert.notEqual(changed.neutronics.hot.keff,square.neutronics.hot.keff);
});
test('External cell screening limitation reaches course notes without changing CHF status',()=>{
 const q=run();assert.ok(q.notes.some(([uk,en])=>uk.includes('IAEA ZR-6')&&en.includes('Physical screening failed')));
 assert.equal(q.notes.some(([uk])=>uk==='Розрахунок CHF вимкнено користувачем.'),q.input.chfMethod==='off');
 const off=run({neutronMethod:'off',chfMethod:'off'});assert.ok(off.notes.some(([uk])=>uk==='Розрахунок CHF вимкнено користувачем.'));assert.ok(!off.notes.some(([uk])=>uk.includes('IAEA ZR-6')));
});
