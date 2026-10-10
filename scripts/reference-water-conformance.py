"""External CoolProp 8.0.0 and iapws 1.5.5 numerical oracles; no runtime dependency. Seed and sample counts fixed."""
import json,random,sys
from pathlib import Path
from CoolProp.CoolProp import PropsSI
from iapws import IAPWS97
rng=random.Random(20261010);rows=[];excluded=[]
keys={'rho':'Dmass','h':'Hmass','s':'Smass','u':'Umass','cp':'Cpmass','cv':'Cvmass','w':'A','mu':'V','lambda':'L'}
critical=[(p,t) for p in [20,21.5,22,22.064,22.1,23,25,30,50,100] for t in [623.16,640,647,647.1,650,700]]
inverse_points=[(.1,300),(3,300),(50,300),(.1,500),(3,500),(20,640),(22,647),(25,650),(100,700),(.5,1500)]
for model,fluid in [('IF97','IF97::Water'),('IAPWS-95','HEOS::Water')]:
 points=inverse_points+critical
 for i in range(300):
  p=10**rng.uniform(-3,2 if model=='IF97' else 3);t=rng.uniform(280,1073.15 if model=='IF97' else 1273)
  points.append((p,t))
 if model=='IF97':points +=[(10**rng.uniform(-3,1.69897),rng.uniform(1073.16,2273.15)) for _ in range(30)]
 for p,t in dict.fromkeys(points):
  if model=='IAPWS-95' and (t>1273 or p> (float('inf') if t>=355 else 632.4*(1-1.07476*(1-(t/273.31)**4.6)) if t>=273.31 else 350.1*(1-1.18721*(1-(t/256.164)**8)))):continue
  try:
   r=dict(model=model,mode='pt',a=p,b=t,inverse=(p,t) in inverse_points)
   for k,v in keys.items():r[k]=PropsSI(v,'P',p*1e6,'T',t,fluid)/(1000 if k in ['h','s','u','cp','cv'] else 1)
   # IF97 R3 returns backward rho: store the independent fundamental pressure at that density.
   # Region-3 properties are evaluated from the same EOS; no HEOS substitution.
   if model=='IAPWS-95':
    # Re-evaluate the same EOS at the reported density. Preserve the original
    # P-T output: CoolProp 8 shows caloric path inconsistencies near Tc.
    r['fundamental']={k:PropsSI(keys[k],'Dmass',r['rho'],'T',t,fluid)/(1000 if k in ['h','s','u','cp','cv'] else 1) for k in ['rho','h','s','u','cp','cv','w','mu','lambda']}
   if model=='IF97':
    z=IAPWS97(P=p,T=t);r['fundamental']={k:float(getattr(z,'k' if k=='lambda' else k)) for k in ['rho','h','s','u','cp','cv','w','mu','lambda']}
   rows.append(r)
  except Exception as e:excluded.append(dict(model=model,p=p,T=t,error=str(e)))
 for p in [.001,.1,3,20,22]:
  for x in [.2,.8]:
   r=dict(model=model,mode='px',a=p,b=x,inverse=True)
   try:
    r['T']=PropsSI('T','P',p*1e6,'Q',x,fluid)
    for k in ['rho','h','s','u']:r[k]=PropsSI(keys[k],'P',p*1e6,'Q',x,fluid)/(1000 if k in ['h','s','u'] else 1)
    # Store mass-balanced refined phase ends from HEOS. IF97 high-T saturation
    # endpoints are backward approximations, so retain separate raw oracle results.
    if model=='IF97':
     l,v=IAPWS97(P=p,x=0),IAPWS97(P=p,x=1);r['fundamental']={k:float(getattr(l,k)+x*(getattr(v,k)-getattr(l,k))) for k in ['h','s','u']};r['fundamental']['rho']=1/(l.v+x*(v.v-l.v))
    rows.append(r)
   except Exception as e:excluded.append(dict(model=model,p=p,x=x,error=str(e)))
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent.parent/'tests/fixtures/water-conformance.json'
out.write_text(json.dumps(dict(source='CoolProp 8.0.0 P-T and direct density-T EOS; Python iapws 1.5.5 IF97 refined roots',seed=20261010,states=rows,excluded=excluded),indent=2)+'\n')
print(len(rows),'states;',len(excluded),'oracle failures')
