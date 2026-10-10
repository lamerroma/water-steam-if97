"""Optional independent audit: pip install iapws==1.5.5 in an isolated environment.
Not used by builds, CI, or the browser. No reference-library code is distributed.
"""
import json
from pathlib import Path
import iapws
from iapws import IAPWS97
root = Path(__file__).resolve().parent.parent
records = []
for p in [.001, .1, 3, 20, 25, 50, 100]:
    for T in [300, 500, 623.14, 623.16, 650, 700, 863.14, 863.16, 1073.14, 1073.16, 1500, 2273.15]:
        if p > 50 and T > 1073.15:
            continue
        q = IAPWS97(P=p, T=T)
        records.append(dict(mode='pt', a=p, b=T, region=q.region,
                            **{k: getattr(q, k) for k in ['h', 's', 'v', 'cp', 'cv', 'w']}))
for p in [.001, .1, 3, 20, 22.063]:
    for x in [0, .5, 1]:
        q = IAPWS97(P=p, x=x)
        liquid, vapor = IAPWS97(P=p, x=0), IAPWS97(P=p, x=1)
        records.append(dict(mode='px', a=p, b=x, region=4,
                            raw={k: getattr(q, k) for k in ['h', 's', 'v']},
                            **{k: getattr(liquid, k)+x*(getattr(vapor, k)-getattr(liquid, k)) for k in ['h', 's', 'v']}))
out = dict(source='https://github.com/jjgomera/iapws', version=iapws.__version__,
           license='GPL-3.0; reference tool only, not bundled', mixture_method='Linear mass balance from IAPWS97(P,x=0/1) fundamental endpoints; original API result preserved as raw', records=records)
(root / 'tests/fixtures/independent-iapws.json').write_text(json.dumps(out, indent=2)+'\n')
print(f'Generated {len(records)} independent reference states ({iapws.__version__}).')
