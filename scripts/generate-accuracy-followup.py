"""Independent 70/90-digit water reference; no product JavaScript imported.
Python iapws 1.5.5 coefficient tables, mpmath 1.3, CoolProp 8 seeds only.
"""
import json,os
from pathlib import Path
import mpmath as mp
import CoolProp.CoolProp as CP
from iapws import IAPWS95,_iapws97Constants as C
from iapws.iapws97 import _PSat_T,_Backward3_sat_v_P,_Region1,_Region2
root=Path(__file__).resolve().parents[1];out=root/os.environ.get('ACCURACY_DIR','.release/accuracy-followup');out.mkdir(parents=True,exist_ok=True)

def eos95(precision):
 mp.mp.dps=precision;c={k:[mp.mpf(str(v)) for v in a] for k,a in IAPWS95._constants.items() if isinstance(a,list)}
 def residual(d,t):
  vals=[];der=[]
  for n,k,e in zip(c['nr1'],c['d1'],c['t1']):
   f=n*d**k*t**e;vals.append(f);der.append(f*k/d)
  for n,k,e,g,b in zip(c['nr2'],c['d2'],c['t2'],c['gamma2'],c['c2']):
   f=n*d**k*t**e*mp.exp(-g*d**b);vals.append(f);der.append(f*(k/d-g*b*d**(b-1)))
  for n,k,e,a,b,g,eps in zip(c['nr3'],c['d3'],c['t3'],c['alfa3'],c['beta3'],c['gamma3'],c['epsilon3']):
   f=n*d**k*t**e*mp.exp(-a*(d-eps)**2-b*(t-g)**2);vals.append(f);der.append(f*(k/d-2*a*(d-eps)))
  x=d-1;sq=x*x
  for n,a,b,A,B,C,D,beta in zip(c['nr4'],c['a4'],c['b4'],c['A'],c['B'],c['C'],c['D'],c['beta4']):
   theta=1-t+A*sq**(1/(2*beta));theta_d=A/beta*x*sq**(1/(2*beta)-1);Delta=theta**2+B*sq**a;Delta_d=2*theta*theta_d+2*a*B*x*sq**(a-1)
   f=n*d*Delta**b*mp.exp(-C*sq-D*(t-1)**2);vals.append(f);der.append(f*(1/d+b*Delta_d/Delta-2*C*x))
  return mp.fsum(vals),mp.fsum(der)
 def jk(d,t):
  phi,pd=residual(d,t);return d*(1+d*pd),mp.log(d)+phi+d*pd
 return residual,jk

def solve95(mode,a,b,precision):
 residual,jk=eos95(precision);Tc=mp.mpf('647.096');Rc=mp.mpf(322);R=mp.mpf('.46151805')
 def equilibrium(l,v,tau):
  jl,kl=jk(l,tau);jv,kv=jk(v,tau);gap=l-v;return (jl-jv)/gap,(kl-kv-(jl-jv)/((l+v)/2))/gap**3
 if mode=='pt':
  p=mp.mpf(str(a));T=mp.mpf(str(b));tau=Tc/T;phase='|liquid' if p>=mp.mpf('22.064') and T<Tc else ''
  seed=mp.mpf(str(CP.PropsSI('Dmass','P',float(p)*1e6,'T'+phase,float(T),'Water')))/Rc
  fn=lambda d:jk(d,tau)[0]*Rc*R*T/1000-p
  if p==mp.mpf('22.064'):
   bracket=(mp.mpf(1),mp.mpf('1.2')) if T<Tc else (mp.mpf('.8'),mp.mpf(1))
   d=mp.findroot(fn,bracket,solver='bisect',tol=mp.mpf(10)**(-precision+18),maxsteps=400)
  else:d=mp.findroot(fn,(seed*mp.mpf('.999999'),seed*mp.mpf('1.000001')),tol=mp.mpf(10)**(-precision+18),maxsteps=100)
  endpoints=[d]
 else:
  Tseed=float(a) if mode=='satt' else 647.096-(22.064-float(a))/.2673 if float(a)>22.0637 else CP.PropsSI('T','P',float(a)*1e6,'Q',0,'Water')
  l0,v0=[mp.mpf(str(CP.PropsSI('Dmass','T',Tseed,'Q',x,'Water')))/Rc for x in [0,1]]
  if mode=='satt':
   T=mp.mpf(str(a));tau=Tc/T
   l,v=mp.findroot(lambda l,v:equilibrium(l,v,tau),(l0,v0),tol=mp.mpf(10)**(-precision+18),maxsteps=100)
  else:
   p=mp.mpf(str(a))
   def equations(l,v,tau):
    e1,e2=equilibrium(l,v,tau);return e1,e2,jk(l,tau)[0]*Rc*R*Tc/tau/1000-p
   l,v,tau=mp.findroot(equations,(l0,v0,Tc/mp.mpf(str(Tseed))),tol=mp.mpf(10)**(-precision+18),maxsteps=100);T=Tc/tau
  assert l>1>v,(a,l,v)
  endpoints=[l,v]
 f0=IAPWS95.Fi0;ao=[mp.mpf(str(v)) for v in f0['ao_pow']];lg=mp.mpf(str(f0['ao_log'][1]));terms=[(mp.mpf(str(n)),mp.mpf(str(g))) for n,g in zip(f0['ao_exp'],f0['titao'])]
 props=[]
 for d in endpoints:
  phi,pd=residual(d,tau);pdd=mp.diff(lambda x:residual(x,tau)[1],d);pt=mp.diff(lambda t:residual(d,t)[0],tau);ptt=mp.diff(lambda t:residual(d,t)[0],tau,2);pdt=mp.diff(lambda t:residual(d,t)[1],tau)
  ideal=mp.log(d)+ao[0]+ao[1]*tau+lg*mp.log(tau)+mp.fsum(n*mp.log(-mp.expm1(-g*tau)) for n,g in terms);it=ao[1]+lg/tau+mp.fsum(n*g/mp.expm1(g*tau) for n,g in terms);itt=-lg/tau**2-mp.fsum(n*g*g*mp.exp(g*tau)/mp.expm1(g*tau)**2 for n,g in terms)
  A=1+d*pd-d*tau*pdt;B=1+2*d*pd+d*d*pdd;assert B>0;cv=-R*tau*tau*(itt+ptt);rho=d*Rc
  props.append(dict(T=T,p=rho*R*T*(1+d*pd)/1000,rho=rho,v=1/rho,h=R*T*(1+tau*(it+pt)+d*pd),s=R*(tau*(it+pt)-ideal-phi),u=R*T*tau*(it+pt),cp=cv+R*A*A/B,cv=cv,w=mp.sqrt(1000*R*T*(B+R*A*A/cv)),alpha=A/(T*B),drhodp=1000/(R*T*B)))
 return [{k:mp.nstr(v,45) for k,v in q.items()} for q in props]

def solve97(mode,a,b,precision):
 mp.mp.dps=precision;tc=mp.mpf('647.096');R=mp.mpf('.461526');rc=mp.mpf(322)
 n=[mp.mpf(v) for v in ['1167.0521452767','-724213.16703206','-17.073846940092','12020.82470247','-3232555.0322333','14.91510861353','-4823.2657361591','405113.40542057','-.23855557567849','650.17534844798']]
 if mode=='satt':
  T=mp.mpf(str(a));theta=T+n[8]/(T-n[9]);A=theta**2+n[0]*theta+n[1];B=n[2]*theta**2+n[3]*theta+n[4];cc=n[5]*theta**2+n[6]*theta+n[7];p=(2*cc/(-B+mp.sqrt(B*B-4*A*cc)))**4
 elif mode=='satp':
  p=mp.mpf(str(a));be=p**mp.mpf('.25');e=be*be+n[2]*be+n[5];f=n[0]*be*be+n[3]*be+n[6];g=n[1]*be*be+n[4]*be+n[7];D=2*g/(-f-mp.sqrt(f*f-4*e*g));T=(n[9]+D-mp.sqrt((n[9]+D)**2-4*(n[8]+n[9]*D)))/2
 else:p,T=mp.mpf(str(a)),mp.mpf(str(b))
 if T<=mp.mpf('623.15'):
  result=[]
  for fn in [_Region1,_Region2]:
   z=fn(float(T),float(p));v=z['v'];result.append(dict(p=p,T=T,rho=1/v,v=v,h=z['h'],s=z['s'],u=z['h']-float(p)*1000*v,cp=z['cp'],cv=z['cv'],w=z['w'],alpha=z['alfav'],drhodp=z['kt']/v))
  return [{k:mp.nstr(v,45) for k,v in q.items()} for q in result]
 tau=tc/T;terms=[(mp.mpf(str(v)),int(i),int(j)) for v,i,j in zip(C.Region3_n,C.Region3_Li,C.Region3_Lj)]
 def phi(d):return mp.mpf('1.0658070028513')*mp.log(d)+mp.fsum(v*d**i*tau**j for v,i,j in terms)
 def pd(d):return mp.mpf('1.0658070028513')/d+mp.fsum(v*i*d**(i-1)*tau**j for v,i,j in terms if i)
 def pressure(d):return rc*d*R*T*d*pd(d)/1000
 result=[]
 if mode!='pt' and T>tc-mp.mpf('.001'):
  spin=mp.findroot(lambda d:mp.diff(pressure,d),(1-mp.sqrt(tc-T)*mp.mpf('.2'),1-mp.sqrt(tc-T)*mp.mpf('.4')))
  maximum=pressure(spin)
  if p>maximum:raise ValueError('IF97 region-4 pressure above region-3 vapor spinodal by '+mp.nstr((p-maximum)*1000000,15)+' Pa')
 for x in ([0] if mode=='pt' else [0,1]):
  seed=mp.mpf(str(1/_Backward3_sat_v_P(float(p),float(T),x)))/rc
  if mode=='pt':seed=mp.mpf('1.003') if T<tc else mp.mpf('.997')
  if mode=='pt':d=mp.findroot(lambda d:pressure(d)-p,(mp.mpf(1),mp.mpf('1.6')) if T<tc else (mp.mpf('.6'),mp.mpf(1)),solver='bisect',tol=mp.mpf(10)**(-precision+18),maxsteps=400)
  else:d=mp.findroot(lambda d:pressure(d)-p,(seed*mp.mpf('.999999'),seed*mp.mpf('1.000001')),tol=mp.mpf(10)**(-precision+18),maxsteps=100)
  pdd=mp.diff(pd,d);dy=mp.fsum(v*j*d**i*tau**(j-1) for v,i,j in terms if j);dyy=mp.fsum(v*j*(j-1)*d**i*tau**(j-2) for v,i,j in terms if j>1);dxy=mp.fsum(v*i*j*d**(i-1)*tau**(j-1) for v,i,j in terms if i and j);A=d*pd(d)-d*tau*dxy;B=2*d*pd(d)+d*d*pdd
  if not B>0 or mode!='pt' and ((x==0 and d<=1) or (x==1 and d>=1)):raise ValueError('IF97 region-3/4 phase consistency limit')
  rho=d*rc;cv=-R*tau*tau*dyy;result.append(dict(T=T,p=p,rho=rho,v=1/rho,h=R*T*(tau*dy+d*pd(d)),s=R*(tau*dy-phi(d)),u=R*T*tau*dy,cp=cv+R*A*A/B,cv=cv,w=mp.sqrt(1000*R*T*(B+R*A*A/cv)),alpha=A/(T*B),drhodp=1000/(R*T*B)))
 return [{k:mp.nstr(v,45) for k,v in q.items()} for q in result]

requests=[]
for model in ['IF97','IAPWS-95']:
 for p in [.1,1,10,20,22,22.0638,22.0639,22.06399,22.063999,22.0639999,22.06399999,22.0639999999]:requests.append((model,'satp',p,None))
 for T in [647.086,647.095,647.0959,647.0959993,647.0959998,647.0959999,647.095999999]:requests.append((model,'satt',T,None))
 for T in [647.0959,647.0960001,647.095999999,647.096000001]:requests.append((model,'pt',22.064,T))
records=[];limits=[]
for model,mode,a,b in requests:
 try:
  low=(solve95 if model=='IAPWS-95' else solve97)(mode,a,b,70);high=(solve95 if model=='IAPWS-95' else solve97)(mode,a,b,90)
  for l,h in zip(low,high):
   for key in h:
    tolerance=mp.mpf('1e-25') if model=='IAPWS-95' or float(h['T'])>623.15 else mp.mpf('1e-14')
    assert abs(mp.mpf(l[key])/mp.mpf(h[key])-1)<tolerance,(model,mode,a,key,l[key],h[key])
  for i,q in enumerate(high):records.append(dict(id=f'{model}-{mode}-{a}-{i}',model=model,mode=mode,a=a,b=b,phase=i if mode!='pt' else None,expected={k:float(v) for k,v in q.items()}))
  print(model,mode,a,'verified',flush=True)
 except Exception as e:
  if model!='IF97' or 'spinodal' not in str(e):raise
  limits.append(dict(model=model,mode=mode,a=a,b=b,error=str(e)));print(model,mode,a,'LIMIT',str(e)[:100],flush=True)
# Independent transport correlations use the MP EOS derivative, not a
# cancellation-prone critical derivative from a double-precision flash.
from iapws._iapws import _Viscosity,_ThCond
from types import SimpleNamespace
for row in records:
 q=row['expected'];rho,T=q['rho'],q['T'];phase=SimpleNamespace(cp=q['cp'],cp_cv=q['cp']/q['cv'],drhodP_T=q['drhodp'])
 if row['model']=='IAPWS-95':
  reference=CP.AbstractState('HEOS','Water');reference.update(CP.DmassT_INPUTS,rho,1.5*647.096);drho=1e6*reference.first_partial_deriv(CP.iDmass,CP.iP,CP.iT)
  mu=_Viscosity(rho,T,phase,drho)
 else:drho=None;mu=_Viscosity(rho,T)
 phase.mu=mu;conductivity=_ThCond(rho,T,phase,drho)
 q.update(mu=mu,nu=mu/rho,lambda_=conductivity,Pr=mu*q['cp']*1000/conductivity)
 q['lambda']=q.pop('lambda_')

report=dict(source='Independent IF97 region-3/4 and IAPWS-95 equations at 70/90 decimal digits; ordinary IF97 regions 1/2 from Python iapws double-precision fundamental equations. CoolProp supplies initial seeds and the regular 1.5 Tc transport reference derivative. Fixed-P coexistence solved jointly for both densities and temperature.',precisionDigits=[70,90],records=records,limits=limits)
(out/'reference.json').write_text(json.dumps(report,indent=2)+'\n')
if '--fixture' in __import__('sys').argv:(root/'tests/fixtures/accuracy-followup-reference.json').write_text(json.dumps(report,indent=2)+'\n')
print('records',len(records),'limits',len(limits))
