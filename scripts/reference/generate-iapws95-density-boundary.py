"""Independent CPython iapws 1.5.5 controls for cold-liquid density inversion.

Run with the pinned environment from requirements-water-heos.txt. No product
code is imported; temperatures and pressures are explicit regression inputs.
"""
import json
import platform
from pathlib import Path
import iapws
from iapws import IAPWS95

assert iapws.__version__ == '1.5.5'
inputs = [
    (0.029138033297768044, 273.1578814055549),
    (0.029138033297768044, 273.157882),
    (0.029138033297768044, 273.16),
    (0.029138033297768044, 273.2),
    (0.01, 273.16), (0.1, 273.16), (1, 273.15), (3, 273.15),
]
records = []
for p, T in inputs:
    q = IAPWS95(P=p, T=T)
    records.append({'p': p, 'T': T, 'expected': {
        key: float(getattr(q, key)) for key in ['rho', 'h', 's', 'cp', 'cv', 'w']}})
report = {
    'source': 'Independent Python iapws implementation of IAPWS-95; not experimental accuracy validation.',
    'python': platform.python_version(), 'iapws': iapws.__version__,
    'units': {'p': 'MPa absolute', 'T': 'K', 'rho': 'kg/m3', 'h': 'kJ/kg',
              's': 'kJ/(kg K)', 'cp': 'kJ/(kg K)', 'cv': 'kJ/(kg K)', 'w': 'm/s'},
    'records': records,
}
target = Path(__file__).resolve().parents[2] / 'tests/fixtures/iapws95-density-boundary.json'
target.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(f'{len(records)} independent cold-liquid states -> {target}')
