import {rankine,rankineReheat,rankineRegen,brayton} from './cycles.js';
export const CYCLE_DEFAULT={type:'rankine',pLow:.01,pHigh:10,pMid:2,Tmin:300,Tmax:773.15,Tmid:773.15,etaT:.85,etaC:.8,flow:1};
export function solveCycle(input=CYCLE_DEFAULT,model='IF97'){
 const a={...CYCLE_DEFAULT,...input};if(!['rankine','rankine-reheat','rankine-regen','brayton'].includes(a.type))throw Error('Невідомий тип циклу.');
 const q=a.type==='brayton'?brayton(a.pLow,a.pHigh,a.Tmin,a.Tmax,a.etaT,a.etaC,a.flow):a.type==='rankine-reheat'?rankineReheat(a.pHigh,a.pMid,a.pLow,a.Tmax,a.Tmid,a.etaT,a.etaC,a.flow,model):a.type==='rankine-regen'?rankineRegen(a.pHigh,a.pMid,a.pLow,a.Tmax,a.etaT,a.etaC,a.flow,model):rankine(a.pHigh,a.pLow,a.Tmax,a.etaT,a.etaC,a.flow,model);
 const names=a.type==='rankine-regen'?['T1','E1','T2','C1','P1','F1','P2']:q.states.map((_,i)=>'S'+(i+1));
 const edges=a.type==='rankine-regen'?[[0,1],[1,2],[2,3],[3,4],[4,5],[1,5],[5,6],[6,0]]:q.states.map((_,i)=>[i,(i+1)%q.states.length]);
 return {...q,input:a,states:q.states.map((s,i)=>({...s,name:names[i]})),edges,balanceResidual:q.heat-q.rejected-q.net,extractionFraction:a.type==='rankine-regen'?(q.states[5].h-q.states[4].h)/(q.states[1].h-q.states[4].h):null};
}
