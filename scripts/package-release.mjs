// Builds a downloadable offline ZIP: one self-contained HTML file plus docs.
// Uses standalone.html (everything embedded, zero network calls, including the
// lazily-loaded-elsewhere CoolProp WASM) -- NOT the multi-file site, which needs
// fetch() and therefore a server; fetch() is blocked under file:// in Chrome.
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));

const README=`Навчальний теплофізичний калькулятор
===================================

Як запустити:
1. Розпакуйте цей архів у будь-яку папку.
2. Відкрийте файл "calculator.html" подвійним кліком у будь-якому сучасному браузері
   (Chrome, Firefox, Edge, Safari).
3. Усе готово. Інтернет не потрібен -- жодних запитів з цього файлу ні на які сервери
   не надсилається, увесь код і дані вбудовані в сам файл.

Ліцензія: MIT (LICENSE). Атрибуція сторонніх джерел і формуляцій IAPWS: THIRD_PARTY_NOTICES.md.
Журнал змін: https://github.com/lamerroma/water-steam-if97/blob/main/CHANGELOG.md
`;

// Small deterministic ZIP using Node's standard library. Fixed 1980 timestamp;
// UTF-8 names and CRC32 let independent ZIP readers verify every member.
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function archive(entries){
 const locals=[],directory=[];let offset=0;
 for(const [filename,bytes] of entries){
  const name=Buffer.from(filename),compressed=deflateRawSync(bytes,{level:9}),crc=crc32(bytes);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
  locals.push(header,name,compressed);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt16LE(0x21,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);directory.push(central,name);
  offset+=header.length+name.length+compressed.length;
 }
 const table=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(table.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,table,end]);
}

async function main(){
 const stage=new URL('dist/release-stage/',root);
 await rm(stage,{recursive:true,force:true});
 await mkdir(stage,{recursive:true});
 await writeFile(new URL('calculator.html',stage),await read('standalone.html'));
 await writeFile(new URL('README.txt',stage),README);
 await writeFile(new URL('LICENSE',stage),await read('LICENSE'));
 await writeFile(new URL('THIRD_PARTY_NOTICES.md',stage),await read('THIRD_PARTY_NOTICES.md'));
 await writeFile(new URL('QUICK_START_UK.md',stage),await read('docs/QUICK_START_UK.md'));
 const app=await readFile(new URL('assets/app.js',root),'utf8'),build=JSON.parse(app.match(/const APP_BUILD = ([^\n]+);/)[1]);
 await writeFile(new URL('BUILD_INFO.json',stage),JSON.stringify(build,null,2)+'\n');
 const zipPath=new URL('dist/water-steam-calculator.zip',root);
 await rm(zipPath,{force:true});
 const names=['calculator.html','README.txt','LICENSE','THIRD_PARTY_NOTICES.md','QUICK_START_UK.md','BUILD_INFO.json'];
 const entries=await Promise.all(names.map(async name=>[name,await readFile(new URL(name,stage))]));
 await writeFile(zipPath,archive(entries));
 const {size}=await import('node:fs').then(fs=>fs.promises.stat(zipPath));
 console.log(`Built ${fileURLToPath(zipPath)} (${size} bytes).`);
}
main();
