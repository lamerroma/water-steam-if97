import {extrapolate95} from './iapws95-extrapolation.js';
import {parseNumber} from './units.js';
// Main water tab: P–T states of IAPWS-95 extrapolated to 5000 K and 100 GPa,
// kept apart from the validated calculator and always shown with a warning.
const EXT95_ROWS=[['rho','кг/м³'],['v','м³/кг'],['h','кДж/кг'],['u','кДж/кг'],['s','кДж/(кг·K)'],['cp','кДж/(кг·K)'],['cv','кДж/(кг·K)'],['w','м/с'],['Z',''],['isentropic','']];
function ext95Render(box){
 const t=k=>escapeHTML(uiTranslator.t(k));
 box.innerHTML=`<summary>${t('ext95.title')}</summary><p class="method-limit">${t('ext95.warning')}</p><div class="process-grid"><label>${t('ext95.p')}<input id="ext95-p" inputmode="decimal" value="10000"></label><label>${t('ext95.t')}<input id="ext95-t" inputmode="decimal" value="2000"></label></div><button type="button" id="ext95-run">${t('ext95.run')}</button><p id="ext95-error" role="alert" hidden></p><div id="ext95-results"></div>`;
 $('ext95-run').onclick=()=>{
  $('ext95-error').hidden=true;$('ext95-results').replaceChildren();
  try{const q=extrapolate95(parseNumber($('ext95-p').value),parseNumber($('ext95-t').value));
   const rows=EXT95_ROWS.map(([k,u])=>[t('ext95.r.'+k),q[k],u]);
   $('ext95-results').innerHTML=`<p class="method-limit" role="status">${t(q.extrapolated?'ext95.extrapolated':'ext95.validated')}</p><table class="sat-table"><tbody>${rows.map(([n,v,u])=>`<tr><td>${n}</td><td>${escapeHTML(format(v))}</td><td>${escapeHTML(u)}</td></tr>`).join('')}</tbody></table>`;
  }catch(e){$('ext95-error').textContent=e.message;$('ext95-error').hidden=false;}
 };
}
function ext95Init(){
 const form=$('calculator');if(!form||$('ext95'))return;
 const box=document.createElement('details');box.id='ext95';box.className='iapws95-extrapolation';box.dataset.i18nIgnore='';calculatorExtrasHost().append(box);ext95Render(box);
 const sync=()=>{box.hidden=$('tab-general').getAttribute('aria-selected')!=='true'||$('calculator-view').hidden;};
 new MutationObserver(sync).observe($('tab-general'),{attributes:true,attributeFilter:['aria-selected']});sync();
 document.addEventListener('languagechange',()=>{const open=box.open,p=$('ext95-p').value,T=$('ext95-t').value;ext95Render(box);box.open=open;$('ext95-p').value=p;$('ext95-t').value=T;});
}
if(globalThis.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ext95Init);else ext95Init();}
