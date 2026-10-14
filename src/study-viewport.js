// Canonical axis coordinates; fitting never changes thermodynamic states.
export function studyViewportBounds(points){
 const valid=points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!valid.length)return null;
 const xs=valid.map(p=>p.x),ys=valid.map(p=>p.y),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
 const dx=xmax-xmin||Math.max(Math.abs(xmin)*.02,.01),dy=ymax-ymin||Math.max(Math.abs(ymin)*.02,1);
 return {xmin:xmin-dx*.06,xmax:xmax+dx*.06,ymin:ymin-dy*.06,ymax:ymax+dy*.06};
}
export function studyViewportZoom(range,factor,anchor={x:.5,y:.5}){
 if(!(factor>0&&Number.isFinite(factor)))throw Error('Invalid zoom factor');
 const dx=(range.xmax-range.xmin)*factor,dy=(range.ymax-range.ymin)*factor;
 const x=range.xmin+(range.xmax-range.xmin)*anchor.x,y=range.ymin+(range.ymax-range.ymin)*anchor.y;
 return {xmin:x-dx*anchor.x,xmax:x+dx*(1-anchor.x),ymin:y-dy*anchor.y,ymax:y+dy*(1-anchor.y)};
}
export function studyViewportPan(range,x,y){
 const dx=(range.xmax-range.xmin)*x,dy=(range.ymax-range.ymin)*y;
 return {xmin:range.xmin+dx,xmax:range.xmax+dx,ymin:range.ymin+dy,ymax:range.ymax+dy};
}
