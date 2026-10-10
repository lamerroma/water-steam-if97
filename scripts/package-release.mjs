// Builds a downloadable offline ZIP: one self-contained HTML file plus docs.
// Uses standalone.html (everything embedded, zero network calls, including the
// lazily-loaded-elsewhere CoolProp WASM) -- NOT the multi-file site, which needs
// fetch() and therefore a server; fetch() is blocked under file:// in Chrome.
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
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

async function main(){
 const stage=new URL('dist/release-stage/',root);
 await rm(stage,{recursive:true,force:true});
 await mkdir(stage,{recursive:true});
 await writeFile(new URL('calculator.html',stage),await read('standalone.html'));
 await writeFile(new URL('README.txt',stage),README);
 await writeFile(new URL('LICENSE',stage),await read('LICENSE'));
 await writeFile(new URL('THIRD_PARTY_NOTICES.md',stage),await read('THIRD_PARTY_NOTICES.md'));
 const zipPath=new URL('dist/water-steam-calculator.zip',root);
 await rm(zipPath,{force:true});
 await run('zip',['-r','-X',zipPath.pathname,'.'],{cwd:stage.pathname});
 const {size}=await import('node:fs').then(fs=>fs.promises.stat(zipPath));
 console.log(`Built ${zipPath.pathname} (${size} bytes).`);
}
main();
