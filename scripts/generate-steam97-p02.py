"""Independent near-Pc inverse controls at 70/90 digits; no product imports.

Reuses the independent fundamental-equation transcription from 1.35.2.
"""
import hashlib
import json
import math
import runpy
from importlib.metadata import version
from pathlib import Path
from iapws import IAPWS95
import mpmath as mp

ROOT = Path(__file__).resolve().parents[1]
reference = runpy.run_path(str(ROOT/'scripts/generate-accuracy-followup.py'))
assert version('iapws') == '1.5.5' and version('CoolProp') == '8.0.0'


def solve95_pt(mode,p,T,digits):
    residual,jk = reference['eos95'](digits)
    p,T = mp.mpf(str(p)),mp.mpf(str(T))
    tc,rc,R = mp.mpf('647.096'),mp.mpf(322),mp.mpf('.46151805')
    tau = tc/T
    # Every cold point in this grid is compressed liquid, every hot point is
    # above Tc. Wide density brackets avoid both CoolProp's automatic phase
    # ambiguity band and the older reference helper's narrow exact-Pc bracket.
    bracket = (mp.mpf(1),mp.mpf(2)) if T<tc else (mp.mpf('.25'),mp.mpf(1))
    fn = lambda d:jk(d,tau)[0]*rc*R*T/1000-p
    assert fn(bracket[0])<0<fn(bracket[1])
    d = mp.findroot(fn,bracket,solver='bisect',tol=mp.mpf(10)**(-digits+18),maxsteps=400)
    phi,pd = residual(d,tau)
    pdd = mp.diff(lambda x:residual(x,tau)[1],d)
    pt = mp.diff(lambda t:residual(d,t)[0],tau)
    ptt = mp.diff(lambda t:residual(d,t)[0],tau,2)
    pdt = mp.diff(lambda t:residual(d,t)[1],tau)
    f0 = IAPWS95.Fi0
    ao = [mp.mpf(str(v)) for v in f0['ao_pow']]
    lg = mp.mpf(str(f0['ao_log'][1]))
    terms = [(mp.mpf(str(n)),mp.mpf(str(g))) for n,g in zip(f0['ao_exp'],f0['titao'])]
    ideal = mp.log(d)+ao[0]+ao[1]*tau+lg*mp.log(tau)+mp.fsum(n*mp.log(-mp.expm1(-g*tau)) for n,g in terms)
    it = ao[1]+lg/tau+mp.fsum(n*g/mp.expm1(g*tau) for n,g in terms)
    itt = -lg/tau**2-mp.fsum(n*g*g*mp.exp(g*tau)/mp.expm1(g*tau)**2 for n,g in terms)
    A,B = 1+d*pd-d*tau*pdt,1+2*d*pd+d*d*pdd
    assert B>0
    cv,rho = -R*tau*tau*(itt+ptt),d*rc
    q = dict(T=T,p=rho*R*T*(1+d*pd)/1000,rho=rho,v=1/rho,
             h=R*T*(1+tau*(it+pt)+d*pd),s=R*(tau*(it+pt)-ideal-phi),u=R*T*tau*(it+pt),
             cp=cv+R*A*A/B,cv=cv,w=mp.sqrt(1000*R*T*(B+R*A*A/cv)),alpha=A/(T*B),drhodp=1000/(R*T*B))
    return [{k:mp.nstr(v,45) for k,v in q.items()}]
pc,tc = 22.064,647.096
pressures = sorted(set([pc+d for d in [-1e-6,-1e-8,-1e-10,-1e-12,0,1e-12,1e-10,1e-8,1e-6]]+
                       [math.nextafter(pc,-math.inf),math.nextafter(pc,math.inf)]))
records = []
for model in ['IF97','IAPWS-95']:
    solve = reference['solve97'] if model == 'IF97' else solve95_pt
    for p in pressures:
        for delta in [-.1,-.001,-1e-5,1e-5,.001,.1]:
            t = tc+delta
            low,high = [solve('pt',p,t,digits)[0] for digits in [70,90]]
            convergence = {k:float(abs(mp.mpf(low[k])/mp.mpf(high[k])-1)) for k in high}
            assert max(convergence.values()) < 1e-25,(model,p,t,convergence)
            expected = {k:float(v) for k,v in high.items()}
            expected.update(p=p,T=t)  # Exact supplied binary64 input spelling.
            records.append(dict(id=f'{model}-pc-{len(records):03}',model=model,p=p,T=t,
                                expected=expected,x=None,modes=['pt','ph','ps','pu'],
                                convergence=convergence))
        print(model,format(p,'.17g'),'verified 70/90 digits',flush=True)
payload = dict(schema_version=1,source='Independent fundamental IF97/IAPWS-95, mpmath 70/90 digits; density bisection, no product values',
               dependencies={k:version(k) for k in ['iapws','CoolProp','mpmath']},precisionDigits=[70,90],
               generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               reference_implementation_sha256=hashlib.sha256((ROOT/'scripts/generate-accuracy-followup.py').read_bytes()).hexdigest(),
               scope='11 pressures on both sides of Pc including adjacent representable values, six temperatures on both sides of Tc; no singular exact Tc state',
               acceptance_policy='docs/steam97-p01/pilot-policy.json and scripts/inverse-precision-common.mjs, unchanged',records=records)
(ROOT/'tests/fixtures/steam97-p02-reference.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
print('states',len(records),'queries',sum(len(c['modes']) for c in records))
