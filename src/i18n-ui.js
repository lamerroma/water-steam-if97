import {createTranslator} from './i18n.js';

// LOCALIZATION_CATALOGS is embedded by build.mjs, including in standalone.html.
let preferredLanguage='uk';
try{preferredLanguage=localStorage.getItem('water-steam-language')||'uk';}catch{}
const uiTranslator=createTranslator(LOCALIZATION_CATALOGS,preferredLanguage);
const originalTexts=new WeakMap(),originalAttributes=new WeakMap();
const localizedAttributes=['title','aria-label','placeholder','alt'];
const ignoredSelector='script,style,textarea,[data-i18n-ignore]';

function translateElement(element){
 if(element.matches(ignoredSelector)||element.closest('[data-i18n-ignore]'))return;
 if(element.hasAttribute('data-i18n-ignore-attributes'))return;
 let records=originalAttributes.get(element);
 if(!records){records=new Map();originalAttributes.set(element,records);}
 for(const attribute of [...localizedAttributes,...(element.matches('meta[name="description"]')?['content']:[])]){
  const current=element.getAttribute(attribute);if(current==null)continue;
  const previous=records.get(attribute);
  const source=previous&&previous.last===current?previous.source:current;
  const translated=uiTranslator.text(source);records.set(attribute,{source,last:translated});
  if(current!==translated)element.setAttribute(attribute,translated);
 }
 // Options without an explicit value would otherwise change their calculation key.
 if(element.tagName==='OPTION'&&!element.hasAttribute('value'))element.value=element.textContent;
}
function translateNode(node){
 const parent=node.parentElement;if(!parent||parent.closest(ignoredSelector))return;
 const current=node.nodeValue,previous=originalTexts.get(node);
 const source=previous&&previous.last===current?previous.source:current;
 const key=parent.getAttribute('data-i18n');
 const translated=key?uiTranslator.t(key):uiTranslator.text(source);originalTexts.set(node,{source,last:translated});
 if(translated!==current)node.nodeValue=translated;
}
function translateUI(root=document.documentElement){
 if(root.nodeType===3){translateNode(root);return;}
 if(root.nodeType!==1)return;
 translateElement(root);
 for(const element of root.querySelectorAll('*'))translateElement(element);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())translateNode(walker.currentNode);
}
function sourceUIText(element){
 if(element.nodeType===3)return originalTexts.get(element)?.source??element.nodeValue;
 return [...element.childNodes].map(sourceUIText).join('');
}
const localizationObserver=new MutationObserver(records=>{
 localizationObserver.disconnect();
 for(const record of records){
  if(record.type==='characterData')translateNode(record.target);
  else if(record.type==='attributes')translateElement(record.target);
  else for(const node of record.addedNodes)translateUI(node);
 }
 observeLocalization();
});
function observeLocalization(){localizationObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:localizedAttributes});}
function setUILanguage(language){
 localizationObserver.disconnect();uiTranslator.setLanguage(language);
 document.documentElement.lang=uiTranslator.language;
 document.getElementById('language-select').value=uiTranslator.language;
 try{localStorage.setItem('water-steam-language',uiTranslator.language);}catch{}
 translateUI();observeLocalization();
 document.dispatchEvent(new CustomEvent('languagechange',{detail:uiTranslator.language}));
}
// Translation is assigned through text nodes and text attributes, never as HTML.
function localizedDocument(content,mime='text/html'){
 const doc=new DOMParser().parseFromString(content,mime);
 if(doc.querySelector('parsererror'))return content;
 translateUI(doc.documentElement);
 doc.documentElement.setAttribute('lang',uiTranslator.language);
 return mime==='image/svg+xml'?new XMLSerializer().serializeToString(doc):'<!doctype html>\n'+doc.documentElement.outerHTML;
}
const languageSelect=document.getElementById('language-select');
languageSelect.replaceChildren(...uiTranslator.languages.map(language=>new Option(LOCALIZATION_CATALOGS[language]['language.name']||language,language)));
languageSelect.onchange=()=>setUILanguage(languageSelect.value);
document.documentElement.lang=uiTranslator.language;
languageSelect.value=uiTranslator.language;
queueMicrotask(()=>translateUI());observeLocalization();
