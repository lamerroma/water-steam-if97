import test from 'node:test';
import assert from 'node:assert/strict';
import {studyViewportBounds,studyViewportZoom,studyViewportPan} from '../src/study-viewport.js';
test('fit includes negative entropy, ignores gaps and pads all finite points',()=>{
 const points=[{x:-2,y:300},null,{x:8,y:800},{x:NaN,y:20}];const r=studyViewportBounds(points);
 assert.ok(r.xmin< -2&&r.xmax>8&&r.ymin<300&&r.ymax>800);assert.equal(studyViewportBounds([null,{x:NaN,y:2}]),null);
});
test('one state still has a finite nonzero view',()=>{const r=studyViewportBounds([{x:0,y:0}]);assert.ok(r.xmax>r.xmin&&r.ymax>r.ymin);});
test('zoom preserves the value under an off-centre anchor and round trips',()=>{
 const r={xmin:-2,xmax:8,ymin:100,ymax:900},a={x:.2,y:.8},z=studyViewportZoom(r,.5,a);
 assert.equal(z.xmin+(z.xmax-z.xmin)*a.x,0);assert.equal(z.ymin+(z.ymax-z.ymin)*a.y,740);
 assert.deepEqual(studyViewportZoom(z,2,a),r);assert.throws(()=>studyViewportZoom(r,0));
});
test('panning preserves both spans and never changes the original bounds',()=>{const r={xmin:0,xmax:10,ymin:100,ymax:500};assert.deepEqual(studyViewportPan(r,.2,-.5),{xmin:2,xmax:12,ymin:-100,ymax:300});assert.equal(r.xmin,0);});
