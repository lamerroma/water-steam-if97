import DefaultSheetJS from '../vendor/sheetjs.cjs';
import {createScriptAssetLoader} from './script-assets.js';

// Node callers retain the synchronous API. The browser build supplies a lazy,
// versioned script URL instead of embedding and executing the backend at startup.
let SheetJS=DefaultSheetJS;
const loadSpreadsheetLibrary=createScriptAssetLoader(typeof SPREADSHEET_LIBRARY_URL==='undefined'?null:SPREADSHEET_LIBRARY_URL,()=>globalThis.XLSX);
export async function prepareSpreadsheet(format){if(format!=='csv'&&!SheetJS)SheetJS=await loadSpreadsheetLibrary();}

export const SPREADSHEET_FORMATS={xlsx:{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bookType:'xlsx'},ods:{type:'application/vnd.oasis.opendocument.spreadsheet',bookType:'ods'},xls:{type:'application/vnd.ms-excel',bookType:'biff8'},csv:{type:'text/csv;charset=utf-8'}};
const spreadsheetCRCTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function spreadsheetStoredODF(bytes){
 // Repackage only our own freshly generated archive. SheetJS puts mimetype
 // third; ODF 1.2 §3.3 requires it first, stored and without an extra field.
 const archive=SheetJS.CFB.read(bytes,{type:'array'}),root=archive.FullPaths[0];
 const entries=archive.FileIndex.flatMap((entry,i)=>entry.type===2&&!entry.name.startsWith('\x01')?[{name:archive.FullPaths[i].slice(root.length),data:new Uint8Array(entry.content)}]:[]);
 entries.sort((a,b)=>a.name==='mimetype'?-1:b.name==='mimetype'?1:0);
 if(entries[0]?.name!=='mimetype')throw Error('Invalid generated ODF archive.');
 const encoder=new TextEncoder(),locals=[],central=[];let offset=0;
 for(const entry of entries){
  const name=encoder.encode(entry.name),data=entry.data;let crc=0xffffffff;for(const b of data)crc=spreadsheetCRCTable[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);
  locals.push(local,data);central.push(c);offset+=local.length+data.length;
 }
 const centralSize=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 const output=new Uint8Array(offset+centralSize+22);let pos=0;for(const chunk of [...locals,...central,end]){output.set(chunk,pos);pos+=chunk.length;}return output;
}
export function writeTabular(document,format='xlsx'){
 const spec=SPREADSHEET_FORMATS[format];if(!spec)throw Error('Unknown spreadsheet format.');
 if(document?.format!=='water-steam-tabular'||document.version!==1||!document.sheets?.length)throw Error('Invalid tabular document.');
 for(const sheet of document.sheets)for(const row of sheet.rows)for(const v of row)if(v!=null&&!(['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v)))throw Error('Invalid spreadsheet cell.');
 // The vendored BIFF8 writer cannot split a single long Unicode SST value
 // safely across CONTINUE records. Reject before writing, never truncate/hang.
 if(format==='xls'&&document.sheets.some(s=>s.rows.some(r=>r.some(v=>typeof v==='string'&&v.length>4000))))throw Error('Text exceeds the XLS export limit (4000 characters per cell). Choose XLSX or ODS.');
 if(format==='csv'){
  // A single CSV contains all named sections and metadata, with UTF-8 BOM.
  // Protect text against formula interpretation; actual negative numbers stay numeric.
  const cell=v=>'"'+String(typeof v==='string'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(v)?"'"+v:v??'').replaceAll('"','""')+'"';
  return '\ufeff'+document.sheets.flatMap(s=>[['worksheet',s.name],...s.rows,[]]).map(r=>r.map(cell).join(';')).join('\r\n');
 }
 if(!SheetJS)throw Error('Prepare the spreadsheet library before binary export.');
 const book=SheetJS.utils.book_new();
 book.Props={Title:'Water and steam calculated results',Author:'water-steam-if97',CreatedDate:new Date('2000-01-01T00:00:00Z'),ModifiedDate:new Date('2000-01-01T00:00:00Z')};
 for(const s of document.sheets){
  // aoa_to_sheet keeps numbers numeric and formula-like strings as string cells.
  const sheet=SheetJS.utils.aoa_to_sheet(s.rows,{sheetStubs:true});
  SheetJS.utils.book_append_sheet(book,sheet,s.name);
 }
 // ODF requires its first mimetype member to be stored, never compressed.
 // BIFF8 needs its shared string table to retain text beyond 255 characters.
 const bytes=new Uint8Array(SheetJS.write(book,{bookType:spec.bookType,type:'array',compression:format!=='ods',bookSST:true}));
 return format==='ods'?spreadsheetStoredODF(bytes):bytes;
}
