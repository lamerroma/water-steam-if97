"""Independent process controls, Python iapws 1.5.5; no product imports."""
import json
import platform
from pathlib import Path
import iapws
from iapws import IAPWS95

assert iapws.__version__ == '1.5.5'

def state(q):
    return {k: float(getattr(q, k)) for k in ['P', 'T', 'h', 's']}

liquid, vapor = IAPWS95(P=.1, x=0), IAPWS95(P=.1, x=1)
def wet_state(h=None, s=None):
    # All selected outlets are wet. Use the equilibrium lever rule rather
    # than a general inverse solver with a poorly converged two-phase root.
    x = (h-liquid.h)/(vapor.h-liquid.h) if h is not None else (s-liquid.s)/(vapor.s-liquid.s)
    assert 0 < x < 1
    return {'P': .1, 'T': float(liquid.T), 'h': float(liquid.h+x*(vapor.h-liquid.h)),
            's': float(liquid.s+x*(vapor.s-liquid.s))}, float(x)

records = []
for kind, modes in [('turbine', ['power', 'flow', 'efficiency']),
                    ('flash', ['condensate', 'saturated', 'subcooled'])]:
    for mode in modes:
        p1, p2, T1, flow, eta, power = 3, .1, 673.15 if kind == 'turbine' else 473.15, 1, .85, 600
        inlet = IAPWS95(P=p1, x=0) if mode == 'saturated' else IAPWS95(P=p1, T=T1)
        expected = {'inlet': state(inlet)}
        if kind == 'turbine':
            ideal, _ = wet_state(s=inlet.s)
            drop = inlet.h - ideal['h']
            if mode == 'flow':
                flow = power / (eta * drop)
            if mode == 'efficiency':
                eta = power / (flow * drop)
            work = eta * drop
            outlet, _ = wet_state(h=inlet.h - work)
            expected.update(ideal=ideal, work=float(work), power=float(flow*work), flow=float(flow), eta=float(eta))
        else:
            outlet, quality = wet_state(h=inlet.h)
            expected.update(flow=flow, vaporFlow=float(flow*quality), liquidFlow=float(flow*(1-quality)))
        expected['outlet'] = outlet
        records.append({'input': {'kind': kind, 'mode': mode, 'p1': p1, 'p2': p2,
                       'T1': None if mode == 'saturated' else T1, 'flow': 1, 'eta': .85, 'power': 600}, 'expected': expected})

report = {'source': 'Independent Python iapws implementation, not experimental or Steam97Web validation.',
          'python': platform.python_version(), 'iapws': iapws.__version__,
          'units': {'P': 'MPa absolute', 'T': 'K', 'h': 'kJ/kg', 's': 'kJ/(kg K)', 'flow': 'kg/s', 'power': 'kW', 'work': 'kJ/kg', 'eta': '1'},
          'records': records}
target = Path(__file__).resolve().parents[2]/'tests/fixtures/steam-process-reference.json'
target.write_bytes((json.dumps(report, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
print(target)
