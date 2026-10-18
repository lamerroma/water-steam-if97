"""Freeze P01 pilot references without importing the product or querying Steam97.

Run with Python iapws==1.5.5 and CoolProp==8.0.0. These implement the same
formulations independently; agreement tests implementation, not model uncertainty.
"""
import hashlib
import json
import math
import warnings
from importlib.metadata import version
from pathlib import Path

from iapws import IAPWS97, IAPWS95
from iapws.iapws97 import _t_P
from iapws._iapws import _Melting_Pressure
import CoolProp.CoolProp as CP

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/steam97-p01'
assert version('iapws') == '1.5.5' and version('CoolProp') == '8.0.0'
generation_warnings = []
warnings.showwarning = lambda message, category, filename, lineno, file=None, line=None: generation_warnings.append(
    dict(message=str(message),category=category.__name__,file=Path(filename).name,line=lineno))
MODES = {
    'IF97': ['pt','ph','ps','pv','pu','th','ts','tv','tu','hs','us','vs','hv','uv','px','tx'],
    'IAPWS-95': ['pt','ph','ps','pv','pu','th','ts','tv','tu','px','tx'],
}


def state(model, **inputs):
    if model == 'IF97':
        q = IAPWS97(**inputs)
        out = {k: float(getattr(q, 'P' if k == 'p' else k)) for k in
                ['p','T','h','s','u','v','rho','cp','cv','w']
                if getattr(q, 'P' if k == 'p' else k) is not None}
        out['p'] = inputs['P']  # Preserve exact supplied pressure, not EOS roundoff.
        return out
    q = CP.AbstractState('HEOS', 'Water')
    if 'x' in inputs:
        q.update(CP.PQ_INPUTS, inputs['P'] * 1e6, inputs['x'])
    else:
        q.update(CP.PT_INPUTS, inputs['P'] * 1e6, inputs['T'])
    out = dict(p=inputs['P'],T=q.T(),h=q.hmass()/1000,s=q.smass()/1000,
               u=q.umass()/1000,v=1/q.rhomass(),rho=q.rhomass())
    if 'x' not in inputs or inputs['x'] in (0,1):
        out.update(cp=q.cpmass()/1000,cv=q.cvmass()/1000,w=q.speed_sound())
    return out


cases = []
for model in MODES:
    points = [('liquid',3,300),('vapor',1,523.15),('dense',25,650),
              ('supercritical',25,700),('near-critical',22.064,647.196)]
    if model == 'IF97':
        points += [('region-5',.5,1500),('B23-below',25,_t_P(25)-1),
                   ('B23-above',25,_t_P(25)+1),('region-5-start',1,1074)]
    for name,p,t in points:
        cases.append(dict(id=f'{model}-{name}',model=model,group=name,x=None,
                          expected=state(model,P=p,T=t),
                          modes=[m for m in MODES[model] if 'x' not in m]))
    for x in [0,.5,1]:
        cases.append(dict(id=f'{model}-quality-{x}',model=model,group='saturation',x=x,
                          expected={**state(model,P=1,x=x),'x':x},
                          modes=['px','tx','ph','ps','pv']))
    # Explicit representable pressures BELOW Pc; do not create these accidentally
    # by using the external library's re-evaluated EOS pressure as a supplied input.
    for name,p in [('below-pc-decimal',22.064-1e-8),
                   ('below-pc-one-ulp',math.nextafter(22.064,-math.inf))]:
        cases.append(dict(id=f'{model}-{name}',model=model,group=name,x=None,
                          expected=state(model,P=p,T=647.196),modes=['pt','ph','ps','pu']))

# Unit inputs are generated from international definitions, not product converters.
lb,ft,btu = .45359237,.3048,1055.05585262
psi_pa = lb*9.80665/(ft/12)**2
units = []
for c in cases:
    if c['group'] not in ['vapor','saturation'] or c['x'] not in [None,.5]:
        continue
    q = c['expected']
    for system in ['SI','English']:
        for mode in (['pt','ph'] if c['x'] is None else ['px']):
            labels = {'p':'bar','t':'C','h':'kJkg','x':'percent'} if system == 'SI' else {
                'p':'psi','t':'F','h':'Btulb','x':'percent'}
            def converted(k,v):
                if k == 'p': return v*10 if system == 'SI' else v*1e6/psi_pa
                if k == 't': return v-273.15 if system == 'SI' else (v-273.15)*1.8+32
                if k == 'h': return v if system == 'SI' else v*1000*lb/btu
                return v*100
            # Mode 't' addresses canonical T.
            vals = [q['T' if k == 't' else k] for k in mode]
            units.append(dict(id=f"{c['id']}-{system}-{mode}",case_id=c['id'],mode=mode,
                              system=system,units=[labels[k] for k in mode],
                              values=[converted(k,v) for k,v in zip(mode,vals)]))

processes = []


def wet_state(model, p, key, target):
    liquid, vapor = state(model,P=p,x=0), state(model,P=p,x=1)
    x = (target-liquid[key])/(vapor[key]-liquid[key])
    assert 0 < x < 1  # These pilot processes have wet outlets.
    return {**{k: liquid[k]+x*(vapor[k]-liquid[k]) for k in ['p','T','h','s']},'x':x}


for model in MODES:
    # Independent EOS endpoints plus analytical two-phase balances avoid
    # unnecessary library inverse-solver uncertainty in these wet-outlet cases.
    inlet = state(model,P=6,T=773.15)
    ideal = wet_state(model,.1,'s',inlet['s'])
    work = .85*(inlet['h']-ideal['h'])
    outlet = wet_state(model,.1,'h',inlet['h']-work)
    expected = dict(work=float(work),power=float(10*work),flow=10.,eta=.85,
                    outlet_h=outlet['h'],outlet_T=outlet['T'],outlet_x=outlet['x'],
                    specific_consumption=float(3600/work))
    for mode in ['power','flow','efficiency']:
        processes.append(dict(id=f'{model}-turbine-{mode}',kind='turbine',model=model,mode=mode,
                              inputs=dict(p1=6,T1=773.15,p2=.1,eta=.85,flow=10),expected=expected))
    for saturated in [0,1]:
        q = state(model,P=1,x=0) if saturated else state(model,P=1,T=423.15)
        out = wet_state(model,.1,'h',q['h'])
        processes.append(dict(id=f'{model}-flash-{saturated}',kind='flash',model=model,
                              inputs=dict(p1=1,T1=q['T'],p2=.1,flow=10,saturated=saturated),
                              expected=dict(outlet_h=out['h'],outlet_T=out['T'],
                                            outlet_x=out['x'],vaporFlow=10*out['x'],
                                            liquidFlow=10*(1-out['x']))))

probes = []
for name,p,t in [('sub-triple-liquid',200,260),('high-pressure-transport',200,400)]:
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        q = IAPWS95(P=p,T=t)
    expected = state('IAPWS-95',P=p,T=t)
    expected.update(mu=float(q.mu),lambda_=float(q.k))
    cross = {key:dict(python=float(getattr(q,key)),coolprop=expected[key],
                     relative=abs(float(getattr(q,key))/expected[key]-1)) for key in ['h','rho']}
    assert all(v['relative'] < 2e-7 for v in cross.values())
    probes.append(dict(id=name,model='IAPWS-95',p=p,T=t,expected=expected,
                       independent_cross_check=cross,
                       python_warnings=[str(w.message) for w in caught],
                       melting_pressure_at_T=float(_Melting_Pressure(t)) if t < 273.16 else None,
                       sources=['S05','S06','S07'],reference_site_result=None,
                       expected_local_gap='temperature_rejected' if t<273.16 else 'transport_unavailable'))

historical = dict(id='steam97-2026-10-10-vapor',source='S09',kind='historical_transcription',
                  original_response_retained=False,date='2026-10-10',model='IF97',
                  model_metadata='inferred from region 2 and historical context; original metadata unavailable',
                  inputs=dict(p=1,T=523.15),
                  independent=state('IF97',P=1,T=523.15),
                  printed=dict(v='0.2327389333',h='2943.2221652337',s='6.9266227397',
                               u='2710.4832319337',cp='2.2116202733',cv='1.6361901740',w='550.1074973272'),
                  tolerance='half of last printed decimal + 64 * Number.EPSILON * max(1, abs(value))')
payload = dict(schema_version=1,date='2026-10-18',baseline='1.35.4',
               evidence_kind='independent_reference_not_new_steam97_response',
               dependencies={k:version(k) for k in ['iapws','CoolProp','numpy','scipy']},
               coolprop_git_revision=CP.get_global_param_string('gitrevision'),
               coolprop_native_sha256=hashlib.sha256(Path(CP.__file__).read_bytes()).hexdigest(),
               generation_warnings=generation_warnings,
               pressure_input_rule='Retain exact requested P; never substitute an EOS re-evaluation. Adjacent-pressure cases are separately named.',
               library_source_hashes={str(p.relative_to(Path(__import__('iapws').__file__).parent)):hashlib.sha256(p.read_bytes()).hexdigest()
                                      for p in sorted(Path(__import__('iapws').__file__).parent.glob('*.py'))},
               generator_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
               historical_document_sha256=hashlib.sha256((ROOT/'docs/COMPARISON.md').read_bytes()).hexdigest(),
               limitations=['Same-EOS independent implementations, not independent experimental data.',
                            'Finite pilot; not exhaustive ranges, graphs, all 32 outputs or UI acceptance.',
                            'Mixture cp/cv/w not assigned; no averaged transport properties.',
                            'No new numeric response obtained from Steam97Web.'],
               required_modes=MODES,cases=cases,unit_cases=units,process_cases=processes,
               domain_probes=probes,historical=historical)
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'pilot-reference.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
print(json.dumps(dict(states=len(cases),queries=sum(len(c['modes']) for c in cases),
                      units=len(units),processes=len(processes),domain_probes=len(probes))))
