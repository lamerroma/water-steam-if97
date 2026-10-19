"""Dimensional controls from exact SI definitions, independent of JS tables."""
import json, sys
from pathlib import Path
from decimal import Decimal as D, getcontext
getcontext().prec=60
lb,ft,g=D('0.45359237'),D('0.3048'),D('9.80665')
factors={'Pas':D(1),'uPas':D('0.000001'),'lb_fts':lb/ft,'lb_fth':lb/ft/3600,
         'm2s':D(1),'mm2s':D('0.000001'),'ft2s':ft*ft,'ft2h':ft*ft/3600,
         'Nm':D(1),'mNm':D('.001'),'lbf_ft':lb*g/ft}
labels={'Pas':'Pa·s','uPas':'μPa·s','lb_fts':'lb/(ft·s)','lb_fth':'lb/(ft·h)',
        'm2s':'m²/s','mm2s':'mm²/s','ft2s':'ft²/s','ft2h':'ft²/h',
        'Nm':'N/m','mNm':'mN/m','lbf_ft':'lbf/ft'}
p=Path(sys.argv[1]);data=json.loads(p.read_text());numeric=missing=0;worst=D(0);controls=[]
for r in data['records']:
    assert r['label']==labels[r['unit']],r
    if r['canonical'] is None:
        assert r['value']=='',r
        missing+=1;continue
    expected=D(str(r['canonical']))/factors[r['unit']]
    controls.append({**r,'expected':float(expected)})
    actual=D(str(r['value']))
    error=abs((actual-expected)/expected) if expected else abs(actual)
    assert error<=D('2e-14'),(r,expected,error)
    worst=max(worst,error);numeric+=1
report={'status':'passed','version':data['version'],'method':'Python Decimal precision 60; exact international pound, foot and standard gravity; independent of JS conversion factors',
        'relative_tolerance':2e-14,'absolute_tolerance_for_nonzero':0,'checks':len(data['records']),'numeric':numeric,'missing':missing,'max_relative_error':float(worst),
        'scope':'Unit conversions of canonical program states, not a new independent EOS or Steam97Web comparison.'}
p.with_name('unit-controls.json').write_text(json.dumps(controls,ensure_ascii=False,indent=2)+'\n')
p.with_name('unit-reference-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
