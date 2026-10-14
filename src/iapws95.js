// IAPWS R6-95(2018), Eqs. (4)-(6), Tables 1-3. © 2018 IAPWS.
// Independent transcription; MPa, K, kg/m³, kJ/kg. No IF97 property substitution.
import {viscosity,viscosityScientific,conductivity,surfaceTension} from './transport.js';
import {dielectric} from './dielectric.js';
export const R95=.46151805, T95C=647.096, D95C=322, P95C=22.064;
const N95=[.012533547935523,7.8957634722828,-8.7803203303561,.31802509345418,-.26145533859358,-.0078199751687981,.0088089493102134,-.66856572307965,.20433810950965,-.000066212605039687,-.19232721156002,-.25709043003438,.16074868486251,-.040092828925807,.00000039343422603254,-.0000075941377088144,.00056250979351888,-.000015608652257135,.0000000011537996422951,.00000036582165144204,-.0000000000013251180074668,-.00000000062639586912454,-.10793600908932,.017611491008752,.22132295167546,-.40247669763528,.58083399985759,.0049969146990806,-.031358700712549,-.74315929710341,.47807329915480,.020527940895948,-.13636435110343,.014180634400617,.0083326504880713,-.029052336009585,.038615085574206,-.020393486513704,-.0016554050063734,.0019955571979541,.00015870308324157,-.000016388568342530,.043613615723811,.034994005463765,-.076788197844621,.022446277332006,-.000062689710414685,-.00000000055711118565645,-.19905718354408,.31777497330738,-.11841182425981];
const D95=[1,1,1,2,2,3,4,1,1,1,2,2,3,4,4,5,7,9,10,11,13,15,1,2,2,2,3,4,4,4,5,6,6,7,9,9,9,9,9,10,10,12,3,4,4,5,14,3,6,6,6];
const E95=[-.5,.875,1,.5,.75,.375,1,4,6,12,1,5,4,2,13,9,3,4,11,4,13,1,7,1,9,10,10,3,7,10,10,6,10,10,1,2,3,4,8,6,9,8,16,22,23,23,10,50,44,46,50];
const C95=[...Array(7).fill(0),...Array(15).fill(1),...Array(20).fill(2),...Array(4).fill(3),4,6,6,6,6];
// Second-order automatic differentiation for the two nonanalytic critical terms.
// Components: f, fδ, fτ, fδδ, fδτ, fττ. All derivatives are analytic.
const j95=n=>[n,0,0,0,0,0];
const add95=(a,b)=>a.map((v,i)=>v+b[i]);
const scale95=(a,b)=>a.map(v=>v*b);
function mul95(a,b){return [a[0]*b[0],a[1]*b[0]+a[0]*b[1],a[2]*b[0]+a[0]*b[2],a[3]*b[0]+2*a[1]*b[1]+a[0]*b[3],a[4]*b[0]+a[1]*b[2]+a[2]*b[1]+a[0]*b[4],a[5]*b[0]+2*a[2]*b[2]+a[0]*b[5]];}
function unary95(a,f,df,ddf){return [f,df*a[1],df*a[2],df*a[3]+ddf*a[1]**2,df*a[4]+ddf*a[1]*a[2],df*a[5]+ddf*a[2]**2];}
const pow95=(a,b)=>a[0]===0&&a[1]===0&&a[2]===0&&b>1?j95(0):unary95(a,a[0]**b,b*a[0]**(b-1),b*(b-1)*a[0]**(b-2));
const exp95=a=>unary95(a,Math.exp(a[0]),Math.exp(a[0]),Math.exp(a[0]));
export function derivatives95(delta,tau){
 if(!(delta>0&&tau>0))throw Error('IAPWS-95: додатні густина і температура обов’язкові.');
 const ideal=[Math.log(delta)-8.3204464837497+6.6832105275932*tau+3.00632*Math.log(tau),1/delta,6.6832105275932+3.00632/tau,-1/delta**2,0,-3.00632/tau**2];
 const ns=[.012436,.97315,1.27950,.96956,.24873],gs=[1.28728967,3.53734222,7.74073708,9.24437796,27.5075105];
 for(let i=0;i<5;i++){const g=gs[i],n=ns[i],e=Math.exp(-g*tau),q=-Math.expm1(-g*tau);ideal[0]+=n*Math.log(q);ideal[2]+=n*g*e/q;ideal[5]-=n*g*g*e/(q*q);}
 let residual=j95(0);
 for(let i=0;i<51;i++){const c=C95[i],d=D95[i],t=E95[i],dc=c?delta**c:0,f=N95[i]*delta**d*tau**t*Math.exp(-dc),ld=(d-c*dc)/delta,lt=t/tau;
 residual=add95(residual,[f,f*ld,f*lt,f*(ld*ld-d/delta**2-(c?c*(c-1)*delta**(c-2):0)),f*ld*lt,f*t*(t-1)/tau**2]);}
 for(const [n,t,b,g] of [[-31.306260323435,0,150,1.21],[31.546140237781,1,150,1.21],[-2521.3154341695,4,250,1.25]]){const f=n*delta**3*tau**t*Math.exp(-20*(delta-1)**2-b*(tau-g)**2),ld=3/delta-40*(delta-1),lt=t/tau-2*b*(tau-g);residual=add95(residual,[f,f*ld,f*lt,f*(ld*ld-3/delta**2-40),f*ld*lt,f*(lt*lt-t/tau**2-2*b)]);}
 const dj=[delta,1,0,0,0,0],tj=[tau,0,1,0,0,0],dx=add95(dj,j95(-1)),ty=add95(tj,j95(-1)),sq=mul95(dx,dx);
 for(const [n,b,C,D] of [[-.14874640856724,.85,28,700],[.31806110878444,.95,32,800]]){
 const theta=add95(scale95(ty,-1),scale95(pow95(sq,1/.6),.32));
 const Delta=add95(mul95(theta,theta),scale95(pow95(sq,3.5),.2));
 const psi=exp95(add95(scale95(sq,-C),scale95(mul95(ty,ty),-D)));
 if(Delta[0]===0)throw Error('Точна критична точка IAPWS-95: сингулярні похідні; використайте стан поза нею.');
 residual=add95(residual,scale95(mul95(mul95(pow95(Delta,b),dj),psi),n));
 }
 return {ideal,residual};
}
export function raw95(T,rho){
 const delta=rho/D95C,tau=T95C/T,{ideal:o,residual:r}=derivatives95(delta,tau),f=add95(o,r),B=1+2*delta*r[1]+delta*delta*r[3],A=1+delta*r[1]-delta*tau*r[4],cv=-R95*tau*tau*f[5];
 return {T,rho,v:1/rho,p:rho*R95*T*(1+delta*r[1])/1000,u:R95*T*tau*f[2],h:R95*T*(1+tau*f[2]+delta*r[1]),s:R95*(tau*f[2]-f[0]),cv,cp:cv+R95*A*A/B,w:Math.sqrt(1000*R95*T*(B+A*A/(cv/R95))),alpha:A/(T*B),drhodp:1000/(R95*T*B),region:null,model:'IAPWS-95'};
}
function bounds95(p,T){if(!Number.isFinite(p)||p<=0||p>1000)throw Error('IAPWS-95: абсолютний тиск 0 < P ≤ 1000 МПа.');if(!Number.isFinite(T)||T<273.16||T>1273)throw Error('Реалізований діапазон IAPWS-95: 273,16…1273 K; лід і переохолоджена вода не моделюються.');
 if(p>meltingLimit95(T))throw Error('IAPWS-95: стан у твердій області або на межі плавлення; лід не моделюється.');}
// R14-08(2011), Eqs. (3),(4). For T≥355 K melting pressure exceeds our 1000 MPa limit.
export function meltingLimit95(T){if(T>=355)return Infinity;if(T>=273.31)return 632.4*(1-1.07476*(1-(T/273.31)**4.6));return 350.1*(1-1.18721*(1-(T/256.164)**8));}
function lowerT95(p){let lo=273.16,hi=355;if(p<=meltingLimit95(lo))return lo;for(let i=0;i<50;i++){const m=(lo+hi)/2;if(p>meltingLimit95(m))lo=m;else hi=m;}return hi+1e-6;}

function decorate95(q,phase,x=null){
 if(!(q.drhodp>0&&q.cp>0&&q.cv>0&&Number.isFinite(q.w)))throw Error('IAPWS-95: нестабільний або сингулярний стан.');
 const kappa=q.drhodp/q.rho,ref=raw95(1.5*T95C,q.rho).drhodp;
 const mu=q.T<=1173&&q.p<=100?viscosityScientific(q,ref):null,lambda=mu==null?null:conductivity(q,ref,mu);
 return {...q,phase,x,kappa,dvdt:q.v*q.alpha,dvdp:-q.v*kappa,dpdt:q.alpha/kappa,dpdv:-1/(q.v*kappa),jt:1000*q.v*(q.T*q.alpha-1)/q.cp,ijt:1000*q.v*(1-q.T*q.alpha),A:q.u-q.T*q.s,G:q.h-q.T*q.s,Z:1000*q.p*q.v/(R95*q.T),isentropic:q.w*q.w*q.rho/(q.p*1e6),dc:dielectric(q.T,q.rho),mu,nu:mu==null?null:mu/q.rho,lambda,diffusivity:lambda==null?null:lambda/(q.rho*q.cp*1000),Pr:lambda==null?null:mu*q.cp*1000/lambda,sigma:x===0||x===1?surfaceTension(q.T):null,notes:['IAPWS-95 R6-95(2018). Насичення — рівновага основного рівняння. μ та λ: наукові IAPWS 2008/2011 з критичними доданками та опорною похідною IAPWS-95; реалізовано лише P≤100 МПа, T≤1173 K. Області 1–5 IF97 до цієї моделі не застосовуються.']};
}
function seedSaturation95(T){const z=1-T/T95C,liquid=[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],le=[1/3,2/3,5/3,16/3,43/3,110/3],vapor=[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],ve=[1/3,2/3,4/3,3,37/6,71/6];return [D95C*(1+liquid.reduce((s,n,i)=>s+n*z**le[i],0)),D95C*Math.exp(vapor.reduce((s,n,i)=>s+n*z**ve[i],0))];}
const satCache95=new Map();
export function saturationT95(T){
 if(!Number.isFinite(T)||T<273.16||T>=T95C)throw Error('Насичення IAPWS-95: 273,16 ≤ T < 647,096 K; точна критична точка не підтримується.');
 if(satCache95.has(T))return satCache95.get(T);
 let [rl,rv]=seedSaturation95(T);const RT=R95*T;
 for(let i=0;i<55;i++){
 const l=raw95(T,rl),v=raw95(T,rv),e1=(l.p-v.p)*1000/RT,e2=(l.h-T*l.s-v.h+T*v.s)/RT;
 if(Math.abs(e1)<2e-10&&Math.abs(e2)<2e-11&&l.drhodp>0&&v.drhodp>0&&rl>rv*1.00001){const p=(l.p+v.p)/2,sat={p,T,liquid:decorate95({...l,p},'Насичена рідина',0),vapor:decorate95({...v,p},'Насичена пара',1),latentHeat:v.h-l.h,model:'IAPWS-95'};if(satCache95.size>400)satCache95.clear();satCache95.set(T,sat);return sat;}
 const a=1000*rl/l.drhodp/RT,b=-1000*rv/v.drhodp/RT,c=1000/l.drhodp/RT,d=-1000/v.drhodp/RT,det=a*d-b*c;
 const dl=(-e1*d+b*e2)/det,dv=(-a*e2+c*e1)/det;let ok=false;
 for(let f=1;f>2**-22;f/=2){const nl=rl*Math.exp(f*dl),nv=rv*Math.exp(f*dv);if(!(nl>D95C&&nv<D95C&&nv>0&&nl<1800))continue;const L=raw95(T,nl),V=raw95(T,nv),E1=(L.p-V.p)*1000/RT,E2=(L.h-T*L.s-V.h+T*V.s)/RT;if(Math.hypot(E1,E2)<Math.hypot(e1,e2)){rl=nl;rv=nv;ok=true;break;}}
 if(!ok)break;
 }
 throw Error('IAPWS-95: рівновага насичення не збіглася; стан надто близький до критичної точки.');
}
const satPressureCache95=new Map();
export function saturationP95(p){
 if(!Number.isFinite(p)||p<.000611654771||p>=P95C)throw Error('Насичення IAPWS-95: 0,000611654771 ≤ P < 22,064 МПа.');
 if(satPressureCache95.has(p))return satPressureCache95.get(p);
 let lo=273.16,hi=T95C-1e-5,T=(lo+hi)/2;
 for(let i=0;i<65;i++){
 const s=saturationT95(T),e=s.p-p;
 if(Math.abs(e)<Math.max(2e-11,p*2e-11)){if(satPressureCache95.size>=500)satPressureCache95.clear();satPressureCache95.set(p,s);return s;}
 if(e>0)hi=T;else lo=T;
 // Exact Clapeyron slope of the computed coexistence states, safeguarded by a bracket.
 const slope=(s.vapor.h-s.liquid.h)/(1000*T*(s.vapor.v-s.liquid.v)),next=T-e/slope;
 T=Number.isFinite(next)&&next>lo&&next<hi?next:(lo+hi)/2;
 }
 throw Error('Не збіглася температура насичення IAPWS-95.');
}

function density95(p,T,side,sat){
 let rho=side==='liquid'?(sat?.liquid.rho||1000):p*1000/(R95*T);
 if(T>=T95C)rho=p>30?700:Math.min(600,rho);
 for(let i=0;i<90;i++){const q=raw95(T,rho),err=q.p-p;if(q.drhodp>0&&Math.abs(err)<Math.max(2e-10,p*2e-11))return q;const step=err*q.drhodp;let ok=false;for(let f=1;f>2**-25;f/=2){const r=rho-f*step;if(!(r>0&&r<1800)||(side==='liquid'&&sat&&r<sat.liquid.rho*(1-1e-7))||(side==='vapor'&&sat&&r>sat.vapor.rho*(1+1e-7)))continue;const n=raw95(T,r);if(n.drhodp>0&&Math.abs(n.p-p)<Math.abs(err)){rho=r;ok=true;break;}}if(!ok)break;}
 // Stable phase-specific bracket; never select an unstable intermediate root.
 let lo=side==='liquid'?sat?.liquid.rho||D95C:1e-12,hi=side==='vapor'?sat?.vapor.rho||D95C:1800;
 for(let i=0;i<100;i++){const mid=(lo+hi)/2,q=raw95(T,mid);if(Math.abs(q.p-p)<Math.max(2e-10,p*2e-11)&&q.drhodp>0)return q;if(q.p>p)hi=mid;else lo=mid;}
 throw Error('IAPWS-95: не знайдено стабільний корінь густини.');
}
export function solvePT95(p,T){bounds95(p,T);let sat,side;if(T<T95C){sat=saturationT95(T);if(Math.abs(p-sat.p)<Math.max(3e-10,sat.p*1e-9))return {saturation:sat,ambiguous:true};side=p>sat.p?'liquid':'vapor';}const q=density95(p,T,side,sat);return {state:decorate95({...q,p},side==='liquid'?'Стиснена рідина':side==='vapor'?'Перегріта пара':p>=P95C?'Надкритичний флюїд':'Газ / перегріта пара')};}
function mixture95(sat,x){if(!Number.isFinite(x)||x<0||x>1)throw Error('Ступінь сухості має бути 0…1.');if(x===0)return {...sat.liquid};if(x===1)return {...sat.vapor};const blend=k=>sat.liquid[k]+x*(sat.vapor[k]-sat.liquid[k]),v=blend('v'),q={...sat.liquid,x,phase:'Двофазна суміш',v,rho:1/v,h:blend('h'),s:blend('s'),u:blend('u'),sigma:surfaceTension(sat.T)};for(const k of ['cp','cv','w','mu','nu','lambda','diffusivity','Pr','dc','alpha','kappa','dvdt','dvdp','dpdt','dpdv','jt','ijt','isentropic','drhodp'])q[k]=null;return {...q,A:q.u-q.T*q.s,G:q.h-q.T*q.s,Z:1000*q.p*q.v/R95/q.T,notes:['Двофазна суміш IAPWS-95: h,s,u,v — масовий баланс фаз; похідні та транспортні властивості суміші не визначаються усередненням.']};}
export function inverse95(p,target,key){if(!Number.isFinite(target))throw Error('Введіть скінченне значення.');bounds95(p,Math.max(715,273.16));let sat;if(p>=.000611654771&&p<P95C){sat=saturationP95(p);const tolerance=key==='s'?2e-12:2e-9;if(Math.abs(target-sat.liquid[key])<=tolerance)return {state:{...sat.liquid},saturation:sat};if(Math.abs(target-sat.vapor[key])<=tolerance)return {state:{...sat.vapor},saturation:sat};if(target>=sat.liquid[key]&&target<=sat.vapor[key])return {state:mixture95(sat,(target-sat.liquid[key])/(sat.vapor[key]-sat.liquid[key])),saturation:sat};}
 // Use the already calculated phase endpoints as inverse brackets. A fixed
 // 1e-7 K offset can still lie inside solvePT95's saturation ambiguity band,
 // especially at low pressure, and falsely reject a valid compressed liquid.
 let lo=lowerT95(p),hi=1273,L,H;if(sat){if(target<sat.liquid[key]){hi=sat.T;H=sat.liquid;}else{lo=sat.T;L=sat.vapor;}}
 // The inverse target selects the stable phase outside the coexistence range.
 // A P-T ambiguity band must not erase that extra information near an endpoint.
 const side=sat?(target<sat.liquid[key]?'liquid':'vapor'):null;
 const at=T=>{const result=solvePT95(p,T);if(result.state||!side)return result;return {state:decorate95({...density95(p,T,side,result.saturation),p},side==='liquid'?'Стиснена рідина':'Перегріта пара')};};
 L??=at(lo).state;H??=at(hi).state;if(!L||!H||target<L[key]||target>H[key])throw Error('Значення поза реалізованими межами IAPWS-95.');
 for(let i=0;i<70;i++){const T=(lo+hi)/2,result=at(T),q=result.state;if(!q)throw Error('Інверсія потрапила на неоднозначне насичення.');if(Math.abs(q[key]-target)<(key==='s'?2e-12:2e-9))return result;if(q[key]>target)hi=T;else lo=T;}throw Error('Інверсія IAPWS-95 не збіглася.');}
export function calculate95(mode,a,b){switch(mode){case 'pt':return solvePT95(a,b);case 'pu':return inverse95(a,b,'u');case 'ph':return inverse95(a,b,'h');case 'ps':return inverse95(a,b,'s');case 'satp':return {saturation:saturationP95(a)};case 'satt':return {saturation:saturationT95(a)};case 'px':{const sat=saturationP95(a);return {state:mixture95(sat,b),saturation:sat};}case 'tx':{const sat=saturationT95(a);return {state:mixture95(sat,b),saturation:sat};}case 'hs':return solveHS95(a,b);default:throw Error('Невідомий режим IAPWS-95.');}}
export function solveHS95(h,s){
 if(!Number.isFinite(h)||!Number.isFinite(s))throw Error('h і s мають бути скінченними.');
 // First search the equilibrium dome, solving h and s with one common quality.
 const domeTemperatures=Array.from({length:71},(_,i)=>273.16+(T95C-.0001-273.16)*i/70);
 for(let k=-8;k<=32;k++)domeTemperatures.push(T95C-10**(-k/8));domeTemperatures.sort((a,b)=>a-b);
 let prev=null;for(const T of domeTemperatures){let sat;try{sat=saturationT95(T);}catch{prev=null;continue;}const x=(h-sat.liquid.h)/sat.latentHeat;if(x<0||x>1){prev=null;continue;}const e=sat.liquid.s+x*(sat.vapor.s-sat.liquid.s)-s;if(Math.abs(e)<1e-9)return {state:mixture95(sat,x),saturation:sat};if(prev&&e*prev.e<0){let lo=prev.T,hi=T,elo=prev.e;for(let k=0;k<65;k++){const t=(lo+hi)/2,a=saturationT95(t),q=(h-a.liquid.h)/a.latentHeat,err=a.liquid.s+q*(a.vapor.s-a.liquid.s)-s;if(Math.abs(err)<1e-9&&q>=0&&q<=1)return {state:mixture95(a,q),saturation:a};if(err*elo>0){lo=t;elo=err;}else hi=t;}}prev={T,e};}
 // Two-variable analytic Newton: log density and log temperature. Each solution
 // is checked against the stable P-T phase, so metastable/spurious roots are rejected.
 for(const [T0,r0] of [[300,1000],[450,900],[600,700],[650,350],[750,500],[900,800],[400,.01],[500,1],[700,10],[900,50],[1200,1]]){let T=T0,rho=r0;for(let k=0;k<70;k++){const q=raw95(T,rho),eh=q.h-h,es=q.s-s;if(Math.abs(eh)<2e-6&&Math.abs(es)<2e-8){try{const stable=solvePT95(q.p,T).state;if(stable&&Math.abs(stable.rho-rho)<rho*1e-7)return {state:stable};}catch{}break;}
 const dpdt=q.alpha*q.rho/q.drhodp,dpdr=1/q.drhodp,a=1000*(dpdr-T*dpdt/rho),b=T*q.cv+1000*T*dpdt/rho,c=-1000*dpdt/rho,d=q.cv,det=a*d-b*c;
 const dr=(-eh*d+b*es)/det,dt=(-a*es+c*eh)/det;let ok=false;for(let f=1;f>2**-20;f/=2){const rn=rho*Math.exp(f*dr),tn=T*Math.exp(f*dt);if(!(rn>1e-12&&rn<1800&&tn>=273.16&&tn<=1273))continue;const n=raw95(tn,rn);if(Math.hypot((n.h-h)/1000,n.s-s)<Math.hypot(eh/1000,es)){rho=rn;T=tn;ok=true;break;}}if(!ok)break;}}
 throw Error('IAPWS-95: не знайдено стабільний стан h–s у реалізованих межах.');
}
