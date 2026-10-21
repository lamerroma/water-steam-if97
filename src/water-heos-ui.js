import {WATER_HEOS_MODES} from './water-heos.js';
import {createCalculationRunner} from './calculator-runner.js';
import {calculationQuantities} from './calculation-protocol.js';
import {selectCalculatedAlternative} from './inverse-diagnostics.js';
import {typedRounding} from './input-rounding.js';

const waterHeosRunner=createCalculationRunner(()=>new Worker(HEOS_WORKER_URL),90000);
let waterHeosSequence=0;
function cancelWaterHeos(){waterHeosSequence++;waterHeosRunner.cancel();}
window.addEventListener('pagehide',()=>waterHeosRunner.reset());
function mountWaterHeos(host){
 const t=key=>uiTranslator.t('heos.'+key),translate=(key)=>'<span data-i18n="heos.'+key+'">'+escapeHTML(t(key))+'</span>';
 host.insertAdjacentHTML('afterbegin','<section id="water-heos" class="method" data-i18n-ignore><h2>'+translate('title')+'</h2><p>'+translate('scope')+'</p><p>'+translate('limits')+'</p><form id="heos-form"><div class="process-grid"><label>'+translate('mode')+'<select id="heos-mode">'+Object.keys(WATER_HEOS_MODES).map(mode=>'<option value="'+mode+'">'+mode.toUpperCase()+'</option>').join('')+'</select></label><label><span id="heos-a-label"></span><input id="heos-a" value="1" inputmode="decimal" required></label><label id="heos-b-field"><span id="heos-b-label"></span><input id="heos-b" value="500" inputmode="decimal"></label></div><label><input id="heos-rounding" type="checkbox"> '+translate('rounding')+'</label><button id="heos-run" type="submit">'+translate('run')+'</button><button id="heos-cancel" type="button" hidden>'+translate('cancel')+'</button><button id="heos-export" type="button" disabled>'+translate('export')+'</button></form><p id="heos-status" role="status"></p><p id="heos-error" role="alert" hidden></p><label id="heos-root-field" hidden>'+translate('root')+'<select id="heos-root"></select></label><p id="heos-sensitivity"></p><div id="heos-result" class="sat-scroll"></div><p><a href="https://coolprop.org/fluid_properties/IF97.html" target="_blank" rel="noopener">CoolProp HEOS / IAPWS-95</a> · MIT</p></section>');
 const section=$('water-heos'),connected=()=>section.isConnected&&activeSection==='libraries';
 let last=null,originalReply=null;
 const labels={p:'P · MPa (absolute)',T:'T · K',h:'h · kJ/kg',s:'s · kJ/(kg K)',u:'u · kJ/kg',x:'x · 0…1',v:'v · m³/kg',rho:'ρ · kg/m³'};
 const defaults={p:'1',T:'500',h:'2891.218298958905',s:'6.824994379140872',u:'2670.5794922041465',v:'0.22063808675503706',rho:'4.532294271839076',x:'0.5'};
 const units={p:'MPa',T:'K',h:'kJkg',s:'kJkgK',u:'kJkg',v:'m3kg',rho:'kgm3',x:'fraction'};
 function draft(){try{localStorage.setItem('thermocalc-water-heos-draft',JSON.stringify({version:1,mode:$('heos-mode').value,a:$('heos-a').value,b:$('heos-b').value,rounding:$('heos-rounding').checked}));}catch{}}
 function clearResult(){last=null;originalReply=null;$('heos-result').replaceChildren();$('heos-error').hidden=true;$('heos-status').textContent='';$('heos-root-field').hidden=true;$('heos-sensitivity').textContent='';}
 function refresh(){if(!connected())return;$('heos-run').disabled=waterHeosRunner.busy;$('heos-cancel').hidden=!waterHeosRunner.busy;$('heos-export').disabled=!last;}
 function fields(){cancelWaterHeos();clearResult();const pair=WATER_HEOS_MODES[$('heos-mode').value];$('heos-a-label').textContent=labels[pair[0]];$('heos-b-label').textContent=labels[pair[1]]||'';$('heos-b-field').hidden=pair.length===1;$('heos-b').required=pair.length===2;$('heos-rounding').disabled=pair.length===1||pair.includes('x');
  $('heos-a').value=defaults[pair[0]];$('heos-b').value=defaults[pair[1]]||'';refresh();
 }
 $('heos-mode').onchange=()=>{fields();draft();};
 $('heos-form').oninput=()=>{cancelWaterHeos();clearResult();draft();refresh();};
 $('heos-cancel').onclick=()=>{cancelWaterHeos();$('heos-status').textContent=t('cancelled');refresh();};
 $('heos-form').onsubmit=async event=>{
  event.preventDefault();cancelWaterHeos();const sequence=waterHeosSequence;clearResult();$('heos-status').textContent=t('running');
  const parse=value=>value.trim()===''?NaN:Number(value.trim().replace(',','.'));
  const mode=$('heos-mode').value,pair=WATER_HEOS_MODES[mode],rounding=pair.map((key,i)=>typedRounding($(i===0?'heos-a':'heos-b').value,units[key])),payload={mode,a:parse($('heos-a').value),...(pair.length===2?{b:parse($('heos-b').value)}:{})};
  if($('heos-rounding').checked&&!$('heos-rounding').disabled&&rounding.every(Boolean))payload.options={inputRounding:rounding};draft();
  const pending=waterHeosRunner.run('water-heos','calculate',payload);refresh();
  try{
   const reply=await pending;if(!connected()||sequence!==waterHeosSequence)return;
   originalReply=reply;last={format:'thermocalc-library-result',version:1,module:'water-heos',method:'calculate',payload,reply,selection:{index:0}};
   const roots=[reply.result.state,...(reply.result.alternatives||[])].filter(Boolean);
   $('heos-root-field').hidden=roots.length<2;$('heos-root').replaceChildren(...roots.map((q,i)=>new Option((i+1)+': '+q.p.toPrecision(10)+' MPa · '+q.T.toPrecision(10)+' K · ρ='+q.rho.toPrecision(10),String(i))));
   renderReply(reply);
  }catch(error){if(connected()&&sequence===waterHeosSequence){$('heos-error').textContent=error.message;$('heos-error').hidden=false;$('heos-status').textContent='';}}
  finally{if(connected()&&sequence===waterHeosSequence)refresh();}
 };
 function renderReply(reply){
   const symbols={rho:'ρ',cp:'cₚ',cv:'cᵥ',gamma:'cₚ/cᵥ',isentropic:'κₛ',mu:'μ',lambda:'λ',nu:'ν',diffusivity:'a',sigma:'σ',dc:'εᵣ',alpha:'α',kappa:'κₜ',dvdt:'(∂v/∂T)ₚ',dvdp:'(∂v/∂p)ₜ',dpdt:'(∂p/∂T)ᵥ',dpdv:'(∂p/∂v)ₜ',jt:'μJT',ijt:'δₜ',latentHeat:'Δh'};
   const rows=Object.entries(reply.quantities).filter(([key])=>!key.startsWith('alternatives.')).map(([key,q])=>{const parts=key.split('.'),property=parts.at(-1),phase=key.startsWith('saturation.liquid.')?'Насичена рідина':key.startsWith('saturation.vapor.')?'Насичена пара':key.startsWith('state.')?reply.result.state.phase:'Насичення';return '<tr data-quantity="'+escapeHTML(key)+'"><th scope="row">'+escapeHTML(uiTranslator.text(phase)+' · '+(symbols[property]||property))+'</th><td>'+(q.value===null?'—':escapeHTML(q.value.toPrecision(12)))+'</td><td>'+escapeHTML(q.unit)+'</td></tr>';}).join('');
   $('heos-result').innerHTML='<table data-canonical-units><thead><tr><th>'+escapeHTML(t('quantity'))+'</th><th>'+escapeHTML(t('value'))+'</th><th>'+escapeHTML(t('unit'))+'</th></tr></thead><tbody>'+rows+'</tbody></table>';
   $('heos-status').textContent=t(reply.result.ambiguous?'ambiguous':'done')+' '+reply.warnings.map(note=>uiTranslator.text(note.message)).join(' ');
   const sensitivity=reply.result.state?.inputSensitivity;
   $('heos-sensitivity').textContent=sensitivity?t('sensitivity')+' '+sensitivity.status+(sensitivity.response?' · Δp='+sensitivity.response.p.toPrecision(5)+' MPa; ΔT='+sensitivity.response.T.toPrecision(5)+' K':''):'';
 }
 $('heos-root').onchange=()=>{
  if(!last||!originalReply)return;const index=Number($('heos-root').value),result=index===0?originalReply.result:selectCalculatedAlternative(originalReply.result,index-1);
  const reply={...originalReply,result,quantities:calculationQuantities(result,'water-state'),warnings:[...new Set([result.state,...(result.alternatives||[])].flatMap(q=>q?.notes||[]))].map(message=>({code:'model-note',message}))};
  last={...last,reply,selection:{index}};renderReply(reply);
 };
 $('heos-export').onclick=()=>{if(last)downloadFile(JSON.stringify(last,null,2),'water-heos-result.json','application/json');};
 let saved;try{saved=JSON.parse(localStorage.getItem('thermocalc-water-heos-draft')||'null');}catch{}
 if(saved?.version===1&&Object.hasOwn(WATER_HEOS_MODES,saved.mode)&&typeof saved.a==='string'&&typeof saved.b==='string'&&saved.a.length<=100&&saved.b.length<=100){$('heos-mode').value=saved.mode;fields();$('heos-a').value=saved.a;$('heos-b').value=saved.b;$('heos-rounding').checked=saved.rounding===true;}else fields();
}
document.addEventListener('languagechange',()=>{for(const node of document.querySelectorAll('#water-heos [data-i18n]'))node.textContent=uiTranslator.t(node.dataset.i18n);});
