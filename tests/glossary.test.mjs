import test from 'node:test';import assert from 'node:assert/strict';
import {GLOSSARY,LABEL_GLOSSARY} from '../src/glossary.js';

// Mirrors the keys of the main property table's `rows` array in src/app.js (app.js
// itself can't be imported here -- it touches `document` at module load time).
const MAIN_TABLE_KEYS=['p','T','rho','v','h','s','u','cp','cv','w','ex','x','region','isentropic','A','G','Z','alpha','kappa','dvdt','dvdp','dpdt','dpdv','ijt','jt','dc','mu','nu','lambda','diffusivity','Pr','sigma'];
// The other learning panels' descriptive Ukrainian labels (src/learning-ui.js renderLearning
// entries and src/learning-export.js d2oPropertyRows), copied verbatim for a cross-check.
const LEARNING_LABELS=['T','P','M','h','s','u','ρ','v','Cp','Cv','w','Cp/Cv','Z','В’язкість','Теплопровідність','Сухість','Тиск','Температура','Відносна вологість','Вологовміст W','Парціальний Pᵥ','Ентальпія','Питомий об’єм','Густина суміші','Точка роси','Мокрий термометр','Густина','Питома ентальпія','Питома внутрішня енергія','Енергія Гельмгольца','Енергія Гіббса','Питома ентропія','Питома теплоємність cp','Кубічний коеф. розширення α','Коефіцієнт тиску β','Ізотермічна стисливість κT','Ізентропна стисливість κs','Ізохорна теплоємність cv','Ізобарна теплоємність cp','Швидкість звуку','Абсолютна солоність','Хімічний потенціал води μW','Робота турбіни','Робота насоса / компресора','Підведене тепло','Відведене тепло','Корисна робота','Термічний ККД','Потужність'];

test('Glossary covers every main property-table key with a non-trivial explanation',()=>{
 for(const key of MAIN_TABLE_KEYS){
  assert.ok(key in GLOSSARY,`missing glossary entry for "${key}"`);
  assert.equal(typeof GLOSSARY[key],'string');
  assert.ok(GLOSSARY[key].length>=40,`glossary entry for "${key}" looks too short`);
 }
});
test('Every other learning-panel label resolves to a valid, non-trivial glossary entry',()=>{
 for(const label of LEARNING_LABELS){
  assert.ok(label in LABEL_GLOSSARY,`missing LABEL_GLOSSARY mapping for "${label}"`);
  const key=LABEL_GLOSSARY[label];
  assert.ok(key in GLOSSARY,`LABEL_GLOSSARY["${label}"]="${key}" has no GLOSSARY entry`);
  assert.ok(GLOSSARY[key].length>=40,`glossary entry for "${key}" (via "${label}") looks too short`);
 }
});
test('Glossary and label map have no stray/unreferenced keys',()=>{
 const used=new Set(Object.values(LABEL_GLOSSARY));
 for(const key of Object.keys(GLOSSARY))assert.ok(MAIN_TABLE_KEYS.includes(key)||used.has(key),`unused glossary key "${key}"`);
 for(const label of Object.keys(LABEL_GLOSSARY))assert.ok(LEARNING_LABELS.includes(label),`unexpected LABEL_GLOSSARY label "${label}"`);
});
