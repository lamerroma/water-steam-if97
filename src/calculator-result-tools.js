import {SMART_PAIRS} from './smart-input.js';
// Clipboard numbers match displayed precision, without thousands separators.
export function calculatorCopyValue(value,unit,{digits=8,locale='uk-UA',includeUnit=true}={}){
 if(!Number.isFinite(value))return null;
 const text=new Intl.NumberFormat(locale,{useGrouping:false,maximumSignificantDigits:digits,notation:Math.abs(value)>0&&Math.abs(value)<1e-4?'scientific':'standard'}).format(value);
 return text+(includeUnit&&unit&&unit!=='–'?' '+unit:'');
}
// Restore the recorded input pair; legacy snapshots have no source metadata.
export function calculatorHistoryInput(state){
 const s=state.source,pair=SMART_PAIRS[s?.mode];
 if(pair&&Number.isFinite(s.a)&&(pair[1]==='sat'||Number.isFinite(s.b)))return {mode:s.mode,a:s.a,b:pair[1]==='sat'?0:s.b};
 if(state.critical)return {mode:'pt',a:state.p,b:state.T};
 if(Number.isFinite(state.x)&&state.x>=0&&state.x<=1)return {mode:'px',a:state.p,b:state.x};
 return {mode:'ph',a:state.p,b:state.h};
}
