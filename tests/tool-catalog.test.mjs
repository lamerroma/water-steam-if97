import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TOOL_CATALOG,toolMatches,toolStatus} from '../src/tool-catalog.js';
import {TOOL_GROUPS} from '../src/tool-navigation.js';
const uk=JSON.parse(readFileSync(new URL('../src/locales/uk.json',import.meta.url))),en=JSON.parse(readFileSync(new URL('../src/locales/en.json',import.meta.url)));
test('Every preserved route has a translated name, task description, limitation and status',()=>{
 const actions=TOOL_GROUPS.flatMap(g=>g.actions);assert.deepEqual(Object.keys(TOOL_CATALOG).sort(),[...actions].sort());
 for(const action of actions){for(const suffix of ['name','description','limits'])for(const catalog of [uk,en])assert.ok(catalog[`tool.${action}.${suffix}`]?.trim());assert.ok(uk['catalog.status.'+toolStatus(action)]);}
});
test('Task search supports Ukrainian/English phrases and legacy section numbers',()=>{
 for(const [query,action] of [['потужність турбіни','turbine'],['ккд циклу','cycles'],['лопаткова потужність','coursework'],['втрати тиску','flow'],['насос компресор','engineering'],['fuel rod','coursework'],['Reynolds','flow'],['27.','coursework'],['21.','npp']])assert.ok(toolMatches(query,action));
 assert.equal(toolMatches('pump','ice'),false);assert.equal(toolMatches('constructor','constructor'),false);assert.equal(toolMatches('<script>','general'),false);
});
test('Method status distinguishes provisional reactor work and experimental gas mixtures',()=>{
 assert.equal(toolStatus('coursework'),'mixed');assert.equal(toolStatus('gases'),'mixed');assert.equal(toolStatus('coursework',{kind:'rankine'}),'educational');assert.equal(toolStatus('coursework',{kind:'stage'}),'educational');assert.equal(toolStatus('coursework',{kind:'core'}),'provisional');
 assert.equal(toolStatus('gases',{model:'real'}),'reference');assert.equal(toolStatus('gases',{model:'ideal'}),'educational');assert.equal(toolStatus('gases',{model:'mixture'}),'experimental');
 assert.ok(en['catalog.provisionalNote'].includes('not yet confirmed'));assert.ok(en['catalog.referenceNote'].includes('not certification'));
});
