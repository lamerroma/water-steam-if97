import {staticCoolProp} from './coolprop-static-bindings.mjs';
// Dependency-free deterministic bundling. HTML opens via file:// without fetch or imports.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const files=['vendor/coolprop.js','src/humid-air-scientific.js','vendor/seuif97.js','src/coefficients.js','src/equations.js','src/transport.js','src/dielectric.js','src/extra-inputs.js','src/iapws95.js','src/engine.js','src/units.js','src/diagram-units.js','src/print-report.js','src/export.js','src/batch.js','src/processes.js','src/exergy.js','src/engineering.js','src/project.js','src/gas-data.js','src/gases.js','src/humid-air.js','src/cycles.js','src/phase-boundaries.js','src/comparison.js','src/ice.js','src/d2o.js','src/seawater.js','src/app.js','src/learning-export.js','src/learning-ui.js','src/phase-ui.js'];
let code='"use strict";\n(async()=>{\n';
code+='const WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
code+='const COOLPROP_WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/coolprop.wasm',root))).toString('base64'))+';\n';
for(const file of files) {
 let s=await read(file);
 if(file==='vendor/coolprop.js')s=(await staticCoolProp(s)).replace('async function Module(', 'async function createCoolProp(').replace('export default Module;','');
 s=s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'");
 code+=`\n// ${file}\n`+s+'\n';
 if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
}
code+='})();\n';
const licenses='<!--\n'+await read('LICENSE')+'\nSEUIF97 / RustSEUIF97:\n'+await read('vendor/SEUIF97-LICENSE')+'\nCantera NASA7 data / BSD-3-Clause:\n'+await read('vendor/CANTERA-LICENSE')+'\nCoolProp / MIT:\n'+await read('vendor/COOLPROP-LICENSE')+'\nFormulations and verification tables: International Association for the Properties of Water and Steam (IAPWS), R7-97(2012), R12-08, R15-11, R1-76(2014), R8-97, R6-95(2018), R14-08(2011), R10-06(2009), R13-08(2008), R16-17(2018).\n-->\n';
const html=licenses+(await read('src/template.html')).replace('/* STYLES */',await read('src/styles.css')).replace('/* APPLICATION */',()=>code.replace(/<\/script/gi,'<\\/script'));
const page=(await read('src/template.html'))
 .replace("script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'")
 .replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
 .replace('<style>/* STYLES */</style>','<link rel="stylesheet" href="assets/styles.css">')
 .replace('<script>/* APPLICATION */</script>','<script src="assets/app.js" defer></script>');
for(const prefix of ['', 'dist/']) {
 await mkdir(new URL(prefix+'assets/',root),{recursive:true});
 await writeFile(new URL(prefix+'index.html',root),licenses+page);
 await writeFile(new URL(prefix+'assets/styles.css',root),await read('src/styles.css'));
 await writeFile(new URL(prefix+'assets/app.js',root),code);
 await writeFile(new URL(prefix+'standalone.html',root),html);
}
console.log(`Built multi-file site and standalone.html (${Buffer.byteLength(html)} bytes).`);
