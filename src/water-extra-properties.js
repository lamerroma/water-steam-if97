// Additional water properties that depend only on (T, ρ) or on already computed
// derivatives: ionization constant, refractive index and density derivatives.
// Sources:
//  - IAPWS R11-07(2019), Bandura & Lvov (2006): ionization constant of H2O, Eq. (1)–(3), Table 1.
//    Validity 273.15…1273.15 K, 0…1000 MPa.
//  - IAPWS R9-97: refractive index of ordinary water, Eq. (7), Table 2.
//    Validity 261.15…773.15 K, 0…1060 kg/m³, 0.2…1.1 μm (0.2…1.9 μm in the release text
//    for the vapour; the conservative range is used here).

export const IONIZATION_LIMITS=Object.freeze({Tmin:273.15,Tmax:1273.15,pmax:1000});
export const REFRACTIVE_LIMITS=Object.freeze({Tmin:261.15,Tmax:773.15,rhoMax:1060,lambdaMin:.2,lambdaMax:1.1});
export const SODIUM_D_LINE_UM=.58929;

// Negative decimal logarithm of the ionization constant Kw (mol²/kg²). T in K, ρ in kg/m³, p in MPa (range check only).
export function ionizationPKw(T,rho,p=null){
 if(!Number.isFinite(T)||!Number.isFinite(rho)||rho<0)return null;
 if(T<IONIZATION_LIMITS.Tmin-1e-9||T>IONIZATION_LIMITS.Tmax+1e-9)return null;
 if(p!=null&&(!Number.isFinite(p)||p>IONIZATION_LIMITS.pmax+1e-9))return null;
 const n=6,a0=-.702132,a1=8681.05,a2=-24145.1,b0=.813876,b1=-51.4471,b2=-.46992,Mw=18.015268;
 const r=rho/1000;
 const pkg=.61415+48251.33/T-67707.93/(T*T)+10102100/(T*T*T);
 if(r===0)return pkg+2*Math.log10(Mw/1000);
 const Z=r*Math.exp(a0+a1/T+a2/(T*T)*r**(2/3));
 const value=-2*n*(Math.log10(1+Z)-Z/(Z+1)*r*(b0+b1/T+b2*r))+pkg+2*Math.log10(Mw/1000);
 return Number.isFinite(value)?value:null;
}

// Refractive index n of water at wavelength lambda (μm). T in K, ρ in kg/m³.
export function refractiveIndex(T,rho,lambda=SODIUM_D_LINE_UM){
 const L=REFRACTIVE_LIMITS;
 if(![T,rho,lambda].every(Number.isFinite)||rho<0)return null;
 if(T<L.Tmin-1e-9||T>L.Tmax+1e-9||rho>L.rhoMax+1e-9||lambda<L.lambdaMin-1e-12||lambda>L.lambdaMax+1e-12)return null;
 const a=[.244257733,9.74634476e-3,-3.73234996e-3,2.68678472e-4,1.5892057e-3,2.45934259e-3,.90070492,-1.66626219e-2];
 const uv=.229202,ir=5.432937;
 const d=rho/1000,t=T/273.15,l=lambda/.589,l2=l*l;
 const A=d*(a[0]+a[1]*d+a[2]*t+a[3]*l2*t+a[4]/l2+a[5]/(l2-uv*uv)+a[6]/(l2-ir*ir)+a[7]*d*d);
 if(!(A>=0&&A<1))return null;
 const value=Math.sqrt((2*A+1)/(1-A));
 return Number.isFinite(value)?value:null;
}

// Single phase: (∂ρ/∂h)p = −ρα/cp, kg²/(m³·kJ); (∂ρ/∂p)h = ρ(κT − α·μJT), kg/(m³·MPa).
export function densityDerivatives(q){
 const ok=[q?.rho,q?.alpha,q?.cp].every(Number.isFinite)&&q.cp>0;
 const drhodh=ok?-q.rho*q.alpha/q.cp:null;
 const drhodph=ok&&Number.isFinite(q.kappa)&&Number.isFinite(q.jt)?q.rho*(q.kappa-q.alpha*q.jt):null;
 return {drhodh,drhodph};
}

// Clausius–Clapeyron slope of the saturation curve, MPa/K, from a saturation pair.
export function saturationSlope(sat){
 const a=sat?.liquid,b=sat?.vapor,T=sat?.T??a?.T;
 if(!a||!b||!Number.isFinite(T)||sat.critical)return null;
 const dv=b.v-a.v,dh=b.h-a.h;
 if(!(dv>0)||!Number.isFinite(dh))return null;
 return dh/(T*dv)/1000;
}

function extendState(q,dpsdt=null,lambda=SODIUM_D_LINE_UM,mixture=null){
 if(!q||typeof q!=='object')return q;
 const twoPhase=Number.isFinite(q.x)&&q.x>0&&q.x<1;
 const out={...q,...densityDerivatives(q)};
 // Two-phase mixture at fixed p: v = v' + (h − h')·Δv/Δh, hence (∂ρ/∂h)p = −ρ²·Δv/Δh.
 if(twoPhase&&mixture&&Number.isFinite(q.rho))out.drhodh=-q.rho*q.rho*mixture.dv/mixture.dh;
 out.pKw=twoPhase?null:ionizationPKw(q.T,q.rho,q.p);
 out.nD=twoPhase?null:refractiveIndex(q.T,q.rho,lambda);
 out.dpsdt=Number.isFinite(q.x)&&q.x>=0&&q.x<=1?dpsdt:null;
 return out;
}

// Adds the extra properties to a calculator result ({state, saturation}) without changing other fields.
export function withExtraWaterProperties(result,lambda=SODIUM_D_LINE_UM){
 if(!result||typeof result!=='object')return result;
 const slope=result.saturation?saturationSlope(result.saturation):null;
 const out={...result};
 if(result.saturation&&typeof result.saturation==='object')out.saturation={...result.saturation,dpsdt:slope,liquid:extendState(result.saturation.liquid,slope,lambda),vapor:extendState(result.saturation.vapor,slope,lambda)};
 const L=result.saturation?.liquid,V=result.saturation?.vapor,mixture=L&&V&&V.h>L.h?{dv:V.v-L.v,dh:V.h-L.h}:null;
 if(result.state&&typeof result.state==='object')out.state=extendState(result.state,slope,lambda,mixture);
 return out;
}
