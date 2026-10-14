"""Independent component checks; no JS imports, reactor EOS, or fitted coefficients.
Radial conduction integrates heat flow from a uniform volumetric source.
Temperature integrals are a comparison model, not replacements for the guide.
"""
import json, math, sys
from decimal import Decimal, localcontext

def conductivity(material,t):
    coefficients={'clad':[16.592,.016102,-.000015], 'gap':[.1362,.000389,-.000000124], 'fuel':[7.8561,-.0072,.000003,-.0000000004]}[material]
    return sum(c*t**i for i,c in enumerate(coefficients))

def derivative(material,t):
    return {'clad':.016102-.00003*t,'gap':.000389-.000000248*t,'fuel':-.0072+.000006*t-.0000000012*t*t}[material]

def newton(function,slope,guess):
    x=guess
    for _ in range(100):
        step=function(x)/slope(x); x-=step
        if abs(step)<1e-10:return x
    raise ValueError('Reference Newton solver did not converge')

def simpson(fn,a,b,n=4096):
    step=(b-a)/n
    return step/3*(fn(a)+fn(b)+sum((4 if i%2 else 2)*fn(a+step*i) for i in range(1,n)))

def reference(c):
    kind=c['kind']
    if kind=='annulus':
        with localcontext() as context:
            context.prec=80
            x=Decimal.from_float(c['inner'])/Decimal.from_float(c['outer'])
            f=Decimal(1) if not x else 1+2*x*x*x.ln()/(1-x*x)
            return {'factor':float(f)}
    if kind=='radial':
        r0,R,q,k=c['inner'],c['outer'],c['linear'],c['conductivity']
        # Q(r)/length = q * fuel area inside radius r / total fuel area.
        def gradient(r):
            if not r:return 0.
            fraction=(r-r0)*(r+r0)/((R-r0)*(R+r0))
            return q*fraction/(2*math.pi*k*r)
        return {'rise':simpson(gradient,r0,R)}
    if kind=='shell':
        return {'rise':simpson(lambda r:c['linear']/(2*math.pi*c['conductivity']*r),c['inner'],c['outer'])}
    if kind=='contact':
        # Interface balance: q'/length = area/length * h * deltaT.
        return {'rise':c['linear']/(2*math.pi*c['radius']*c['conductance'])}
    if kind=='published-pin':
        rf,ri,ro=c['fuelRadius'],c['fuelRadius']+c['gap'],c['fuelRadius']+c['gap']+c['cladThickness']
        q=c['linear'];wall=c['coolant']+q/(2*math.pi*ro*c['coolantAlpha'])
        clad=wall+simpson(lambda r:q/(2*math.pi*c['cladLambda']*r),ri,ro)
        surface=clad+q/(2*math.pi*rf*c['gapConductance'])
        centre=surface+simpson(lambda r:q*r/(2*math.pi*c['fuelLambda']*rf*rf),0,rf)
        return {'cladOuter':wall,'cladInner':clad,'fuelSurface':surface,'fuelCentre':centre}
    if kind=='polynomial':
        t,target,material=c['outer'],c['target'],c['material']
        rise=newton(lambda h:conductivity(material,t+h/2)*h-target,
                    lambda h:conductivity(material,t+h/2)+h/2*derivative(material,t+h/2),target/conductivity(material,t))
        exact=newton(lambda h:simpson(lambda temp:conductivity(material,temp),t,t+h,32)-target,
                     lambda h:conductivity(material,t+h),rise)
        return {'rise':rise,'integralRise':exact,'differenceK':rise-exact}
    if kind=='chf':
        p,G,x=c['pressure'],c['massFlux'],c['quality']
        # Published Eq.53 is kW/m2; caller output is MW/m2.
        return {'critical':795*G**(.184-.311*x)*(1-x)**(.105*p-.5)*(1-.0185*p)/1000}
    if kind=='boiling':
        p,t,ts,alpha,q=c['pressure'],c['coolant'],c['saturation'],c['alpha'],c['flux']
        onset=alpha*(ts-t);excess=max(0,q-onset)
        coefficient=.027*(p*10)**1.33*math.pow(excess,2/3) if 8<=p<=20 else 0
        combined=math.sqrt(alpha*alpha+coefficient*coefficient)
        wall=ts+excess/combined if coefficient>0 else t+q/alpha
        return {'wall':wall,'alphaBoiling':coefficient,'onset':onset}
    raise ValueError(kind)

print(json.dumps([reference(c) for c in json.load(sys.stdin)]))
