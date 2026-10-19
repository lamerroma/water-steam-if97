"""Independent Decimal-70 evaluation and adaptive quadrature of the tabulated fit.
This validates arithmetic and thermodynamic identities, not Steam97Web parity or
independent transcription of the original 2003 paper. Coefficients are a frozen
factual transcription in docs/steam97-p03/coefficients.json, not JS output.
"""
import json
import math
import sys
from decimal import Decimal as D, getcontext
from functools import lru_cache
from pathlib import Path
getcontext().prec = 70
root = Path(__file__).resolve().parents[2]
data = json.loads((root/'docs/steam97-p03/coefficients.json').read_text())
R, T0, P0 = map(D, (data['R'], data['T0'], data['p0']))
species = {q['id']: q for q in data['species']}
exponents = list(map(D, data['exponents']))

@lru_cache(maxsize=32000)
def pure(id, T):
    tau = T/T0
    cp = h = s = D(0)
    for a, b in zip(map(D, species[id]['a']), exponents):
        if not a:
            continue
        power = (b*tau.ln()).exp()
        cp += a*power
        h += a*T0*((b+1)*tau.ln()).exp()/(b+1) - a*T0/(b+1)
        s += a*tau.ln() if not b else a*(power-1)/b
    return cp, h, s

def state(row):
    p, T = D(str(row['p'])), D(str(row['T']))
    values = {id: D(str(x)) for id, x in row['fractions'].items() if x}
    x = {id: v/D(species[id]['M']) if row['basis']=='mass' else v for id,v in values.items()}
    total = sum(x.values())
    x = {id:v/total for id,v in x.items()}
    M = sum(v*D(species[id]['M']) for id,v in x.items())
    cp, h, entropy = [sum(v*pure(id,T)[k] for id,v in x.items())/M for k in range(3)]
    r = R/M
    mixing = -r*sum(v*v.ln() for v in x.values())
    s = entropy+mixing-r*(p/P0).ln()
    cv = cp-r
    rho = 1000*p/(r*T)
    gamma = cp/cv
    q = dict(M=M,R=r,cp=cp,cv=cv,h=h,s=s,u=h-r*T,rho=rho,v=1/rho,w=(1000*gamma*r*T).sqrt(),isentropic=gamma,Z=D(1),mixingEntropy=mixing)
    return {k:float(v) for k,v in q.items()}

def integrate(f,a,b,tol):
    """Adaptive Simpson integration, independently integrating cp or cp/T."""
    def recur(a,b,fa,fm,fb,whole,eps,depth):
        c=(a+b)/2; l=(a+c)/2; r=(c+b)/2
        fl,fr=f(l),f(r)
        left=(c-a)*(fa+4*fl+fm)/6
        right=(b-c)*(fm+4*fr+fb)/6
        delta=left+right-whole
        if depth==0 or abs(delta)<15*eps:
            assert depth>0, 'Quadrature did not converge'
            return left+right+delta/15
        return recur(a,c,fa,fl,fm,left,eps/2,depth-1)+recur(c,b,fm,fr,fb,right,eps/2,depth-1)
    if a==b: return 0.
    if a>b: return -integrate(f,b,a,tol)
    fa,fm,fb=f(a),f((a+b)/2),f(b)
    return recur(a,b,fa,fm,fb,(b-a)*(fa+4*fm+fb)/6,tol,24)

payload = json.loads(Path(sys.argv[1]).read_text())
errors = {}; checks=0; controls=[]
for row in payload['records']:
    expected=state(row)
    for key, value in expected.items():
        actual=row['result'][key]
        err=abs(actual-value)
        limit=2e-11+3e-12*abs(value)
        assert math.isfinite(actual) and err<=limit,(row['id'],key,actual,value,limit)
        errors[key]=max(errors.get(key,0),err); checks+=1
    controls.append({**{k:row[k] for k in ('id','p','T','fractions','basis')},'expected':expected})
quadrature=[]
for id in species:
    for T in (200.,3300.):
        exact=pure(id,D(str(T)))
        for key,index in [('h',1),('s',2)]:
            value=integrate(lambda t: float(pure(id,D(str(t)))[0])/(t if key=='s' else 1),float(T0),T,1e-6 if key=='h' else 1e-9)
            error=abs(value-float(exact[index]))
            assert error <= (2e-6 if key=='h' else 2e-9),(id,T,key,error)
            quadrature.append({'component':id,'T':T,'quantity':key,'error_molar':error});checks+=1
out=Path(sys.argv[1]).parent
(out/'controls.json').write_text(json.dumps(controls,indent=2)+'\n')
report={'status':'passed','method':'Python stdlib Decimal, 70 digits; independent adaptive Simpson quadrature','cases':len(controls),'checks':checks,'max_absolute_errors':errors,'quadrature':quadrature,'limitations':['Same factual coefficient source; not an independent confirmation of original BSW2003 transcription.','Different-model external comparisons are recorded separately.','No fresh Steam97Web numerical responses obtained.']}
(out/'reference-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('status','cases','checks','max_absolute_errors')}))
