import {reactorNeutronCell} from './reactor-neutronics.js';
import {reactorTemperatureRise} from './reactor-course.js';
import {reactorCHF} from './reactor-methods.js';
import {REACTOR_CELL_REFERENCE,REACTOR_CELL_SUPPLEMENTARY,REACTOR_PIN_CHECKS,REACTOR_CHF_CHECKS} from './reactor-reference-data.js';
export const REACTOR_EVIDENCE_VERSION='reactor-evidence-1';
export const REACTOR_CHECK_SOURCES={
 iaea:'https://www-pub.iaea.org/MTCD/Publications/PDF/Pub1264_web.pdf (Table 14.9; Appendix IV.3)',
 pin:'https://tmap8.inl.gov/docs/PRs/451/site/verification_and_validation/ver-1m.html (Table 1; analytical solution)',
 chf:'https://arxiv.org/html/2203.15048 (Eq. 53; Table 10)',
 guide:'Кравченко / Kravchenko, 2025, supplied coursework guide §3–7'
};
export function reactorReferenceCellInput(index,supplementary=null){
 const ref=REACTOR_CELL_REFERENCE,c=ref.cases[index],g=ref.geometry,f=ref.atomDensitiesPerCM3.fuel,z=ref.atomDensitiesPerCM3.clad;
 const V0=Math.PI*g.fuelRadiusCM**2,Vgas=Math.PI*(g.cladInnerRadiusCM**2-g.fuelRadiusCM**2),Vzr=Math.PI*(g.cladOuterRadiusCM**2-g.cladInnerRadiusCM**2);
 const pitch=supplementary?.pitchCM??g.pitchCM,Vcell=supplementary?Math.sqrt(3)/2*pitch*pitch:Math.PI*g.cellRadiusCM**2;
 return {geometry:{fuelAreaCM2:V0,gasAreaCM2:Vgas,metalAreaCM2:Vzr,totalAreaCM2:Vcell,fuelDiameterCM:2*g.fuelRadiusCM,boreDiameterCM:0,cladDiameterCM:2*g.cladOuterRadiusCM,pitchCM:pitch,lattice:'hex'},material:{rhoWater:c.waterAtomDensitiesPerCM3.O16*18.01528/6.02214076e23,fuelDensity:g.fuelDensityGCM3,N5:f.U235,N8:f.U238,NO:f.O16,NZr:z.Zr*Vzr/(Vgas+Vzr),Nwater:c.waterAtomDensitiesPerCM3.O16},temperature:{waterK:c.temperatureK,fuelC:c.temperatureK-273.15},options:{resonanceMethod:'gp',resonanceI8:22,bellFactor:1.27,squareBoundaryGamma:1},leakage:{materialBucklingCM2:(supplementary?.measuredBucklingM2??c.measuredBucklingM2)/1e4}};
}
function reactorWorse(worst,check){const score=r=>r.status==='unavailable'?Infinity:r.absoluteError/r.tolerance;return !worst||score(check)>score(worst);}
function reactorCheck(id,kind,actual,expected,absoluteTolerance,relativeTolerance,unit,source,formula,substitution,inputs={}){
 const error=Math.abs(actual-expected),tolerance=absoluteTolerance+relativeTolerance*Math.abs(expected),valid=[actual,expected,error,tolerance].every(Number.isFinite);
 return {id,kind,actual,expected,absoluteTolerance,relativeTolerance,tolerance,absoluteError:valid?error:null,status:valid?(error<=tolerance?'passed':'failed'):'unavailable',unit,source,formula,substitution,inputs};
}
export function reactorReferenceChecks(){
 const rows=[],N=v=>Number(v.toPrecision(9));
 for(const [index,c] of REACTOR_CELL_REFERENCE.cases.entries()){
  const input=reactorReferenceCellInput(index),n=reactorNeutronCell(input);
  rows.push({...reactorCheck(c.code,'physical-screening',n.keff,c.experimentalK,c.reportedKError,0,'–',REACTOR_CHECK_SOURCES.iaea,'k = k∞ exp(−B²τ)/(1+B²L²)',`${N(n.kinf)} exp(−${N(n.Bsq)} × ${N(n.age)}) / (1 + ${N(n.Bsq)} × ${N(n.Lsq)})`,input),screeningGoal:.01,withinScreeningGoal:Math.abs(n.keff-1)<=.01,diagnostics:{kinf:n.kinf,thermal:n.kinfThermal,resonance:n.kinfResonance,nonLeak:n.nonLeak,age:n.age,Lsq:n.Lsq,I8Barn:n.baseI8,Tng:n.Tng},inputBasis:'official-deck-transcription',omissions:REACTOR_CELL_REFERENCE.modelOmissions});
 }
 for(const c of REACTOR_CELL_SUPPLEMENTARY){const input=reactorReferenceCellInput(c.temperatureCase,c),n=reactorNeutronCell(input);
  rows.push({...reactorCheck(c.code,'reconstructed-screening',n.keff,c.experimentalK,c.reportedKError,0,'–',REACTOR_CHECK_SOURCES.iaea,'Acell = √3 S²/2; k = k∞ exp(−B²τ)/(1+B²L²)',`S=${c.pitchCM} cm; B²=${c.measuredBucklingM2} m⁻²`,input),inputBasis:'derived-hex-area-and-reused-unborated-materials',notes:'Not an exact deck replay: equivalent hexagonal cell area derived from pitch; unborated atom densities reused at the same temperature. Full supplemental deck unavailable on 2026-10-14.',omissions:REACTOR_CELL_REFERENCE.modelOmissions});
 }
 for(const c of REACTOR_PIN_CHECKS){const q=c.linear,rf=.005,ri=.0051,ro=.0061;
  const outer=290+q/(2*Math.PI*ro*18000),inner=outer+reactorTemperatureRise(outer,q*Math.log(ro/ri)/(2*Math.PI),'clad',16.5).rise,surface=inner+q/(2*Math.PI*rf*7381),centre=surface+reactorTemperatureRise(surface,q/(4*Math.PI),'fuel',17.6).rise;
  for(const [key,value] of Object.entries({cladOuter:outer,cladInner:inner,fuelSurface:surface,fuelCentre:centre}))rows.push(reactorCheck('pin-'+q+'-'+key,'analytical',value,c.expected[key],1e-8,1e-10,'°C',REACTOR_CHECK_SOURCES.pin,'Tco=Tb+q′/(2πroα); Tci=Tco+q′ln(ro/ri)/(2πλc); Tfs=Tci+q′/(2πrfhgap); Tc=Tfs+q′/(4πλf)',`q′=${q} W/m; rf=${rf} m; ri=${ri} m; ro=${ro} m; α=18000 W/(m² K); λc=16.5, λf=17.6 W/(m K); hgap=7381 W/(m² K); Tb=290 °C`,{linear:q,material:'U-ZrH, constant properties; not UO2 validation',gapConductance:7381,gapConductanceUnit:'W/(m² K)',coolantAlpha:18000,coolantAlphaBasis:'Estimate in the source table'}));
 }
 for(const c of REACTOR_CHF_CHECKS)rows.push(reactorCheck('chf-'+c.p,'correlation-arithmetic',reactorCHF(c.p,c.G,c.x).qCritical,c.expected,1e-10,1e-10,'MW/m²',REACTOR_CHECK_SOURCES.chf,'qcrit = 0.795 (1−x)^(0.105p−0.5) G^(0.184−0.311x) (1−0.0185p)',`p=${c.p} MPa; G=${c.G} kg/(m² s); x=${c.x}`,{...c,meaning:'Published local inputs; high-precision equation evaluation, not measured CHF'}));
 return {version:REACTOR_EVIDENCE_VERSION,arithmeticStatus:rows.filter(r=>['analytical','correlation-arithmetic'].includes(r.kind)).every(r=>r.status==='passed')?'passed':'failed',physicalStatus:rows.filter(r=>r.kind==='physical-screening').every(r=>r.status==='passed')?'screening-passed-not-full-validation':'physical-screening-failed',checks:rows,uncovered:['evaluated multigroup transport','borated lattice benchmarks','experimental bundle CHF','boiling onset for this bundle','campaign / rods / boron physical validation']};
}
// Independently reconstruct closures from the current calculated fields. A small
// residual checks equation consistency, not empirical model applicability.
export function reactorCalculationChecks(q){
 const m=q.metrics,g=q.geometry,a=q.input,rows=[],add=(...args)=>rows.push(reactorCheck(...args)),N=v=>Number(v.toPrecision(9));
 add('energy','balance',m.flow*(q.states[1].h-q.states[0].h),1000*m.thermalMW,1e-7,1e-10,'kW',REACTOR_CHECK_SOURCES.guide+' §3.1','G(hout−hin) = 1000Q',`${N(m.flow)} × (${N(q.states[1].h)} − ${N(q.states[0].h)})`);
 add('power-profile','balance',m.peakLinear*1000*2*Math.sin(m.beta*m.height/2)/m.beta*m.bundles*g.rods,m.thermalMW*1e6*a.fuelFraction*a.radialPeak,1e-6,1e-10,'W',REACTOR_CHECK_SOURCES.guide+' §3.3','∫q′max cos(βz) dz × nTVS nrod = Q fFuel Krad',`${N(m.peakLinear*1000)} × 2sin(${N(m.beta*m.height/2)}) / ${N(m.beta)} × ${m.bundles} × ${g.rods}`);
 for(const [key,unit,formula,evaluate] of [
  ['clad','W/m','λclad(Tci−Tco)=Kλq′ln(d/di)/(2π)',r=>[r.cladLambda*(r.cladInner-r.cladOuter),a.conductionFactor*r.qLinear*1000*Math.log(g.d/g.di)/(2*Math.PI)]],
  ['fuel','W/m','λfuel(Tmax−Tsurface)=Kλq′Fannulus/(4π)',r=>{const x=g.hole/g.df,d=(g.df-g.hole)/g.df;let F=x===0?1:1+2*x*x*Math.log(x)/(1-x*x);if(x>.99){const n=32,f=u=>u*(2*x+d*u)/(x+d*u);let sum=f(0)+f(1);for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(i/n);F=2*d/(1+x)*sum/(3*n);}return [r.fuelLambda*(r.fuelCenter-r.fuelSurface),a.conductionFactor*r.qLinear*1000*F/(4*Math.PI)];}],
  ['gap',a.gapMethod==='perfect'?'K':'W/m',a.gapMethod==='perfect'?'Tfs−Tci=0':a.gapMethod==='contact'?'π df hgap(Tfs−Tci)=Kλq′':'2πλgap(Tfs−Tci)/ln(di/df)=Kλq′',r=>a.gapMethod==='perfect'?[r.fuelSurface-r.cladInner,0]:[a.gapMethod==='contact'?Math.PI*g.df*a.contactConductance*(r.fuelSurface-r.cladInner):2*Math.PI*r.gapLambda*(r.fuelSurface-r.cladInner)/Math.log(g.di/g.df),a.conductionFactor*r.qLinear*1000]],
  ['wall','W/m²','α(Twall−Tbase)=qdrive',r=>[r.alpha*(r.cladOuter-(r.boiling?r.saturationC:r.t)),(r.boiling?r.excessFlux:r.designFlux)*1e6]]
 ]){let worst=null;for(const [channel,list] of [['hot',q.profile],['mean',q.meanProfile]])for(const r of list){const [actual,expected]=evaluate(r),check=reactorCheck(key,'equation-residual',actual,expected,1e-7,1e-9,unit,REACTOR_CHECK_SOURCES.guide+' §3.3',formula,`z=${N(r.z)} m; channel=${channel}; actual=${N(actual)}; expected=${N(expected)}`);if(reactorWorse(worst,check))worst={...check,channel,z:r.z};}rows.push(worst);}
 add('pressure-sum','balance',m.calculatedDrop,m.frictionDrop+m.localDrop+m.gravityDrop+m.accelerationDrop,1e-12,1e-10,'MPa',REACTOR_CHECK_SOURCES.guide+' §3.5','Δp=Δpf+Δplocal+Δpg+Δpa',`${N(m.frictionDrop)} + ${N(m.localDrop)} + ${N(m.gravityDrop)} + ${N(m.accelerationDrop)}`);
 if(q.chf&&a.chfMethod==='gidropress'){let worst=null;for(const [i,r] of q.chf.entries()){const p=q.profile[i].p,expected=.795*(1-r.x)**(.105*p-.5)*m.massFlux**(.184-.311*r.x)*(1-.0185*p),check=reactorCheck('chf-current','equation-residual',r.qCritical,expected,1e-10,1e-10,'MW/m²',REACTOR_CHECK_SOURCES.chf,'Eq. 53, p MPa; G kg/(m² s); output MW/m²',`z=${N(r.z)} m; p=${N(p)} MPa; G=${N(m.massFlux)} kg/(m² s); x=${N(r.x)}`);if(reactorWorse(worst,check))worst=check;}rows.push(worst);}
 if(q.neutronics)for(const [state,n] of [['hot',q.neutronics.hot],['cold',q.neutronics.cold]])add(state+'-keff','equation-residual',n.keff,(n.kinfThermal+n.kinfResonance)*Math.exp(-n.Bsq*n.age)/(1+n.Bsq*n.Lsq),1e-12,1e-10,'–',REACTOR_CHECK_SOURCES.guide+' §4.4–4.5','k=(k∞T+k∞R) exp(−B²τ)/(1+B²L²)',`(${N(n.kinfThermal)} + ${N(n.kinfResonance)}) exp(−${N(n.Bsq)} × ${N(n.age)}) / (1 + ${N(n.Bsq)} × ${N(n.Lsq)})`);
 return {version:REACTOR_EVIDENCE_VERSION,status:rows.every(r=>r.status==='passed')?'passed':'failed',checks:rows};
}
export function reactorVerificationTables(q,en=false){
 const t=(uk,eng)=>en?eng:uk,current=reactorCalculationChecks(q),ref=reactorReferenceChecks(),label=s=>({passed:t('У допуску','Within tolerance'),failed:t('Поза допуском','Outside tolerance'),unavailable:t('Немає результату','Unavailable')})[s];
 const kinds={balance:t('Баланс рівнянь','Equation balance'),'equation-residual':t('Нев’язка рівняння','Equation residual'),analytical:t('Аналітичний приклад','Analytical case'),'correlation-arithmetic':t('Арифметика кореляції','Correlation arithmetic'),'physical-screening':t('Експериментальний еталон','Experimental reference'),'reconstructed-screening':t('Реконструйована комірка','Reconstructed cell')};
 const make=(title,rows)=>({className:'reactor-verification',title,headers:[t('Приклад / рівняння','Case / equation'),t('Тип перевірки','Check type'),t('Отримано','Actual'),t('Еталон / права частина','Reference / RHS'),t('Допуск |Δ|','Tolerance |Δ|'),t('Відхилення |Δ|','Error |Δ|'),t('Статус','Status'),t('Одиниця','Unit'),t('Джерело','Source')],rows:rows.map(r=>[r.id,kinds[r.kind],r.actual,r.expected,r.tolerance,r.absoluteError,label(r.status),r.unit,r.source])});
 return [make(t('Перевірка рівнянь поточного розрахунку','Current calculation equation checks'),current.checks),make(t('Контрольні приклади: арифметика та експеримент окремо','Reference cases: arithmetic and experiment separately'),ref.checks),{className:'reactor-verification',title:t('Формули й числові підстановки перевірок','Check formulas and numerical substitutions'),headers:[t('Перевірка','Check'),t('Формула','Formula'),t('Підстановка','Substitution'),t('Джерело','Source')],rows:[...current.checks,...ref.checks].map(r=>[r.id,r.formula,r.substitution,r.source])}];
}
