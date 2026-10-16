# Reference generation only: pip install iapws==1.5.5 (not a runtime dependency).
import json
from importlib.metadata import version
assert version("iapws") == "1.5.5", "Pin the reference implementation version"
from pathlib import Path
from iapws import IAPWS97,IAPWS95
records=[]
def save(name,model,kwargs):
 cls=IAPWS97 if model=='IF97' else IAPWS95
 q=cls(**kwargs)
 records.append(dict(name=name,model=model,input=kwargs,expected={k:None if getattr(q,k) is None else float(getattr(q,k)) for k in ['P','T','h','s','u','v','rho','cp','cv','w','x']}))
for name,p,T in [('critical-label',22.5,655),('B23',30,700),('region5-maxP',50,1500),('region1-turn',65.9,575.8),('upper-T',1,2273.15),('upper-P',100,650),('region25',.0035,1073.15),('region13',30,623.150001)]:save(name,'IF97',dict(P=p,T=T))
for p in [.1,1,10,20]:
 for x in [0,1]:save('endpoint-'+str(p)+'-'+str(x),'IF97',dict(P=p,x=x))
for x in [0,1]:save('cutoff-'+str(x),'IF97',dict(T=623.15,x=x))
for name,p,T in [('critical-T-lowP',.1,647.096),('critical-T-highP',25,647.096),('lower-T',.1,273.16),('upper-T',200,1273),('upper-P',1000,1000)]:save(name,'IAPWS-95',dict(P=p,T=T))
for x in [.2,.5,.8]:save('triple-'+str(x),'IF97',dict(T=273.15,x=x))
(Path(__file__).resolve().parents[1] / 'tests/fixtures/inverse-boundary-reference.json').write_text(json.dumps(dict(source='Independent Python iapws 1.5.5; reference generation only; library not included in runtime',generator='scripts/generate-inverse-boundary-reference.py',records=records),indent=2)+'\n')
print('External reference records:',len(records))
