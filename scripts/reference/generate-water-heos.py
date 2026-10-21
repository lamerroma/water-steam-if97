"""Independent IAPWS95 data only. Requires iapws==1.5.5 and scipy; no runtime dependency."""
import json
import platform
import scipy
import numpy
from pathlib import Path
from scipy.optimize import brentq, minimize_scalar
from iapws import IAPWS95, __version__

root = Path(__file__).resolve().parents[2]
read = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
keys = ["P", "T", "rho", "v", "h", "s", "u", "cp", "cv", "w"]

def pack(q, quality=None):
    data = {"p" if k == "P" else k: getattr(q, k) for k in keys}
    data["x"] = quality
    return data

records = []
for i, q in enumerate(read("tests/fixtures/independent-iapws95.json")["states"]):
    records.append({"id": f"single-{i:02}", "kind": "single", "expected": pack(IAPWS95(P=q["p"], T=q["T"]))})
for i, q in enumerate(read("tests/fixtures/water-heos-regressions.json")["states"]):
    records.append({"id": f"audit-{i}", "kind": "single", "expected": pack(IAPWS95(P=q["p"], T=q["T"]))})
for p in [.001, .1, 10, 20]:
    q = IAPWS95(P=p, x=.5)
    # Heat capacities and sound are not mixture properties in this contract.
    data = {"p": p, "T": q.T, "h": q.h, "s": q.s, "u": q.u, "v": q.v, "rho": q.rho, "x": .5}
    records.append({"id": f"mixture-{p}", "kind": "mixture", "expected": data})
for p, T, name in [(.1, 273.16, "lower-T"), (200, 1273, "upper-T"), (1000, 1000, "upper-P")]:
    records.append({"id": name, "kind": "single", "expected": pack(IAPWS95(P=p, T=T))})
ps_near = IAPWS95(T=640, x=0).P
for side, multiplier in [("vapor", 1-5e-7), ("liquid", 1+5e-7)]:
    records.append({"id": f"coexistence-band-{side}", "kind": "single",
                    "expected": pack(IAPWS95(P=ps_near*multiplier, T=640))})

q = IAPWS95(P=.1, T=275)
hot = brentq(lambda T: IAPWS95(P=.1, T=T).rho-q.rho, 277.5, 285, xtol=1e-10)
records.append({"id": "density-two-roots", "kind": "multiple", "modes": ["pv", "prho"],
                "expected": pack(q), "roots": [pack(q), pack(IAPWS95(P=.1, T=hot))]})

T = 575.8
ps = IAPWS95(T=T, x=0).P
turn = minimize_scalar(lambda p: IAPWS95(P=p, T=T).h, bounds=(ps*1.0001, 1000), method="bounded").x
q = IAPWS95(P=turn*.9, T=T)
second = brentq(lambda p: IAPWS95(P=p, T=T).h-q.h, turn, 1000, xtol=1e-9)
records.append({"id": "enthalpy-two-roots", "kind": "multiple", "modes": ["th"],
                "expected": pack(q), "roots": [pack(q), pack(IAPWS95(P=second, T=T))]})

out = {"source": f"Independent Python iapws {__version__} / IAPWS95; external reference data only",
       "environment": {"python": platform.python_version(), "iapws": __version__, "scipy": scipy.__version__, "numpy": numpy.__version__},
       "generator": "scripts/reference/generate-water-heos.py", "units": "MPa absolute, K, kg/m3, m3/kg, kJ/kg, kJ/(kg K), m/s, mass quality fraction",
       "rootMethod": "Independent SciPy brentq; pressure enthalpy turning point located with minimize_scalar",
       "records": records}
target = root / "tests/fixtures/water-heos-matrix.json"
target.write_text(json.dumps(out, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
print(f"Wrote {len(records)} records to {target.name}")
