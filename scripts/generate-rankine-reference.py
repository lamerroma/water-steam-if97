"""Optional reference generation: Python iapws==1.5.5, not a runtime dependency.
Run with PYTHONPATH pointing to its isolated install. Energies are kJ/kg.
"""
import json
import sys
from pathlib import Path
import iapws
from iapws import IAPWS97, IAPWS95
from scipy.optimize import brentq
from functools import lru_cache

cases = [
    dict(name='simple-superheated', kind='rankine', steamMode='superheated', pLow=.01, pHigh=10., Tsteam=773.15),
    dict(name='single-reheat', kind='rankine-reheat', steamMode='superheated', pLow=.01, pHigh=10., pReheat=2., Tsteam=773.15, Treheat=773.15),
    dict(name='dry-saturated-inlet', kind='rankine', steamMode='saturated', pLow=.01, pHigh=3.),
    dict(name='superheated-exit', kind='rankine', steamMode='superheated', pLow=.5, pHigh=10., Tsteam=1000.),
]
actual = '--actual' in sys.argv
if actual:
    cases = [dict(c, equipment='actual', etaPump=.85, etaHP=.88, **({'etaLP': .9} if c['kind']=='rankine-reheat' else {})) for c in cases]
records = []
for model, equation in [('IF97', IAPWS97), ('IAPWS-95', IAPWS95)]:
    for case in cases:
        a = case
        @lru_cache(maxsize=20)
        def sat(p, x):
            return equation(P=p, x=x)
        def ps(p, entropy):
            # The package's generic IAPWS95 P-s two-phase solve can return a
            # nonconverged saturation temperature. Enforce equilibrium with
            # the lever rule; in a single phase independently solve s(T,p).
            liquid, vapor = sat(p, 0), sat(p, 1)
            if liquid.s <= entropy <= vapor.s:
                return equation(P=p, x=(entropy-liquid.s)/(vapor.s-liquid.s))
            lo, hi = (273.16, liquid.T-1e-5) if entropy < liquid.s else (vapor.T+1e-5, 1273.15)
            T = brentq(lambda T: equation(P=p, T=T).s-entropy, lo, hi, xtol=1e-9)
            state = equation(P=p, T=T)
            assert abs(state.s-entropy) < 1e-8
            return state
        def ph(p, enthalpy):
            liquid, vapor = sat(p, 0), sat(p, 1)
            if liquid.h <= enthalpy <= vapor.h:
                return equation(P=p, x=(enthalpy-liquid.h)/(vapor.h-liquid.h))
            lo, hi = (273.16, liquid.T-1e-5) if enthalpy < liquid.h else (vapor.T+1e-5, 1273.15)
            T = brentq(lambda T: equation(P=p, T=T).h-enthalpy, lo, hi, xtol=1e-9)
            state = equation(P=p, T=T)
            assert abs(state.h-enthalpy) < 1e-6
            return state
        one = sat(a['pLow'], 0)
        two = ps(a['pHigh'], one.s)
        if actual:
            two = ph(a['pHigh'], one.h+(two.h-one.h)/a['etaPump'])
        three = equation(P=a['pHigh'], **({'x': 1} if a['steamMode'] == 'saturated' else {'T': a['Tsteam']}))
        four = ps(a.get('pReheat', a['pLow']), three.s)
        if actual:
            four = ph(a.get('pReheat', a['pLow']), three.h-a['etaHP']*(three.h-four.h))
        states = [one, two, three, four]
        if a['kind'] == 'rankine-reheat':
            five = equation(P=a['pReheat'], T=a['Treheat'])
            six = ps(a['pLow'], five.s)
            if actual:
                six = ph(a['pLow'], five.h-a['etaLP']*(five.h-six.h))
            states += [five, six]
        pump = two.h - one.h
        boiler = three.h - two.h
        hp = three.h - four.h
        lp = states[4].h - states[5].h if len(states) == 6 else 0.
        reheat = states[4].h - four.h if len(states) == 6 else 0.
        rejection = states[-1].h - one.h
        net = hp + lp - pump
        data = []
        for i, state in enumerate(states):
            satT = sat(state.P, 1).T
            quality = state.x if abs(state.T - satT) < 1e-5 else None
            data.append(dict(p=float(state.P), T=float(state.T), h=float(state.h), s=float(state.s), v=float(state.v), x=None if quality is None else float(quality)))
        records.append(dict(name=case['name'], model=model, input={k:v for k,v in case.items() if k!='name'} | dict(fluid='water', mass=1., model=model), states=data,
                            metrics=dict(pump=pump, boiler=boiler, hp=hp, lp=lp, reheater=reheat, condenser=rejection, net=net, heat=boiler+reheat, efficiency=net/(boiler+reheat))))
        print(model, case['name'], net/(boiler+reheat), flush=True)
output = dict(source='Python iapws independent package (GPL-3.0), IAPWS97 and IAPWS95', version=iapws.__version__,
              generator='scripts/generate-rankine-reference.py', units='MPa absolute, K, kJ/kg, kJ/(kg K), m3/kg, quality fraction or null outside saturation',
              inverse_method=('Actual outlets use saturation enthalpy lever rule or brentq on independent h(T,P), residual < 1e-6 kJ/kg. ' if actual else '') + 'At fixed P use saturation lever rule when sl<=s<=sv; otherwise scipy brentq on independent package s(T,P). Generic package IAPWS95 P-s inverse is not used.',
              assumptions=('Specified isentropic efficiencies for adiabatic pump/turbines' if actual else 'Ideal isentropic pump/turbines') + ', isobaric heat exchangers, saturated-liquid condenser outlet, no pressure losses or kinetic/potential energy changes.', records=records)
Path('tests/fixtures/rankine-actual-reference.json' if actual else 'tests/fixtures/rankine-library-reference.json').write_text(json.dumps(output, indent=2)+'\n')
