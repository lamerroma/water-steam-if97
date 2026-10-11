import {staticCoolProp} from './coolprop-static-bindings.mjs';
// Dependency-free deterministic bundling. HTML opens via file:// without fetch or imports.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const catalogs={};
for(const file of (await readdir(new URL('src/locales/',root))).filter(file=>/^[a-z]{2}(?:-[A-Z]{2})?\.json$/.test(file)).sort()){
 const language=file.slice(0,-5),catalog=JSON.parse(await read('src/locales/'+file));
 if(!catalog['language.name']||Object.values(catalog).some(value=>typeof value!=='string'))throw Error('Invalid language catalog: '+file);
 catalogs[language]=catalog;
}
if(!catalogs.uk||!catalogs.en)throw Error('Ukrainian and English catalogs are required.');
for(const [language,catalog] of Object.entries(catalogs))for(const key of Object.keys(catalog))if(!(key in catalogs.uk))throw Error('Unknown translation key: '+language+'/'+key);
const files=['vendor/coolprop.js','src/humid-air-scientific.js','vendor/seuif97.js','src/coefficients.js','src/equations.js','src/transport.js','src/dielectric.js','src/extra-inputs.js','src/iapws95.js','src/engine.js','src/units.js','src/ux-display.js','src/pressure.js','src/flow.js','src/diagram-units.js','src/diagram-workspace.js','src/print-report.js','src/export.js','src/batch.js','src/processes.js','src/exergy.js','src/engineering.js','src/workspace.js','src/project.js','src/gas-data.js','src/gases.js','src/real-gases.js','src/humid-air.js','src/cycles.js','src/phase-boundaries.js','src/comparison.js','src/ice.js','src/d2o.js','src/seawater.js','src/glossary.js','src/input-guidance.js','src/app.js','src/learning-export.js','src/learning-ui.js','src/phase-ui.js','src/flow-ui.js','src/tutorials.js'];
// The CoolProp WASM binary (~9 MB) is the dominant cost of the bundle. The standalone
// single-file build must embed it (no network allowed, file:// only). The multi-file
// site build instead ships it as a separate asset fetched lazily on first use of a
// gases/humid-air panel (see ensureCoolProp() in app.js), so its initial app.js stays
// a few hundred KB and students who only need plain steam tables never download it.
async function buildCode(embedCoolProp) {
 let code='"use strict";\n(async()=>{\n';
 code+='const LOCALIZATION_CATALOGS = '+JSON.stringify(catalogs)+';\n';
 for(const file of ['src/i18n.js','src/i18n-ui.js'])code+='\n'+(await read(file)).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')+'\n';
 code+='const WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
 if(embedCoolProp)code+='const COOLPROP_WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/coolprop.wasm',root))).toString('base64'))+';\n';
 for(const file of files) {
  let s=await read(file);
  if(file==='vendor/coolprop.js')s=(await staticCoolProp(s)).replace('async function Module(', 'async function createCoolProp(').replace('export default Module;','');
  s=s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'");
  code+=`\n// ${file}\n`+s+'\n';
  if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
 }
 code+='})();\n';
 return code;
}
const codeStandalone=await buildCode(true);
const codeMultiFile=await buildCode(false);
const licenses='<!--\n'+await read('LICENSE')+'\nSEUIF97 / RustSEUIF97:\n'+await read('vendor/SEUIF97-LICENSE')+'\nCantera NASA7 data / BSD-3-Clause:\n'+await read('vendor/CANTERA-LICENSE')+'\nCoolProp / MIT:\n'+await read('vendor/COOLPROP-LICENSE')+'\nFormulations and verification tables: International Association for the Properties of Water and Steam (IAPWS), R7-97(2012), R12-08, R15-11, R1-76(2014), R8-97, R6-95(2018), R14-08(2011), R10-06(2009), R13-08(2008), R16-17(2018).\n-->\n';
const html=licenses+(await read('src/template.html')).replace('/* STYLES */',await read('src/styles.css')).replace('/* APPLICATION */',()=>codeStandalone.replace(/<\/script/gi,'<\\/script'));
const page=(await read('src/template.html'))
 .replace("script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline'")
 .replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
 .replace("connect-src 'none'", "connect-src 'self'")
 .replace('<style>/* STYLES */</style>','<link rel="stylesheet" href="assets/styles.css">')
 .replace('<script>/* APPLICATION */</script>','<script src="assets/app.js" defer></script>');
const coolpropWasm=await readFile(new URL('vendor/coolprop.wasm',root));
for(const prefix of ['', 'dist/']) {
 await mkdir(new URL(prefix+'assets/',root),{recursive:true});
 await writeFile(new URL(prefix+'index.html',root),licenses+page);
 await writeFile(new URL(prefix+'assets/styles.css',root),await read('src/styles.css'));
 await writeFile(new URL(prefix+'assets/app.js',root),codeMultiFile);
 await writeFile(new URL(prefix+'assets/coolprop.wasm',root),coolpropWasm);
 await writeFile(new URL(prefix+'standalone.html',root),html);
}
console.log(`Built multi-file site (${Buffer.byteLength(codeMultiFile)} bytes app.js + lazy coolprop.wasm) and standalone.html (${Buffer.byteLength(html)} bytes).`);
