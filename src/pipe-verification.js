// Canonical SI contract for the deliberately small, checked fluids workflow.
export const PIPE_VERIFICATION_UNITS={area:'m2',mu:'Pa s',nu:'m2/s',mass:'kg/s',volume:'m3/s',velocity:'m/s',Re:'1',dynamicPressure:'Pa',factor:'1',fanningFactor:'1',frictionPressure:'Pa',localPressure:'Pa',lossPressure:'Pa',lossHead:'m',requiredHead:'m',pumpHead:'m',hydraulicPower:'W',shaftPower:'W'};
export const PIPE_VERIFICATION_INPUT_UNITS={rho:'kg/m3',mu:'Pa s',velocity:'m/s',diameter:'m',length:'m',roughness:'m',localK:'1',efficiency:'1',heightDifference:'m',pressureDifference:'Pa'};
export function pipeVerificationPayload(flow,hydraulics,frictionMethod){
 if(!['Clamond','Colebrook'].includes(frictionMethod))throw Error('Unknown fluids pipe friction method.');
 return {rho:flow.rho,mu:flow.mu,velocity:flow.velocity,diameter:flow.diameter,...Object.fromEntries(['length','roughness','localK','efficiency','heightDifference','pressureDifference'].map(key=>[key,hydraulics[key]])),frictionMethod};
}
export function comparePipeVerification(flow,hydraulics,result){
 const control={...flow,...hydraulics},absoluteTolerance=1e-10,relativeTolerance=5e-11;
 const rows=Object.entries(PIPE_VERIFICATION_UNITS).map(([key,unit])=>{
  const expected=control[key],actual=result[key];
  if(!((actual===null||Number.isFinite(actual))&&(expected===null||Number.isFinite(expected))))throw Error('Invalid pipe verification quantity: '+key);
  const difference=actual===null||expected===null?null:actual-expected,absoluteDifference=difference===null?null:Math.abs(difference);
  return {key,unit,control:expected,fluids:actual,difference,relativeDifference:difference===null||expected===0?null:difference/Math.abs(expected),passed:actual===null||expected===null?actual===expected:absoluteDifference<=absoluteTolerance+relativeTolerance*Math.max(Math.abs(actual),Math.abs(expected))};
 });
 return {passed:rows.every(row=>row.passed),absoluteTolerance,relativeTolerance,rows};
}
