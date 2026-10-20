// Package the complete static PWA, including a loopback server for local use.
// Calculation runs on the device; the server only serves files, never computes.
import {readFile,writeFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));

const README=`Навчальний теплофізичний калькулятор
===================================

Як запустити:
1. Розпакуйте цей архів у будь-яку папку.
2. За наявності Python 3 виконайте в цій папці: python serve.py
   (у Windows також можна: py -3 serve.py).
3. Відкрийте http://localhost:8080/ і дочекайтеся статусу готовності офлайн.
4. За бажанням установіть PWA через меню браузера. Після підготовки кешу можна
   зупинити локальний сервер і відкрити цю ж адресу або встановлену програму офлайн.

Для ht / fluids перед зупинкою сервера відкрийте «Теплообмін і гідравліка» →
«Бібліотеки ht / fluids» і підготуйте окремий пакет (~32 МБ). Він також у цьому ZIP.
Базова готовність PWA не означає готовності додаткових Python-бібліотек.

Усі ресурси вже в архіві: для цього локального запуску інтернет не потрібен.
Python використовується лише як статичний сервер; розрахунки виконує браузер.
Відкриття index.html через file:// не підтримується. Використовуйте ту саму адресу
та порт при наступному запуску. Після очищення кешу знову запустіть serve.py.
Альтернатива: розмістіть комплект на HTTPS-хостингу й установіть PWA звідти.

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
 const app=await readFile(new URL('assets/app.js',root),'utf8'),build=JSON.parse(app.match(/const APP_BUILD = ([^\n]+);/)[1]);
 const worker=await readFile(new URL('service-worker.js',root),'utf8');
 const resources=JSON.parse(worker.match(/const RESOURCES=(\[[^;]+\]);/)[1]);
 const names=[...new Set(resources.map(path=>path.split('?')[0])),'service-worker.js'];
 const python=JSON.parse(await read('dist/assets/python-package.json'));
 names.push(...python.files.map(file=>file.url));
 const entries=await Promise.all(names.map(async name=>[name,await read('dist/'+name)]));
 for(const [name,source] of [['LICENSE','LICENSE'],['THIRD_PARTY_NOTICES.md','THIRD_PARTY_NOTICES.md'],['QUICK_START_UK.md','docs/QUICK_START_UK.md'],['PWA_UK.md','docs/PWA_UK.md'],['PWA_ARCHITECTURE_UK.md','docs/PWA_ARCHITECTURE_UK.md'],['CALCULATION_MODULES_UK.md','docs/CALCULATION_MODULES_UK.md'],['PYTHON_LIBRARIES_UK.md','docs/PYTHON_LIBRARIES_UK.md'],['FLUIDS_PIPE_UK.md','docs/FLUIDS_PIPE_UK.md'],['serve.py','scripts/serve-pwa.py']])entries.push([name,await read(source)]);
 entries.push(['README.txt',Buffer.from(README)],['BUILD_INFO.json',Buffer.from(JSON.stringify(build,null,2)+'\n')]);
 const zipPath=new URL('dist/water-steam-calculator.zip',root);
 await writeFile(zipPath,archive(entries));
 const {size}=await import('node:fs').then(fs=>fs.promises.stat(zipPath));
 console.log(`Built ${fileURLToPath(zipPath)} (${size} bytes).`);
}
main();
