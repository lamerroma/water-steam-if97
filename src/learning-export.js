export const d2oPropertyRows=s=>[['Тиск',s.p,'МПа'],['Температура',s.T-273.15,'°C'],['Густина',s.rho,'кг/м³'],['Питомий об’єм',s.v,'м³/кг'],['Питома ентальпія',s.h,'кДж/кг'],['Питома внутрішня енергія',s.u,'кДж/кг'],['Питома ентропія',s.s,'кДж/(кг·K)'],['Ізохорна теплоємність cv',s.cv,'кДж/(кг·K)'],['Ізобарна теплоємність cp',s.cp,'кДж/(кг·K)'],['Швидкість звуку',s.w,'м/с']];
// Shared by the UI and regression tests. Keep phase labels and model warnings
// in the exported record so the file retains the interpretation shown on screen.
export function learningCSV(q,inputRows,entries){
 const phaseEntries=q.liquid&&q.vapor?[...d2oPropertyRows(q.liquid).map(r=>['Насичена рідина',...r]),...d2oPropertyRows(q.vapor).map(r=>['Насичена пара',...r])]:null;
 const lines=[['model',q.model],['input','value'],...inputRows];
 if(q.phase)lines.push(['phase',q.phase]);
 for(const note of q.notes||[])lines.push(['warning',note]);
 if(!q.rows)lines.push(...(phaseEntries?[['phase','quantity','value','unit'],...phaseEntries]:[['quantity','value','unit'],...entries]));
 if(q.rows)lines.push(['quantity','IF97','IAPWS-95','delta','relative [%]','unit'],...q.rows.map(r=>[r.label,r.if97,r.iapws95,r.delta,r.relative,r.unit]));
 for(const m of q.models||[])if(m.error)lines.push(['error '+m.model,m.error]);
 if(q.states)lines.push(['state','p [MPa]','T [K]','h [kJ/kg]','s [kJ/(kg K)]'],...q.states.map((z,i)=>[i+1,z.p,z.T,z.h,z.s]));
 const cell=v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 return '\uFEFF'+lines.map(row=>row.map(cell).join(';')).join('\r\n');
}
