import {staticCoolProp} from './coolprop-static-bindings.mjs';
// Dependency-free deterministic bundling for the installable, offline PWA.
import {readFile,readdir,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const assetVersion=content=>createHash('sha256').update(content).digest('hex').slice(0,16);
// Content-versioned WASM has one cache key shared by the page and lazy Workers.
const coolpropWasmBytes=await readFile(new URL('vendor/coolprop.wasm',root));
const coolpropWasmPath='assets/coolprop.wasm?v='+assetVersion(coolpropWasmBytes);
const coolpropStaticSource=(await staticCoolProp(await read('vendor/coolprop.js'))).replace('async function Module(', 'async function createCoolProp(').replace('export default Module;','');
const pythonVendor=JSON.parse(await read('vendor/python/manifest.json'));
const pythonRevision=assetVersion(JSON.stringify(pythonVendor));
const pythonBase='assets/python/'+pythonRevision+'/';
const pythonPackage={revision:pythonRevision,base:pythonBase,pyodide:pythonVendor.pyodide,python:pythonVendor.python,packages:pythonVendor.packages,
 files:pythonVendor.files.map(file=>({url:pythonBase+file.path,sha256:file.sha256,bytes:file.bytes})),bytes:pythonVendor.files.reduce((sum,file)=>sum+file.bytes,0)};
const catalogs={};
for(const file of (await readdir(new URL('src/locales/',root))).filter(file=>/^[a-z]{2}(?:-[A-Z]{2})?\.json$/.test(file)).sort()){
 const language=file.slice(0,-5),catalog=JSON.parse(await read('src/locales/'+file));
 if(!catalog['language.name']||Object.values(catalog).some(value=>typeof value!=='string'))throw Error('Invalid language catalog: '+file);
 catalogs[language]=catalog;
}
if(!catalogs.uk||!catalogs.en)throw Error('Ukrainian and English catalogs are required.');
for(const [language,catalog] of Object.entries(catalogs))for(const key of Object.keys(catalog))if(!(key in catalogs.uk))throw Error('Unknown translation key: '+language+'/'+key);
const files=['src/water-models.js','src/script-assets.js','src/provenance.js','vendor/coolprop.js','src/humid-air-scientific.js','vendor/seuif97.js','src/coefficients.js','src/precision.js','src/critical-eos.js','src/equations.js','src/transport.js','src/dielectric.js','src/phase-boundaries.js','src/water-validity.js','src/inverse-diagnostics.js','src/extra-inputs.js','src/inverse-phase-bracket.js','src/iapws95.js','src/engine.js','src/gas-data.js','src/gas-bsw2003-data.js','src/gas-bsw2003.js','src/gas-dissociation.js','src/gas-table-rows.js','src/gases.js','src/process-gas.js','src/water-process.js','src/cycle-chart.js','src/adiabatic-machine.js','src/rankine-regeneration.js','src/custom-cycle.js','src/cycle-library.js','src/rankine-library.js','src/rankine-sweep.js','src/units.js','src/input-rounding.js','src/ui-quantities.js','src/ux-display.js','src/pressure.js','src/smart-input.js','src/pipe-verification.js','src/flow.js','src/nuclear.js','src/cycle-study.js','src/exchanger-design.js','src/research.js','src/laboratory.js','src/reactor-methods.js','src/reactor-variants.js','src/reactor-course.js','src/reactor-nuclear-data.js','src/reactor-neutronics.js','src/reactor-coverage.js','src/reactor-reference-data.js','src/reactor-verification.js','src/reactor-course-tables.js','src/coursework.js','src/study-workflow.js','src/state-comparison.js','src/study-report.js','src/diagram-units.js','src/diagram-coordinates.js','src/diagram-guides.js','src/diagram-series.js','src/diagram-series-ui.js','src/diagram-chart-data.js','src/diagram-render-geometry.js','src/diagram-chart.js','src/diagram-svg.js','src/diagram-refinement.js','src/saturation-grid.js','src/diagram-workspace.js','src/print-report.js','src/export.js','src/tabular-data.js','src/spreadsheet.js','src/spreadsheet-ui.js','src/result-copy.js','src/calculator-result-tools.js','src/batch.js','src/processes.js','src/exergy.js','src/engineering.js','src/workspace.js','src/project.js','src/project-library.js','src/real-gases.js','src/humid-air.js','src/cycles.js','src/study-process-paths.js','src/study-viewport.js','src/profile-convergence.js','src/comparison.js','src/ice.js','src/d2o.js','src/seawater.js','src/glossary.js','src/input-guidance.js','src/tool-catalog.js','src/tool-navigation.js','src/app.js','src/study-ui.js','src/sprint-ui.js','src/study-interaction.js','src/study-chart-workspace.js','src/laboratory-ui.js','src/reactor-course-ui.js','src/coursework-ui.js','src/pwa.js','src/learning-export.js','src/learning-ui.js','src/gas-tables-ui.js','src/saturation-grid-ui.js','src/phase-ui.js','src/flow-ui.js','src/water-process-ui.js','src/custom-cycle-ui.js','src/cycle-library-ui.js','src/rankine-sweep-ui.js','src/tutorials.js','src/ui-workspace.js','src/calculator-workspace-ui.js','src/study-workflow-ui.js','src/ui-task-layout.js'];
files.splice(files.indexOf('src/workspace.js'),0,'src/library-recipe.js');
// Keep CoolProp WASM separate from app.js. The PWA caches the complete current
// release, while the calculation engine initializes only when its panel needs it.
// Reuse the existing deterministic module order for the worker's pure imports.
const workerModules=new Set();
async function collectWorkerModules(file,workerModules){
 if(workerModules.has(file))return;workerModules.add(file);
 for(const match of (await read(file)).matchAll(/^import .*?from ['"]([^'"]+)['"];?$/gm)){
  const dependency=new URL(match[1],new URL(file,root));
  if(!dependency.href.startsWith(root.href))throw Error('Worker dependency outside repository');
  await collectWorkerModules(dependency.href.slice(root.href.length),workerModules);
 }
}
await collectWorkerModules('src/calculator-worker.js',workerModules);
const heosWorkerModules=new Set();await collectWorkerModules('src/heos-calculator-worker.js',heosWorkerModules);
// Protocol follows units; adapters follow all numerical dependencies in this deterministic bundle.
files.splice(files.indexOf('src/units.js')+1,0,'src/calculation-protocol.js','src/python-package.js');
files.splice(files.indexOf('src/calculation-protocol.js')+1,0,'src/calculation-adapter-registry.js','src/water-heos.js');
files.push('src/library-recipe-runner.js','src/water-heos-ui.js','src/python-library-recipes-ui.js','src/python-libraries-ui.js');
const workerFiles=[...files.filter(file=>workerModules.has(file)),'src/calculation-modules.js','src/calculator-worker.js'];
for(const file of workerModules)if(!workerFiles.includes(file))throw Error('Missing worker module: '+file);
const heosWorkerFiles=[...files.filter(file=>heosWorkerModules.has(file)),'src/calculation-modules.js','src/heos-calculator-worker.js'];
for(const file of heosWorkerModules)if(!heosWorkerFiles.includes(file))throw Error('Missing HEOS worker module: '+file);
const implementationHash=createHash('sha256');
for(const file of new Set([...workerFiles,...heosWorkerFiles]))implementationHash.update(file).update('\0').update(await read(file)).update('\0');
implementationHash.update(await readFile(new URL('vendor/seuif97_bg.wasm',root)));
implementationHash.update(coolpropWasmBytes);
implementationHash.update(await read('scripts/coolprop-static-bindings.mjs'));
for(const file of ['src/python-package.js','src/python-module-worker.js','src/python-library-bridge.py','src/python-pipe.py','src/pipe-verification.js'])implementationHash.update(file).update(await read(file));
implementationHash.update(JSON.stringify(pythonVendor));
const implementationRevision=implementationHash.digest('hex');
let pythonWorkerCode='"use strict";\nconst CALCULATION_IMPLEMENTATION_REVISION = '+JSON.stringify(implementationRevision)+';\nconst PYTHON_PACKAGE = '+JSON.stringify(pythonPackage)+';\nconst PYTHON_BRIDGE_SOURCE = '+JSON.stringify((await read('src/python-library-bridge.py'))+'\n'+(await read('src/python-pipe.py')))+';\n';
for(const file of ['src/units.js','src/calculation-protocol.js','src/python-package.js','src/pipe-verification.js','src/python-module-worker.js'])pythonWorkerCode+='\n'+(await read(file)).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')+'\n';
const pythonWorkerPath='assets/python-worker.js?v='+assetVersion(pythonWorkerCode);
async function buildWorkerCode(sources){
 let code='"use strict";\n(async()=>{\nconst CALCULATION_IMPLEMENTATION_REVISION = '+JSON.stringify(implementationRevision)+';\nconst WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
 code+='const COOLPROP_WASM_URL = '+JSON.stringify(coolpropWasmPath.replace('assets/','./'))+';\n';
 for(const file of sources){
  code+='\n// '+file+'\n'+(file==='vendor/coolprop.js'?coolpropStaticSource:await read(file)).replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'")+'\n';
  if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
 }
 return code+'})();\n';
}
const calculatorWorkerCode=await buildWorkerCode(workerFiles),heosWorkerCode=await buildWorkerCode(heosWorkerFiles);
const calculatorWorkerPath='assets/calculator-worker.js?v='+assetVersion(calculatorWorkerCode);
const heosWorkerPath='assets/heos-calculator-worker.js?v='+assetVersion(heosWorkerCode);
const spreadsheetCode=await readFile(new URL('vendor/sheetjs.cjs',root));
const spreadsheetPath='assets/sheetjs.js?v='+assetVersion(spreadsheetCode);
async function buildCode() {
 let code=(await read('vendor/chart.umd.min.js')).replace(/\/\/# sourceMappingURL=.*$/gm,'')+'\n;\n';
 code+='"use strict";\n(async()=>{\n/* BUILD_INFO */\n';
 code+='const LOCALIZATION_CATALOGS = '+JSON.stringify(catalogs)+';\n';
 code+='const DefaultSheetJS=null;\nconst SPREADSHEET_LIBRARY_URL = '+JSON.stringify(spreadsheetPath)+';\n';
 for(const file of ['src/i18n.js','src/i18n-ui.js'])code+='\n'+(await read(file)).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')+'\n';
 code+='const WASM_BASE64 = '+JSON.stringify((await readFile(new URL('vendor/seuif97_bg.wasm',root))).toString('base64'))+';\n';
 code+='const CALCULATOR_WORKER_URL = '+JSON.stringify(calculatorWorkerPath)+';\n';
 code+='const HEOS_WORKER_URL = '+JSON.stringify(heosWorkerPath)+';\n';
 code+='const COOLPROP_WASM_URL = '+JSON.stringify(coolpropWasmPath)+';\n';
 code+='const PYTHON_WORKER_URL = '+JSON.stringify(pythonWorkerPath)+';\nconst PYTHON_PACKAGE = '+JSON.stringify(pythonPackage)+';\n';
 code+='const CALCULATION_IMPLEMENTATION_REVISION = '+JSON.stringify(implementationRevision)+';\n';
 for(const file of files) {
  if(file==='src/app.js')code+='\n'+(await read('src/calculator-runner.js')).replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')+'\n';
  let s=await read(file);
  if(file==='vendor/coolprop.js')s=coolpropStaticSource;
  s=s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{.*?\};\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.url/g,"'file:///unused'");
  code+=`\n// ${file}\n`+s+'\n';
  if(file==='vendor/seuif97.js')code+='const init=__wbg_init;\n';
 }
 code+='})();\n';
 return code;
}
let codeMultiFile=await buildCode();
const styles=await read('src/styles.css');
const template=await read('src/template.html');
const {version}=JSON.parse(await read('package.json'));
// Content-derived ID stays identical locally, in CI and in the offline build.
const buildId=createHash('sha256').update(version).update(codeMultiFile).update(calculatorWorkerCode).update(await readFile(new URL('vendor/coolprop.wasm',root))).update(styles).update(template).update(await read('src/service-worker.js')).update(await read('scripts/build.mjs')).update(await readFile(new URL('src/icons/icon-192.png',root))).update(await readFile(new URL('src/icons/icon-512.png',root))).digest('hex').slice(0,12);
const buildInfo=`const APP_BUILD = ${JSON.stringify({version,id:buildId})};\n`+
 "document.getElementById('app-version-value').textContent=APP_BUILD.version;\n"+
 "document.getElementById('app-build-value').textContent=APP_BUILD.id;";
codeMultiFile=codeMultiFile.replace('/* BUILD_INFO */',()=>buildInfo);
const versionedTemplate=template.replaceAll('{{APP_VERSION}}',version).replaceAll('{{APP_BUILD_ID}}',buildId);
const licenses='<!--\n'+await read('vendor/MODELICA-LICENSE')+'\n'+await read('LICENSE')+'\nSEUIF97 / RustSEUIF97:\n'+await read('vendor/SEUIF97-LICENSE')+'\nCantera NASA7 data / BSD-3-Clause:\n'+await read('vendor/CANTERA-LICENSE')+'\nChart.js 4.5.1 / MIT:\n'+await read('vendor/CHARTJS-LICENSE')+'\nSheetJS CE 0.20.3 / Apache-2.0:\n'+await read('vendor/SHEETJS-LICENSE')+'\nCoolProp / MIT:\n'+await read('vendor/COOLPROP-LICENSE')+'\nFormulations and verification tables: International Association for the Properties of Water and Steam (IAPWS), R7-97(2012), R12-08, R15-11, R1-76(2014), R8-97, R6-95(2018), R14-08(2011), R10-06(2009), R13-08(2008), R16-17(2018).\n-->\n';
const page=versionedTemplate.replace('</head>', '<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#125a88"><link rel="apple-touch-icon" href="assets/icon-192.png"></head>')
 .replace('<style>/* STYLES */</style>',`<link rel="stylesheet" href="assets/styles.css?v=${assetVersion(styles)}">`)
 .replace('<script>/* APPLICATION */</script>',`<script src="assets/app.js?v=${assetVersion(codeMultiFile)}" defer></script>`);
const resources=['index.html',`assets/app.js?v=${assetVersion(codeMultiFile)}`,`assets/styles.css?v=${assetVersion(styles)}`,coolpropWasmPath,'manifest.webmanifest','assets/icon-192.png','assets/icon-512.png',calculatorWorkerPath,heosWorkerPath,pythonWorkerPath,'assets/python-package.json',spreadsheetPath];
const manifest=JSON.stringify({id:'./',name:'Навчальний теплофізичний калькулятор',short_name:'ThermoCalc',lang:'uk',start_url:'./',scope:'./',display:'standalone',background_color:'#eef4f8',theme_color:'#125a88',icons:[192,512].map(size=>({src:`assets/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))},null,2);
const coolpropWasm=await readFile(new URL('vendor/coolprop.wasm',root));
const resourceData={'index.html':licenses+page,[resources[1]]:codeMultiFile,[resources[2]]:styles,[resources[3]]:coolpropWasm,'manifest.webmanifest':manifest};
resourceData[spreadsheetPath]=spreadsheetCode;
resourceData[calculatorWorkerPath]=calculatorWorkerCode;
resourceData[heosWorkerPath]=heosWorkerCode;
resourceData[pythonWorkerPath]=pythonWorkerCode;
resourceData['assets/python-package.json']=JSON.stringify(pythonPackage,null,2)+'\n';
for(const size of [192,512])resourceData[`assets/icon-${size}.png`]=await readFile(new URL(`src/icons/icon-${size}.png`,root));
const digests=Object.fromEntries(Object.entries(resourceData).map(([path,content])=>[path,createHash('sha256').update(content).digest('hex')]));
const worker=(await read('src/service-worker.js')).replace('/* PWA_CONFIG */',`const BUILD=${JSON.stringify({version,id:buildId})};const RESOURCES=${JSON.stringify(resources)};const DIGESTS=${JSON.stringify(digests)};const PYTHON_PACKAGE=${JSON.stringify(pythonPackage)};`);
for(const prefix of ['', 'dist/']) {
 await mkdir(new URL(prefix+'assets/',root),{recursive:true});
 await writeFile(new URL(prefix+'index.html',root),licenses+page);
 await writeFile(new URL(prefix+'assets/styles.css',root),styles);
 await writeFile(new URL(prefix+'assets/app.js',root),codeMultiFile);
 await writeFile(new URL(prefix+'assets/sheetjs.js',root),spreadsheetCode);
 await writeFile(new URL(prefix+'assets/calculator-worker.js',root),calculatorWorkerCode);
 await writeFile(new URL(prefix+'assets/heos-calculator-worker.js',root),heosWorkerCode);
 await writeFile(new URL(prefix+'assets/python-worker.js',root),pythonWorkerCode);
 await writeFile(new URL(prefix+'assets/python-package.json',root),resourceData['assets/python-package.json']);
 for(const file of pythonVendor.files){
  const data=await readFile(new URL('vendor/python/'+file.path,root));if(data.length!==file.bytes||createHash('sha256').update(data).digest('hex')!==file.sha256)throw Error('Python vendor checksum mismatch: '+file.path);
  const target=new URL(prefix+pythonBase+file.path,root);await mkdir(new URL('./',target),{recursive:true});await writeFile(target,data);
 }
 await writeFile(new URL(prefix+'assets/coolprop.wasm',root),coolpropWasm);
 // Remove only the obsolete generated page, including after upgrading an old checkout.
 await rm(new URL(prefix+'standalone.html',root),{force:true});
 await writeFile(new URL(prefix+'service-worker.js',root),worker);
 await writeFile(new URL(prefix+'manifest.webmanifest',root),manifest);
 for(const size of [192,512])await writeFile(new URL(prefix+`assets/icon-${size}.png`,root),await readFile(new URL(`src/icons/icon-${size}.png`,root)));
}
console.log(`Built offline PWA (${Buffer.byteLength(codeMultiFile)} bytes app.js + separate workers/WASM) in root and dist/.`);
