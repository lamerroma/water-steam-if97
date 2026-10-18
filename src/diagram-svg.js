import {diagramAnnotationLayout,diagramArrowGeometry} from './diagram-render-geometry.js';
// Export the current chart's geometry, ticks and visible datasets. No independent
// thermodynamic geometry or unit conversion is maintained by this exporter.
export function diagramChartSVG(chart,{title='',description='',pointTitles=[]}={}){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const n=v=>Number(v.toFixed(3));const a=chart.chartArea;
 const text=(value,x,y,attrs='')=>`<text x="${n(x)}" y="${n(y)}" ${attrs}>${esc(value)}</text>`;
 let axes='';
 for(const [id,scale] of Object.entries(chart.scales)){
  const horizontal=id==='x';
  scale.ticks.forEach((tick,i)=>{const p=scale.getPixelForTick(i);axes+=`<path data-axis="${id}" data-tick="${esc(tick.value)}" d="${horizontal?`M${n(p)} ${n(a.top)}V${n(a.bottom)}`:`M${n(a.left)} ${n(p)}H${n(a.right)}`}" stroke="#eaf0f6"/>`;});
  for(const label of scale.getLabelItems()){const [x,y]=label.options.translation,rotate=label.options.rotation||0,lines=Array.isArray(label.label)?label.label:[label.label];axes+=`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotate*180/Math.PI)})" fill="#53677d" style="font:${esc(label.font.string)}">`+lines.map((line,i)=>text(line,0,label.textOffset+i*label.font.lineHeight,`text-anchor="${label.options.textAlign==='center'?'middle':label.options.textAlign==='right'?'end':'start'}" dominant-baseline="${label.options.textBaseline==='middle'?'central':'auto'}"`)).join('')+'</g>';}
  const label=scale.options.title.text;
  if(horizontal)axes+=text(label,(a.left+a.right)/2,scale.bottom-8,'text-anchor="middle" fill="#344c65"');
  else axes+=`<g transform="translate(${n(scale.left+13)} ${n((a.top+a.bottom)/2)}) rotate(-90)">${text(label,0,0,'text-anchor="middle" fill="#344c65"')}</g>`;
 }
 axes+=`<path d="M${n(a.left)} ${n(a.top)}V${n(a.bottom)}H${n(a.right)}" fill="none" stroke="#b6c5d6"/>`;
 let lines='',decorations='';
 const sorted=chart.getSortedVisibleDatasetMetas();
 for(const meta of [...sorted].reverse()){
  const d=chart.data.datasets[meta.index],points=meta.data;
  if(d.role==='states'){lines+=points.map((p,i)=>p.skip||![p.x,p.y].every(Number.isFinite)?'':`<g data-point="${i}" transform="translate(${n(p.x)} ${n(p.y)})"><title data-i18n-ignore="">${esc(pointTitles[i])}</title><circle class="diagram-marker" r="${p.options.radius}" fill="${esc(p.options.backgroundColor)}" stroke="${esc(p.options.borderColor)}" stroke-width="${p.options.borderWidth}"/></g>`).join('');continue;}
  let pen=false;const path=points.map(p=>{if(p.skip||![p.x,p.y].every(Number.isFinite)){pen=false;return '';}const command=`${pen?'L':'M'}${n(p.x)},${n(p.y)}`;pen=true;return command;}).join(' ');
  lines+=`<path data-dataset="${meta.index}" data-role="${esc(d.role)}" ${d.role==='series'?`data-series-name="${esc(d.seriesName)}" data-series-kind="${esc(d.seriesKind)}"`:''} ${['quality','isotherm'].includes(d.role)?`data-guide="${d.role}"`:''} ${d.role==='history'?'data-history-path="true"':''} d="${path}" fill="none" stroke="${esc(d.borderColor)}" stroke-width="${d.borderWidth}" ${d.borderDash?`stroke-dasharray="${d.borderDash.join(' ')}"`:''}/>`;
 }
 for(const label of diagramAnnotationLayout(chart)){decorations+=`<g data-annotation="${label.critical?'critical':'guide'}"><rect x="${n(label.tx-label.width/2-3)}" y="${n(label.ty-12)}" width="${n(label.width+6)}" height="16" fill="#ffffffe6"/>`+text(label.text,label.tx,label.ty,`text-anchor="middle" fill="${esc(label.color||'#64748b')}" style="font:${label.font}"`)+(label.critical?`<circle cx="${n(label.x)}" cy="${n(label.y)}" r="4" fill="#d97706"/>`:'')+'</g>';}
 chart.data.datasets.forEach((d,index)=>{if(!chart.isDatasetVisible(index))return;const points=chart.getDatasetMeta(index).data;
  if(d.arrows)for(const arrow of diagramArrowGeometry(points,d.arrowEnd))decorations+=`<path transform="translate(${n(arrow.x)} ${n(arrow.y)}) rotate(${n(arrow.angle*180/Math.PI)})" d="M-8 -4L0 0L-8 4Z" fill="${esc(d.borderColor)}"/>`;
  if(d.role==='states'&&chart.$numbers)points.forEach((p,i)=>{if(!p.skip&&[p.x,p.y].every(Number.isFinite))decorations+=text(i+1,p.x+10,p.y-10,'fill="#182b40" stroke="white" stroke-width="3" paint-order="stroke" font-weight="bold"');});
 });
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${chart.width}" height="${chart.height}" viewBox="0 0 ${chart.width} ${chart.height}" role="img" data-i18n-ignore="" style="font:12px Arial"><title>${esc(title)}</title><desc>${esc(description)}</desc><defs><clipPath id="plot-clip"><rect x="${n(a.left)}" y="${n(a.top)}" width="${n(a.right-a.left)}" height="${n(a.bottom-a.top)}"/></clipPath></defs><rect width="${chart.width}" height="${chart.height}" fill="white"/>${axes}<g clip-path="url(#plot-clip)">${lines}${decorations}</g></svg>`;
}
