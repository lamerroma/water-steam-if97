import {PIPE_VERIFICATION_UNITS,PIPE_VERIFICATION_INPUT_UNITS} from './pipe-verification.js';
import {normalizeCalculationRequest,CalculationModuleError,calculationReplyIdentity,calculationErrorReply} from './calculation-protocol.js';
import {createPythonPackageManager} from './python-package.js';

const pythonWorkerBase=new URL('../',self.location.href);
let pythonBackend;
async function initializePythonBackend(request){
 const progress=stage=>self.postMessage({...calculationReplyIdentity(request),status:'progress',progress:{stage}});
 if(!(await createPythonPackageManager(PYTHON_PACKAGE,pythonWorkerBase).status()).ready)throw new CalculationModuleError('module-missing','Prepare the ht / fluids offline package first.');
 progress('runtime');
 const indexURL=new URL(PYTHON_PACKAGE.base+'pyodide/',pythonWorkerBase).href;
 const {loadPyodide}=await import(indexURL+'pyodide.mjs');
 const pyodide=await loadPyodide({indexURL,enableRunUntilComplete:false});
 progress('dependencies');await pyodide.loadPackage(['numpy','scipy']);
 const directory=pyodide.runPython('import sysconfig; sysconfig.get_paths()["purelib"]');
 for(const name of ['fluids','ht']){
  const response=await fetch(new URL(PYTHON_PACKAGE.base+PYTHON_PACKAGE.packages[name].file,pythonWorkerBase));
  if(!response.ok)throw new CalculationModuleError('module-missing','The local library package is missing.');
  pyodide.unpackArchive(new Uint8Array(await response.arrayBuffer()),'zip',{extractDir:directory});
 }
 progress('libraries');await pyodide.runPythonAsync(PYTHON_BRIDGE_SOURCE);
 const versions=JSON.parse(pyodide.runPython('json.dumps({name:importlib.metadata.version(name) for name in ("ht","fluids","numpy","scipy")})'));
 for(const [name,entry] of Object.entries(PYTHON_PACKAGE.packages))if(versions[name]!==entry.version)throw new CalculationModuleError('version-mismatch','Python package version does not match.',{name});
 return {pyodide,execute:pyodide.globals.get('_thermocalc_library_json')};
}
self.onmessage=async({data:request})=>{
 try{
  const {descriptor,payload}=normalizeCalculationRequest(request);
  if(!['ht','fluids'].includes(descriptor.id))throw new CalculationModuleError('unsupported-module','This worker executes ht / fluids.');
  if(!(await createPythonPackageManager(PYTHON_PACKAGE,pythonWorkerBase).status()).ready)throw new CalculationModuleError('module-missing','Prepare the ht / fluids offline package first.');
  pythonBackend??=initializePythonBackend(request).catch(error=>{pythonBackend=null;throw error;});
  const backend=await pythonBackend;
  const response=JSON.parse(backend.execute(JSON.stringify({module:request.moduleId,method:request.methodId,payload})));
  if(!response.ok)throw new CalculationModuleError(response.code,response.message);
  const outputs=response.description?.documentedUnits?.Returns??[];
  const pipe=request.methodId==='pipe-hydraulics';
  const quantities=pipe?Object.fromEntries(Object.entries(PIPE_VERIFICATION_UNITS).map(([key,unit])=>[key,{value:response.result[key],unit,status:response.result[key]===null?'unavailable':'available'}])):typeof response.result==='number'?{result:{value:response.result,unit:outputs.length===1?outputs[0].unit:null,status:'available',unitSource:'upstream-documentation'}}:{};
  self.postMessage({...calculationReplyIdentity(request),status:'ok',result:response.result,model:request.moduleId+' '+descriptor.engineVersion,quantities,
   units:pipe?{convention:'Canonical SI; explicit pipe workflow contract, no implicit unit conversion.',inputs:PIPE_VERIFICATION_INPUT_UNITS,outputs:PIPE_VERIFICATION_UNITS}:{convention:'Upstream documented units (generally SI); no automatic conversion.',inputs:response.description?.documentedUnits?.Parameters??[],outputs},
   warnings:[{code:'integration-only',message:'Library connected; comprehensive independent numerical acceptance is pending.'},...(response.description?.knownIssues??[])],
   validity:descriptor.validity,...(response.description?{description:response.description}:{})});
 }catch(error){self.postMessage(calculationErrorReply(request,error));}
};
