import sys,json,random
# Install CoolProp==8.0.0 in an external Python environment.
from CoolProp.CoolProp import PropsSI,HAPropsSI
rng=random.Random(97095);rows=[]
for model,fluid in [('IF97','IF97::Water'),('IAPWS-95','HEOS::Water')]:
 points=[(3,300),(.1,500),(22,647),(22.1,648),(25,650),(25,700),(100,700)]
 for i in range(100):
  p=10**rng.uniform(-3,2);T=rng.uniform(280,1070);points.append((p,T))
 if model=='IF97':points +=[(.5,1500),(30,1500),(50,2200)]
 for p,T in points:
  try:
   row=dict(model=model,mode='pt',a=p,b=T)
   for k,v in {'rho':'Dmass','h':'Hmass','s':'Smass','u':'Umass','cp':'Cpmass','cv':'Cvmass','w':'A','mu':'V','lambda':'L'}.items():row[k]=PropsSI(v,'P',p*1e6,'T',T,fluid)/(1000 if k in ['h','s','u','cp','cv'] else 1)
   rows.append(row)
  except Exception:pass
ha=[]
for p,T,rh in [(0.101325,303.15,.5),(.1,283.15,.5),(.2,323.15,.8),(.05,353.15,.5)]:
 row=dict(p=p,T=T,rh=rh)
 for k,v in {'W':'W','h':'H','v':'V','dew':'D','wet':'B'}.items():row[k]=HAPropsSI(v,'P',p*1e6,'T',T,'R',rh)/(1000 if k=='h' else 1)
 ha.append(row)
json.dump(dict(source='CoolProp 8.0.0; deterministic seed 97095',states=rows,humid=ha),open(sys.argv[1] if len(sys.argv)>1 else 'accuracy-audit-reference.json','w'))
print(len(rows),'water states;',len(ha),'humid-air states')
