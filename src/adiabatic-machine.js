import {calculate} from './engine.js';
// An efficiency fixes the outlet, not an internal equilibrium trajectory.
export function adiabaticMachine(start,pressure,eta,model){
 if(!['IF97','IAPWS-95'].includes(model)||!Number.isFinite(eta)||eta<=0||eta>1||!Number.isFinite(pressure)||pressure<=0||pressure===start.p)throw Error('Адіабатне обладнання: вода, різні додатні тиски та 0 < ηₛ ≤ 1. / Adiabatic machinery requires water, different positive pressures and 0 < eta_s <= 1.');
 const get=(mode,a,b)=>{const r=calculate(mode,a,b,model);if(!r.state||r.alternatives?.length)throw Error('Неоднозначний стан обладнання. / Ambiguous machinery state.');return r.state;},ideal=get('ps',pressure,start.s),compression=pressure>start.p,h=start.h+(ideal.h-start.h)*(compression?1/eta:eta),finish=eta===1?ideal:get('ph',pressure,h),dh=finish.h-start.h,ds=finish.s-start.s,tolerance=.005+1e-5*Math.max(Math.abs(start.h),Math.abs(finish.h));
 if(![h,dh,ds].every(Number.isFinite)||ds< -2e-7||(compression?dh<=0:dh>=0)||Math.abs(finish.h-h)>tolerance)throw Error('Фізично некоректний вихід обладнання. / Invalid machinery outlet.');
 return {states:[start,finish],ideal,eta,compression,schematic:true,path:[start,finish],heat:0,technicalWork:-dh,boundaryWork:null,dh,du:finish.u-start.u,ds,entropyGeneration:ds,residual:0,flowResidual:finish.h-h,tolerance,refinement:null,segments:0,converged:true};
}
