import {bswGasState,bswComposition,calculateBSWGas} from './gas-bsw2003.js';

// Factual VDI-4670 reaction/energy coefficients from Modelica ReferenceMoistAir,
// pinned source and derivation in docs/steam97-p04. Independent implementation.
// U1 follows the CO2 -> CO + O2/2 mass-action relation (secondary Eq.3.20).
// D2 is +303000 as in Modelica, independently checked against NASA reaction
// enthalpies; the negative sign in the secondary thesis is not used.
export const GAS_DISSOCIATION_MODEL='BSW2003-VDI4670-caloric-experimental';
export const GAS_DISSOCIATION_LIMITS=Object.freeze({min:1200,max:2000,pmin:.01,pmax:5,oxygenMin:.01,lambdaMinExclusive:1.05});
export const GAS_DISSOCIATION_COEFFICIENTS=Object.freeze([
 ['CO',20413.2,-33086.5,-19.5,-115000,9.483e9],
 ['H2',1075.5,-30283.3,-65.2,303000,7.277e9],
 ['OH',165.95,-19526.8,-18.7,57200,3.136e9],
 ['H',1491.75,-27488,-3.6,393000,5.826e9],
 ['O',3235.34,-30807.8,-21.8,150000,7.659e9],
 ['NO',4.5542,-10973.6,-5.6,16200,9.94e8]
].map(Object.freeze));

function gasDissociationDomain(p,T,y,options){
 const d=GAS_DISSOCIATION_LIMITS;
 if(!Number.isFinite(p)||p<d.pmin||p>d.pmax||!Number.isFinite(T)||T<d.min||T>d.max)throw Error('VDI4670: локальний дослідний діапазон 1200…2000 K, 0,01…5 МПа. / Local experimental range: 1200…2000 K, 0.01…5 MPa.');
 if(options?.combustion!=='complete-air'||!Number.isFinite(options.excessAirLambda)||options.excessAirLambda<=d.lambdaMinExclusive)throw Error('VDI4670: задайте повне згоряння у звичайному повітрі та λ > 1,05. / Specify complete combustion in ordinary air and excess-air lambda > 1.05.');
 if(!(y.N2>0)||!(y.O2>=d.oxygenMin-1e-14)||y.CO>0)throw Error('VDI4670: потрібні N₂ > 0, O₂ ≥ 1 мол. %, CO = 0 у початковому складі. Кисневе й неповне згоряння не підтримуються. / Initial composition requires N2 > 0, O2 >= 1 mol %, CO = 0; oxyfuel and incomplete combustion unsupported.');
}

// Empirical caloric increments per original mole, not equilibrium concentrations.
// The listed cp correction is an independently fitted approximation; it is NOT
// the exact derivative of the fitted h increment. Never use it as a Newton slope.
export function gasDissociationMolar(p,T,y,options){
 y=bswComposition(y,'mole').mole;
 gasDissociationDomain(p,T,y,options);
 const k=GAS_DISSOCIATION_COEFFICIENTS.map(([,a,b])=>a*Math.exp(b/T)),rootP=Math.sqrt(.101325/p),rootO=Math.sqrt(y.O2),water=y.H2O||0;
 const u=[k[0]*(y.CO2||0)/rootO*rootP,k[1]*water/rootO*rootP,k[2]*Math.sqrt(water)*Math.sqrt(rootO)*Math.sqrt(rootP),0,k[4]*rootO*rootP,k[5]*Math.sqrt(y.N2*y.O2)];
 u[3]=k[3]*Math.sqrt(u[1])*rootP;
 const normalizer=1+u.reduce((s,v)=>s+v,0);
 let cp=0,h=0;
 GAS_DISSOCIATION_COEFFICIENTS.forEach(([,a,b,c,d,e],i)=>{const v=c+d/T+e/(T*T);cp+=u[i]*v;h-=T*T*u[i]*v/b;});
 cp/=normalizer;h/=normalizer;
 return {cp,h,s:h/T,normalizer,reactionIndices:Object.fromEntries(GAS_DISSOCIATION_COEFFICIENTS.map(([id],i)=>[id,u[i]]))};
}

export function dissociatedGasState(p,T,fractions,basis='mole',options){
 const q=bswGasState(p,T,fractions,basis),m=gasDissociationMolar(p,T,q.composition,options),delta={cp:m.cp/q.M,h:m.h/q.M,s:m.s/q.M};
 const cp=q.cp+delta.cp,cv=q.cv+delta.cp,h=q.h+delta.h,s=q.s+delta.s;
 if(![cp,cv,h,s].every(Number.isFinite)||cv<=0)throw Error('VDI4670: недопустима калорична поправка. / Invalid caloric correction.');
 return {...q,model:'BSW2003 + VDI4670 · experimental caloric correction',modelId:GAS_DISSOCIATION_MODEL,
  cp,cv,h,s,u:q.u+delta.h,gamma:cp/cv,caloricRatio:cp/cv,w:null,isentropic:null,
  limits:{...GAS_DISSOCIATION_LIMITS},compositionMeaning:'initial-frozen',dissociationApplied:true,
  excessAirLambda:options.excessAirLambda,dissociationDeltaH:delta.h,dissociationDeltaS:delta.s,dissociationDeltaCp:delta.cp,
  dissociation:{model:'VDI4670-caloric',experimental:true,combustion:options.combustion,excessAirLambda:options.excessAirLambda,
   corrections:{...delta,cv:delta.cp,u:delta.h},reactionIndices:m.reactionIndices,normalizer:m.normalizer,
   compositionMeaning:'initial-frozen',equilibriumCompositionComputed:false,indexIsDissociatedFraction:false,
   cpDefinition:'Empirical caloric increment; not the exact temperature derivative of the fitted enthalpy increment.',
   cvDefinition:'Same empirical increment as cp, added to the frozen cv; not an equilibrium constant-volume derivative.',
   densityDefinition:'Initial frozen ideal-mixture molar mass; no equilibrium volume correction.',
   soundSpeedAvailable:false,Steam97WebParityVerified:false},
  reference:{...q.reference,reactionEnergyIncludedInCorrection:true},
  notes:['Дослідна калорична поправка; склад і густина відповідають початковій суміші. Рівноважний склад не обчислюється. / Experimental caloric correction; composition and density refer to the initial mixture, not equilibrium products.',
   'cp і cv містять апроксимовану поправку; швидкість звуку та ізентропний показник для цього режиму не підтверджені. / cp and cv include an empirical correction; sound speed and isentropic exponent are not established for this mode.'],
  validation:{...q.validation,source:'https://github.com/modelica/ModelicaStandardLibrary/blob/64d9bd4a625cc6f28c18c0398bbf4082ef460625/Modelica/Media/Air/ReferenceMoistAir.mo',status:'Experimental VDI caloric approximation; CO branch derived from mass action. Direct Steam97Web parity unverified.'}};
}

export function calculateGasTable(mode,p,value,fractions,basis='mole',options){
 if(!options||options.dissociation===false)return calculateBSWGas(mode,p,value,fractions,basis);
 if(options.dissociation!==true)throw Error('VDI4670: невідомий режим поправки. / Unknown correction mode.');
 if(!['pt','ph','ps'].includes(mode)||!Number.isFinite(value))throw Error('VDI4670: скінченні P–T, P–h або P–s. / Finite P-T, P-h or P-s input required.');
 if(mode==='pt')return dissociatedGasState(p,value,fractions,basis,options);
 const key=mode==='ph'?'h':'s';let lo=GAS_DISSOCIATION_LIMITS.min,hi=GAS_DISSOCIATION_LIMITS.max;
 const L=dissociatedGasState(p,lo,fractions,basis,options),H=dissociatedGasState(p,hi,fractions,basis,options);
 if(value<L[key]||value>H[key])throw Error('VDI4670: задана величина поза локальним діапазоном 1200…2000 K. / Target outside the local 1200…2000 K range.');
 if(value===L[key])return L;if(value===H[key])return H;
 for(let i=0;i<70;i++){const mid=(lo+hi)/2,q=dissociatedGasState(p,mid,fractions,basis,options);if(hi-lo<2e-10)return q;if(q[key]<value)lo=mid;else hi=mid;}
 throw Error('VDI4670: обернений розрахунок не збігся. / Inverse calculation did not converge.');
}
