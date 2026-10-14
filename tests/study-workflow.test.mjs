import {test} from 'node:test';import assert from 'node:assert/strict';import {studyReadiness} from '../src/study-workflow.js';
test('editorial review identifies empty reports and targets metadata without mutating inputs',()=>{
 const report={entries:[]},before=JSON.stringify(report),r=studyReadiness(report);assert.equal(r.count,0);assert.deepEqual(r.issues.map(q=>q.key),['empty','assignment','author','intro']);assert.equal(r.issues.find(q=>q.key==='author').target,'study-author');assert.equal(JSON.stringify(report),before);
});
test('outline review follows current order and accepts meaningful titles and conclusions',()=>{
 const report={assignment:'Task',author:'Student',intro:'Given',entries:[{title:'  ',comment:' '},{title:'Second',comment:'Concluded'}]};assert.deepEqual(studyReadiness(report).issues.map(q=>[q.key,q.index,q.target]),[['title',0,'study-block-0'],['comment',0,'study-block-0']]);report.entries.reverse();assert.deepEqual(studyReadiness(report).issues.map(q=>q.index),[1,1]);report.entries[1]={title:'First',comment:'Done'};assert.deepEqual(studyReadiness(report).issues,[]);
});
