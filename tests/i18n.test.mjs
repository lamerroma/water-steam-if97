import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createTranslator} from '../src/i18n.js';
import {formatProperty} from '../src/ux-display.js';
const catalogs={};
for(const language of ['uk','en'])catalogs[language]=JSON.parse(await readFile(new URL('../src/locales/'+language+'.json',import.meta.url),'utf8'));

test('catalogs have matching keys and English scientific terminology',()=>{
 assert.deepEqual(Object.keys(catalogs.uk).sort(),Object.keys(catalogs.en).sort());
 const translator=createTranslator(catalogs,'en');
 assert.equal(translator.text('Сухість'),'Vapor quality');
 assert.equal(translator.text('Температуропровідність'),'Thermal diffusivity');
 assert.equal(translator.text('л/с'),'L/s');
 assert.equal(translator.text('17. Витрати та Reynolds'),'17. Flow rates and Reynolds');
 assert.equal(translator.text('Тиск + сухість (P–x)'),'Pressure + vapor quality (P–x)');
});
test('fallback, parameters and extra languages require no engine changes',()=>{
 const translator=createTranslator({uk:{greeting:'Вітаю, {name}',missing:'Резервний текст'},en:{greeting:'Hello, {name}'},de:{greeting:'Hallo, {name}'}},'de');
 assert.equal(translator.t('greeting',{name:'<script>'}),'Hallo, <script>');
 assert.equal(translator.t('missing'),'Резервний текст');
 assert.equal(translator.t('unknown'),'unknown');
 assert.equal(translator.setLanguage('xx'),'uk');
 assert.equal(translator.t('greeting',{name:'Роман'}),'Вітаю, Роман');
});
test('legacy messages translate whole phrases before fragments without corrupting identifiers',()=>{
 const translator=createTranslator(catalogs,'en');
 assert.equal(translator.text('Станів: 42'),'States: 42');
 assert.equal(translator.text('  Розрахувати  '),'  Calculate  ');
 assert.equal(translator.text('parameter_m MPa IF97'),'parameter_m MPa IF97');
 assert.equal(translator.text('параметр'), 'параметр');
 translator.setLanguage('uk');
 assert.equal(translator.text('Станів: 42'),'Станів: 42');
});
test('number locale changes presentation without changing numeric values',()=>{
 assert.equal(formatProperty(1234.5,6,'en'),'1,234.5');
 assert.match(formatProperty(1234.5,6,'uk-UA'),/1.*234,5/);
 assert.equal(formatProperty(null,6,'en'),'—');
});

test('language selector applies input immediately and handles input plus change only once',async()=>{
 // A small DOM fixture exercises the actual UI adapter without a browser dependency.
 const element={nodeType:1,tagName:'HTML',matches:()=>false,closest:()=>null,
  hasAttribute:()=>false,getAttribute:()=>null,querySelectorAll:()=>[]};
 const text={nodeType:3,parentElement:element,nodeValue:'Розрахувати'};
 const select=new EventTarget();select.replaceChildren=()=>{};
 const document=new EventTarget();document.documentElement=element;
 document.getElementById=()=>select;
 document.createTreeWalker=()=>{let visited=false;return {currentNode:text,nextNode(){if(visited)return false;visited=true;return true;}};};
 const saved=new Map();let updates=0;document.addEventListener('languagechange',()=>updates++);
 const source=(await readFile(new URL('../src/i18n-ui.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
 vm.runInNewContext(source,{createTranslator,LOCALIZATION_CATALOGS:catalogs,document,
  localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},
  MutationObserver:class{observe(){}disconnect(){}},NodeFilter:{SHOW_TEXT:4},
  Option:class{},CustomEvent,queueMicrotask:callback=>callback()});
 select.value='en';select.dispatchEvent(new Event('input'));
 assert.equal(element.lang,'en');assert.equal(text.nodeValue,'Calculate');
 assert.equal(saved.get('water-steam-language'),'en');assert.equal(updates,1);
 select.dispatchEvent(new Event('change'));assert.equal(updates,1);
 select.value='uk';select.dispatchEvent(new Event('change'));
 assert.equal(element.lang,'uk');assert.equal(text.nodeValue,'Розрахувати');assert.equal(updates,2);
});
