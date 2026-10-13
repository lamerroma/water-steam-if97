// Numerical transcription of the supplied guide. Conflicting printed examples
// are not reference values. Units are explicit at each interface.
const rmRequire=(ok,msg)=>{if(!ok)throw Error(msg);};
export function reactorResonanceIntegral({V0,V1,V2,Nwater,NZr,N5,N8,NO,diameterCM,boreCM,pitchCM,density,fuelK,lattice,bell=1.27}){
 rmRequire([V0,V1,V2,diameterCM,pitchCM,density,fuelK,bell].every(v=>Number.isFinite(v)&&v>0)&&boreCM>=0&&boreCM<diameterCM&&['hex','square'].includes(lattice),'Некоректні дані резонансної моделі. / Invalid resonance inputs.');
 const chordFuel=4*V0/(Math.PI*(diameterCM+boreCM)),chordModerator=4*(V1+V2)/(Math.PI*diameterCM),distance=(pitchCM-diameterCM)/chordModerator;
 const sigmaTotal=(44.76e-24*Nwater*V1+6.2e-24*NZr*V2)/(V1+V2),shapeBeta=lattice==='hex'?17/3:17/8,u=chordModerator*sigmaTotal,shapeCorrection=u/(7+shapeBeta*u),denominator=1+u*(1-distance-shapeCorrection);
 rmRequire(distance>=0&&denominator>0,'Поправка Данкова поза областю наближення. / Dancoff approximation outside domain.');
 // The guide's c is moderator-collision probability (1 - conventional Dancoff C).
 // Keep the historical field for saved reports; expose C explicitly as well.
 const dancoff=1-Math.exp(-distance*u)/denominator,shielding=dancoff/(1+(bell-1)*(1-dancoff)),surfaceMass=4/((diameterCM-boreCM)*density),sigmaFuel=1e-24*(3.76*.94*NO+.2*(13.8*N5+8.3*N8)),scatteringFactor=1+chordFuel*sigmaFuel/bell;
 rmRequire(dancoff>=0&&dancoff<=1&&shielding>0&&shielding<=1,'Недопустиме затінення решітки. / Invalid lattice shielding.');
 const baseBarn=5.55+26.6*Math.sqrt(surfaceMass*scatteringFactor*shielding),doppler=1+(.535+.47*surfaceMass*scatteringFactor)*.01*(Math.sqrt(fuelK)-Math.sqrt(300));
 rmRequire(doppler>0,'Недопустима поправка Доплера. / Invalid Doppler correction.');
 return {chordFuel,chordModerator,distance,sigmaTotal,shapeBeta,shapeCorrection,dancoff,dancoffFactor:1-dancoff,shielding,surfaceMass,sigmaFuel,scatteringFactor,baseBarn,doppler,effectiveBarn:baseBarn*doppler};
}
export function reactorBoiling({pMPa,coolantC,saturationC,alphaConv,designFlux,method='off'}){
 rmRequire([pMPa,coolantC,saturationC,alphaConv,designFlux].every(Number.isFinite)&&pMPa>0&&alphaConv>0&&designFlux>=0&&saturationC>coolantC,'Недопустимий стан поверхневого кипіння. / Invalid wall boiling state.');
 const onsetFlux=alphaConv*(saturationC-coolantC),excessFlux=Math.max(0,designFlux-onsetFlux),convectiveWall=coolantC+designFlux/alphaConv;
 // Positive excess only; never enhance heat transfer below the onset. Pressure
 // in the Rassokhin term is bar, NOT MPa. 2/3 is the guide's cube-root square.
 const active=method==='guide'&&excessFlux>0,withinPressure=pMPa>=8&&pMPa<=20;
 const alphaBoiling=active&&withinPressure?.027*(10*pMPa)**1.33*excessFlux**(2/3):0,alpha=alphaBoiling>0?Math.hypot(alphaConv,alphaBoiling):alphaConv,wall=alphaBoiling>0?saturationC+excessFlux/alpha:convectiveWall;
 return {onsetFlux,excessFlux,convectiveWall,alphaConv,alphaBoiling,alpha,wall,active:alphaBoiling>0,outside:active&&!withinPressure};
}
export function reactorCHF(pMPa,massFlux,x,method='gidropress'){
 rmRequire([pMPa,massFlux,x].every(Number.isFinite)&&pMPa>0&&pMPa<22.064&&massFlux>0&&x<1,'Недопустимі дані CHF. / Invalid CHF input.');
 const m=method==='candidate'?.311*(1-x)**(-.127):.311*(1-x)-.127,n=.105*pMPa-.5,qCritical=.795*massFlux**m*(1-x)**n*(1-.0185*pMPa);
 rmRequire(Number.isFinite(qCritical)&&qCritical>0,'Недопустимий результат CHF. / Invalid CHF result.');return {m,n,qCritical};
}
export function reactorReadLayout(text,method,coreRadius,assemblies,rodsPerCluster){
 rmRequire(typeof text==='string'&&text.length<=20000,'Картограма: текст до 20000 символів. / Layout text up to 20000 characters.');
 const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());rmRequire(lines.length>0&&lines.length<=500,'Введіть 1…500 рядків картограми. / Enter 1…500 layout rows.');
 const parsed=lines.map((line,i)=>{const values=line.trim().split(';').map(v=>v.trim());rmRequire(values.length===2&&values.every(v=>/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(v)),`Картограма, рядок ${i+1}: потрібні два числа через ;. / Layout row ${i+1}: two numbers separated by ; required.`);const [v,w]=values.map(v=>Number(v.replace(',','.')));rmRequire(Number.isFinite(v)&&Number.isFinite(w),'Некоректне число картограми. / Invalid layout number.');
  const radius=method==='coordinates'?Math.hypot(v,w):v,count=method==='coordinates'?1:w;rmRequire(radius>=0&&radius<coreRadius&&Number.isInteger(count)&&count>0,'Радіус має бути всередині зони, кількість — додатна ціла. / Radius must lie inside the core; count must be a positive integer.');return {radius,assemblies:count,rods:count*rodsPerCluster,...(method==='coordinates'?{x:v,y:w}:{})};});
 rmRequire(parsed.reduce((s,r)=>s+r.assemblies,0)===assemblies,'Сума касет картограми не відповідає заданій кількості. / Layout assembly total differs from the specified count.');
 if(method==='coordinates')rmRequire(new Set(parsed.map(r=>`${r.x},${r.y}`)).size===parsed.length,'Координати касет дублюються. / Duplicate assembly coordinates.');
 return parsed;
}
