// IAPWS-IF97 supplementary equation for the metastable-vapor region
// (IAPWS R7-97(2012), §6.2.3, Eqs. 18–20, Tables 16–18): supercooled
// (subcooled) steam between the saturated-vapor line and the 5 % equilibrium
// moisture line, from the triple-point pressure up to 10 MPa.
import {polynomial,R,saturationTemperature,PMIN_SAT} from './equations.js';
import {R2J0,R2N0} from './coefficients.js';
import {calculate} from './engine.js';

// Residual part, R7-97 Table 16: [I, J, n].
const METASTABLE_R=[[1,0,-0.73362260186506e-2],[1,2,-0.88223831943146e-1],[1,5,-0.72334555213245e-1],[1,11,-0.40813178534455e-2],[2,1,0.20097803380207e-2],[2,7,-0.53045921898642e-1],[2,16,-0.76190409086970e-2],[3,4,-0.63498037657313e-2],[3,16,-0.86043093028588e-1],[4,7,0.75321581522770e-2],[4,10,-0.79238375446139e-2],[5,9,-0.22888160778447e-3],[5,10,-0.26456501482810e-2]];
// Ideal-gas part: region-2 coefficients with n°1, n°2 replaced (Eq. 19).
const METASTABLE_N0=[-0.96937268393049e1,0.10087275970006e2,...R2N0.slice(2)];

// Gibbs-equation properties at (p, T) without domain checks. MPa, K, kJ, kg.
export function metastableVaporGibbs(p,T){
 const pi=p,tau=540/T,d=polynomial(pi,tau-0.5,METASTABLE_R);
 d.g+=Math.log(pi);d.x+=1/pi;d.xx-=1/pi**2;
 for(let k=0;k<R2J0.length;k++){const j=R2J0[k],n=METASTABLE_N0[k];d.g+=n*tau**j;if(j)d.y+=n*j*tau**(j-1);if(j&&j!==1)d.yy+=n*j*(j-1)*tau**(j-2);}
 const v=R*T*d.x/1000,cp=-R*tau*tau*d.yy,cv=cp+R*(d.x-tau*d.xy)**2/d.xx;
 const w=Math.sqrt(1000*R*T*d.x*d.x/((d.x-tau*d.xy)**2/(tau*tau*d.yy)-d.xx));
 return {p,T,v,rho:1/v,h:R*T*tau*d.y,u:R*T*(tau*d.y-pi*d.x),s:R*(tau*d.y-d.g),cp,cv,w,model:'IF97 metastable vapor'};
}

// Checked state: 0 < p ≤ 10 MPa, T ≤ Tsat(p) and h above the 5 % moisture line.
export function metastableVapor(p,T){
 if(!Number.isFinite(p)||p<PMIN_SAT||p>10)throw Error('Метастабільна пара IF97: '+PMIN_SAT.toPrecision(6)+' ≤ P ≤ 10 МПа.');
 if(!Number.isFinite(T))throw Error('Температура має бути скінченним числом.');
 const Ts=saturationTemperature(p);
 if(T>Ts+1e-9)throw Error('Температура вища за температуру насичення: це звичайна перегріта пара.');
 const q=metastableVaporGibbs(p,T),limit=calculate('px',p,0.95).state.h;
 if(q.h<limit)throw Error('Стан за межею 5 % рівноважної вологості, де рівняння метастабільної пари не застосовне.');
 return {...q,Tsat:Ts,subcooling:Ts-T,equilibriumQuality:calculate('ph',p,q.h).state.x};
}
