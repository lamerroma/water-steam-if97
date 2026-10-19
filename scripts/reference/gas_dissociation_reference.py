"""Independent Decimal evaluation of the P04 caloric approximation.

python3 scripts/reference/gas_dissociation_reference.py .release/steam97-p04/values.json
Optional, separate physical model comparison (requires Cantera 3.2.0):
python3 scripts/reference/gas_dissociation_reference.py --cantera OUTPUT.json
No application source is imported. Numerical agreement is not site parity.
"""
from decimal import Decimal as D, getcontext
from pathlib import Path
import hashlib
import itertools
import json
import math
import sys

getcontext().prec = 60
ROOT = Path(__file__).resolve().parents[2]
LEDGER = json.loads((ROOT/'docs/steam97-p04/modelica-source-audit.json').read_text())
ARRAYS = [[D(str(v)) for v in LEDGER['constants'][key]] for key in ('AA', 'BB', 'CC', 'DD', 'EE')]
MASS = {row['id']: D(row['M']) for row in json.loads((ROOT/'docs/steam97-p03/coefficients.json').read_text())['species']}
NAMES = ('CO', 'H2', 'OH', 'H', 'O', 'NO')


def reference(p, temperature, fractions, basis='mole'):
    p, t = D(str(p)), D(str(temperature))
    x = {key: D(str(v))/(MASS[key] if basis == 'mass' else 1) for key, v in fractions.items() if v}
    total = sum(x.values())
    x = {key: value/total for key, value in x.items()}
    a, b, c, d, e = ARRAYS
    k = [a_i*(b_i/t).exp() for a_i, b_i in zip(a, b)]
    oxygen = x['O2']
    water = x.get('H2O', D(0))
    pressure = (D('0.101325')/p).sqrt()
    # Independently use pressure activities for the two parent dissociations;
    # OH, H, O and NO have their individual mass-action powers.
    u = [k[0]*x.get('CO2', D(0))/oxygen.sqrt()*pressure,
         k[1]*water/oxygen.sqrt()*pressure,
         k[2]*water.sqrt()*oxygen.sqrt().sqrt()*pressure.sqrt(),
         D(0), k[4]*oxygen.sqrt()*pressure, k[5]*(x['N2']*oxygen).sqrt()]
    u[3] = k[3]*u[1].sqrt()*pressure
    normalizer = 1+sum(u)
    v = [ci+di/t+ei/(t*t) for ci, di, ei in zip(c, d, e)]
    cp = sum(ui*vi for ui, vi in zip(u, v))/normalizer
    h = -t*t*sum(ui*vi/bi for ui, vi, bi in zip(u, v, b))/normalizer
    mass = sum(value*MASS[key] for key, value in x.items())
    return {'cp': float(cp/mass), 'h': float(h/mass), 's': float(h/t/mass),
            'normalizer': float(normalizer), 'reactionIndices': dict(zip(NAMES, map(float, u)))}


def verify(path):
    data = json.loads(path.read_text())
    checks = 0
    maxima = {}
    controls = []
    for row in data['records']:
        expected = reference(row['p'], row['T'], row['fractions'], row['basis'])
        actual = row['result']['dissociation']
        for key in ('cp', 'h', 's'):
            error = abs(actual['corrections'][key]-expected[key])
            assert error <= 2e-12+5e-12*abs(expected[key]), (row['id'], key, error)
            maxima[key] = max(maxima.get(key, 0), error)
            checks += 1
        for key in NAMES:
            assert math.isclose(actual['reactionIndices'][key], expected['reactionIndices'][key], rel_tol=5e-12, abs_tol=1e-18)
            checks += 1
        assert math.isclose(actual['normalizer'], expected['normalizer'], rel_tol=5e-12)
        controls.append({key: row[key] for key in ('id', 'p', 'T', 'fractions', 'basis')} | {'expected': expected})
    (path.parent/'controls.json').write_text(json.dumps(controls, indent=2)+'\n')
    report = {'status': 'passed', 'cases': len(controls), 'checks': checks, 'precision_digits': 60,
              'method': 'Independent Decimal equations using the frozen external coefficient ledger',
              'max_absolute_errors': maxima, 'physical_accuracy_proven': False, 'Steam97Web_parity': False}
    (path.parent/'reference-report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))


def cantera_comparison(path):
    import cantera as ct
    assert ct.__version__ == '3.2.0'
    gas = ct.Solution('gri30.yaml')
    mechanism = Path(ct.get_data_directories()[-1])/'gri30.yaml'
    rows = []
    for excess, t, p in itertools.product((1.06, 1.2, 2.), (1200., 1400., 1600., 1800., 2000.), (.01, .101325, 1., 5.)):
        amounts = {'CO2': 1, 'H2O': 2, 'O2': 2*(excess-1), 'N2': 2*excess*3.76}
        fractions = {key: value/sum(amounts.values()) for key, value in amounts.items()}
        predicted = reference(p, t, fractions)
        gas.TPX = t, p*1e6, fractions
        h0, s0, cp0 = gas.enthalpy_mass, gas.entropy_mass, gas.cp_mass
        gas.equilibrate('TP')
        h, s = gas.enthalpy_mass-h0, gas.entropy_mass-s0
        derivatives = []
        for step in (.05, .025):
            enthalpies = []
            for temperature in (t-step, t+step):
                gas.TPX = temperature, p*1e6, fractions
                gas.equilibrate('TP')
                enthalpies.append(gas.enthalpy_mass)
            derivatives.append((enthalpies[1]-enthalpies[0])/(2*step)-cp0)
        assert abs(derivatives[0]-derivatives[1]) < 2e-5, (t, p, derivatives)
        # cp_mass at one equilibrated state holds its composition fixed. Re-
        # equilibrating both temperatures is needed for the equilibrium slope.
        values = {'h': h/1000, 's': s/1000, 'cp': derivatives[1]/1000}
        relative = {key: predicted[key]/values[key]-1 for key in values}
        rows.append({'lambda': excess, 'T': t, 'p': p, 'fractions': fractions,
                     'cantera_correction': values, 'local_correction': {key: predicted[key] for key in values},
                     'relative_difference': relative})
    reaction = []
    for t in (1200., 1600., 2000.):
        gas.TP = t, 101325
        h = gas.standard_enthalpies_RT*ct.gas_constant*t/1000
        g = gas.standard_gibbs_RT
        co = {'CO': 1, 'O2': .5, 'CO2': -1}
        water = {'H2': 1, 'O2': .5, 'H2O': -1}
        for label, index, stoich in (('CO2', 0, co), ('H2O', 1, water)):
            enthalpy = sum(value*h[gas.species_index(key)] for key, value in stoich.items())
            a, b, c, d, e = (float(values[index]) for values in ARRAYS)
            exact = -b/t**2*enthalpy
            fitted = c+d/t+e/t**2
            wrong_sign = c-d/t+e/t**2
            dg = sum(value*g[gas.species_index(key)] for key, value in stoich.items())
            equilibrium_constant = math.exp(-dg)
            reaction.append({'reaction_parent': label, 'T': t, 'NASA_reaction_h_J_mol': enthalpy,
                             'NASA_energy_index_J_molK': exact, 'Modelica_energy_index': fitted,
                             'opposite_D_sign_energy_index': wrong_sign,
                             'NASA_Kp_at_101325Pa': equilibrium_constant, 'empirical_Kp': a*math.exp(b/t)})
    report = {'status': 'diagnostic_not_physical_accuracy_acceptance', 'cantera_version': ct.__version__,
              'mechanism': 'gri30.yaml', 'mechanism_sha256': hashlib.sha256(mechanism.read_bytes()).hexdigest(),
              'method': 'Independent TP Gibbs equilibrium; differences from the same frozen composition, including formation energies; equilibrium cp by re-equilibrated central differences.',
              'cases': len(rows), 'records': rows, 'reaction_energy_and_mass_action_checks': reaction,
              'max_absolute_relative_difference': {key: max(abs(row['relative_difference'][key]) for row in rows) for key in ('cp', 'h', 's')},
              'limitations': ['Different thermodynamic models, not a Steam97Web oracle.',
                             'These are errors relative to the correction, not to total h/s/cp.',
                             'Only methane/ordinary-air compositions in this comparison; no sulfur or neon validation.',
                             'No coefficients fitted to Cantera results.']}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({key: report[key] for key in ('status', 'cases', 'max_absolute_relative_difference')}))


if __name__ == '__main__':
    if sys.argv[1] == '--cantera':
        cantera_comparison(Path(sys.argv[2]))
    else:
        verify(Path(sys.argv[1]))
