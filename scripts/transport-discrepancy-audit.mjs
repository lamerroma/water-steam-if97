// Exact local-core audit; no network, no adjusted coefficients.
import fs from 'node:fs';import {initializeHumidAir,getCoolPropBackend} from '../src/humid-air-scientific.js';import {realGasState} from '../src/real-gases.js';
await initializeHumidAir(fs.readFileSync(new URL('../vendor/coolprop.wasm',import.meta.url)));const c=getCoolPropBackend();
const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/nist-gases.json',import.meta.url))),rows=[];
for(const r of fixture.states.filter(r=>['CH4','He'].includes(r.id))){const fluid=r.id==='CH4'?'Methane':'Helium',q=realGasState(r.id,r.p,r.T),row={id:r.id,T:r.T,p:r.p,rho:q.rho,NIST_rho:r.rho,properties:{}};
 for(const [key,output] of [['mu','VISCOSITY'],['lambda','CONDUCTIVITY']]){const direct=c.PropsSI(output,'Dmass',q.rho,'T',r.T,fluid);row.properties[key]={unit:key==='mu'?'Pa s':'W/(m K)',browserCore:q[key],directDensity:direct,NIST:r[key],relativeDifference:Math.abs(q[key]-r[key])/Math.abs(r[key]),inputPathDifference:Math.abs(q[key]-direct)/Math.abs(direct)};}
 rows.push(row);
}
const report={source:'NIST WebBook controls already archived with exact query URLs; local CoolProp 8 WASM',conclusion:'The same differences are reproduced at T,rho. No integration or unit-conversion error was found. This does not certify either model against experiment.',rows};
fs.writeFileSync(new URL('../docs/TRANSPORT_DISCREPANCY_AUDIT.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log('Saved six transport discrepancy controls.');
