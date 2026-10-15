"""Independent numeric references only: isolated Python iapws==1.5.5, NumPy/SciPy."""
import json
from pathlib import Path
import iapws
from iapws import IAPWS97, IAPWS95
from scipy.optimize import brentq
from functools import lru_cache

cases = [
    dict(name='ideal', equipment='ideal', pLow=.01, pBleed=1., pHigh=10., Tsteam=773.15, steamMode='superheated'),
    dict(name='actual', equipment='actual', pLow=.01, pBleed=1., pHigh=10., Tsteam=773.15, steamMode='superheated'),
    dict(name='saturated-inlet', equipment='actual', pLow=.01, pBleed=.5, pHigh=3., steamMode='saturated'),
    dict(name='superheated-exit', equipment='actual', pLow=.5, pBleed=2., pHigh=10., Tsteam=1000., steamMode='superheated'),
]
records=[]
for model, equation in [('IF97', IAPWS97), ('IAPWS-95', IAPWS95)]:
    @lru_cache(maxsize=100)
    def sat(p,x): return equation(P=p,x=x)
    def inverse(p,target,key):
        liquid,vapor=sat(p,0),sat(p,1)
        if getattr(liquid,key)<=target<=getattr(vapor,key):
            return equation(P=p,x=(target-getattr(liquid,key))/(getattr(vapor,key)-getattr(liquid,key)))
        lo,hi=(273.16,liquid.T-1e-5) if target<getattr(liquid,key) else (vapor.T+1e-5,1273.15)
        T=brentq(lambda T:getattr(equation(P=p,T=T),key)-target,lo,hi,xtol=1e-9)
        state=equation(P=p,T=T)
        assert abs(getattr(state,key)-target)<(1e-8 if key=='s' else 1e-6)
        return state
    for case in cases:
        a=dict(kind='rankine-regenerative',model=model,fluid='water',mass=1.,etaPump=.85,etaPumpHigh=.82,etaHP=.88,etaLP=.9,**{k:v for k,v in case.items() if k!='name'})
        def out(s,p,eta):
            ideal=inverse(p,s.s,'s')
            efficiency=1. if a['equipment']=='ideal' else a[eta]
            return inverse(p,s.h+(ideal.h-s.h)*(1/efficiency if p>s.P else efficiency),'h')
        one=sat(a['pLow'],0);two=out(one,a['pBleed'],'etaPump');three=sat(a['pBleed'],0);four=out(three,a['pHigh'],'etaPumpHigh')
        five=equation(P=a['pHigh'],**({'x':1} if a['steamMode']=='saturated' else {'T':a['Tsteam']}));six=out(five,a['pBleed'],'etaHP');seven=out(six,a['pLow'],'etaLP')
        y=(three.h-two.h)/(six.h-two.h)
        pumpLow=(1-y)*(two.h-one.h);pumpHigh=four.h-three.h;boiler=five.h-four.h;hp=five.h-six.h;lp=(1-y)*(six.h-seven.h);condenser=(1-y)*(seven.h-one.h);net=hp+lp-pumpLow-pumpHigh
        states=[]
        for s in [one,two,three,four,five,six,seven]:
            quality=s.x if abs(s.T-sat(s.P,1).T)<1e-5 else None
            states.append(dict(p=float(s.P),T=float(s.T),h=float(s.h),s=float(s.s),v=float(s.v),x=None if quality is None else float(quality)))
        baselineHigh=out(two,a['pHigh'],'etaPumpHigh');baselineHeat=five.h-baselineHigh.h;baselineWork=hp+(six.h-seven.h)-(two.h-one.h)-(baselineHigh.h-two.h)
        metrics=dict(y=y,pumpLow=pumpLow,pumpHigh=pumpHigh,boiler=boiler,hp=hp,lp=lp,condenser=condenser,net=net,efficiency=net/boiler,mixerEntropy=three.s-(1-y)*two.s-y*six.s,baselineHeat=baselineHeat,baselineWork=baselineWork,baselineEfficiency=baselineWork/baselineHeat)
        records.append(dict(name=case['name'],input=a,states=states,metrics=metrics))
        print(model,case['name'],'y',y,'eta',net/boiler,flush=True)
Path('tests/fixtures/rankine-regeneration-reference.json').write_text(json.dumps(dict(source='Independent Python iapws 1.5.5 (GPL-3.0), IAPWS97/IAPWS95; not included in runtime',version=iapws.__version__,generator='scripts/generate-regeneration-reference.py',inverse='At fixed P, saturation lever rules for s/h or scipy brentq on independent EOS; s residual <1e-8, h residual <1e-6. Application output is never used.',basis='1 kg boiler steam; adiabatic open heater saturated-liquid outlet, no pressure losses/reheat; baseline retains both pumps/stages and efficiencies',records=records),indent=2)+'\n')
