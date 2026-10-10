// IAPWS R8-97, Eqs. (3)-(5),(7), Tables 1-2. Constants fixed by this release.
export function dielectric(T,rho){
 if(!Number.isFinite(T)||!Number.isFinite(rho)||T<238||T>873||rho<0)return null;
 const d=rho/322,t=647.096/T;
 const terms=[[.978224486826,1,.25],[-.957771379375,1,1],[.237511794148,1,2.5],[.714692244396,2,1.5],[-.298217036956,3,1.5],[-.108863472196,3,2.5],[.0949327488264,4,2],[-.00980469816509,5,2],[.000016516763497,6,5],[.0000937359795772,7,.5],[-.00000000012317921872,10,10]];
 const g=1+terms.reduce((s,[n,i,j])=>s+n*d**i*t**j,0)+.00196096504426*d*(T/228-1)**-1.2;
 const e0=1/(4e-7*Math.PI*299792458**2),NA=6.0221367e23,molar=rho/.018015268;
 const A=NA*(6.138e-30)**2*molar*g/(e0*1.380658e-23*T),B=NA*1.636e-40*molar/(3*e0);
 const value=(1+A+5*B+Math.sqrt(9+2*A+18*B+A*A+10*A*B+9*B*B))/(4-4*B);
 return Number.isFinite(value)&&value>=1?value:null;
}
