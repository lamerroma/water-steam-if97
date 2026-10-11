import {diagramPoint} from './diagram-coordinates.js';
// Renderer data stays canonical. Missing/invalid samples break a line rather than
// interpolating an unknown physical state. P–h uses a true logarithmic pressure axis.
export function chartDiagramPoint(kind,state){
 if(!state)return {x:NaN,y:NaN};
 const {x,y}=diagramPoint(kind,state);
 if(!Number.isFinite(x)||!Number.isFinite(y))return {x:NaN,y:NaN};
 return {x,y:kind==='phdiagram'?state.p:y};
}
export function diagramPhaseColor(state){
 if(state.x!=null&&state.x>0&&state.x<1)return '#9b59b6';
 if(state.critical||state.T>=647.096&&state.p>=22.064)return '#d97706';
 return state.x===0||/рідина|liquid/i.test(state.phase||'')?'#1685a6':'#d04444';
}
export function chartDiagramDatasets(kind,cache,choices,plan,process,hidden,colors,selected,guides={}){
 const line=(states,color,width,extra={})=>({data:states.map(q=>chartDiagramPoint(kind,q)),showLine:true,pointRadius:0,pointHitRadius:0,borderColor:color,borderWidth:width,tension:0,spanGaps:false,fill:false,...extra});
 const datasets=cache.isobars.map(({points},i)=>line(points,colors[i],1.25,{hidden:hidden.has(i),role:'isobar'}));
 if(guides.isotherms)datasets.push(...guides.isotherms.map(g=>line(g.points,'#b06824',1.3,{borderDash:[7,4],role:'isotherm'})));
 if(guides.qualities)datasets.push(...guides.qualities.map(g=>line(g.points,'#8a69a8',1.1,{borderDash:[3,4],role:'quality'})));
 datasets.push(...cache.dome.map(points=>line(points,'#12477c',2.5,{role:'dome'})));
 if(plan.connectHistory)datasets.push(line(choices.filter(([q,_,source])=>source==='history'&&!plan.excluded.includes(q)).map(([q])=>q),'#8b4599',2.3,{arrows:true,role:'history'}));
 if(process){const r=process.result;datasets.push(line([r.inlet,r.outlet],'#12804a',2.8,{arrows:true,role:'process'}));
 if(r.coldInlet)datasets.push(line([r.coldInlet,r.coldOutlet],'#1a77b9',2.8,{arrows:true,role:'cold'}));
 if(r.ideal)datasets.push(line([r.inlet,r.ideal],'#12804a',1.8,{borderDash:[6,4],role:'ideal'}));}
 datasets.push({role:'states',data:choices.map(([q],i)=>({...chartDiagramPoint(kind,q),choiceIndex:i})),showLine:false,pointRadius:choices.map((_,i)=>selected===i?8:6),pointHoverRadius:9,pointHitRadius:14,pointBackgroundColor:choices.map(([q],i)=>selected===i?'#f09a00':diagramPhaseColor(q)),pointBorderColor:'#fff',pointBorderWidth:2});
 const counts=new Map();for(const d of datasets){const index=counts.get(d.role)||0;counts.set(d.role,index+1);d.id=d.role+'-'+index;}
 return datasets;
}
