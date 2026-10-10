import {calculate} from './engine.js';
export function referenceState(p0=.101325,T0=298.15,model='IF97'){
 if(!Number.isFinite(p0)||!Number.isFinite(T0))throw Error('Параметри довкілля мають бути скінченними.');
 const ref=calculate('pt',p0,T0,model).state;
 if(!ref||ref.critical)throw Error('Довкілля має задавати однозначний однофазний стан P₀–T₀.');
 return ref;
}
// Specific physical FLOW exergy; no chemical, kinetic or potential contribution.
export function flowExergy(state,ref){return (state.h-ref.h)-ref.T*(state.s-ref.s);}
export function withExergy(result,ref){const add=s=>({...s,ex:flowExergy(s,ref)});return {...result,...(result.state?{state:add(result.state)}:{}),...(result.saturation?{saturation:{...result.saturation,liquid:add(result.saturation.liquid),vapor:add(result.saturation.vapor)}}:{}),...(result.alternatives?{alternatives:result.alternatives.map(add)}:{})};}
