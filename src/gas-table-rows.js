import {BSW2003_SPECIES} from './gas-bsw2003.js';
import {englishProperty} from './units.js';
import {uiDisplayQuantity} from './ui-quantities.js';
export function gasTableRows(q,system='si',preferences=null){
 const fields=[['p','MPa'],['T','K'],['M','kg/kmol'],['R','kJ/(kg K)'],['h','kJ/kg'],['s','kJ/(kg K)'],['u','kJ/kg'],['rho','kg/m³'],['v','m³/kg'],['cp','kJ/(kg K)'],['cv','kJ/(kg K)'],['w','m/s'],['isentropic','–'],['Z','–'],['mixingEntropy','kJ/(kg K)']];
 return fields.map(([key,unit])=>{
  const dimension=['R','mixingEntropy'].includes(key)?'s':key;
  const original=system==='english'?englishProperty(dimension,q[key],unit):[q[key],unit];
  return [key,...(preferences?uiDisplayQuantity(...original,preferences):original)];
 });
}
export function gasCompositionRows(q){return BSW2003_SPECIES.map(id=>[id,100*(q.composition[id]||0),100*(q.massComposition[id]||0)]);}
