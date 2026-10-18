"""Deterministic independent IF97/IAPWS-95 inverse references (no product JS).
Python iapws 1.5.5 for IF97; CoolProp 8 HEOS for IAPWS-95, with an
independent Python IAPWS95 cross-check. Keep same-formulation comparisons.
"""
import json, math, os, random, warnings, runpy
from pathlib import Path
from iapws import IAPWS97, IAPWS95
from iapws.iapws97 import _t_P, _Region3
import CoolProp.CoolProp as CP

warnings.filterwarnings('error', category=RuntimeWarning)
ROOT=Path(__file__).resolve().parents[1]
MODES={'ph':['p','h'],'ps':['p','s'],'pu':['p','u'],'pv':['p','v'],'prho':['p','rho'],
       'th':['T','h'],'ts':['T','s'],'tu':['T','u'],'tv':['T','v'],'trho':['T','rho'],
       'hs':['h','s'],'us':['u','s'],'vs':['v','s'],'hv':['h','v'],'uv':['u','v']}
records=[]; seen=set(); cross=[]; criticalChecks=[]; rng=random.Random(13503)
referenceLibrary=runpy.run_path(str(ROOT/'scripts/generate-accuracy-followup.py'))
solve97=referenceLibrary['solve97'];solve95=referenceLibrary['solve95']
sat97cache={}

def add(model,p,T,group='ordinary',x=None,modes=None):
    identity=(model,p,T,x)
    if identity in seen: return
    if model=='IF97':
        q=IAPWS97(P=p,T=T) if x is None else IAPWS97(P=p,x=x)
        expected=dict(p=p,T=q.T,h=q.h,s=q.s,u=q.u,v=q.v,rho=q.rho)
        if x is not None and q.T>623.15:
            # Python's saturated region-3 API uses approximate backward v(p,T)
            # without the forward-EOS refinement used by its ordinary P-T API.
            # Refine each stable endpoint independently before mass blending.
            if p not in sat97cache:
                low=solve97('satp',p,None,70);high=solve97('satp',p,None,90)
                assert all(abs(float(a[k])/float(b[k])-1)<1e-14 for a,b in zip(low,high) for k in ['h','s','u','v','rho'])
                sat97cache[p]=high
            endpoints=sat97cache[p]
            expected['T']=float(endpoints[0]['T'])
            for k in ['h','s','u','v']:expected[k]=float(endpoints[0][k])+x*(float(endpoints[1][k])-float(endpoints[0][k]))
            expected['rho']=1/expected['v']
        region=q.region
    else:
        state=CP.AbstractState('HEOS','Water')
        state.update(CP.PT_INPUTS,p*1e6,T) if x is None else state.update(CP.PQ_INPUTS,p*1e6,x)
        expected=dict(p=p,T=state.T(),h=state.hmass()/1000,s=state.smass()/1000,
                      u=state.umass()/1000,v=1/state.rhomass(),rho=state.rhomass())
        region=None
        if len([c for c in records if c['model']==model])%20==0:
            other=IAPWS95(P=p,T=T) if x is None else IAPWS95(T=expected['T'],x=x)
            differences={k:abs(getattr(other,k)-expected[k])/max(abs(expected[k]),1e-12) for k in ['h','s','u','rho']}
            assert max(differences.values())<2e-7,(p,T,differences)
            cross.append(dict(p=p,T=T,x=x,relative=differences))
    if group=='critical' and (model=='IAPWS-95' or p==22.064):
        fn=solve97 if model=='IF97' else solve95
        low=fn('pt',p,T,70)[0];high=fn('pt',p,T,90)[0]
        import mpmath as mp
        assert all(abs(mp.mpf(low[k])/mp.mpf(high[k])-1)<mp.mpf('1e-25') for k in expected)
        precise={k:float(high[k]) for k in expected}
        comparison=dict(model=model,p=p,T=T,primaryRelative={k:abs(expected[k]-precise[k])/max(abs(precise[k]),1e-12) for k in expected},verifiedDigits=[70,90])
        if model=='IAPWS-95':
            other=IAPWS95(T=T,rho=precise['rho'])
            comparison['pythonRelative']={k:abs(getattr(other,k)-precise[k])/max(abs(precise[k]),1e-12) for k in ['h','s','u','rho']}
            assert max(comparison['pythonRelative'].values())<2e-10
        criticalChecks.append(comparison);expected=precise
    seen.add(identity)
    records.append(dict(id=f'{model}-{len(records):04d}',model=model,group=group,
                        expected=expected,region=region,x=x,
                        modes=modes or [list(MODES)[len(records)%len(MODES)]]))

# Dense targeted points on BOTH sides of the IF97 consistency boundaries.
for p in [.001,.1,1,10,20,25,40,50]:
    for T in [1073.15-1e-5,1073.15,1073.15+1e-5,1073.16,1074,1076,1078]:
        add('IF97',p,T,'region-2-5',modes=list(MODES)[:10])
for p in [17,20,22,25,30,50,75,100]:
    for d in [-1,-.01,-1e-5,1e-5,.01,1]:
        add('IF97',p,_t_P(p)+d,'B23',modes=['ph','ps','pu','pv','prho','th','ts','tu','tv','trho'])
for p in [17,20,25,50,100]:
    for d in [-1e-5,0,1e-5]: add('IF97',p,623.15+d,'region-1-3',modes=['ph','ps','pv','prho','th','ts','tv','trho'])
for model in ['IF97','IAPWS-95']:
    for p in [20,22,22.064,25,50]:
        for d in [-.01,-.0001,.0001,.01]:
            add(model,p,647.096+d,'critical',modes=['ph','ps','pu','pv','prho','th','ts','tu','tv','trho','hs'])
    for p in [.001,.1,1,10,15,16.5,20,22,22.06]:
        for x in [.1,.5,.9]: add(model,p,None,'mixture',x,modes=['ph','ps','pu','pv','prho','th','ts','tu','tv','trho','hs','us','vs','hv','uv'])
    # Closed domain endpoints and high-pressure ordinary states.
    for p in [.001,.1,1,25,50,100] if model=='IF97' else [.001,.1,1,25,100,500,1000]:
        for T in ([273.15,1073.15,2273.15] if model=='IF97' and p<=50 else [273.15,1073.15] if model=='IF97' else [355,1273]):
            add(model,p,T,'domain',modes=['ph','ps','pu','pv','prho','th','ts','tu','tv','trho','hs'])

# >=2000 distinct states, not a count of repeated scalar comparisons.
for model,count in [('IF97',1700),('IAPWS-95',500)]:
    while sum(c['model']==model for c in records)<count:
        p=10**rng.uniform(-3,2 if model=='IF97' else 3)
        n=len(records)%4
        T=rng.uniform(273.2,1073.15 if p>50 else 2273.15) if model=='IF97' else rng.uniform(355 if p>500 else 280,1273)
        if model=='IF97' and n==0:
            p=rng.uniform(17,100);T=rng.uniform(623.151,_t_P(p)-.001)
        add(model,p,T)

out=ROOT/'tests/fixtures/inverse-precision-reference.json'
out.write_text(json.dumps(dict(source={'IF97':'Python iapws 1.5.5 fundamental equations',
    'IAPWS-95':'CoolProp 8.0.0 HEOS ordinary states; all critical states independently at 70/90 digits; sampled Python iapws 1.5.5 cross-check',
    'seed':13503},modes=MODES,crossChecks=cross,criticalChecks=criticalChecks,records=records),indent=2,allow_nan=False)+'\n')
print(json.dumps(dict(states=len(records),queries=sum(len(c['modes']) for c in records),crossChecks=len(cross),path=str(out))))
