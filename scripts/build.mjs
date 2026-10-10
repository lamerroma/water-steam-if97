// Dependency-free deterministic bundling. HTML opens via file:// without fetch or imports.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const files=['vendor/seuif97.js','src/coefficients.js','src/equations.js','src/transport.js','src/engine.js','src/units.js','src/export.js','src/processes.js','src/project.js','src/app.js'];
let code='"use strict";\n(async()=>{\n';
code+='const WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
for(const file of files) {
 let s=await read(file);
 s=s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'");
 code+=`\n// ${file}\n`+s+'\n';
 if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
}
code+='})();\n';
const licenses='<!--\n'+await read('LICENSE')+'\nSEUIF97 / RustSEUIF97:\n'+await read('vendor/SEUIF97-LICENSE')+'\nFormulations and verification tables: International Association for the Properties of Water and Steam (IAPWS), R7-97(2012), R12-08, R15-11, R1-76(2014).\n-->\n';
const html=licenses+(await read('src/template.html')).replace('/* STYLES */',await read('src/styles.css')).replace('/* APPLICATION */',()=>code.replace(/<\/script/gi,'<\\/script'));
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('index.html',root),html);await writeFile(new URL('dist/index.html',root),html);
console.log(`Built standalone index.html and dist/index.html (${Buffer.byteLength(html)} bytes).`);
