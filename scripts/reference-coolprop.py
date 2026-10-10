"""External audit only: pip install CoolProp==8.0.0 in a separate environment."""
import json
from pathlib import Path
import CoolProp
from CoolProp.CoolProp import PropsSI
rows=[]
for model,fluid in [('IF97','IF97::Water'),('IAPWS-95','HEOS::Water')]:
 for p,T in [(0.001,300),(.1,300),(3,300),(50,300),(.1,500),(3,500),(20,640),(22,647),(22.1,648),(25,650),(25,700),(100,700),(.1,900),(20,900),(50,1500)]:
  if model=='IAPWS-95' and T>1273:continue
  r=dict(model=model,p=p,T=T)
  for k,v in {'rho':'Dmass','h':'Hmass','s':'Smass','cp':'Cpmass','cv':'Cvmass','w':'A','mu':'V','lambda':'L'}.items():
   r[k]=float(PropsSI(v,'P',p*1e6,'T',T,fluid))/(1000 if k in ['h','s','cp','cv'] else 1)
  rows.append(r)
root=Path(__file__).resolve().parent.parent
root.joinpath('tests/fixtures/coolprop.json').write_text(json.dumps({'source':'CoolProp '+CoolProp.__version__,'states':rows},indent=2)+'\n')
