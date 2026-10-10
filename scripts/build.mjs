// Dependency-free deterministic bundling. HTML opens via file:// without fetch or imports.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const files=['vendor/seuif97.js','src/coefficients.js','src/equations.js','src/transport.js','src/dielectric.js','src/extra-inputs.js','src/iapws95.js','src/engine.js','src/units.js','src/diagram-units.js','src/print-report.js','src/export.js','src/batch.js','src/processes.js','src/exergy.js','src/engineering.js','src/project.js','src/gas-data.js','src/gases.js','src/humid-air.js','src/cycles.js','src/ice.js','src/app.js','src/learning-ui.js'];
let code='"use strict";\n(async()=>{\n';
code+='const WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
for(const file of files) {
 let s=await read(file);
 s=s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'");
 code+=`\n// ${file}\n`+s+'\n';
 if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
}
code+='})();\n';
const licenses='<!--\n'+await read('LICENSE')+'\nSEUIF97 / RustSEUIF97:\n'+await read('vendor/SEUIF97-LICENSE')+'\nCantera NASA7 data / BSD-3-Clause:\n'+await read('vendor/CANTERA-LICENSE')+'\nFormulations and verification tables: International Association for the Properties of Water and Steam (IAPWS), R7-97(2012), R12-08, R15-11, R1-76(2014), R8-97, R6-95(2018), R14-08(2011).\n-->\n';
const html=licenses+(await read('src/template.html')).replace('/* STYLES */',await read('src/styles.css')).replace('/* APPLICATION */',()=>code.replace(/<\/script/gi,'<\\/script'));
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('index.html',root),html);await writeFile(new URL('dist/index.html',root),html);
console.log(`Built standalone index.html and dist/index.html (${Buffer.byteLength(html)} bytes).`);
