// One background operation at a time. Termination also interrupts synchronous
// numerical searches; a cancellation message alone cannot do that.
export function createCalculationRunner(createWorker,timeoutMs=60000){
 let worker=null,pending=null,sequence=0;
 const error=(code,message)=>Object.assign(new Error(message),{code});
 const finish=(failure,value)=>{const task=pending;if(!task)return;pending=null;clearTimeout(task.timer);if(failure)task.reject(failure);else task.resolve(value);};
 const stop=()=>{worker?.terminate();worker=null;};
 const fail=(code,message)=>{stop();finish(error(code,message));};
 function execute(type,payload){
  if(pending)return Promise.reject(error('busy','A calculation is already running.'));
  return new Promise((resolve,reject)=>{
   const id=++sequence;pending={id,resolve,reject,timer:setTimeout(()=>fail('timeout','Calculation time limit exceeded.'),timeoutMs)};
   try{
    if(!worker){
     const current=worker=createWorker();
     current.onmessage=event=>{
      if(worker!==current||event.data?.id!==pending?.id)return;
      if(event.data.error)finish(error('calculation',event.data.error));else finish(null,event.data.result);
     };
     current.onerror=event=>{event.preventDefault?.();if(worker===current)fail('unavailable','Background calculation could not start.');};
     current.onmessageerror=()=>{if(worker===current)fail('unavailable','Background result could not be read.');};
    }
    worker.postMessage({id,type,payload});
   }catch{fail('unavailable','Background calculation could not start.');}
  });
 }
 return {
  calculate:(mode,a,b,model)=>execute('calculate',{mode,a,b,model}),
  readProject:text=>execute('project',{text}),
  waterProcess:(input,model)=>execute('water-process',{input,model}),
  cancel(){if(!pending)return false;stop();finish(error('cancelled','Calculation cancelled.'));return true;},
  get busy(){return pending!==null;}
 };
}
