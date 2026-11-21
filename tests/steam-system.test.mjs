import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {PIPE_SCHEDULES,KV_TO_CV,airViscosity,pipeFluid,sizePipe,pipePressureDrop,condensateReturn,valveLiquid,valveGas,valve,orificeFlow,orificeDischarge} from '../src/steam-system.js';
import {darcyFactor} from '../src/flow.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const rel=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);

test('pipe schedules give published inner diameters',()=>{
 const id=(s,n)=>PIPE_SCHEDULES[s].pipes.find(q=>q.name===n).id;
 rel(id('ANSI-40','NPS 4'),102.26,1e-4);rel(id('ANSI-80','NPS 2'),49.25,1e-3);
 rel(id('JIS-40','100A'),102.3,1e-4);rel(id('DIN','DN100'),107.1,1e-4);
 for(const s of Object.values(PIPE_SCHEDULES))for(let i=1;i<s.pipes.length;i++)assert.ok(s.pipes[i].id>s.pipes[i-1].id);
});

test('air viscosity follows Sutherland reference values',()=>{rel(airViscosity(273.15),1.716e-5,1e-12);rel(airViscosity(293.15),1.813e-5,2e-3);});

test('saturated steam line sizing picks the first pipe at or below the target velocity',()=>{
 const f=pipeFluid({kind:'steam',p:1});assert.equal(f.x,1);
 const r=sizePipe({fluid:f,massFlow:1,velocity:25,schedule:'DIN'});
 rel(r.requiredId,Math.sqrt(4/(Math.PI*f.rho*25)));assert.equal(r.pipe.name,'DN100');assert.ok(r.velocity<=25);
 assert.equal(sizePipe({fluid:f,massFlow:500,velocity:25}).pipe,null);
 assert.throws(()=>pipeFluid({kind:'steam',p:1,T:350}));assert.throws(()=>pipeFluid({kind:'water',p:1,T:500}));
});

test('short line pressure drop equals single-step Darcy–Weisbach',()=>{
 for(const fluid of [pipeFluid({kind:'water',p:.5,T:333.15}),pipeFluid({kind:'steam',p:1,T:523.15}),pipeFluid({kind:'air',p:.7,T:293.15})]){
  const D=.1,L=1,m=fluid.kind==='water'?10:.5,eps=4.5e-5,v=m/(fluid.rho*Math.PI*D*D/4),Re=v*D/fluid.mu;
  const ref=darcyFactor(Re,eps/D).factor*L/D*fluid.rho*v*v/2,r=pipePressureDrop({fluid,massFlow:m,diameter:D,length:L,roughness:eps});
  rel(r.frictionPressure,ref,2e-3);rel(r.velocity,v);
 }
});

test('compressible steam line loses more pressure than the incompressible estimate and keeps h',()=>{
 const fluid=pipeFluid({kind:'steam',p:.5}),D=.05,L=100,m=.3;
 const r=pipePressureDrop({fluid,massFlow:m,diameter:D,length:L,localK:2});
 const v=m/(fluid.rho*Math.PI*D*D/4),inc=darcyFactor(v*D/fluid.mu,4.5e-5/D).factor*L/D*fluid.rho*v*v/2;
 assert.ok(r.frictionPressure>inc);assert.ok(r.outletVelocity>r.velocity);rel(r.localPressure,2*fluid.rho*v*v/2);
 rel(r.outletPressure,.5-r.lossPressure/1e6,1e-9);// Below ~3 MPa throttling dry saturated steam at constant h gives slight superheat.
 assert.equal(r.outletQuality,null);assert.ok(r.outletTemperature<fluid.T);
 assert.throws(()=>pipePressureDrop({fluid,massFlow:5,diameter:.015,length:100}));
});

test('condensate flash fraction matches the enthalpy balance',()=>{
 const r=condensateReturn({p1:1,p2:.101325,massFlow:1});
 assert.ok(r.flashFraction>.150&&r.flashFraction<.154,String(r.flashFraction));
 rel(r.flashSteam+r.liquid,1);assert.ok(r.volumeFlow>r.steamVolumeFlow);
 assert.ok(condensateReturn({p1:1,p2:.101325,massFlow:1,subcooling:20}).flashFraction<r.flashFraction);
 assert.throws(()=>condensateReturn({p1:.1,p2:.2,massFlow:1}));
});

test('liquid valve: Kv definition, round trips and choked limit',()=>{
 const a=valveLiquid({mode:'flow',rho:1000,p1:.5,dp:.1,kv:10});rel(a.volumeFlow*3600,10);rel(a.cv,10*KV_TO_CV);
 const b=valveLiquid({mode:'kv',rho:1000,p1:.5,dp:.1,volumeFlow:a.volumeFlow});rel(b.kv,10);
 const c=valveLiquid({mode:'dp',rho:1000,p1:.5,kv:10,volumeFlow:a.volumeFlow});rel(c.dp,.1);
 const d=valveLiquid({mode:'flow',rho:950,p1:.3,dp:.29,kv:10,FL:.9,pv:.1});assert.ok(d.choked);
 rel(d.volumeFlow*3600,10*Math.sqrt(d.dpChoked/.1/.95));
});

test('gas valve: IEC expansion factor, choked flow and inverse modes',()=>{
 const p1=1,rho1=5,kappa=1.3,xT=.72,kv=20;
 const x=.2,Fg=kappa/1.4,Y=1-x/(3*Fg*xT),W=27.3*kv*Y*Math.sqrt(x*10*rho1)/3600;
 const a=valveGas({mode:'flow',p1,rho1,kappa,dp:.2,kv,xT});rel(a.massFlow,W);rel(a.Y,Y);assert.equal(a.choked,false);
 rel(valveGas({mode:'kv',p1,rho1,kappa,dp:.2,massFlow:W,xT}).kv,kv);
 rel(valveGas({mode:'dp',p1,rho1,kappa,massFlow:W,kv,xT}).dp,.2,1e-9);
 const c1=valveGas({mode:'flow',p1,rho1,kappa,dp:.8,kv,xT}),c2=valveGas({mode:'flow',p1,rho1,kappa,dp:.9,kv,xT});
 assert.ok(c1.choked);rel(c1.massFlow,c2.massFlow);rel(c1.Y,2/3);
 assert.throws(()=>valveGas({mode:'dp',p1,rho1,kappa,massFlow:c1.massFlow*1.01,kv,xT}));
});

test('valve dispatch uses IF97 inlet state for steam and water',()=>{
 const s=valve({fluid:pipeFluid({kind:'steam',p:1}),mode:'kv',dp:.2,massFlow:1});assert.equal(s.phase,'gas');assert.ok(s.kv>0);
 const w=valve({fluid:pipeFluid({kind:'water',p:1,T:353.15}),mode:'flow',dp:.1,kv:5});assert.equal(w.phase,'liquid');assert.ok(w.massFlow>0);
});

test('orifice flow and free discharge',()=>{
 const w=pipeFluid({kind:'water',p:.5,T:293.15}),r=orificeFlow({fluid:w,d:.05,D:.1,dp:20000});
 rel(r.massFlow,.61/Math.sqrt(1-.5**4)*Math.PI*.05**2/4*Math.sqrt(2*20000*w.rho));assert.equal(r.epsilon,1);
 const air=pipeFluid({kind:'air',p:.7,T:293.15}),g=orificeFlow({fluid:air,d:.05,D:.1,dp:20000});assert.ok(g.epsilon<1&&g.epsilon>.98);
 const d=orificeDischarge({fluid:air,d:.005,p2:.101325});assert.ok(d.choked);rel(d.criticalRatio,(2/2.4)**(1.4/.4),1e-3);
 const k=air.kappa,rc=d.criticalRatio,ref=.61*Math.PI*.005**2/4*Math.sqrt(2*k/(k-1)*.7e6*air.rho*(rc**(2/k)-rc**((k+1)/k)));rel(d.massFlow,ref);
 assert.ok(orificeDischarge({fluid:air,d:.005,p2:.6}).massFlow<d.massFlow);
 assert.throws(()=>orificeDischarge({fluid:w,d:.005,p2:.1}));
});
