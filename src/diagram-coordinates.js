// Geometry uses canonical units; P–h uses log10 of absolute pressure in MPa.
export function diagramAxes(kind){
 if(kind==='phdiagram')return {horizontal:'h',vertical:'p',name:'P–h',initial:{xmin:0,xmax:4500,ymin:Math.log10(.0006),ymax:2},minWidth:1,maxWidth:18000};
 if(!['ts','hsdiagram'].includes(kind))throw Error('Невідома діаграма.');
 return {horizontal:'s',vertical:kind==='ts'?'T':'h',name:kind==='ts'?'T–s':'h–s',initial:{xmin:0,xmax:11,ymin:0,ymax:kind==='ts'?800:4500},minWidth:.05,maxWidth:44};
}
export function diagramPoint(kind,q){
 if(kind==='phdiagram')return {x:q.h,y:q.p>0?Math.log10(q.p):NaN};
 return {x:q.s,y:kind==='ts'?q.T-273.15:q.h};
}
// Local viewing presets, not EOS restrictions or verified Steam97Web geometry.
export function diagramViewport(kind,preset='full'){
 if(preset==='full')return {...diagramAxes(kind).initial};
 if(kind==='hsdiagram'&&preset==='vapor')return {xmin:3.5,xmax:10,ymin:1500,ymax:4200};
 throw Error('Невідомий масштаб діаграми.');
}
