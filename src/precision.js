// Double-double arithmetic for cancellation-prone critical equations. Ordinary
// states keep the Number path. Parse published decimal constants before rounding.
const hpSplit=134217729;
export const hpAdd=(a,b)=>{const s=a[0]+b[0],v=s-a[0],e=(a[0]-(s-v))+(b[0]-v)+a[1]+b[1],h=s+e;return [h,e-(h-s)];};
export const hpNeg=a=>[-a[0],-a[1]];
export const hpSub=(a,b)=>hpAdd(a,hpNeg(b));
export function hpMul(a,b){const p=a[0]*b[0],ca=hpSplit*a[0],cb=hpSplit*b[0],ah=ca-(ca-a[0]),bh=cb-(cb-b[0]),al=a[0]-ah,bl=b[0]-bh,e=((ah*bh-p)+ah*bl+al*bh)+al*bl+a[0]*b[1]+a[1]*b[0]+a[1]*b[1],h=p+e;return [h,e-(h-p)];}
export function hpDiv(a,b){const q=a[0]/b[0],r=hpSub(a,hpMul([q,0],b)),q2=(r[0]+r[1])/b[0];return hpAdd([q,0],[q2,0]);}
export function hpIntPow(a,n){if(n<0)return hpDiv([1,0],hpIntPow(a,-n));let r=[1,0];for(;n;n=Math.floor(n/2),a=hpMul(a,a))if(n%2)r=hpMul(r,a);return r;}
export const hpValue=a=>a[0]+a[1];
export function hpDecimal(value){const text=String(value),parts=text.toLowerCase().split('e'),negative=parts[0][0]==='-',mantissa=parts[0].replace(/^[+-]/,''),fraction=mantissa.split('.')[1]||'',digits=mantissa.replace('.','');let r=[0,0];for(const c of digits)r=hpAdd(hpMul(r,[10,0]),[Number(c),0]);const exponent=Number(parts[1]||0)-fraction.length;r=exponent>=0?hpMul(r,hpIntPow([10,0],exponent)):hpDiv(r,hpIntPow([10,0],-exponent));return negative?hpNeg(r):r;}
const hpLn2=hpDecimal('0.693147180559945309417232121458176568');
export function hpExp(a){const k=Math.round(a[0]/Math.LN2),x=hpSub(a,hpMul([k,0],hpLn2));let term=[1,0],sum=[1,0];for(let n=1;n<=40;n++){term=hpDiv(hpMul(term,x),[n,0]);sum=hpAdd(sum,term);if(Math.abs(term[0])<1e-33)break;}return hpMul(sum,[2**k,0]);}
export function hpLog(a){if(!(a[0]>0))throw Error('Precision logarithm requires a positive argument');const k=Math.floor(Math.log2(a[0])),m=hpDiv(a,[2**k,0]),z=hpDiv(hpSub(m,[1,0]),hpAdd(m,[1,0])),z2=hpMul(z,z);let term=z,sum=z;for(let n=3;n<160;n+=2){term=hpMul(term,z2);const part=hpDiv(term,[n,0]);sum=hpAdd(sum,part);if(Math.abs(part[0])<1e-33)break;}return hpAdd(hpMul([2,0],sum),hpMul([k,0],hpLn2));}
export const hpPow=(a,b)=>Number.isInteger(b)?hpIntPow(a,b):hpExp(hpMul(Array.isArray(b)?b:hpDecimal(b),hpLog(a)));
// evaluate supplies a pressure residual subtracted before rounding, and dp/dρ.
export function criticalDensityRoot(p,side,evaluate,model){
 let lo=200,hi=500;
 if(side){let unstable=322,stable=side==='liquid'?hi:lo;
  if(!(evaluate(unstable).slope>0)){for(let i=0;i<48;i++){const mid=(unstable+stable)/2;if(mid===stable||mid===unstable)break;if(evaluate(mid).slope>0)stable=mid;else unstable=mid;}}
  else stable=unstable;
  if(side==='liquid')lo=stable;else hi=stable;
 }
 const L=evaluate(lo),H=evaluate(hi);
 if(L.error>0||H.error<0)throw Error(model==='IF97'?'Біля критичної точки тиск не має кореня на вибраній стабільній гілці; рівняння насичення IF97 та області 3 можуть бути неузгодженими.':'IAPWS-95: не знайдено кореня на вибраній стабільній гілці.');
 let rho=(lo+hi)/2,best;
 for(let i=0;i<100;i++){
  const q=evaluate(rho),step=q.error/q.slope;
  if(q.slope>0&&(!best||Math.abs(step)<Math.abs(best.step)))best={...q,step};
  if(q.slope>0&&Math.abs(step)<=rho*2e-15)return {...q.state,p};
  if(q.error>0)hi=rho;else lo=rho;
  if(hi-lo<=rho*8*Number.EPSILON)break;
  const next=rho-step;rho=q.slope>0&&next>lo&&next<hi?next:(lo+hi)/2;
 }
 if(best&&Math.abs(best.step)<=best.state.rho*1e-12)return {...best.state,p};
 throw Error('Не вдалося уточнити густину біля критичної точки до потрібної точності.');
}
