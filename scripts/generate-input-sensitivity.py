"""Independent response coefficients: Python iapws97 + CoolProp HEOS95.
Five-point finite differences (two step sizes) additionally check ordinary
states without repeating the JavaScript thermodynamic derivative identities.
"""
import json, math
from pathlib import Path
from iapws import IAPWS97
import CoolProp.CoolProp as CP

ROOT=Path(__file__).resolve().parents[1]
records=[]
for model in ['IF97','IAPWS-95']:
    points=[(3,400),(1,700),(25,700),(25,647.096),(22.064,647.196)]
    points += [(40,1500)] if model=='IF97' else [(100,1000)]
    for p,T in points:
        def evaluate(p,T):
            if model=='IF97':
                q=IAPWS97(P=p,T=T)
                return dict(p=p,T=T,h=q.h,s=q.s,u=q.u,v=q.v,rho=q.rho)
            state=CP.AbstractState('HEOS','Water');state.update(CP.PT_INPUTS,p*1e6,T)
            return dict(p=p,T=T,h=state.hmass()/1000,s=state.smass()/1000,u=state.umass()/1000,v=1/state.rhomass(),rho=state.rhomass())
        center=evaluate(p,T)
        gradients={}
        convergence={}
        for key in center:
            values=[]
            for dimension,step in [(0,p*(1e-5 if abs(T-647.096)<.2 else 1e-4)),(1,1e-4 if abs(T-647.096)<.2 else 1e-3)]:
                def stencil(h):
                    def value(offset):
                        return evaluate(p+offset*h if dimension==0 else p,T+offset*h if dimension==1 else T)[key]
                    return (8*(value(1)-value(-1))-(value(2)-value(-2)))/(12*h)
                coarse=stencil(step);fine=stencil(step/2)
                values.append(fine)
                convergence[key+':'+str(dimension)]=abs(fine-coarse)
            gradients[key]=values
        records.append(dict(model=model,expected=center,gradients=gradients,convergence=convergence))
output=dict(source={'IF97':'iapws 1.5.5, forward P-T','IAPWS-95':'CoolProp 8.0.0 HEOS Water','method':'five-point central differences at two step sizes; no product JS'},records=records)
(ROOT/'tests/fixtures/input-sensitivity-reference.json').write_text(json.dumps(output,indent=2)+'\n')
print('Independent sensitivity reference states:',len(records))
