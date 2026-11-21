import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {chSaturation,chVoidFraction,chFrictionGradient,chChen,chBiasi,chZuber,chWallSuperheat,chHeatFluxShape,chChannel,CH_VOID_METHODS} from '../src/channel-th.js';
import {readWorkspace,WORKSPACE_PANELS} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const close=(a,b,rel=1e-6)=>assert.ok(Math.abs(a-b)<=rel*Math.abs(b),`${a} vs ${b}`);
// Reference values: fluids 1.3.1 / ht 1.2.0 (vendored wheels) with the same
// IF97 saturation properties at 7 MPa, G = 1500 kg/(m²·s), D = 12.5 mm.
const sat=chSaturation(7),D=.0125,G=1500;
test('Saturation properties at 7 MPa come from IF97',()=>{close(sat.Tsat,558.9800228057516,1e-9);close(sat.rhol,739.7236643757099,1e-9);close(sat.hfg,1505132.020955599,1e-9);assert.ok(sat.sigma>.017&&sat.sigma<.018);});
test('Void fraction models match fluids',()=>{
 const ref={.05:[.515964,.281124,.418722,.432104],.2:[.835074,.650048,.702964,.696876],.5:[.952949,.881378,.882196,.86136]};
 for(const [x,values] of Object.entries(ref))CH_VOID_METHODS.forEach((m,i)=>close(chVoidFraction(m,+x,sat),values[i],2e-6));
 assert.equal(chVoidFraction('zivi',0,sat),0);assert.equal(chVoidFraction('zivi',1,sat),1);assert.throws(()=>chVoidFraction('bad',.5,sat),/ch.error.method/);
});
test('Frictional gradients match fluids Lockhart_Martinelli and Friedel',()=>{
 const ref={.05:[11499.535114312606,5195.38482078448],.2:[31522.156244453297,11008.429248095947],.5:[51586.70443588742,22068.43523662716]};
 for(const [x,[lm,fr]] of Object.entries(ref)){close(chFrictionGradient('lockhart-martinelli',{G,x:+x,D,sat}).gradient,lm,1e-9);close(chFrictionGradient('friedel',{G,x:+x,D,sat}).gradient,fr,1e-6);}
 const h=chFrictionGradient('homogeneous',{G,x:0,D,sat});assert.ok(h.gradient>0&&h.Re>1e5);
});
test('Chen flow boiling matches ht Chen_Edelstein; heat-flux form inverts it',()=>{
 close(chChen({G,x:.2,D,sat,Te:8}).h,59427.27779363528,1e-9);
 const r=chChen({G,x:.2,D,sat,q:5e5});close(r.h*r.Te,5e5,1e-6);
});
test('Zuber pool CHF matches ht; wall superheat formulas',()=>{
 close(chZuber({hfg:2256.4e3,rhog:.5904,rhol:958.35,sigma:.0589}),1101497.9219275073,1e-9);
 close(chWallSuperheat('jens-lottes',1e6,6.2),25*Math.exp(-1),1e-12);close(chWallSuperheat('thom',4e6,8.7),45*Math.exp(-1),1e-12);
});
test('Biasi CHF: published functions, low/high-quality branches and range notes',()=>{
 // F(70 bar) and H(70 bar) by hand from the Biasi functions.
 const b=chBiasi({p:7,G:2000,D:.01,x:.2});close(b.F,.7249+.099*70*Math.exp(-.032*70),1e-12);close(b.H,-1.159+.149*70*Math.exp(-.019*70)+8.99*70/(10+4900),1e-12);
 close(b.q1,1.883e3/(1**.4*200**(1/6))*(b.F/200**(1/6)-.2)*1e4,1e-12);assert.equal(b.q,Math.max(b.q1,b.q2));assert.deepEqual(b.notes,[]);
 const low=chBiasi({p:7,G:250,D:.01,x:.3});assert.equal(low.q,low.q2);
 assert.ok(chBiasi({p:7,G:2000,D:.01,x:.2}).q>chBiasi({p:7,G:2000,D:.01,x:.6}).q,'CHF falls with quality');
 assert.deepEqual(chBiasi({p:16,G:50,D:.05,x:-.1}).notes,['ch.note.biasiPressure','ch.note.biasiMassFlux','ch.note.biasiDiameter','ch.note.biasiSubcooled']);
});
test('Chopped cosine shape: peaking factor and symmetry',()=>{
 const s=chHeatFluxShape('cosine',3.7,3.7);close(s.peaking,Math.PI/2,1e-12);close(s.f(0),s.f(3.7),1e-12);
 close(chHeatFluxShape('cosine',3.7,4.2).peaking,1/(2*Math.sin(Math.PI*3.7/8.4)/(Math.PI*3.7/4.2)),1e-12);assert.throws(()=>chHeatFluxShape('cosine',3.7,3),/extrapolated/);
});
test('Heated channel: energy balance, boiling onset order, DNBR and pressure drop',()=>{
 const r=chChannel({p:7,Tin:543.15,G,D,L:3.7,qAvg:5e5,shape:'cosine',Le:4.2,nodes:40});
 const last=r.nodes.at(-1),first=r.nodes[0];
 close((last.h-first.h)*1e3*r.massFlow,r.power,2e-3);
 assert.ok(r.zBoil<r.zSat&&r.zSat<3.7);assert.ok(r.xOut>.15&&r.xOut<.25);assert.equal(r.Tout,r.sat.Tsat);
 assert.ok(r.minDNBR>1&&r.zMin>r.zSat);assert.equal(r.minDNBR,Math.min(...r.nodes.map(n=>n.dnbr)));
 assert.ok(r.dpFric>0&&r.dpAcc>0&&r.dpGrav>0);close(r.dpTotal,r.dpFric+r.dpAcc+r.dpGrav,1e-12);
 const u=chChannel({p:7,Tin:543.15,G,D,L:3.7,qAvg:5e5,shape:'uniform',nodes:10});assert.equal(u.peaking,1);close(u.xOut,r.xOut,1e-3);
 assert.throws(()=>chChannel({p:7,Tin:600,G,D,L:3.7,qAvg:5e5}),/inletSubcooled/);
 const dry=chChannel({p:7,Tin:543.15,G:300,D,L:3.7,qAvg:8e5,shape:'uniform',nodes:20});assert.ok(dry.notes.includes('ch.note.dryout'));
});
test('Channel panel inputs are kept by the project workspace',()=>{
 assert.ok(WORKSPACE_PANELS.includes('channel'));
 const w=readWorkspace({active:'channel',panels:{channel:{inputs:{'ch-calc':'channel','ch-p':'7','ch-shape':'cosine','ch-frictionMethod':'friedel','ui-unit-ch-p':'bar'},calculated:true}}});
 assert.equal(w.panels.channel.inputs['ch-calc'],'channel');
 assert.throws(()=>readWorkspace({active:'channel',panels:{channel:{inputs:{'ch-calc':'evil'},calculated:false}}}),/Невідомий режим/);
});
