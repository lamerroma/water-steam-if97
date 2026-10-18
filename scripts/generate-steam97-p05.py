"""Independent P05 controls: Python IAPWS-95 and CoolProp HEOS; no product imports.

Validity comes from the releases, not the libraries' willingness to extrapolate.
The acceptance limits below are fixed before evaluating the product.
"""
import hashlib
import json
import math
import warnings
from importlib.metadata import version
from pathlib import Path
from iapws import IAPWS95
from iapws._iapws import _Melting_Pressure
import CoolProp.CoolProp as CP

ROOT = Path(__file__).resolve().parents[1]
assert version('iapws') == '1.5.5' and version('CoolProp') == '8.0.0'


def upper(T):
    if T >= 355:
        return math.inf
    return _Melting_Pressure(T, 'III' if T < 256.164 else 'V' if T < 273.31 else 'VI')


def fluid(p, T):
    return T >= 251.165 and p < upper(T) and (T >= 273.16 or p > _Melting_Pressure(T, 'Ih'))


def floor(p):
    if p < .000611657:
        return 273.16
    lo, hi = 251.165, 355
    for _ in range(60):
        mid = (lo+hi)/2
        if fluid(p, mid):
            hi = mid
        else:
            lo = mid
    return hi


def limits(p):
    mu = 1173.15 if p <= 300 else 873.15 if p <= 350 else 433.15 if p <= 500 else 373.15
    lam = 1173.15 if p <= 100 else 874 if p <= 250 else 573 if p <= 687 else 403 if p <= 785 else 348
    return mu, lam


points = {(200., 260.), (200., 400.), (400., 500.), (700., 380.), (1., 273.15)}
for p in [.0001, .1, 1, 20, 100, 138.268113, 200, 208.566, 250, 300, 350.1, 400, 632.4, 700, 1000]:
    for dT in [1e-5, .01, 1]:
        points.add((p, floor(p)+dT))
    for T in [300, 400, 600, 900, 1273]:
        if T >= floor(p):
            points.add((p, T))
for cut in [100, 250, 300, 350, 500, 687, 785, 1000]:
    for p in [cut-1e-6, cut, cut+1e-6]:
        if p > 1000:
            continue
        for edge in set(limits(p)):
            for dT in [-1e-6, 0, 1e-6]:
                points.add((p, edge+dT))
# Ordinary and near-critical transport, preserving the exact critical exclusion.
points.update([(22.064, 646.996), (22.064, 647.196), (22.1, 647.35), (25, 700)])
records = []
keys = ['h', 's', 'u', 'rho', 'v', 'cp', 'cv', 'w']
cp_keys = dict(h='Hmass', s='Smass', u='Umass', rho='Dmass', cp='Cpmass', cv='Cvmass', w='A')
for p, T in sorted(points):
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        q = IAPWS95(P=p, T=T)
    expected = {k:float(getattr(q, k)) for k in keys}
    expected.update(p=p, T=T, mu=q.mu, lambda_=q.k, dc=q.epsilon)
    expected['lambda'] = expected.pop('lambda_')
    # HEOS's automatic melting guard differs from R14-08 near the ice V/VI
    # junction. Impose liquid only after the independent R14-08 fluid proof.
    t_key = 'T|liquid' if T<355 and p>=.000611657 else 'T'
    assert T>=273.16 or fluid(p,T)
    cross = {k:CP.PropsSI(v, 'P', p*1e6, t_key, T, 'Water')/(1000 if k in ['h', 's', 'u', 'cp', 'cv'] else 1) for k, v in cp_keys.items()}
    cross.update(mu=CP.PropsSI('V', 'P', p*1e6, t_key, T, 'Water'), **{'lambda': CP.PropsSI('L', 'P', p*1e6, t_key, T, 'Water')})
    for k, value in cross.items():
        assert abs(value-expected[k]) <= max(1e-7 if k in ['h', 'u'] else 1e-9, abs(expected[k])*2e-7), (p, T, k, value, expected[k])
    mu_limit, lam_limit = limits(p)
    records.append(dict(id=f'P05-{len(records):03}', model='IAPWS-95', expected=expected, coolprop=cross,
                        available=dict(mu=T<=mu_limit, nu=T<=mu_limit, **{'lambda':T<=lam_limit},
                                       diffusivity=T<=lam_limit, Pr=T<=min(mu_limit,lam_limit), dc=T<=873),
                        coolprop_phase_input=t_key, warnings=sorted(set(str(w.message) for w in caught))))

domain = []
for p in [.1, 1, 20, 138.268113, 200, 208.566, 300, 350.1, 632.4, 1000]:
    for delta in [-1e-5, 1e-5]:
        domain.append(dict(p=p, T=floor(p)+delta, accepted=delta>0, phase='liquid' if delta>0 else 'ice'))
domain += [dict(p=p,T=T,accepted=False,phase='outside-validated-domain') for p,T in
           [(200,251.164999),(1,250),(1,1273.000001),(1000.000001,400),(0,400),(.0001,273.15)]]
payload = dict(schema_version=1, dependencies={k:version(k) for k in ['iapws','CoolProp']},
               generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               sources=['https://iapws.org/technical-guidance/release/IAPWS-95.download',
                        'https://iapws.org/technical-guidance/release/MeltSub.download',
                        'https://iapws.org/technical-guidance/release/viscosity.download',
                        'https://iapws.org/public/documents/w-mwl/ThCond.pdf',
                        'https://iapws.org/technical-guidance/release/Dielec.download'],
               policy=dict(forward_relative=2e-7, forward_absolute=dict(h=1e-7,u=1e-7,s=1e-9,rho=1e-7,v=1e-12,cp=1e-8,cv=1e-8,w=1e-6,mu=1e-12,**{'lambda':1e-10},dc=1e-8),
                           inverse_temperature_absolute=2e-6,inverse_pressure_absolute=2e-6,
                           domain='Stable fluid only; melting boundary excluded; no sub-triple vapor extrapolation; exact critical singularity excluded.'),
               records=records,domain_probes=domain)
out=ROOT/'tests/fixtures/steam97-p05-reference.json'
out.write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
print(json.dumps(dict(states=len(records),domain_probes=len(domain),max_library_relative_difference=max(abs(c['coolprop'][k]/c['expected'][k]-1) for c in records for k in c['coolprop'] if c['expected'][k]))))
