// IAPWS R14-08(2011), Eqs. 1–6; R16-17(2018), Section 6, Eqs. 9–13.
// Pressures in MPa, temperatures in K. D2O curves are auxiliary representations
// printed in the release, not separately endorsed IAPWS recommendations.
const H2O_CURVES={Ih:[251.165,273.16],III:[251.165,256.164],V:[256.164,273.31],VI:[273.31,355],VII:[355,715]};
const D2O_CURVES={Ih:[254.415,276.969],III:[254.415,258.661],V:[258.661,275.748],VI:[275.748,315]};
export const D2O_PHASE_NOTE='Криві D₂O: допоміжні кореляції R16-17, §6; окрема офіційна рекомендація IAPWS для цих кривих відсутня.';
export function meltingPressure(T,phase='Ih',substance='H2O'){
 const ranges=substance==='H2O'?H2O_CURVES:substance==='D2O'?D2O_CURVES:null,range=ranges?.[phase];
 if(!range||!Number.isFinite(T)||T<range[0]||T>range[1])throw Error(`Плавлення ${substance}, лід ${phase}: потрібно ${range?.join('…')||'коректну фазу й речовину'} K.`);
 if(substance==='D2O'){
  if(phase==='Ih'){const t=T/276.969;return .00066159*(1-30153*(1-t**5.5)+692503*(1-t**8.2));}
  const [t,p,a,b]=phase==='III'?[254.415,222.41,.802871,33]:phase==='V'?[258.661,352.19,1.280388,7.6]:[275.748,634.53,1.276026,4];
  return p*(1-a*(1-(T/t)**b));
 }
 if(phase==='Ih'){const t=T/273.16;return .000611657*(1+1195393.37*(1-t**3)+80818.3159*(1-t**25.75)+3338.2686*(1-t**103.75));}
 if(phase==='VII'){const t=T/355;return 2216*Math.exp(1.73683*(1-t**-1)-.0544606*(1-t**5)+8.06106e-8*(1-t**22));}
 const [t,p,a,b]=phase==='III'?[251.165,208.566,.299948,60]:phase==='V'?[256.164,350.1,1.18721,8]:[273.31,632.4,1.07476,4.6];
 return p*(1-a*(1-(T/t)**b));
}
export function sublimationPressure(T,substance='H2O'){
 const min=substance==='H2O'?50:210,max=substance==='H2O'?273.16:276.969;
 if(!['H2O','D2O'].includes(substance)||!Number.isFinite(T)||T<min||T>max)throw Error(`Сублімація ${substance}: потрібно ${min}…${max} K.`);
 const t=T/max;
 return substance==='H2O'?.000611657*Math.exp((-21.2144006*t**.00333333333+27.3203819*t**1.20666667-6.1059813*t**1.70333333)/t):.00066159*Math.exp(-13.14226*(1-t**-1.73)+32.12969*(1-t**-1.42));
}
export function meltingTemperature(p,substance='H2O'){
 const ranges=substance==='H2O'?H2O_CURVES:D2O_CURVES;
 if(!Number.isFinite(p)||p<=0)throw Error('Тиск плавлення має бути додатним.');
 for(const [phase,[min,max]] of Object.entries(ranges)){
  const a=meltingPressure(min,phase,substance),b=meltingPressure(max,phase,substance);
  if(p<Math.min(a,b)||p>Math.max(a,b))continue;
  let lo=min,hi=max;
  for(let i=0;i<65;i++){const mid=(lo+hi)/2,q=meltingPressure(mid,phase,substance);if((q>p)===(b>a))hi=mid;else lo=mid;}
  return {T:(lo+hi)/2,phase};
 }
 throw Error('Тиск поза межами наведених кривих плавлення.');
}
export function boundaryCalculation(substance,kind,T,phase='Ih'){
 if(!['melt','subl'].includes(kind))throw Error('Невідома фазова рівновага.');
 const p=kind==='melt'?meltingPressure(T,phase,substance):sublimationPressure(T,substance);
 return {model:substance==='H2O'?'IAPWS R14-08(2011)':'D₂O · IAPWS R16-17(2018), §6',substance,T,p,phase:kind==='melt'?`Лід ${phase} ↔ рідина`:'Лід Ih ↔ пара',notes:substance==='D2O'?[D2O_PHASE_NOTE]:[]};
}
export function icePhaseStatus(T,pPa){
 const p=pPa/1e6,notes=[];
 let phase='Лід Ih';
 if(T>=50){const ps=sublimationPressure(T);if(Math.abs(p-ps)<Math.max(1e-15,ps*1e-7))phase='Межа сублімації: лід Ih ↔ пара';else if(p<ps){phase='Метастабільний лід щодо пари';notes.push('Тиск нижче кривої сублімації R14-08: рівноважною фазою є пара.');}}
 else notes.push('T < 50 K: крива сублімації поза офіційним діапазоном; рівновага з парою не перевірена.');
 if(T>=251.165){const pm=meltingPressure(T);if(Math.abs(p-pm)<Math.max(1e-9,pm*1e-7))phase='Межа плавлення: лід Ih ↔ рідина';else if(p>pm){phase='Метастабільний лід щодо рідини';notes.push('Тиск вище кривої плавлення льоду Ih: задані властивості описують метастабільний лід.');}}
 if(p>208.566)notes.push('Можливі інші модифікації льоду; рівновага між твердими фазами тут не моделюється.');
 return {phase,notes};
}
