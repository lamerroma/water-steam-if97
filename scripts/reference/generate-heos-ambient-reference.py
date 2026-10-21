"""Independent IAPWS95 flow-exergy controls; pinned iapws 1.5.5, canonical units."""
import json
import platform
from pathlib import Path
import iapws
from iapws import IAPWS95

assert iapws.__version__ == '1.5.5'
state=IAPWS95(P=1, T=500)
records=[]
for p, T in [(0.101325,298.15),(0.08,310.15)]:
    ref=IAPWS95(P=p,T=T)
    records.append({'ambient':{'p':p,'T':T},'reference':{'h':float(ref.h),'s':float(ref.s)},
                    'exergy':float((state.h-ref.h)-T*(state.s-ref.s))})
report={'source':'Independent Python iapws implementation; not experimental validation.',
        'python':platform.python_version(),'iapws':iapws.__version__,
        'state':{'p':1,'T':500,'h':float(state.h),'s':float(state.s)},
        'units':{'p':'MPa absolute','T':'K','h':'kJ/kg','s':'kJ/(kg K)','exergy':'kJ/kg'},
        'records':records}
target=Path(__file__).resolve().parents[2]/'tests/fixtures/heos-ambient-reference.json'
target.write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
print(target)
