// Developer inventory integrity. No scientific acceptance is inferred here.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const stageNames=['catalog','types','units','geometry','domain','dependencies','numerical','dedicatedUI','persistence','exports','coldOffline'];

export function validateLibraryRegistry(surface,profiles){
 requireValue(surface.schemaVersion===1,'Unsupported library registry schema');
 requireValue(surface.summary.globalNumericalCoveragePercent===null,'Inventory cannot claim global numerical coverage');
 const records=new Map(),aliases=new Map(),classes=new Map();
 for(const record of surface.records){
  requireValue(!records.has(record.id),'Duplicate record ID: '+record.id);records.set(record.id,record);
  requireValue(['ht','fluids'].includes(record.package)&&record.id.startsWith(record.package+'@'+record.version+':'),'Invalid scoped ID: '+record.id);
  requireValue(['function','class','class-member','data'].includes(record.kind),'Unknown record kind');
  requireValue(Object.keys(record.stages).sort().join('|')===[...stageNames].sort().join('|'),'Incomplete acceptance stages: '+record.id);
  for(const [stage,status] of Object.entries(record.stages)){
   const allowed=stage==='catalog'?[record.kind==='class-member'?'member_only':'observed']:stage==='numerical'&&record.knownIssues?.length?['known_discrepancy']:['unreviewed'];
   requireValue(allowed.includes(status),'Unjustified acceptance promotion: '+record.id+' '+stage);
  }
  requireValue(['types','units','geometry','domain','dependencies'].every(key=>record.contracts[key]===null),'Generated observations cannot become reviewed contracts');
  if(record.source.status==='pinned-package-source')requireValue(digest(record.source.sha256)&&surface.sourceFiles[record.source.path]===record.source.sha256,'Stale source link: '+record.id);
  if(record.kind==='class')classes.set(record.id,record);
  if(record.kind!=='class-member'){
   requireValue(record.aliases.length>0&&record.aliases.includes(record.canonical),'Missing canonical alias: '+record.id);
   for(const alias of record.aliases){requireValue(!aliases.has(alias),'Duplicate public path: '+alias);aliases.set(alias,record.id);}
  }
 }
 requireValue(aliases.size===Object.keys(surface.pathIndex).length,'Public path count differs from aliases');
 for(const [alias,id] of aliases)requireValue(surface.pathIndex[alias]===id,'Broken public path: '+alias);
 const kinds={};
 for(const record of records.values()){
  kinds[record.kind]=(kinds[record.kind]||0)+1;
  if(record.kind==='class-member')requireValue(classes.has(record.classObjectId),'Missing class owner');
  if(record.baseObjectId){
   requireValue(record.adapter==='numpy.vectorize'&&records.has(record.baseObjectId),'Invalid vectorized base');
   const seen=new Set([record.id]);let current=record;
   while(current.baseObjectId){requireValue(!seen.has(current.baseObjectId),'Cyclic adapter links');seen.add(current.baseObjectId);current=records.get(current.baseObjectId);requireValue(current,'Missing adapter base');}
  }
  if(record.upstreamDocumentation?.inheritedFrom)requireValue(record.upstreamDocumentation.inheritedFrom===record.baseObjectId,'Incorrect documentation inheritance');
  if(record.signature?.status==='runtime-dependent')for(const profile of profiles)requireValue(profile.signatures[record.signature.observationKey],'Missing runtime signature: '+record.id);
 }
 requireValue(surface.summary.records===records.size&&surface.summary.catalogPaths===aliases.size,'Incorrect inventory summary');
 requireValue(JSON.stringify(Object.entries(kinds).sort())===JSON.stringify(Object.entries(surface.summary.kinds).sort()),'Incorrect kind totals');
 for(const p of surface.packages){
  const own=[...records.values()].filter(r=>r.package===p.package);
  requireValue(own.filter(r=>r.kind==='class-member').length===p.staticClassMembers,'Incorrect class-member count');
  requireValue(own.filter(r=>r.kind==='data').length===p.dataBindings,'Incorrect data-binding count');
  requireValue(own.filter(r=>['class','function'].includes(r.kind)).length===p.callableObjects,'Incorrect callable count');
  requireValue(own.filter(r=>['class','function'].includes(r.kind)&&!r.baseObjectId).length===p.baseObjectFamilies,'Incorrect family count');
  requireValue([...aliases.keys()].filter(name=>name.startsWith(p.package+'.')).length===p.catalogPaths,'Incorrect package path count');
  for(const blocked of p.unavailableModules)requireValue(blocked.reason&&blocked.exportScopeStatus==='unresolved_optional_variant'&&surface.sourceFiles[blocked.path]===blocked.sha256,'Unrecorded optional scope/dependency');
 }
 for(const [name,value] of Object.entries(surface.sourceFiles))requireValue(/^(ht|fluids)\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.py$/.test(name)&&digest(value),'Invalid pinned source path/hash');
 for(const profile of profiles)for(const key of Object.keys(profile.signatures))requireValue(records.get(key)?.signature?.observationKey===key,'Unlinked runtime signature: '+key);
 return {records:records.size,paths:aliases.size,knownDiscrepancyRecords:surface.records.filter(r=>r.stages.numerical==='known_discrepancy').length};
}

export function validateLibraryControls(controls,surface){
 const ids=new Set();
 for(const c of controls.cases){
  requireValue(!ids.has(c.id),'Duplicate control ID');ids.add(c.id);
  const target=surface.records.find(r=>r.id===surface.pathIndex[c.target]);requireValue(target,'Control target absent');
  requireValue(typeof c.expected==='number'&&Number.isFinite(c.expected),'Elementary reference must stay numeric');
  if(c.disposition==='known_upstream_discrepancy'){
   requireValue(JSON.stringify(c.expected)!==JSON.stringify(c.observedUpstream),'Known discrepancy hides its reference');
   requireValue(target.knownIssues?.some(i=>i.code===c.issueCode),'Known discrepancy lacks a linked issue');
  }else requireValue(c.disposition===undefined,'Unknown control disposition');
 }
}

export function validateReviewedLibraryContracts(contracts,surface){
 const seen=new Set(),records=new Map(surface.records.map(r=>[r.id,r]));
 requireValue(contracts.schemaVersion===1,'Unsupported reviewed-contract schema');
 for(const contract of contracts.records){
  const record=records.get(contract.id);requireValue(record&&!seen.has(contract.id),'Missing/duplicate reviewed contract');seen.add(contract.id);
  requireValue(contract.sourceSHA256===record.source.sha256,'Reviewed contract source changed');
  requireValue(contract.reviewStatus==='partial_review'&&contract.numericalAcceptance==='not_granted','Partial contract cannot grant global numerical acceptance');
  for(const field of ['types','units','geometry','domain','dependencies','scope'])requireValue(contract[field]!==null&&contract[field]!==undefined,'Missing partial contract field: '+field);
 }
}

export async function checkManagedLibraryRegistry(){
 const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
 const surface=await read('docs/library-registry/surface.json');
 const profiles=await Promise.all(['native','pyodide'].map(name=>read('docs/library-registry/runtime-signatures-'+name+'.json')));
 const result=validateLibraryRegistry(surface,profiles);
 for(const [file,key] of [['src/python-library-bridge.py','bridgeSHA256'],['scripts/reference/library_registry_collector.py','collectorSHA256'],['vendor/python/manifest.json','vendorManifestSHA256']])requireValue(sha(await readFile(path.join(root,file)))===surface.inputs[key],'Stale registry input: '+file);
 const vendor=await read('vendor/python/manifest.json');
 for(const [name,wheel] of Object.entries(surface.inputs.wheels)){
  requireValue(vendor.packages[name].version===wheel.version,'Package pin changed');
  requireValue(sha(await readFile(path.join(root,'vendor/python',wheel.file)))===wheel.sha256,'Wheel checksum changed');
 }
 const controls=await read('docs/library-registry/controls.json');
 validateLibraryControls(controls,surface);
 validateReviewedLibraryContracts(await read('docs/library-registry/reviewed-contracts.json'),surface);
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))checkManagedLibraryRegistry().then(result=>console.log('Library registry integrity PASS '+JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
