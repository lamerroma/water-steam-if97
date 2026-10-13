"""Independent arithmetic audit of the course model (stdlib only).

No JS modules or computed neutron intermediates are used. Water properties and
mean temperatures are shared boundary data, NOT independently validated here.
This verifies transcription/numerics, not empirical physical applicability.
"""
import json, math, sys
NA = 6.02214076e23
PI = math.pi

def interpolate(table, x, column=1):
    if not table[0][0] <= x <= table[-1][0]:
        raise ValueError('Outside source table')
    for lo, hi in zip(table, table[1:]):
        if lo[0] <= x <= hi[0]:
            return lo[column] + (hi[column]-lo[column])*(x-lo[0])/(hi[0]-lo[0])
    return table[-1][column]

def j0(x):
    return sum((-1)**i*(x/2)**(2*i)/math.factorial(i)**2 for i in range(40))

def audit(case):
    a, w = case['input'], case['water']
    out = {}
    def record(key, value):
        if not math.isfinite(value):
            raise ValueError(key + ': nonfinite reference')
        out[key] = value
        return value
    d=a['rodDiameter']/1000; di=d-2*a['cladThickness']/1000
    df=di-2*a['gap']/1000; hole=a['holeDiameter']/1000
    pitch=d*a['pitchRatio']; tubes=a['guides']+a['centralTubes']
    sites=3*a['layers']*(a['layers']-1)+1 if a['lattice']=='hex' else a['layers']**2
    rods=sites-tubes
    inner=(math.sqrt(3)*pitch*(a['layers']-1) if a['lattice']=='hex' else pitch*(a['layers']-1))+d
    flats=inner+2*a['ductThickness']/1000
    geometric=math.sqrt(3)/2 if a['lattice']=='hex' else 1
    cell=geometric*(flats+a['bundleGap']/1000)**2
    duct=geometric*(flats**2-inner**2)
    flow_area=cell-rods*PI*d*d/4-tubes*PI*(a['guideDiameter']/1000)**2/4-duct
    perimeter=rods*PI*d
    if a['areaMethod']=='duct':
        perimeter+=tubes*PI*a['guideDiameter']/1000+(2*math.sqrt(3) if a['lattice']=='hex' else 4)*inner
    hydraulic=4*flow_area/perimeter
    power=a['electricalMW']/a['plantEfficiency']; volume=power/a['volumeHeat']
    diameter=(4*volume/(PI*a['heightRatio']))**(1/3); height=diameter*a['heightRatio']
    raw=PI*diameter**2/(4*cell)
    count={'nearest':lambda v:math.floor(v+.5),'ceil':math.ceil,'floor':math.floor}[a['bundleRounding']](raw)
    flow=power*1000/(w['outlet']['h']-w['inlet']['h'])
    reflector=75*w['inlet']['v'] if a['reflectorMethod']=='density' else a['reflector']
    beta=PI/(height+2*reflector)
    peak=power*1e6*a['fuelFraction']*a['radialPeak']*beta/(2*count*rods*math.sin(beta*height/2))
    for key,value in dict(thermalMW=power,rods=rods,waterArea=flow_area*1e6,hydraulicDiameter=hydraulic*1000,diameter=diameter,height=height,bundles=count,flow=flow,peakLinear=peak/1000).items():
        record('metrics.'+key,value)
    mean=w['mean']; massflux=flow/(count*flow_area)
    mean_re=massflux*hydraulic/mean['mu']; velocity=massflux*mean['v']
    hp=a['pitchRatio']*((1+math.sqrt(3)/2)/2 if a['lattice']=='hex' else 1)
    shape=.58+9.2*(hp-1)
    fb=(1.82*math.log10(mean_re)-1.64)**(-2)*(.57+.18*(hp-1)+.53*(1-math.exp(-shape)))
    dynamic=velocity**2/(2*mean['v'])
    friction=fb*height/hydraulic*dynamic/1e6
    local=(a['gridCount']*a['gridK']*dynamic+a['inletK']*(massflux*w['inlet']['v'])**2/(2*w['inlet']['v']))/1e6
    gravity=height*9.80665/mean['v']/1e6
    acceleration=massflux**2*(w['outlet']['v']-w['inlet']['v'])/1e6
    for key,value in dict(meanRe=mean_re,fBundle=fb,frictionDrop=friction,localDrop=local,gravityDrop=gravity,accelerationDrop=acceleration,calculatedDrop=friction+local+gravity+acceleration).items():
        record('metrics.'+key,value)
    fuelvol=PI*(df*df-hole*hole)/4*height*rods*count
    mass=fuelvol*a['fuelDensity']*1000; fresh=a['freshEnrichment']/100
    n5=n8=0
    for i in range(a['reloadZones']):
        n=count//a['reloadZones']+(i<count%a['reloadZones'])
        zone_mass=mass*n/count
        initial=zone_mass*235*fresh/(270-3*fresh)
        burned=1.23*power*a['reloadDays']*.001*(1-a['plutoniumShare'])*i/a['reloadZones']
        n5+=(initial-burned)/235
        n8+=zone_mass*238*(1-fresh)/(270-3*fresh)/238
    enrichment=n5/(n5+n8)
    record('zones.enrichment',enrichment*100)
    def neutron(label, water, fuel_c):
        V0=PI*(df*df-hole*hole)/4*1e4
        gas=PI*(di*di-df*df+hole*hole)/4*1e4
        zirconium=(rods*PI*(d*d-di*di)/4+tubes*PI*((a['guideDiameter']/1000)**2-((a['guideDiameter']-2*a['guideThickness'])/1000)**2)/4+duct)/rods*1e4
        V2=gas+zirconium; Vcell=cell/rods*1e4; V1=Vcell-V0-V2
        rho=water['rho']/1000; Tw=water['T']
        nf=a['fuelDensity']*NA/(270-3*enrichment)
        U5=enrichment*nf; U8=(1-enrichment)*nf; oxygen=2*nf
        Zr=a['zirconiumDensity']*zirconium/V2*NA/91.22; H2O=rho*NA/18.01528
        slowfuel=(2/235*13.8*U5+2/238*8.3*U8+2/16*3.76*oxygen)*1e-24
        slowzr=2/91.22*6.4*Zr*1e-24; slowwater=(41+2/16*3.76)*H2O*1e-24
        g=lambda T:[interpolate(case['gTable'],T,k) for k in range(1,6)]
        factor=lambda T:math.sqrt(PI*293.15/T)/2
        fw=factor(Tw); gw=g(Tw)
        Tn=Tw*(1+1.46*(V0*fw*(681*U5*gw[0]+2.71*U8*gw[2])+V2*fw*.185*Zr+V1*fw*.66427*H2O)*1e-24/(V0*slowfuel+V2*slowzr+V1*slowwater))
        f=factor(Tn); gf=g(Tn)
        sa5=681e-24*U5*f*gf[0]; sa8=2.71e-24*U8*f*gf[2]; sf5=584e-24*U5*f*gf[1]
        sa0=sa5+sa8; sazr=.185e-24*Zr*f; saw=.66427e-24*H2O*f
        ss0=(13.8*U5+8.3*U8+3.76*oxygen)*1e-24
        str0=sa0+(13.8*(1-2/(3*235))*U5+8.3*(1-2/(3*238))*U8+3.76*(1-2/(3*16))*oxygen)*1e-24
        strzr=sazr+6.4e-24*(1-2/(3*91.22))*Zr
        sa1=(saw*V1+sazr*V2)/(V1+V2)
        water_ratio=Tw/293.15
        water_area=(2.72/rho)**2*water_ratio*1.0614/(1+.0614*math.sqrt(water_ratio))
        str1=(V1/(3*water_area*saw)+V2*strzr)/(V1+V2)
        slow=(slowwater*V1+slowzr*V2)/(V1+V2)
        P=.154*rho*(V1+V2)/(PI*(d*100)**2/4*U8*1e-24)
        mu=(1.34+P*(1+.27*df*100*U8*1e-24))/(1+P)
        l0=4*V0/(PI*(df+hole)*100); FM=4/((df-hole)*100*a['fuelDensity'])
        sigmam=(3.76*.94*oxygen+.2*(13.8*U5+8.3*U8))*1e-24
        bell=a['bellFactor'] if a['resonanceMethod']=='gp' else 1.27
        scattering=1+l0*sigmam/bell
        KT=1+(.535+.47*FM*scattering)*.01*(math.sqrt(fuel_c+273.15)-math.sqrt(300))
        base=a['resonanceI8']
        if a['resonanceMethod']=='gp':
            l1=4*(V1+V2)/(PI*df*100); t=(pitch-df)*100/l1
            u=(44.76e-24*H2O*V1+6.2e-24*Zr*V2)/(V1+V2)*l1
            b=17/3 if a['lattice']=='hex' else 17/8
            correction=u/(7+b*u)
            c=1-math.exp(-t*u)/(1+u*(1-t-correction))
            gamma=c/(1+(bell-1)*(1-c))
            base=5.55+26.6*math.sqrt(FM*scattering*gamma)
        phi8=math.exp(-U8*base*1e-24*KT*V0/(slow*(V1+V2)))
        phi5=math.exp(-U5*419e-24*V0/(slow*(V1+V2)))
        phizr=math.exp(-Zr*3e-24*V2/(slow*(V1+V2))); phi=phi8*phi5*phizr
        r0=math.sqrt(V0/PI); r1=math.sqrt(Vcell/PI); psi=r1/r0; kap=3*sa1*str1
        qd=kap*r1*r1/2*(psi*psi/(psi*psi-1)*math.log(psi)-.75+1/(4*psi*psi))
        boundary=.64+(1.6745/psi-.3114)/(r0*str1+3.217/psi-.5202) if a['lattice']=='hex' else a['squareBoundaryGamma']
        delta=kap*(r1*r1-r0*r0)/2/(r0*str1)*(boundary-2/3)
        y=r0*str0
        q0=1+sa0/str0*(.26781*y+.18869*y*y)*(1+(.067*y+.0037*y*y)*ss0/str0+(.046*y+.02*y*y)*(ss0/str0)**2)
        absorption=(V1+V2)*sa1/(V0*sa0)*(q0+qd)+delta; theta=1/(1+absorption)
        eta=2.416*sf5/sa0
        kt=eta*mu*theta*phi; kr=1.6*mu*phi8*(1-phi5)*phizr
        L0=1/(3*str0*sa0); L1=1/(3*str1*sa1); L2=(1-theta)*L1+theta*L0
        age=27.3*(1+V0/V1+zirconium/V1)/(rho+.82*V0/V1+.4*zirconium/V1)**2
        extension=4.3*(1+.4*Vcell/V1)/rho
        B2=(2.405/(diameter*50+extension))**2+(PI/(height*100+2*extension))**2
        leak=math.exp(-B2*age)/(1+B2*L2)
        result=dict(V0=V0,V1=V1,V2=V2,N5=U5,N8=U8,Tng=Tn,baseI8=base,KT=KT,phi=phi,theta=theta,kinf=kt+kr,boundaryGamma=boundary,Lsq=L2,age=age,nonLeak=leak,keff=(kt+kr)*leak,Lwater2=water_area,phiZr=phizr,qAbs=absorption)
        for key,value in result.items(): record(label+'.'+key,value)
        return dict(**result,rho=rho,sa5=sa5,sa8=sa8,sf5=sf5,sa0=sa0,phi8=phi8,phi5=phi5,phizr=phizr,mu=mu,eta=eta,kr=kr,qabs=absorption,fluxratio=q0+qd,totalstr=(V0*str0+(V1+V2)*str1)/Vcell,extension=extension,gf=gf,slow=slow)
    hot=neutron('hot',w['hot'],case['meanFuel'])
    cold=neutron('cold',w['cold'],a['coldC'])
    R=diameter*50+cold['extension']; rod=a['controlRodDiameter']/20
    ltr=1/(3*cold['totalstr']); argument=rod/ltr
    F=interpolate(case['rodTable'],argument) if a['rodMethod']=='course' else 0
    gamma=4/3-argument*F if a['rodMethod']=='course' else 0
    reff=rod*math.exp(-gamma*ltr/rod)
    worth=a['centralRodWorth'] if a['rodMethod']=='given' else 7.5*cold['Lsq']/(R*R*(.116+math.log(R/(2.405*reff))))
    if a['rodLayout']=='effective':
        layout=[dict(radius=diameter/2*a['controlRadiusFraction'],assemblies=a['controlAssemblies'])]
    else:
        layout=[]
        for line in a['controlLayout'].strip().splitlines():
            if not line.strip():continue
            v,z=[float(value.strip().replace(',','.')) for value in line.split(';')]
            layout.append(dict(radius=math.hypot(v,z) if a['rodLayout']=='coordinates' else v,assemblies=1 if a['rodLayout']=='coordinates' else int(z)))
    weighted=sum(row['assemblies']*a['rodsPerCluster']*j0(2.405*row['radius']*100/R)**2 for row in layout)
    total=worth*weighted*a['interferenceFactor']
    B=0
    if cold['keff']>a['shutdownTarget']+total:
        theta_target=((a['shutdownTarget']+total)/cold['nonLeak']-cold['kr'])/(cold['eta']*cold['mu']*cold['phi'])
        qb=1/theta_target-1-cold['qabs']
        sigB=(3835*a['boronFraction10']+.0055*(1-a['boronFraction10']))*1e-24*math.sqrt(PI*293.15/cold['Tng'])/2
        NB=qb*cold['V0']*cold['sa0']/(cold['V1']*cold['fluxratio']*sigB)
        B=NB*10.81/NA*1000/cold['rho']
    record('controls.centralWorth',worth); record('controls.totalWorth',total);record('controls.boron',B);record('controls.boricAcid',B*61.83/10.81)
    # Independent depletion solution at selected times, same course assumptions.
    flux=power*1e6/(hot['sf5']*3.2e-11*fuelvol*1e6)
    sig5=hot['sa5']/hot['N5']; sig8=hot['sa8']/hot['N8']; sigf5=hot['sf5']/hot['N5']
    fac=math.sqrt(PI*293.15/hot['Tng'])/2
    sig9=1028e-24*fac*hot['gf'][3]; sigf9=742e-24*fac*hot['gf'][4]
    ratio9=sig9/sig5; ratio8=sig8/sig5+hot['mu']*hot['eta']*(1-hot['phi8'])*hot['N5']/hot['N8']
    for index,days in enumerate(case['campaignDays']):
        z=sig5*flux*days*86400; U5=hot['N5']*math.exp(-z)
        Pu=hot['N8']*ratio8/ratio9*(-math.expm1(-ratio9*z)) if days else 0
        Xe=.059*flux*sigf5*U5/(2.09e-5+2.72e-18*fac*flux) if days else 0
        Sm=.014*sigf5*U5/(4.1e-20*fac) if days else 0
        slag=1.23*power*days/(fuelvol*1e6)*NA/(270-3*enrichment)
        sa=hot['sa8']+sig5*U5+sig9*Pu+5e-23*slag+2.72e-18*fac*Xe+4.1e-20*fac*Sm
        nu_theta=(2.416*sigf5/sig5*sig5*U5+2.87*sigf9/sig9*sig9*Pu)/(sa+hot['qabs']*hot['sa0'])
        phi5=math.exp(-U5*419e-24*hot['V0']/(hot['slow']*(hot['V1']+hot['V2'])))
        phi9=math.exp(-Pu*501e-24*hot['V0']/(hot['slow']*(hot['V1']+hot['V2'])))
        kinf=hot['mu']*hot['phi8']*hot['phizr']*(phi5*phi9*nu_theta+1.6*(phi9*(1-phi5)+phi5*(1-phi9)))
        record('campaign.'+str(index),kinf*hot['nonLeak'])
    # Per-node heat transfer and cylindrical layer residuals (no shared roots).
    for i,row in enumerate(case['nodes']):
        z=row['z']; linear=peak*math.cos(beta*z)
        Re=flow/(count*flow_area)*hydraulic/row['mu']; Pr=row['cp']*1000*row['mu']/row['lambda']
        conv=(.026*a['pitchRatio']-.006)*row['lambda']/hydraulic*Re**.8*Pr**(1/3)
        surface=linear/(PI*d); design=a['heatFactor']*surface
        excess=max(0,design-conv*(row['satT']-row['T']))
        alpha_b=.027*(10*row['p'])**1.33*excess**(2/3) if a['boilingMethod']=='guide' and 8<=row['p']<=20 else 0
        alpha=math.hypot(conv,alpha_b)
        wall=row['satT']+excess/alpha if alpha_b else row['T']+design/conv
        record('nodes.'+str(i)+'.alpha',alpha);record('nodes.'+str(i)+'.cladOuter',wall)
        if a['chfMethod']!='off':
            x=(row['h']-row['hf'])/(row['hg']-row['hf'])
            m=.311*(1-x)**(-.127) if a['chfMethod']=='candidate' else .311*(1-x)-.127
            crit=.795*(flow/(count*flow_area))**m*(1-x)**(.105*row['p']-.5)*(1-.0185*row['p'])
            record('nodes.'+str(i)+'.chf',crit/(surface/1e6))
        def conductivity(material,t):
            return {'clad':lambda:-1.5e-5*t*t+.016102*t+16.592,'gap':lambda:-1.24e-7*t*t+.000389*t+.1362,'fuel':lambda:-4e-10*t**3+3e-6*t*t-.0072*t+7.8561}[material]()
        def rise(outer,target,material,mode,constant):
            if mode=='constant':return target/constant
            lo=0;hi=.5
            while conductivity(material,outer+hi/2)*hi<target:
                hi*=1.2
                if hi>12000:raise ValueError('Unbracketed reference root')
            for _ in range(100):
                mid=(lo+hi)/2
                if conductivity(material,outer+mid/2)*mid>target:hi=mid
                else:lo=mid
            return (lo+hi)/2
        clad=wall+rise(wall,a['conductionFactor']*linear*math.log(d/di)/(2*PI),'clad',a['cladMethod'],a['cladConductivity'])
        if a['gapMethod']=='contact':fuel=clad+a['conductionFactor']*linear/(PI*df*a['contactConductance'])
        elif a['gapMethod']=='perfect':fuel=clad
        else:fuel=clad+rise(clad,a['conductionFactor']*linear*math.log(di/df)/(2*PI),'gap',a['gapMethod'],a['gapConductivity'])
        chi=hole/df
        annulus=1+2*chi*chi*math.log(chi)/(1-chi*chi) if chi else 1
        centre=fuel+rise(fuel,a['conductionFactor']*linear*annulus/(4*PI),'fuel',a['fuelMethod'],a['fuelConductivity'])
        record('nodes.'+str(i)+'.cladInner',clad);record('nodes.'+str(i)+'.fuelSurface',fuel);record('nodes.'+str(i)+'.fuelCenter',centre)
    return out

if __name__=='__main__':
    cases=json.load(sys.stdin)
    json.dump([audit(case) for case in cases],sys.stdout,allow_nan=False)
