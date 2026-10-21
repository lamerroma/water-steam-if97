"""Independent single-phase process controls; pinned Python iapws 1.5.5."""
import json
import platform
from pathlib import Path
import iapws
from iapws import IAPWS95
from scipy.optimize import brentq

assert iapws.__version__ == '1.5.5'

def state(q):
    return {k: float(getattr(q, k)) for k in ['P', 'T', 'rho', 'h', 's']}

def inverse(p, key, target, bounds):
    # All selected paths stay single phase within the stated temperature bracket.
    T = brentq(lambda T: getattr(IAPWS95(P=p, T=T), key)-target, *bounds, xtol=1e-10)
    q = IAPWS95(P=p, T=T)
    assert abs(getattr(q, key)-target) < 1e-7
    return q

records = []
for kind, p, T, p2, bounds in [('pump', .1, 293.15, 10, (280, 340)), ('compressor', .1, 423.15, 1, (500, 1200))]:
    inlet = IAPWS95(P=p, T=T)
    ideal = inverse(p2, 's', inlet.s, bounds)
    work = (ideal.h-inlet.h)/.8
    outlet = inverse(p2, 'h', inlet.h+work, bounds)
    records.append({'kind': kind, 'args': [p, T, p2, .8, 2],
                    'expected': {'inlet': state(inlet), 'ideal': state(ideal), 'outlet': state(outlet),
                                 'work': float(work), 'power': float(2*work), 'flow': 2, 'eta': .8}})
hot, cold = IAPWS95(P=1, T=423.15), IAPWS95(P=.1, T=293.15)
out_hot = inverse(1, 'h', hot.h-100, (280, 440))
out_cold = inverse(.1, 'h', cold.h+200/3, (275, 365))
records.append({'kind': 'heat-exchanger', 'args': [1, 423.15, 1, 2, .1, 293.15, .1, 3, 200],
                'expected': {'inlet': state(hot), 'outlet': state(out_hot), 'coldInlet': state(cold),
                             'coldOutlet': state(out_cold), 'power': 200, 'flow': 2, 'coldFlow': 3}})
annotations = [state(IAPWS95(P=p, T=T)) for p, T in [(10, 423.15), (.1, 673.15), (30, 773.15)]]
report = {'source': 'Independent Python IAPWS95 and bracketed single-phase inversions; no product imports. Not experimental or Steam97Web validation.',
          'python': platform.python_version(), 'iapws': iapws.__version__,
          'units': {'P': 'MPa absolute', 'T': 'K', 'rho': 'kg/m3', 'h': 'kJ/kg', 's': 'kJ/(kg K)', 'work': 'kJ/kg', 'power': 'kW', 'flow': 'kg/s'},
          'records': records, 'diagramAnnotations': annotations}
target = Path(__file__).resolve().parents[2]/'tests/fixtures/engineering-reference.json'
target.write_bytes((json.dumps(report, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
print(target)
