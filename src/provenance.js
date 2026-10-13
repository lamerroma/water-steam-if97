// Export provenance describes the software producing the file, not a historical calculation.
export function readExportMetadata(value){
 if(value==null)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid export metadata.');
 const out={};
 for(const key of ['appVersion','buildId','method','model']){
  const text=value[key];if(typeof text!=='string'||text.length>160||/[\x00-\x1f]/.test(text))throw Error('Invalid export metadata.');
  out[key]=text;
 }
 return out;
}
export function exportMetadata(build,method,model){return readExportMetadata({appVersion:build.version,buildId:build.id,method,model});}
const provenanceEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function exportWithMetadata(content,type,metadata,english=false){
 const m=readExportMetadata(metadata);
 if(type.startsWith('application/json')){
  const data=JSON.parse(content);if(!data||typeof data!=='object'||Array.isArray(data))return content;
  return JSON.stringify({...data,exportedWith:m},null,2);
 }
 if(type.startsWith('text/html')){
  const label=english?'Exported with / method':'Експортовано програмою / метод';
  const note=english?'Export version; the original calculation version is not inferred.':'Версія експорту; версія первісного розрахунку не визначається за нею.';
  const footer=`<footer data-export-provenance><p>${label}: ${[m.appVersion,m.buildId,m.method,m.model].map(provenanceEscape).join(' · ')}.</p><p>${note}</p></footer>`;
  return /<\/body>/i.test(content)?content.replace(/<\/body>/i,footer+'</body>'):/<\/html>/i.test(content)?content.replace(/<\/html>/i,footer+'</html>'):content+footer;
 }
 if(!type.startsWith('text/csv'))return content;
 // Split logical records, preserving embedded newlines and escaped quotes.
 const bom=content.startsWith('\uFEFF')?'\uFEFF':'',records=[];
 let start=bom.length,quoted=false,commas=0,semicolons=0,delimiter=null,newline='\r\n';
 for(let i=start;i<content.length;i++){
  const c=content[i];
  if(c==='"'){if(quoted&&content[i+1]==='"'){i++;continue;}quoted=!quoted;}
  if(!quoted){
   if(delimiter===null){if(c===',')commas++;if(c===';')semicolons++;}
   if(c==='\r'||c==='\n'){
    if(delimiter===null){delimiter=semicolons>commas?';':',';newline=c==='\r'&&content[i+1]==='\n'?'\r\n':c;}
    records.push(content.slice(start,i));if(c==='\r'&&content[i+1]==='\n')i++;start=i+1;
   }
  }
 }
 if(quoted)throw Error('Unclosed CSV quote.');
 if(start<content.length)records.push(content.slice(start));
 if(!records.length)return content;
 delimiter??=semicolons>commas?';':',';
 const cell=v=>'"'+String(/^[=+\-@]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';
 const header=['export_app_version','export_build_id','export_method','export_model'].map(cell).join(delimiter);
 const values=[m.appVersion,m.buildId,m.method,m.model].map(cell).join(delimiter);
 return bom+records.map((row,i)=>row?row+delimiter+(i===0?header:values):row).join(newline)+(start===content.length?newline:'');
}
