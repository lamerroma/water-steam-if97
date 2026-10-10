"""External oracle/data extraction. Requires Cantera 3.2.0 and PyYAML.
Usage: python scripts/reference-cantera.py /path/to/pinned/nasa_gas.yaml
Download URL and SHA256 are in THIRD_PARTY_NOTICES.md. No downloads occur here.
"""
import hashlib,json,sys,yaml,cantera as ct
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[1]); raw=source.read_bytes()
expected='4de6199d65d2d3db782e30573720c723130953707336add59713b02d8667e4db'
if hashlib.sha256(raw).hexdigest()!=expected: raise ValueError('Unexpected NASA data checksum')
blocks=yaml.load(raw,Loader=yaml.CBaseLoader)['species'] # NO must not become YAML boolean.
names=['N2','O2','CO2','CO','H2','H2O','CH4','Ar','He','NO','SO2']; data=[]; fixtures=[]; species=[]
for name in names:
 b=next(b for b in blocks if b['name'].upper()==name.upper());t=b['thermo']
 b['composition']={k:float(v) for k,v in b['composition'].items()};t['temperature-ranges']=[float(v) for v in t['temperature-ranges']];t['data']=[[float(v) for v in row] for row in t['data']]
 s=ct.Species.from_yaml(yaml.safe_dump(b));species.append(s);g=ct.Solution(thermo='ideal-gas',species=[s])
 data.append(dict(id=name,M=float(g.mean_molecular_weight),range=t['temperature-ranges'],coeff=t['data'],sourceName=s.name))
 for T in [300,1000,1800]:
  g.TP=T,200000;fixtures.append(dict(id=name,T=T,p=.2,cp=g.cp_mass/1000,cv=g.cv_mass/1000,h=g.enthalpy_mass/1000,s=g.entropy_mass/1000,rho=g.density,w=g.sound_speed))
(root/'src/gas-data.js').write_text('// NASA TM-4513 (1993), NASA7 coefficients via Cantera. BSD-3-Clause, see vendor/CANTERA-LICENSE.\nexport const GAS_DATA='+json.dumps(data,separators=(',',':'))+';\n')
mixtures=[];g=ct.Solution(thermo='ideal-gas',species=species)
for name,comp in [('air',{'N2':.78084,'O2':.20946,'Ar':.00934,'CO2':.00036}),('flue',{'N2':.73,'CO2':.1,'H2O':.12,'O2':.05})]:
 for T in [300,1000,1800]:
  g.TPX=T,200000,{next(d['sourceName'] for d in data if d['id']==k):v for k,v in comp.items()}
  mixtures.append(dict(name=name,composition=comp,T=T,p=.2,cp=g.cp_mass/1000,cv=g.cv_mass/1000,h=g.enthalpy_mass/1000,s=g.entropy_mass/1000,rho=g.density,w=g.sound_speed))
(root/'tests/fixtures/cantera-gases.json').write_text(json.dumps(dict(source='Cantera '+ct.__version__+' / NASA TM-4513',dataSHA256=expected,states=fixtures,mixtures=mixtures),indent=2)+'\n')
