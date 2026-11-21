// Shareable links: one calculation's inputs travel in the URL fragment, which
// browsers never send to the server. Opening the link replaces only that tab's
// inputs; results are always recomputed from the inputs, never read from the link.
import {WATER_MODELS} from './water-models.js';
import {readCalculation} from './workspace.js';

export const SHARE_HASH_PREFIX='#calc=';
export const SHARE_MAX_LENGTH=16000;
const SHARE_MODES=['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'];
const shareRecord=x=>x&&typeof x==='object'&&!Array.isArray(x);

function shareToBase64Url(text){
 const bytes=new TextEncoder().encode(text);let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function shareFromBase64Url(text){
 if(!/^[A-Za-z0-9_-]*$/.test(text))throw Error('share.invalid');
 const binary=atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4));
 return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));
}

// The main water/steam form is not a workspace panel: validate its few fields here.
function shareReadGeneral(form){
 if(!shareRecord(form))throw Error('share.invalid');
 const out={model:form.model??'IF97',mode:form.mode,a:form.a,b:form.b,ua:form.ua,ub:form.ub};
 if(!WATER_MODELS.includes(out.model)||!SHARE_MODES.includes(out.mode))throw Error('share.invalid');
 for(const key of ['a','b','ua','ub'])if(typeof out[key]!=='string'||out[key].length>80)throw Error('share.invalid');
 if(!/^[\w.%/-]*$/.test(out.ua)||!/^[\w.%/-]*$/.test(out.ub))throw Error('share.invalid');
 return out;
}

// payload: {module:'general', form:{model,mode,a,b,ua,ub}} or {module:<panel>, inputs, model, source?}
export function shareLinkPayload(payload){
 if(!shareRecord(payload))throw Error('share.invalid');
 if(payload.module==='general')return {v:1,module:'general',form:shareReadGeneral(payload.form)};
 if(payload.source==='csv')throw Error('share.csv');
 const checked=readCalculation(JSON.stringify({format:'water-steam-calculation',version:1,module:payload.module,inputs:payload.inputs,model:payload.model,...(payload.source?{source:payload.source}:{})}));
 return {v:1,module:checked.module,inputs:checked.record.inputs,model:checked.record.model,...(checked.record.source?{source:checked.record.source}:{})};
}

export function encodeShareLink(payload,base){
 const fragment=SHARE_HASH_PREFIX+shareToBase64Url(JSON.stringify(shareLinkPayload(payload)));
 if(fragment.length>SHARE_MAX_LENGTH)throw Error('share.tooLong');
 return String(base||'').replace(/#.*$/,'')+fragment;
}

// Returns null when the fragment is not a share link; throws on a damaged one.
export function decodeShareLink(hash){
 if(typeof hash!=='string'||!hash.startsWith(SHARE_HASH_PREFIX))return null;
 if(hash.length>SHARE_MAX_LENGTH)throw Error('share.tooLong');
 let raw;
 try{raw=JSON.parse(shareFromBase64Url(hash.slice(SHARE_HASH_PREFIX.length)));}catch{throw Error('share.invalid');}
 if(!shareRecord(raw)||raw.v!==1)throw Error('share.invalid');
 if(raw.module==='general')return {module:'general',form:shareReadGeneral(raw.form)};
 const checked=readCalculation(JSON.stringify({format:'water-steam-calculation',version:1,module:raw.module,inputs:raw.inputs,model:raw.model,...(raw.source?{source:raw.source}:{})}));
 // A CSV series depends on a local file that cannot travel in a link.
 if(checked.record.source==='csv')throw Error('share.invalid');
 return {module:checked.module,record:checked.record};
}
