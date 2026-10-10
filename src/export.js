// Unrounded canonical values; energy unit is explicitly recorded in each CSV row.
export function exportCSV(result,energy='kJ',ambient=null) {
  const props=[['dc','–'],['ex','кДж/кг'],['h','кДж/кг'],['s','кДж/(кг·K)'],['rho','кг/м³'],['v','м³/кг'],['cp','кДж/(кг·K)'],['cv','кДж/(кг·K)'],['w','м/с'],['u','кДж/кг'],['mu','Па·с'],['lambda','Вт/(м·K)'],['A','кДж/кг'],['G','кДж/кг'],['Z','–'],['isentropic','–'],['alpha','1/K'],['kappa','1/МПа'],['dvdt','м³/(кг·K)'],['dvdp','м³/(кг·МПа)'],['dpdt','МПа/K'],['dpdv','МПа·кг/м³'],['jt','K/МПа'],['ijt','кДж/(кг·МПа)'],['nu','м²/с'],['diffusivity','м²/с'],['Pr','–'],['sigma','Н/м']];
  const rows=[['state','property','value','unit']],states=result.state?[['state',result.state]]:[];
  if(ambient)rows.push(['reference','p0',ambient.p,'MPa'],['reference','T0',ambient.T,'K'],['reference','exergy_definition','(h-h0)-T0*(s-s0); physical flow exergy','']);
  if(result.saturation)states.push(['saturated_liquid',result.saturation.liquid],['saturated_vapor',result.saturation.vapor]);
  if(result.alternatives)result.alternatives.forEach((s,i)=>states.push(['alternative_'+(i+1),s]));
  for(const [name,s] of states) {
    rows.push([name,'p',s.p,'MPa'],[name,'T',s.T,'K'],[name,'region',s.region,''],[name,'phase',s.phase,''],[name,'x',s.x??'','']);
    for(const [key,unit] of props) {const convert=energy==='J'&&['h','s','cp','cv','u','A','G','ijt','ex'].includes(key);rows.push([name,key,s[key]==null?'':s[key]*(convert?1000:1),convert?unit.replace('кДж','Дж'):unit]);}
    for(const note of s.notes||[])rows.push([name,'note',note,'']);
  }
  return '\uFEFF'+rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
