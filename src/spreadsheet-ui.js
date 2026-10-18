import {writeTabular,SPREADSHEET_FORMATS} from './spreadsheet.js';

// One compact format selector beside each existing export; no extra result panel.
export function attachSpreadsheetExport(anchor,{id,getDocument,download,onError,translate=x=>x}){
 const group=document.createElement('span');group.className='spreadsheet-export';group.id=id;
 const select=document.createElement('select');select.id=id+'-format';select.setAttribute('aria-label','Формат таблиці');
 for(const [value,text] of [['xlsx','XLSX'],['ods','ODS'],['xls','XLS (97–2003)'],['csv','CSV (UTF-8)']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
 const button=document.createElement('button');button.type='button';button.id=id+'-save';button.dataset.i18n='spreadsheet.save';button.textContent='Зберегти таблицю';
 button.onclick=()=>{try{const format=select.value,doc=getDocument(),content=writeTabular(doc,format);download(content,id+'.'+format,SPREADSHEET_FORMATS[format].type,{metadata:false});}catch(e){onError?.(e);}};
 group.append(select,button);anchor.after(group);return group;
}
