import {CalculationModuleError,createCalculationRequest,createLegacyCalculationRequest,validateCalculationReply,normalizeCalculationRequest} from './calculation-protocol.js';

// One background operation at a time. Termination also interrupts synchronous
// numerical searches; a cancellation message alone cannot do that.
export function createCalculationRunner(createWorker,timeoutMs=60000){
 let worker=null,pending=null,sequence=0;
 const error=(code,message,details)=>new CalculationModuleError(code,message,details);
 const finish=(failure,value)=>{const task=pending;if(!task)return;pending=null;clearTimeout(task.timer);task.signal?.removeEventListener('abort',task.abort);if(failure)task.reject(failure);else task.resolve(value);};
 const stop=()=>{worker?.terminate();worker=null;};
 const fail=(code,message)=>{stop();finish(error(code,message));};
 function execute(makeRequest,{signal}={}){
  if(pending)return Promise.reject(error('busy','A calculation is already running.'));
  if(signal!=null&&(typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))return Promise.reject(error('invalid-input','A valid AbortSignal is required.'));
  if(signal?.aborted)return Promise.reject(error('cancelled','Calculation cancelled.'));
  let request;try{request=makeRequest(++sequence);normalizeCalculationRequest(request);}catch(failure){return Promise.reject(failure);}
  return new Promise((resolve,reject)=>{
   pending={id:request.id,request,resolve,reject,signal,abort:()=>fail('cancelled','Calculation cancelled.'),timer:setTimeout(()=>fail('timeout','Calculation time limit exceeded.'),timeoutMs)};
   signal?.addEventListener('abort',pending.abort,{once:true});
   try{
    if(!worker){
     const current=worker=createWorker();
     current.onmessage=event=>{
      if(worker!==current||event.data?.id!==pending?.id)return;
      let reply;try{reply=validateCalculationReply(pending.request,event.data);}catch(failure){stop();finish(failure);return;}
      if(reply.status==='error')finish(error(reply.error.code,reply.error.message,reply.error.details));else finish(null,reply);
     };
     current.onerror=event=>{event.preventDefault?.();if(worker===current)fail('unavailable','Background calculation could not start.');};
     current.onmessageerror=()=>{if(worker===current)fail('unavailable','Background result could not be read.');};
    }
    worker.postMessage(request);
   }catch(failure){if(failure?.name==='DataCloneError')fail('invalid-input','Calculation arguments could not be transferred.');else fail('unavailable','Background calculation could not start.');}
  });
 }
 const legacy=(type,payload)=>execute(id=>createLegacyCalculationRequest(id,type,payload)).then(reply=>reply.result);
 return {
  run:(moduleId,methodId,payload,options={})=>execute(id=>createCalculationRequest({id,moduleId,methodId,payload,engineVersion:options.engineVersion,inputUnits:options.inputUnits}),options),
  calculate:(mode,a,b,model,options)=>legacy('calculate',{mode,a,b,model,...(options?{options}:{})}),
  readProject:text=>legacy('project',{text}),
  gasTable:(mode,p,value,fractions,basis,options)=>legacy('gas-bsw2003',{mode,p,value,fractions,basis,...(options?{options}:{})}),
  customCycle:(input,model)=>legacy('custom-cycle',{input,model}),
  libraryCycle:input=>legacy('library-cycle',{input}),
  rankineSweep:input=>legacy('rankine-sweep',{input}),
  studyReport:(title,report,options)=>legacy('study-report-html',{title,report,options}),
  compareCycles:input=>legacy('cycle-comparison',{input}),
  cyclePreset:(name,model)=>legacy('cycle-preset',{name,model}),
  waterProcess:(input,model)=>legacy('water-process',{input,model}),
  cancel(){if(!pending)return false;stop();finish(error('cancelled','Calculation cancelled.'));return true;},
  get busy(){return pending!==null;}
 };
}
