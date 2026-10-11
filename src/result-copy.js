export function resultJSON(result,build,reference,units){
 return JSON.stringify({format:'water-steam-result',version:1,build,pressure_basis:'absolute',units,reference,result},null,2);
}
export function resultMarkdown(sections,headings){
 const escape=v=>String(v??'—').replaceAll('\\','\\\\').replaceAll('|','\\|').replace(/[\r\n]+/g,' ');
 return sections.map(({title,rows})=>`### ${escape(title)}\n\n| ${headings.map(escape).join(' | ')} |\n| ${headings.map(()=>'---').join(' | ')} |\n`+rows.map(row=>'| '+row.map(escape).join(' | ')+' |').join('\n')).join('\n\n');
}
