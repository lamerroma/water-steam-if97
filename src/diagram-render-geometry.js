// Shared screen/export decorations, positioned using the active Chart.js scales.
export function diagramAnnotationLayout(chart){
 const {ctx,chartArea:a}=chart,labels=[];
 for(const label of chart.$annotations||[]){const x=chart.scales.x.getPixelForValue(label.x),y=chart.scales.y.getPixelForValue(label.y);if(![x,y].every(Number.isFinite)||x<a.left||x>a.right||y<a.top||y>a.bottom)continue;
  const font=label.critical?'bold 11px Arial':'12px Arial';ctx.save();ctx.font=font;const width=ctx.measureText(label.text).width;ctx.restore();if(width>a.right-a.left-8)continue;
  labels.push({...label,x,y,font,width,tx:Math.max(a.left+width/2+4,Math.min(a.right-width/2-4,x)),ty:Math.max(a.top+14,Math.min(a.bottom-5,y-8))});
 }return labels;
}
export function diagramArrowGeometry(points,endOnly=false){
 const arrows=[];for(let i=endOnly?Math.max(1,points.length-1):1;i<points.length;i++){const p=points[i-1],q=points[i];if(p.skip||q.skip||![p.x,p.y,q.x,q.y].every(Number.isFinite)||Math.hypot(q.x-p.x,q.y-p.y)<(endOnly?.01:8))continue;arrows.push({x:q.x,y:q.y,angle:Math.atan2(q.y-p.y,q.x-p.x)});}return arrows;
}
