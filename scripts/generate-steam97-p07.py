"""Independent diagram controls: fundamental Python IF97 / CoolProp HEOS.

No product imports. Region-3 saturation solves the fundamental pressure equation
and selects the stable liquid/vapor roots, including the near-critical pair.
"""
import hashlib,json,math
from pathlib import Path
from importlib.metadata import version
from functools import lru_cache
from scipy.optimize import brentq
from scipy.interpolate import CubicHermiteSpline
import numpy as np
from iapws import IAPWS97
from iapws.iapws97 import _Region1,_Region2,_Region3,_PSat_T
import CoolProp.CoolProp as CP
ROOT=Path(__file__).resolve().parents[1]
assert version('iapws')=='1.5.5' and version('CoolProp')=='8.0.0'
def pt(model,p,T):
    if model=='IF97':
        q=IAPWS97(P=p,T=T)
        return dict(p=p,T=T,h=q.h,s=q.s)
    q=CP.AbstractState('HEOS','Water')
    if T<273.16:q.specify_phase(CP.iphase_liquid)
    q.update(CP.PT_INPUTS,p*1e6,T)
    return dict(p=p,T=T,h=q.hmass()/1000,s=q.smass()/1000)
@lru_cache(None)
def endpoints(model,T):
    if model=='IAPWS-95':
        result=[]
        for x in [0,1]:
            q=CP.AbstractState('HEOS','Water');q.update(CP.QT_INPUTS,x,T)
            result.append(dict(p=q.p()/1e6,T=T,h=q.hmass()/1000,s=q.smass()/1000))
        return result
    p=_PSat_T(T)
    if T<=623.15:qs=[_Region1(T,p),_Region2(T,p)]
    elif T==647.096:qs=[_Region3(322,T)]*2
    else:
        grid=[100+550*i/4096 for i in range(4097)];roots=[]
        a=grid[0];fa=_Region3(a,T)['P']-p
        for b in grid[1:]:
            fb=_Region3(b,T)['P']-p
            if fa*fb<0:
                rho=brentq(lambda d:_Region3(d,T)['P']-p,a,b,xtol=1e-10,rtol=1e-14)
                if _Region3(rho,T)['kt']>0:roots.append(rho)
            a,fa=b,fb
        assert len(roots)==2,(T,roots)
        qs=[_Region3(max(roots),T),_Region3(min(roots),T)]
    return [dict(p=p,T=T,h=q['h'],s=q['s'])for q in qs]
def tx(model,T,x):
    l,v=endpoints(model,T)
    return dict(p=l['p'],T=T,h=l['h']+x*(v['h']-l['h']),s=l['s']+x*(v['s']-l['s']),x=x)
records=[]
def add(model,mode,a,b,expected,background=None):
    records.append(dict(id=f'{model}-{len(records):03}',model=model,mode=mode,a=a,b=b,expected=expected,**({'background':background}if background else {})))
for model in ['IF97','IAPWS-95']:
    low=273.15 if model=='IF97' else 273.16
    for p in [.01,.1,1,10,22.064,50,100]:
        for i in [0,12,25,50,75,100]:
            T=low+(1073.15-low)*i/100
            add(model,'pt',p,T,pt(model,p,T),dict(kind='isobar',p=p,T=T))
    high=647.096 if model=='IF97' else 647.096-.0001
    for i in [0,20,60,120,160,180]:
        T=low+(high-low)*math.sin(i/180*math.pi/2)
        for branch in [0,1]:
            if model=='IF97' and i==180:
                e=tx(model,T,branch);e.pop('x');add(model,'pt',22.064,T,e,dict(kind='dome',slot=i,branch=branch))
            else:add(model,'tx',T,branch,tx(model,T,branch),dict(kind='dome',slot=i,branch=branch))
    for T in [273.16,300,373.15,473.15,623.15,640,647,647.0959]:
        for x in [0,.5,1]:add(model,'tx',T,x,tx(model,T,x))
    for p,T in [(3,373.15),(3,673.15),(25,650),(22.064,647.097),(1,1074),(40,1073.2),(100,1073.15)]:add(model,'pt',p,T,pt(model,p,T))
    if model=='IAPWS-95':
        for p,T in [(200,260),(400,500)]:add(model,'pt',p,T,pt(model,p,T))
curves=[]
curve_states=[pt('IF97',p,T)for p,T in [(.1,373.15),(3,673.15),(10,800)]]
for kind in ['ts','hsdiagram','phdiagram']:
    for closed in [False,True]:
        states=curve_states+([curve_states[0]]if closed else [])
        span=np.array([4500,math.log10(100/.0006)])if kind=='phdiagram'else np.array([11,800 if kind=='ts'else 4500])
        xy=np.array([[q['h'],math.log10(q['p'])]if kind=='phdiagram'else[q['s'],q['T']-273.15 if kind=='ts'else q['h']]for q in states])/span
        steps=np.linalg.norm(np.diff(xy,axis=0),axis=1)**.5
        slopes=np.diff(xy,axis=0)/steps[:,None];derivatives=np.zeros_like(xy)
        derivatives[0]=slopes[0];derivatives[-1]=slopes[-1]
        for i in range(1,len(xy)-1):derivatives[i]=(steps[i]*slopes[i-1]+steps[i-1]*slopes[i])/(steps[i-1]+steps[i])
        if closed:derivatives[0]=derivatives[-1]=(steps[0]*slopes[-1]+steps[-1]*slopes[0])/(steps[-1]+steps[0])
        knots=np.r_[0,np.cumsum(steps)];curve=CubicHermiteSpline(knots,xy,derivatives)
        samples=curve(np.linspace(0,knots[-1],241))*span
        curves.append(dict(kind=kind,closed=closed,states=states,expected=[dict(x=p[0],y=p[1])for p in samples]))
payload=dict(schema_version=1,source='Python iapws fundamental IF97; independently bracketed stable region-3 saturation roots; CoolProp HEOS IAPWS-95; SciPy CubicHermiteSpline drawing controls. No product imports.',dependencies={k:version(k)for k in ['iapws','CoolProp','scipy']},generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),policy=dict(relative=2e-7,T_absolute=2e-5,p_absolute=2e-8,h_absolute=2e-5,s_absolute=2e-8,spline_pixel=.65),records=records,curves=curves)
(ROOT/'tests/fixtures/steam97-p07-reference.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
print(json.dumps({'states':len(records),'background_controls':sum('background'in r for r in records)}))
