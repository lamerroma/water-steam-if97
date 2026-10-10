import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initializeHumidAir,getCoolPropBackend} from '../src/humid-air-scientific.js';import {realGasState} from '../src/real-gases.js';
await initializeHumidAir(fs.readFileSync(new URL('../vendor/coolprop.wasm',import.meta.url)));
const refs=JSON.parse(fs.readFileSync(new URL('fixtures/nist-gases.json',import.meta.url)));
for(const r of refs.states.filter(r=>['CH4','He'].includes(r.id)))test(`Transport discrepancy input-path control ${r.id} ${r.T} K ${r.p} MPa`,()=>{const q=realGasState(r.id,r.p,r.T),c=getCoolPropBackend(),f=r.id==='CH4'?'Methane':'Helium';for(const [key,out] of [['mu','VISCOSITY'],['lambda','CONDUCTIVITY']]){const d=c.PropsSI(out,'Dmass',q.rho,'T',r.T,f);assert.ok(Math.abs(q[key]-d)/Math.abs(d)<2e-8,key);}});
// Friend, Ely & Ingham (1989), Appendix Table A1: independently printed dilute-limit conductivity.
// The table is rounded to .01 mW/(m K); old/new ideal heat-capacity EOS differences remain.
for(const [T,expected] of [[100,9.83],[200,21.64],[300,34.32],[400,49.96]])test(`Methane primary Friend A1 lambda ${T} K`,()=>{const x=getCoolPropBackend().PropsSI('CONDUCTIVITY','Dmolar',1e-9,'T',T,'Methane')*1000;assert.ok(Math.abs(x-expected)<.01);});
test('Known discrepancy remains explicit rather than silently rescaled to NIST',()=>{const h=realGasState('He',.25,5.3),m=realGasState('CH4',4.7,193);assert.match(h.validation.transport,/критич/);assert.match(m.validation.transport,/2006/);assert.equal(h.transportModels.lambda,'Hands–Arp 1981 · критичний доданок CoolProp 8');assert.equal(m.transportModels.mu,'Quiñones-Cisneros–Deiters 2006');});
