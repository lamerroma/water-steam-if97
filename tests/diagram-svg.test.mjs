import test from 'node:test';
import assert from 'node:assert/strict';
import {diagramChartSVG} from '../src/diagram-svg.js';
import {diagramArrowGeometry,diagramAnnotationLayout} from '../src/diagram-render-geometry.js';
const area={left:60,top:20,right:360,bottom:240};
const point=(x,y,skip=false)=>({x,y,skip,options:{radius:8,backgroundColor:'#f09a00',borderColor:'#fff',borderWidth:2}});
function chartFixture(){
 const data=[{role:'isobar',borderColor:'#333',borderWidth:1.25,borderDash:[7,4]},{role:'isobar',hidden:true,borderColor:'#444',borderWidth:2},{role:'states'}];
 const metas=[{index:0,data:[point(100,200),point(0,0,true),point(200,50)]},{index:1,data:[point(60,240),point(360,20)]},{index:2,data:[point(180,120)]}];
 const scale=(id,values)=>({left:0,bottom:280,ticks:values.map(value=>({value})),options:{title:{text:id==='x'?'h, Btu/lb':'p, psi · log'}},getPixelForTick:i=>id==='x'?60+i*150:240-i*110,getPixelForValue:v=>v,getLabelItems:()=>[{options:{translation:[20,30],rotation:0,textAlign:'center'},label:'1,450',font:{string:'12px Arial',lineHeight:14},textOffset:0}]});
 return {width:380,height:280,chartArea:area,data:{datasets:data},scales:{x:scale('x',[0,100,200]),y:scale('y',[.1,1,10])},ctx:{save(){},restore(){},measureText:s=>({width:s.length*6})},$annotations:[],getSortedVisibleDatasetMetas:()=>[metas[0],metas[2]],getDatasetMeta:i=>metas[i],isDatasetVisible:i=>i!==1,$numbers:true};
}
test('SVG exports the actual ticks, clip, styles and selected marker without bridging gaps',()=>{
 const c=chartFixture(),svg=diagramChartSVG(c);
 assert.ok(svg.includes('x="60" y="20" width="300" height="220"'));assert.ok(svg.includes('data-tick="0.1"'));assert.ok(svg.includes('data-tick="10"'));assert.ok(svg.includes('h, Btu/lb'));assert.ok(svg.includes('p, psi · log'));
 assert.ok(svg.includes('d="M100,200  M200,50"'));assert.ok(svg.includes('stroke-width="1.25"'));assert.ok(svg.includes('stroke-dasharray="7 4"'));assert.ok(!svg.includes('#444'));
 assert.ok(svg.includes('translate(180 120)'));assert.ok(svg.includes('r="8"'));assert.ok(!/NaN|Infinity/.test(svg));
});
test('SVG metadata escapes text and preserves user titles through localization',()=>{
 const svg=diagramChartSVG(chartFixture(),{title:'<img onerror="x">',description:'A & B',pointTitles:['Турбіна <script>']});
 assert.ok(!svg.includes('<img'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;img'));assert.ok(svg.includes('A &amp; B'));assert.ok(svg.includes('<title data-i18n-ignore="">Турбіна &lt;script&gt;</title>'));assert.ok(svg.includes('role="img" data-i18n-ignore=""'));
});
test('Shared arrows respect gaps and shared annotation bounds keep labels inside the plot',()=>{
 assert.equal(diagramArrowGeometry([point(10,10),point(30,10,true),point(60,10)]).length,0);
 assert.equal(diagramArrowGeometry([point(10,10),point(30,10),point(60,10)],true).length,1);
 const c=chartFixture();c.$annotations=[{x:61,y:21,text:'Critical point',critical:true},{x:500,y:30,text:'Outside'}];
 const [label]=diagramAnnotationLayout(c);assert.equal(diagramAnnotationLayout(c).length,1);assert.ok(label.tx-label.width/2>=area.left+4);assert.ok(label.ty>=area.top+14);
});
