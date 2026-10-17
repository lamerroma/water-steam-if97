// Controlled experiment: same EOS, inputs, and stopping criterion, replacing
// only the adaptive cubic integral by the previous fixed linear integral.
import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{saturationT95}from'../src/iapws95.js';
const dir=process.env.ACCURACY_DIR||'.release/accuracy-followup',original=await readFile('src/iapws95.js','utf8');let control=original;
const start=control.indexOf('  for(const [direction,extent]'),end=control.indexOf('  return [e1,e2/gap];',start);if(start<0||end<0)throw Error('Cannot locate critical quadrature');
control=control.slice(0,start)+`  for(const [lo,hi]of [[v,1],[1,l]])for(let i=0;i<satNodes95.length;i++)for(const sign of [-1,1]){
   const half=(hi-lo)/2,offset=lo-mean+half*(1+sign*satNodes95[i]),delta=mean+offset,term=satWeights95[i]*half*B(delta);e1+=term;e2-=term*offset/(delta*mean);
  }
`+control.slice(end);
const adaptive='if(Math.max(Math.abs(dl),Math.abs(dv))<2e-14&&bl>0&&bv>0){if(validated||panels===8)return [l*D95C,v*D95C];panels*=2;validated=true;continue;}';if(!control.includes(adaptive))throw Error('Cannot locate quadrature convergence control');control=control.replace(adaptive,'if(Math.max(Math.abs(dl),Math.abs(dv))<2e-14&&bl>0&&bv>0)return [l*D95C,v*D95C];');
control=control.replace(/from '(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,new URL('../src/iapws95.js',import.meta.url)).href));
const prior=await import('data:text/javascript;base64,'+Buffer.from(control).toString('base64')),fixture=JSON.parse(await readFile(dir+'/reference.json')),records=[];
for(const T of[647.0959,647.0959993,647.0959998]){const before=prior.saturationT95(T),after=saturationT95(T);for(const[phase,x]of[['liquid',0],['vapor',1]]){const ref=fixture.records.find(r=>r.model==='IAPWS-95'&&r.mode==='satt'&&r.a===T&&r.phase===x).expected;records.push({T,phase,referenceCp:ref.cp,beforeCp:before[phase].cp,afterCp:after[phase].cp,beforeRelative:Math.abs(before[phase].cp/ref.cp-1),afterRelative:Math.abs(after[phase].cp/ref.cp-1)});}}
await writeFile(dir+'/quadrature-comparison.json',JSON.stringify({experiment:'Controlled comparison of fixed linear versus adaptive cubic quadrature; same independent reference and EOS',sourceSha256:createHash('sha256').update(original).digest('hex'),records},null,2)+'\n');console.log(records);
