from pathlib import Path
from decimal import Decimal as D,localcontext
import ht,json,hashlib,inspect
assert ht.__version__=='1.2.0'
cases=[('counterflow-normal',[100.,60.,30.,40.],True),('parallel-normal',[100.,60.,30.,40.],False),('counterflow-equal-approaches',[100.,60.,20.,60.],True),('parallel-zero-duty',[100.,100.,30.,30.],False),('counterflow-opposite-sign-approaches',[100.,60.,80.,40.],True),('counterflow-one-zero-approach',[100.,60.,30.,100.],True),('counterflow-nearly-equal-approaches',[100.,99.999999999,30.,30.000000002],True)]
rows=[]
for id,args,counterflow in cases:
 row={'id':id,'inputs':{'Thi':args[0],'Tho':args[1],'Tci':args[2],'Tco':args[3],'counterflow':counterflow},'temperatureScale':'consistent Celsius values; differences in K'}
 try:row['upstreamResult']=ht.LMTD(*args,counterflow=counterflow)
 except Exception as e:row['upstreamError']={'type':type(e).__name__,'message':str(e)}
 with localcontext() as ctx:
  ctx.prec=100;a,b,c,d=map(D.from_float,args);x,y=(a-d,b-c) if counterflow else (a-c,b-d);row['exactBinaryInputTerminalDifferences']=[str(x),str(y)]
  if x>0 and y>0:
   ref=x if x==y else (x-y)/(x/y).ln();row['decimalLogMeanReference']=str(ref)
   if 'upstreamResult' in row:row['absoluteErrorAgainstDecimal']=str(abs(D.from_float(row['upstreamResult'])-ref))
  else:row['domainQualification']='Not two strictly positive driving temperature differences; dedicated-form policy still needs review.'
 rows.append(row)
report={'date':'2026-10-21','stage':'R17 preparation only','source':'Pinned ht 1.2.0 / ht.core.LMTD; native CPython','sourceSHA256':hashlib.sha256(inspect.getsource(ht.LMTD).encode()).hexdigest(),'reference':'Independent Python Decimal, 100-digit log-mean formula on exact binary inputs. Equal positive differences use the continuous mathematical limit. No model or UI modifications.','qualification':'These are raw upstream observations and proposed contract inputs, not accepted engineering workflows or a new release. Zero-duty, reversed-flow and zero-approach behavior require an explicit product policy.','records':rows}
Path('.release/development-r16/r17-lmtd-preflight.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode());print(json.dumps([{k:r[k] for k in ['id','upstreamResult','upstreamError','absoluteErrorAgainstDecimal'] if k in r} for r in rows],indent=2))
