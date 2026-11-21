"""Reference states for the NIST / CoolProp comparison (docs/REFERENCE_COMPARISON.md).

External oracle only: CoolProp is NOT a runtime dependency of the calculator.
  pip install CoolProp==8.0.0
  python scripts/reference-nist-coolprop.py [output.json]

Two CoolProp backends are sampled at the same named states:
  HEOS::Water  - IAPWS-95 (Wagner & Pruss 2002), the same equation of state that
                 NIST REFPROP 10 and the NIST Chemistry WebBook use for water;
                 viscosity IAPWS 2008 and thermal conductivity IAPWS 2011.
  IF97::Water  - IAPWS-IF97 industrial formulation (CoolProp's own implementation).
Metastable vapor uses HEOS with the gas phase imposed, i.e. the vapor root of
IAPWS-95 extrapolated below the saturation temperature.
"""
import json, sys
from pathlib import Path
import CoolProp
import CoolProp.CoolProp as CP
from CoolProp.CoolProp import PropsSI

KEYS = {'v': 'Dmass', 'h': 'Hmass', 's': 'Smass', 'u': 'Umass', 'cp': 'Cpmass',
        'cv': 'Cvmass', 'w': 'A', 'mu': 'V', 'lambda': 'L'}
KJ = {'h', 's', 'u', 'cp', 'cv'}
ATM = 0.101325

# group, id, mode, a, b  (mode pt: a = p MPa, b = T K; mode px: a = p MPa, b = x)
POINTS = []
def add(group, mode, a, b):
    POINTS.append(dict(group=group, id=f'{group}-{len([q for q in POINTS if q["group"] == group]) + 1}', mode=mode, a=a, b=b))

for p, T in [(ATM, 293.15), (3, 300), (1, 350), (10, 450), (20, 550), (50, 300)]:
    add('liquid', 'pt', p, T)
for p, T in [(100, 300), (100, 473.15), (100, 623.15)]:
    add('high-pressure', 'pt', p, T)
for p in [0.01, ATM, 1, 5, 10, 15, 20, 21.5]:
    for x in (0, 1):
        add('saturation', 'px', p, x)
for p, T in [(0.0035, 300), (0.01, 350), (ATM, 400), (1, 500), (3, 600), (10, 700), (16.5, 700)]:
    add('vapor', 'pt', p, T)
for p, T in [(23, 648), (22.5, 660), (25, 650), (25, 660), (30, 700), (40, 700)]:
    add('near-critical', 'pt', p, T)
for p, T in [(25, 800), (30, 900), (60, 900), (100, 1073.15)]:
    add('supercritical', 'pt', p, T)
for p, T in [(0.5, 1500), (10, 1800), (30, 1900)]:
    add('high-temperature', 'pt', p, T)
for p, T in [(0.1, 360), (1, 440), (5, 525), (10, 580)]:
    add('metastable', 'pt', p, T)


def scale(k, value):
    if k == 'v':
        return 1 / value
    return value / 1000 if k in KJ else value


def props(fluid, mode, a, b):
    out = {}
    pair = ('P', a * 1e6, 'T', b) if mode == 'pt' else ('P', a * 1e6, 'Q', b)
    for k, name in KEYS.items():
        if mode == 'px' and k in ('cp', 'cv', 'w', 'mu', 'lambda') and b not in (0, 1):
            continue
        try:
            out[k] = scale(k, PropsSI(name, *pair, fluid))
        except Exception as error:  # property outside the backend's range
            out[k] = None
            out.setdefault('missing', {})[k] = str(error).splitlines()[0][:160]
    if mode == 'px':
        out['T'] = PropsSI('T', *pair, fluid)
    return out


def metastable_heos(p, T):
    state = CP.AbstractState('HEOS', 'Water')
    state.specify_phase(CP.iphase_gas)
    state.update(CP.PT_INPUTS, p * 1e6, T)
    return {'v': 1 / state.rhomass(), 'h': state.hmass() / 1000, 's': state.smass() / 1000,
            'u': state.umass() / 1000, 'cp': state.cpmass() / 1000, 'cv': state.cvmass() / 1000,
            'w': state.speed_sound()}


rows = []
for point in POINTS:
    row = dict(point)
    if point['group'] == 'metastable':
        row['heos'] = metastable_heos(point['a'], point['b'])
    else:
        row['heos'] = props('HEOS::Water', point['mode'], point['a'], point['b'])
        row['if97'] = props('IF97::Water', point['mode'], point['a'], point['b'])
    rows.append(row)

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'tests/fixtures/reference-nist-coolprop.json'
out.write_text(json.dumps(dict(
    source=f'CoolProp {CoolProp.__version__}: HEOS::Water (IAPWS-95, the NIST REFPROP / WebBook equation) and IF97::Water',
    units='p MPa, T K, v m3/kg, h u kJ/kg, s cp cv kJ/(kg K), w m/s, mu Pa s, lambda W/(m K)',
    states=rows), indent=1) + '\n')
print(len(rows), 'reference states ->', out)
