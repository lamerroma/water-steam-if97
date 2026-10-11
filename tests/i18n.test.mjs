import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
