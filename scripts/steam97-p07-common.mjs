export function assessDiagramState(actual,expected,policy){
 return ['p','T','h','s'].map(key=>{const tolerance=Math.max(policy[key+'_absolute'],Math.abs(expected[key])*policy.relative);return {key,actual:actual?.[key]??null,expected:expected[key],tolerance,passed:Number.isFinite(actual?.[key])&&Math.abs(actual[key]-expected[key])<=tolerance};});
}
export function assessDiagramCurve(path,reference,range,width,height){
 const pixel=p=>({x:p.x/(range.xmax-range.xmin)*width,y:p.y/(range.ymax-range.ymin)*height}),line=path.map(pixel);
 const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
 return Math.max(...reference.map(pixel).map(p=>Math.min(...line.slice(1).map((b,i)=>distance(p,line[i],b)))));
}
