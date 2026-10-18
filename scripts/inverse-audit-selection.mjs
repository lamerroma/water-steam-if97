// Fixed, reviewable smoke subset. Full acceptance always uses the entire fixture.
export function inverseAuditTasks(fixture,quick=false){
 const all=fixture.records.flatMap(c=>c.modes.map(mode=>({c,mode,keys:fixture.modes[mode]})));
 if(!quick)return all;
 const selected=new Map(),keep=t=>{if(t)selected.set(t.c.id+':'+t.mode,t);};
 for(const model of ['IF97','IAPWS-95']){
  // Every inverse mode, in both a liquid and a vapor ordinary state.
  for(const liquid of [true,false])for(const mode of Object.keys(fixture.modes))keep(all.find(t=>t.c.model===model&&t.mode===mode&&t.c.group==='ordinary'&&(t.c.expected.rho>100)===liquid));
  for(const group of ['region-2-5','B23','region-1-3','critical','domain']){
   const rows=all.filter(t=>t.c.model===model&&t.c.group===group);
   for(const mode of ['ph','ps','pv','tv']){const matching=rows.filter(t=>t.mode===mode);keep(matching[0]);keep(matching.at(-1));}
  }
  for(const mode of ['pv','us','vs'])keep(all.find(t=>t.c.model===model&&t.c.group==='mixture'&&t.c.expected.p===1&&t.c.x===.5&&t.mode===mode));
 }
 keep(all.find(t=>t.c.id==='IAPWS-95-2066'&&t.mode==='us'));
 return [...selected.values()];
}
