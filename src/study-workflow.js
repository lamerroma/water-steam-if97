// Editorial reminders only: missing metadata must never block a report export.
export function studyReadiness(report){
 const entries=report.entries||[],issues=[];
 if(!entries.length)issues.push({key:'empty',target:null});
 for(const field of ['assignment','author','intro'])if(!String(report[field]||'').trim())issues.push({key:field,target:'study-'+field});
 entries.forEach((entry,index)=>{if(!String(entry.title||'').trim())issues.push({key:'title',index,target:'study-block-'+index});if(!String(entry.comment||'').trim())issues.push({key:'comment',index,target:'study-block-'+index});});
 return {count:entries.length,issues};
}
