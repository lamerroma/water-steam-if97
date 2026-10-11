import {readProject} from './project.js';
export const LIBRARY_KEY='thermocalc-project-library-v1';
export function readLibrary(text,verify=false){
 if(text==null)return {format:'thermocalc-library',version:1,projects:[]};if(typeof text!=='string'||text.length>8000000)throw Error('Бібліотека: максимум 8 МБ.');const a=JSON.parse(text);
 if(a.format!=='thermocalc-library'||a.version!==1||!Array.isArray(a.projects)||a.projects.length>20)throw Error('Некоректна бібліотека проєктів (максимум 20).');
 const ids=new Set();return {format:a.format,version:1,projects:a.projects.map(p=>{if(typeof p.id!=='string'||p.id.length>80||ids.has(p.id)||typeof p.title!=='string'||p.title.length>80||typeof p.updated!=='string'||!Number.isFinite(Date.parse(p.updated))||typeof p.data!=='string'||p.data.length>2000000)throw Error('Некоректний збережений проєкт.');ids.add(p.id);if(verify)readProject(p.data);return {id:p.id,title:p.title,updated:p.updated,data:p.data};})};
}
export function librarySave(storage,library){const text=JSON.stringify(library);readLibrary(text);storage.setItem(LIBRARY_KEY,text);}
export function libraryPut(library,id,title,snapshot){
 const data=JSON.stringify({...snapshot,title});readProject(data);const entry={id,title,updated:new Date().toISOString(),data},projects=library.projects.filter(p=>p.id!==id);projects.push(entry);return readLibrary(JSON.stringify({...library,projects}));
}
