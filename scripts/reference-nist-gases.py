"""Refresh small public NIST WebBook checkpoints; no runtime network dependency."""
import json,subprocess,urllib.parse,concurrent.futures
from pathlib import Path
IDS={'N2':'C7727379','O2':'C7782447','CO2':'C124389','CO':'C630080','H2':'C1333740','H2O':'C7732185','CH4':'C74828','Ar':'C7440371','He':'C7440597','SO2':'C7446095','Ne':'C7440019'}
# Gas, compressed fluid, liquid (where possible), near-critical: temperatures and pressures chosen explicitly.
POINTS={'N2':[(300,.101325),(90,2),(128,3.5)],'O2':[(300,.101325),(100,2),(156,5.2)],'CO2':[(400,.101325),(280,8),(307,7.5)],'CO':[(300,.101325),(90,2),(134,3.6)],'H2':[(300,.101325),(25,2),(34,1.35)],'H2O':[(400,.101325),(300,2),(650,23)],'CH4':[(300,.101325),(130,2),(193,4.7)],'Ar':[(300,.101325),(100,2),(153,5)],'He':[(300,.101325),(4,1),(5.3,.25)],'SO2':[(400,.101325),(300,2),(435,8)],'Ne':[(300,.101325),(30,2),(45,2.8)]}
def fetch(item):
 id,T,p=item
 params={'Action':'Data','Wide':'on','ID':IDS[id],'Type':'IsoTherm','Digits':8,'PLow':p,'PHigh':p,'PInc':1,'T':T,'RefState':'DEF','TUnit':'K','PUnit':'MPa','DUnit':'kg/m3','HUnit':'kJ/kg','WUnit':'m/s','VisUnit':'Pa*s','STUnit':'N/m'}
 url='https://webbook.nist.gov/cgi/fluid.cgi?'+urllib.parse.urlencode(params)
 text=subprocess.check_output(['curl','-fsSL','--max-time','30',url],text=True)
 lines=text.strip().splitlines()
 if len(lines)<2 or not lines[0].startswith('Temperature'):return {'id':id,'T':T,'p':p,'url':url,'error':'No NIST numerical table available'}
 vals=lines[1].split('\t');q={'id':id,'T':T,'p':p,'url':url,'phase':vals[-1]}
 for key,index in [('rho',2),('u',4),('h',5),('s',6),('cv',7),('cp',8),('w',9),('mu',11),('lambda',12)]:
  try:q[key]=float(vals[index])
  except ValueError:q[key]=None
 return q
items=[(id,T,p) for id,ps in POINTS.items() for T,p in ps]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(fetch,items))
Path('tests/fixtures/nist-gases.json').write_text(json.dumps({'source':'NIST Chemistry WebBook SRD69 public fluid tables, 8 significant digits, DEF reference state','retrieved':'2026-10-10','states':[r for r in rows if 'error' not in r],'unavailable':[r for r in rows if 'error' in r]},indent=2)+'\n')
print('NIST states:',sum('error' not in r for r in rows),'unavailable:',sum('error' in r for r in rows))
