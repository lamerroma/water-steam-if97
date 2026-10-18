// If coexistence cannot be resolved near Pc, a forward-validated single-phase
// bracket can still establish a remote hot/cold inverse. Never interpolate
// through the unresolved phase interval or substitute a critical mixture.
const phaseBracketCache=new WeakMap();
export function resolvedSinglePhaseBracket(p,target,key,Tc,rhoc,forward){
 const stable=q=>q&&q.x==null&&q.cp>0&&q.cv>0&&q.drhodp>0&&
  ['h','s','u'].every(k=>Number.isFinite(q[k]))&&q.cp-1000*p*q.v*q.alpha>0;
 const boundary=direction=>{
  // A hot probe needs no coexistence calculation. Start the cold probe well
  // below Tc, then refine it toward Tc only when the target needs that detail.
  // One kelvin is an initial search step, never a fixed exclusion or tolerance.
  let step=direction>0?Number.EPSILON*Tc:1;
  for(let i=0;i<52;i++,step*=2){
   const T=Tc+direction*step;if(!(T>0))break;
   try{const q=forward(p,T).state;if(stable(q)&&(direction>0||q.rho>rhoc))return q;}catch{}
  }
 };
 let cache=phaseBracketCache.get(forward);if(!cache){cache=new Map();phaseBracketCache.set(forward,cache);}
 let entry=cache.get(p);
 if(!entry||entry.Tc!==Tc||entry.rhoc!==rhoc){
  entry={Tc,rhoc,hot:boundary(1),cold:boundary(-1)};
  // Reuse forward-validated states across h/s/u. A colder target needs no
  // extra coexistence work; a closer target can refine the cold anchor below.
  if(entry.hot&&entry.cold){if(cache.size>=64)cache.clear();cache.set(p,entry);}
 }
 const {hot}=entry;let {cold}=entry;
 if(!hot||!cold)return null;
 for(let i=0;i<52&&target>=Math.min(hot[key],cold[key])&&target<=Math.max(hot[key],cold[key]);i++){
  const T=Tc-(Tc-cold.T)/2;if(T===Tc||T===cold.T)break;
  try{const q=forward(p,T).state;if(!stable(q)||q.rho<=rhoc)break;cold=q;entry.cold=q;}catch{break;}
 }
 // Include both certified anchors in the excluded interval, even if rounding
 // or IF97 consistency error reverses their extremely close property values.
 if(target>Math.max(hot[key],cold[key]))return {lo:hot.T,L:hot};
 if(target<Math.min(hot[key],cold[key]))return {hi:cold.T,H:cold};
 // Quality/endpoint targets within the unresolved interval still need a
 // successful coexistence solve; the caller retains its original phase error.
 return null;
}
