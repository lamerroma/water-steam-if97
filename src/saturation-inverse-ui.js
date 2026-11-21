import {saturationByProperty} from './saturation-inverse.js';
// Saturation tab: find the saturation state from h, s, u, v or ρ of the liquid
// or vapor, or from the latent heat. The chosen root is opened through the
// ordinary T-saturation calculation, so results, history and exports stay the same.
const SAT_INV_OPTIONS=[['h:liquid',"h′"],['h:vapor',"h″"],['s:liquid',"s′"],['s:vapor',"s″"],['u:liquid',"u′"],['u:vapor',"u″"],['v:liquid',"v′"],['v:vapor',"v″"],['rho:liquid',"ρ′"],['rho:vapor',"ρ″"],['latent:',"r = h″ − h′"]];
const SAT_INV_UNITS={h:'кДж/кг',s:'кДж/(кг·K)',u:'кДж/кг',v:'м³/кг',rho:'кг/м³',latent:'кДж/кг'};
function satInvOpen(T){
 $('mode').value='satt';resetMode();$('unit-a').value='K';$('unit-a').dataset.previous='K';$('input-a').value=String(T);$('calculator').requestSubmit();
}
function satInvRender(box){
 const t=k=>escapeHTML(uiTranslator.t(k));
 box.innerHTML=`<summary>${t('satinv.title')}</summary><p>${t('satinv.intro')}</p><div class="process-grid"><label>${t('satinv.property')}<select id="satinv-key">${SAT_INV_OPTIONS.map(([v,l])=>`<option value="${v}">${escapeHTML(l)} · ${t('satinv.key.'+v.replace(':','.').replace(/\.$/,''))}</option>`).join('')}</select></label><label><span id="satinv-label">${t('satinv.value')}</span><input id="satinv-value" inputmode="decimal" value="2780"></label></div><button type="button" id="satinv-find">${t('satinv.find')}</button><p id="satinv-error" role="alert" hidden></p><div id="satinv-roots"></div>`;
 const label=()=>{const [key]=$('satinv-key').value.split(':');$('satinv-label').textContent=uiTranslator.t('satinv.value')+', '+SAT_INV_UNITS[key];};
 $('satinv-key').onchange=label;label();
 $('satinv-find').onclick=()=>{
  const [key,phase]=$('satinv-key').value.split(':');$('satinv-error').hidden=true;$('satinv-roots').replaceChildren();
  try{const roots=saturationByProperty({key,phase:phase||'liquid',value:parseNumber($('satinv-value').value),model:modelValue()});
   if(roots.length===1){satInvOpen(roots[0].T);return;}
   const p=document.createElement('p');p.textContent=uiTranslator.t('satinv.choose');$('satinv-roots').append(p);
   for(const r of roots){const b=document.createElement('button');b.type='button';b.textContent=`T = ${format(r.T-273.15)} °C · p = ${format(r.saturation.p)} МПа`;b.onclick=()=>satInvOpen(r.T);$('satinv-roots').append(b,' ');}
  }catch(e){$('satinv-error').textContent=e.message;$('satinv-error').hidden=false;}
 };
}
// Styles live here, not in styles.css: that file is pinned by the library-recipe acceptance evidence.
const CALC_EXTRAS_CSS='.calculator-extras{padding:0 .75rem;flex-shrink:0}.calculator-extras>details{margin:.5rem 0;padding:.35rem .6rem;border:1px solid #becde1;border-radius:6px;background:var(--panel,#fff)}.calculator-extras>details>summary{cursor:pointer;font-weight:600}.calculator-extras .process-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:.5rem}.calculator-extras label{display:flex;flex-direction:column}.calculator-extras table{width:100%}';
function calculatorExtrasHost(){let host=$('calculator-extras');if(!host){if(!$('calculator-extras-style')){const style=document.createElement('style');style.id='calculator-extras-style';style.textContent=CALC_EXTRAS_CSS;document.head.append(style);}const area=$('calculator').closest('.input-area')||$('calculator');host=document.createElement('div');host.id='calculator-extras';host.className='calculator-extras';area.after(host);}return host;}
function satInvInit(){
 const form=$('calculator');if(!form||$('satinv'))return;
 const box=document.createElement('details');box.id='satinv';box.className='saturation-inverse';box.dataset.i18nIgnore='';calculatorExtrasHost().append(box);satInvRender(box);
 const sync=()=>{box.hidden=$('tab-saturation').getAttribute('aria-selected')!=='true'||$('calculator-view').hidden;};
 new MutationObserver(sync).observe($('tab-saturation'),{attributes:true,attributeFilter:['aria-selected']});sync();
 document.addEventListener('languagechange',()=>{const open=box.open,key=$('satinv-key').value,value=$('satinv-value').value;satInvRender(box);box.open=open;$('satinv-key').value=key;$('satinv-key').onchange();$('satinv-value').value=value;});
}
if(globalThis.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',satInvInit);else satInvInit();}
