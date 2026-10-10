"""Optional external numerical audit; pip install iapws==1.5.5 separately.
Only numerical results are stored. GPL reference code is not distributed.
"""
import json
from pathlib import Path
from iapws import IAPWS95
points=[(.001,300),(.1,300),(3,300),(50,300),(700,300),(.1,500),(3,500),(50,500),(700,500),(3,623),(20,640),(22,647),(22.1,648),(25,650),(25,700),(100,700),(1000,700),(.1,900),(20,900),(700,900),(1000,1273)]
rows=[]
for p,T in points:
    q=IAPWS95(P=p,T=T)
    rows.append(dict(p=p,T=T,**{k:float(getattr(q,k)) for k in ['rho','h','s','cp','cv','w']}))
Path(__file__).resolve().parent.parent.joinpath('tests/fixtures/independent-iapws95.json').write_text(json.dumps({'source':'Python iapws 1.5.5 / IAPWS95, external GPL audit only','states':rows},indent=2)+'\n')
