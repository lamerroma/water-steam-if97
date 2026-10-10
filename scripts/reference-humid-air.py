"""Numerical fixtures from external CoolProp 8; no copied implementation."""
import json, random
from pathlib import Path
from CoolProp.CoolProp import HAPropsSI
rng=random.Random(1485)
points=[(.101325,303.15,.5),(.101325,253.15,.7),(.5,350,.8),(2,400,.3),(.101325,298.15,0),(.101325,303.15,1)]
points +=[(p,t,rh) for p in [.05,.101325,.5,2,5] for t in [213.15,253.15,303.15,350,423.15,473] for rh in [.1,.5,.9]]
rows=[];excluded=[]
for p,t,r in points:
 z={'p':p,'T':t,'rh':r}
 try:
  for k in ['W','H','V','C','D','B']:
   try:z[k]=HAPropsSI(k,'P',p*1e6,'T',t,'R',r)
   except ValueError:
    if k in ['D','B']:z[k]=None
    else:raise
  rows.append(z)
 except ValueError as e:excluded.append({'p':p,'T':t,'rh':r,'reason':str(e)})
Path(__file__).resolve().parent.joinpath('../tests/fixtures/humid-air-scientific.json').write_text(json.dumps({'source':'CoolProp 8.0.0 Python HAPropsSI; binding parity, not an independent EOS','states':rows,'excluded':excluded},indent=2)+'\n')
print(len(rows),'states',len(excluded),'inadmissible states')
