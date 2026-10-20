"""Independent Decimal equation controls. Does not import fluids or application code."""
from decimal import Decimal as D, localcontext
from functools import lru_cache
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parent.parent
PI = D('3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628')

@lru_cache(None)
def factor(re, ed):
    lo, hi = D('0.00000001'), D(1000)
    for _ in range(240):
        y = (lo+hi)/2
        residual = y+2*(ed/D('3.7')+D('2.51')*y/re).log10()
        if residual > 0:
            hi = y
        else:
            lo = y
    return 1/((lo+hi)/2)**2

def reference(p):
    p = {k: D(str(v)) for k, v in p.items() if k != 'frictionMethod'}
    rho, mu, v, diameter = (p[k] for k in ('rho', 'mu', 'velocity', 'diameter'))
    area, nu = PI*diameter**2/4, mu/rho
    volume = area*v
    re = v*diameter/nu
    f = None if re == 0 or D(2300) <= re < D(4000) else D(64)/re if re < 2300 else factor(re, p['roughness']/diameter)
    dynamic = rho*v*v/2
    local = p['localK']*dynamic
    friction = D(0) if v == 0 or p['length'] == 0 else None if f is None else f*p['length']/diameter*dynamic
    loss = None if friction is None else friction+local
    head = None if loss is None else loss/(rho*D('9.80665'))
    required = None if head is None else head+p['heightDifference']+p['pressureDifference']/(rho*D('9.80665'))
    pump = None if required is None else max(D(0), required)
    hydraulic = None if pump is None else rho*D('9.80665')*volume*pump
    result = dict(area=area, mu=mu, nu=nu, mass=rho*volume, volume=volume, velocity=v,
                  Re=re, dynamicPressure=dynamic, factor=f, fanningFactor=None if f is None else f/4,
                  frictionPressure=friction, localPressure=local, lossPressure=loss, lossHead=head,
                  requiredHead=required, pumpHead=pump, hydraulicPower=hydraulic,
                  shaftPower=None if hydraulic is None else hydraulic/p['efficiency'])
    return {k: None if v is None else float(v) for k, v in result.items()}

def generate():
    base = dict(rho=1000, mu=.001, velocity=2, diameter=.05, length=100,
                roughness=.00005, localK=3, efficiency=.8, heightDifference=0, pressureDifference=0)
    cases = []
    def add(label, **changes):
        for method in ('Clamond', 'Colebrook'):
            p = {**base, **changes, 'frictionMethod': method}
            cases.append({'id': label+'/'+method, 'input': p, 'expected': reference(p)})
    add('turbulent-example')
    add('laminar-example', velocity=.1, diameter=.01, length=10, roughness=0, localK=0)
    for re in (1, 100, 1000, 2039, 2040, 2200, 2299, 2300, 3000, 3999, 4000):
        add('boundary-'+str(re), rho=1, mu=1, diameter=1, velocity=re, roughness=0, length=10)
    for re in (2300, 3000, 3999):
        add('local-only-'+str(re), rho=1, mu=1, diameter=1, velocity=re, roughness=0, length=0)
    for re in (1e4, 1e5, 1e6, 1e8, 1e10):
        for ed in (0, 1e-6, 1e-4, .001, .01, .05):
            add('grid-'+str(re)+'-'+str(ed), velocity=re*.001/1000/.05, roughness=float(D(str(ed))*D('.05')))
    add('zero-flow', velocity=0, heightDifference=5)
    add('gravity', length=0, roughness=0, localK=0, heightDifference=-5)
    add('elevation-and-pressure', heightDifference=5, pressureDifference=20000)
    add('doc-one-phase', rho=1000, mu=1e-5, diameter=.1, velocity=10/(1000*float(PI)*.1*.1/4), length=1, roughness=0, localK=0)
    invalid = [dict(base, **change) for change in [
        {'rho': 0}, {'rho': -1}, {'rho': True}, {'mu': 0}, {'diameter': 0},
        {'velocity': -1}, {'length': -1}, {'roughness': -.1}, {'roughness': .003},
        {'localK': -1}, {'efficiency': 0}, {'efficiency': 1.01},
        {'frictionMethod': 'unknown'}, {'velocity': '2'}, {'unknown': 1}, {'velocity': 1e308}]]
    return {'format': 'fluids-pipe-reference', 'version': 1,
            'reference': {'implementation': 'Python stdlib Decimal, precision 80, independent Colebrook y-bisection (240 iterations), Hagen-Poiseuille and energy balance; no fluids or app imports',
                          'scope': 'Equation controls, not experimental validation. Laminar <2300; transition [2300,4000); turbulent >=4000.',
                          'absoluteTolerance': 1e-10, 'relativeTolerance': 5e-11,
                          'sources': ['https://fluids.readthedocs.io/fluids.friction.html', 'https://fluids.readthedocs.io/fluids.core.html']},
            'cases': cases, 'invalid': invalid}

with localcontext() as context:
    context.prec = 80
    output = (json.dumps(generate(), ensure_ascii=False, indent=2, allow_nan=False)+'\n').encode('utf-8')
target = ROOT/'tests/fixtures/fluids-pipe-reference.json'
if '--check' in sys.argv:
    assert target.read_bytes() == output, 'Reference fixture differs; regenerate and inspect.'
else:
    target.write_bytes(output)
print('Independent pipe controls: '+str(len(json.loads(output)['cases']))+' cases, 16 invalid inputs.')
