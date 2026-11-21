import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialize} from '../src/engine.js';
import {STEAM_SYS_CALCS,STEAM_SYS_FIELDS,steamSysValues,steamSysVisible,steamSysRun} from '../src/steam-system-ui.js';
import {PIPE_SCHEDULES} from '../src/steam-system.js';
import {readWorkspace,WORKSPACE_PANELS,WORKSPACE_STEAM_SYSTEM} from '../src/workspace.js';
await initialize(fs.readFileSync(new URL('../vendor/seuif97_bg.wasm',import.meta.url)));
const catalogs=Object.fromEntries(['uk','en'].map(l=>[l,JSON.parse(fs.readFileSync(new URL(`../src/locales/${l}.json`,import.meta.url),'utf8'))]));
const defaults=over=>({...Object.fromEntries(Object.entries(STEAM_SYS_FIELDS).map(([k,[,,def,opts]])=>[k,opts?opts[0][0]:String(def)])),...over});
const finiteRows=r=>{assert.ok(r.rows.length>0);for(const [key,value] of r.rows){assert.ok(catalogs.uk[key]&&catalogs.en[key],key);if(typeof value==='number')assert.ok(Number.isFinite(value),key+' '+value);}};

test('every steam-system calculation runs with its default inputs',()=>{
 for(const calc of Object.keys(STEAM_SYS_CALCS))finiteRows(steamSysRun(calc,steamSysValues(calc,defaults({}))));
});
test('all fluids, valve modes and condensate load kinds run',()=>{
 for(const fluid of ['steam-sat','steam-sh','water','air'])for(const calc of ['pipe-size','pipe-drop','valve','orifice']){
  const t=fluid==='water'?'60':'250',flow=fluid==='water'?'20000':'3600';finiteRows(steamSysRun(calc,steamSysValues(calc,defaults({fluid,t,flow}))));}
 for(const valveMode of ['kv','flow','dp'])finiteRows(steamSysRun('valve',steamSysValues('valve',defaults({valveMode,dp:'100',kv:'80'}))));
 for(const loadKind of ['warmup','pipe-loss','tank','exchanger','air-heater','duty'])finiteRows(steamSysRun('condensate-load',steamSysValues('condensate-load',defaults({loadKind}))));
});
test('only relevant fields are shown',()=>{
 assert.ok(!steamSysVisible('pipe-size',{fluid:'steam-sat'}).includes('t'));assert.ok(steamSysVisible('pipe-size',{fluid:'steam-sh'}).includes('t'));
 assert.ok(!steamSysVisible('valve',{fluid:'steam-sat',valveMode:'kv'}).includes('kv'));assert.ok(steamSysVisible('valve',{fluid:'water',valveMode:'kv'}).includes('FL'));
 const tank=steamSysVisible('condensate-load',{loadKind:'tank'});assert.ok(tank.includes('mass')&&!tank.includes('outerD')&&tank.includes('safety'));
});
test('each calculation, field and formula has Ukrainian and English text',()=>{
 for(const calc of Object.keys(STEAM_SYS_CALCS)){for(const l of ['uk','en'])assert.ok(catalogs[l]['steam.calc.'+calc],calc);if(calc!=='condensate-load')assert.ok(catalogs.en['steam.formula.'+calc],calc);}
 for(const [,[id]] of Object.entries(STEAM_SYS_FIELDS))assert.ok(catalogs.uk['steam.f.'+id]&&catalogs.en['steam.f.'+id],id);
});

test('steam-system inputs and local units are saved in the project workspace',()=>{
 assert.ok(WORKSPACE_PANELS.includes('steam-system'));
 const ids=['steam-calc',...Object.values(STEAM_SYS_FIELDS).map(([id])=>'steam-'+id)];
 assert.deepEqual([...WORKSPACE_STEAM_SYSTEM.fields].sort(),[...ids].sort());
 const c=WORKSPACE_STEAM_SYSTEM.choices;
 assert.deepEqual(c['steam-calc'],Object.keys(STEAM_SYS_CALCS));
 assert.deepEqual(c['steam-schedule'],Object.keys(PIPE_SCHEDULES));
 for(const [key,[id,,,opts]] of Object.entries(STEAM_SYS_FIELDS))if(opts)assert.deepEqual(c['steam-'+id],opts.map(([v])=>v),key);
 const inputs={'steam-calc':'pipe-drop','steam-fluid':'steam-sh','steam-p':'1','steam-t':'250','steam-flow':'3600','ui-unit-steam-p':'bar','ui-unit-steam-flow':'kgs','ui-unit-steam-d':'inch'};
 const w=readWorkspace({active:'steam-system',panels:{'steam-system':{inputs,calculated:true,model:'IF97'}}});
 assert.deepEqual(w.panels['steam-system'].inputs,inputs);
 assert.throws(()=>readWorkspace({active:'steam-system',panels:{'steam-system':{inputs:{'steam-calc':'nope'},calculated:false}}}));
 assert.throws(()=>readWorkspace({active:'steam-system',panels:{'steam-system':{inputs:{'steam-result':'1'},calculated:false}}}));
 assert.throws(()=>readWorkspace({active:'steam-system',panels:{'steam-system':{inputs:{'ui-unit-steam-p':'furlong'},calculated:false}}}));
});
