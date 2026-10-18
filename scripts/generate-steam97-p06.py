"""Independent P06 references: fundamental Python IF97/IAPWS-95 + balances.

No product imports. Brent roots refine P-h/P-s against the forward formulation;
the reference does not rely on the accuracy of backward-polynomial seeds.
"""
import hashlib
import json
import warnings
from pathlib import Path
from importlib.metadata import version
from scipy.optimize import brentq
from iapws import IAPWS97, IAPWS95
from iapws.iapws97 import _Region1,_Region2,_Region3,_TSat_P
from types import SimpleNamespace
from functools import lru_cache
import CoolProp.CoolProp as CP

ROOT=Path(__file__).resolve().parents[1]
assert version('iapws')=='1.5.5' and version('CoolProp')=='8.0.0'
records=[]

def point(cls,p,T,side=None):
    if cls is IAPWS97:
        return cls(P=p,T=T)
    q=CP.AbstractState('HEOS','Water')
    if side or T<273.16:
        q.specify_phase(CP.iphase_liquid if side=='liquid' or T<273.16 else CP.iphase_gas)
    q.update(CP.PT_INPUTS,p*1e6,T)
    return SimpleNamespace(P=p,T=T,h=q.hmass()/1000,s=q.smass()/1000,rho=q.rhomass())

@lru_cache(None)
def saturated(cls,p,x):
    if cls is IAPWS95:
        q=CP.AbstractState('HEOS','Water');q.update(CP.PQ_INPUTS,p*1e6,x)
        return SimpleNamespace(P=p,T=q.T(),h=q.hmass()/1000,s=q.smass()/1000,rho=q.rhomass())
    T=_TSat_P(p)
    endpoints=[]
    for quality in [0,1]:
        if T<=623.15:
            q=(_Region1 if quality==0 else _Region2)(T,p)
        else:
            seed=IAPWS97(P=p,x=quality).rho
            rho=brentq(lambda d:_Region3(d,T)['P']-p,seed*.98,seed*1.02,xtol=1e-10,rtol=1e-14)
            q=_Region3(rho,T)
        endpoints.append(q)
    l,v=endpoints
    return SimpleNamespace(P=p,T=T,h=l['h']+x*(v['h']-l['h']),s=l['s']+x*(v['s']-l['s']),rho=1/(l['v']+x*(v['v']-l['v'])))

def state(q,x=None):
    return dict(p=q.P,T=q.T,h=q.h,s=q.s,rho=q.rho,x=x)

def inverse(cls,p,key,target):
    upper=1273 if cls is IAPWS95 else 2273.15 if p<=50 else 1073.15
    lower=273.16 if cls is IAPWS95 else 273.15
    side=None
    if p<22.064:
        l,v=saturated(cls,p,0),saturated(cls,p,1)
        left,right=getattr(l,key),getattr(v,key)
        if left<=target<=right:
            x=(target-left)/(right-left)
            return saturated(cls,p,x),x
        if target<left:
            upper=l.T-1e-7;side='liquid'
        else:
            lower=v.T+1e-7;side='vapor'
    t=brentq(lambda T:getattr(point(cls,p,T,side),key)-target,lower,upper,xtol=2e-11,rtol=1e-14)
    return point(cls,p,t,side),None

for model,cls in [('IF97',IAPWS97),('IAPWS-95',IAPWS95)]:
    turbine_points=[(3,673.15,.1,.85,2),(6,773.15,.1,.85,10),(1,973.15,.8,.75,5),
                    (25,823.15,.1,.9,8),(30,900,25,.85,2),(22.064,773.15,1,.85,4),
                    (22.06,700,20,.8,2),(16.5,900,15,.95,1),(50,1200,45,.8,3),
                    (100,1000,50,.85,1),(6,773.15,.1,1,10),(3,673.15,.1,.1,2),
                    (6,773.15,.1,.9999,10),(3,673.15,.1,.85,0)]
    for p1,T1,p2,eta,flow in turbine_points:
        inlet=point(cls,p1,T1)
        ideal,xi=inverse(cls,p2,'s',inlet.s)
        work=eta*(inlet.h-ideal.h)
        outlet,x=inverse(cls,p2,'h',inlet.h-work)
        sat1=saturated(cls,p1,0).T if p1<22.064 else None
        sat2=saturated(cls,p2,0).T if p2<22.064 else None
        superheat=None if sat2 is None else 0 if x is not None else outlet.T-sat2 if outlet.T>=sat2 else None
        records.append(dict(id=f'{model}-turbine-{len(records):02}',kind='turbine',model=model,
                            input=dict(p1=p1,T1=T1,p2=p2,eta=eta,flow=flow),
                            modes=['power','flow','efficiency'] if flow>0 and eta<1 else ['power'],
                            expected=dict(inlet=state(inlet),ideal=state(ideal,xi),outlet=state(outlet,x),
                                          work=work,power=work*flow,eta=eta,flow=flow,
                                          inletTsat=sat1,outletSuperheat=superheat,specificConsumption=3600/work)))
    flash_points=[(3,0,.1,2,1),(20,0,.1,2,1),(22.0,0,20,2,1),
                  (3,450,.1,4,2),(3,300,1,4,2),(25,600,.1,2,2),
                  (3,673.15,.1,1,0),(3,0,.1,0,1)]
    if cls is IAPWS95:
        flash_points.append((200,260,100,2,2))
    # Explicit saturated-liquid/vapor outlet controls, with independently
    # refined inlet temperatures. Endpoints are not inferred from rounded T.
    for p1,p2,x in [(3,.1,0),(20,.1,1)]:
        target=saturated(cls,p2,x).h
        q,_=inverse(cls,p1,'h',target)
        flash_points.append((p1,q.T,p2,2,2 if x==0 else 0))
    for p1,T1,p2,flow,flag in flash_points:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            inlet=saturated(cls,p1,0) if flag==1 else point(cls,p1,T1)
            outlet,x=inverse(cls,p2,'h',inlet.h)
        records.append(dict(id=f'{model}-flash-{len(records):02}',kind='flash',model=model,
                            input=dict(p1=p1,T1=inlet.T,p2=p2,flow=flow,flag=flag),modes=['flash'],
                            warnings=sorted(set(str(w.message)for w in caught)),
                            expected=dict(inlet=state(inlet,0 if flag==1 else None),outlet=state(outlet,x),flow=flow,
                                          vaporFlow=None if x is None else flow*x,liquidFlow=None if x is None else flow*(1-x))))
    print(model,'reference states completed',flush=True)

payload=dict(schema_version=1,source='Python fundamental IF97 (region-3 saturation density refined), CoolProp HEOS IAPWS-95, independent Brent P-h/P-s roots, adiabatic energy and phase mass balances; no product imports',
             dependencies={k:version(k)for k in ['iapws','CoolProp','scipy']},
             generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
             policy=dict(relative=2e-7,temperature_absolute=2e-5,energy_absolute=2e-6,power_absolute=2e-5,
                         scalar_absolute=2e-7,entropy_absolute=2e-9,quality_absolute=2e-7,
                         endpoint_quality_snap=2e-7,
                         notes='Exact eta=1 and zero-flow controls are forward checks; inverse eta=1 closure uses the same EOS power to avoid mistaking rounded independent power for an efficiency above one.'),records=records)
(ROOT/'tests/fixtures/steam97-p06-reference.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
print(json.dumps(dict(states=len(records),queries=sum(len(r['modes'])for r in records))))
