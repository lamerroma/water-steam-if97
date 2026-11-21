import {metastableVapor} from './metastable-vapor.js';
import {parseNumber} from './units.js';
// Main water tab: supercooled (metastable) steam by the IF97 supplementary equation.
const METASTABLE_ROWS=[['v','м³/кг'],['rho','кг/м³'],['h','кДж/кг'],['u','кДж/кг'],['s','кДж/(кг·K)'],['cp','кДж/(кг·K)'],['cv','кДж/(кг·K)'],['w','м/с']];
function metastableRender(box){
 const t=k=>escapeHTML(uiTranslator.t(k));
 box.innerHTML=`<summary>${t('metastable.title')}</summary><p>${t('metastable.intro')}</p><div class="process-grid"><label>${t('metastable.p')}<input id="metastable-p" inputmode="decimal" value="1"></label><label>${t('metastable.t')}<input id="metastable-t" inputmode="decimal" value="166.85"></label></div><button type="button" id="metastable-run">${t('metastable.run')}</button><p id="metastable-error" role="alert" hidden></p><div id="metastable-results"></div>`;
 $('metastable-run').onclick=()=>{
  $('metastable-error').hidden=true;$('metastable-results').replaceChildren();
  try{const q=metastableVapor(parseNumber($('metastable-p').value),parseNumber($('metastable-t').value)+273.15);
   const rows=[...METASTABLE_ROWS.map(([k,u])=>[t('metastable.r.'+k),q[k],u]),[t('metastable.r.Tsat'),q.Tsat-273.15,'°C'],[t('metastable.r.subcooling'),q.subcooling,'K'],[t('metastable.r.quality'),q.equilibriumQuality,'']];
   $('metastable-results').innerHTML=`<table class="sat-table"><tbody>${rows.map(([n,v,u])=>`<tr><td>${n}</td><td>${escapeHTML(format(v))}</td><td>${escapeHTML(u)}</td></tr>`).join('')}</tbody></table>`;
  }catch(e){$('metastable-error').textContent=e.message;$('metastable-error').hidden=false;}
 };
}
function metastableInit(){
 const form=$('calculator');if(!form||$('metastable'))return;
 const box=document.createElement('details');box.id='metastable';box.className='metastable-vapor';box.dataset.i18nIgnore='';form.after(box);metastableRender(box);
 const sync=()=>{box.hidden=$('tab-general').getAttribute('aria-selected')!=='true'||$('calculator-view').hidden;};
 new MutationObserver(sync).observe($('tab-general'),{attributes:true,attributeFilter:['aria-selected']});sync();
 document.addEventListener('languagechange',()=>{const open=box.open,p=$('metastable-p').value,T=$('metastable-t').value;metastableRender(box);box.open=open;$('metastable-p').value=p;$('metastable-t').value=T;});
}
if(globalThis.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',metastableInit);else metastableInit();}
