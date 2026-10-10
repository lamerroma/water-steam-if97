// Precompile Emscripten binding factories at build time, keeping browser CSP free of eval.
import createCoolProp from '../vendor/coolprop.js';
import {readFile} from 'node:fs/promises';
export async function staticCoolProp(source){
 const OriginalFunction=globalThis.Function,compiled=new Map();
 globalThis.Function=new Proxy(OriginalFunction,{construct(target,args){const fn=Reflect.construct(target,args);compiled.set(JSON.stringify(args),fn.toString());return fn;}});
 try {const cp=await createCoolProp({wasmBinary:await readFile(new URL('../vendor/coolprop.wasm',import.meta.url)),print:()=>{},printErr:()=>{}});
 for(const output of ['W','H','V','C','D','B','Y','R'])cp.HAPropsSI(output,'P',101325,'T',303.15,'R',.5);
 cp.get_global_param_string('version');
 cp.PropsSI('Dmass','P',101325,'T',300,'HEOS::Nitrogen');
 }finally{globalThis.Function=OriginalFunction;}
 const factories=[...compiled].map(([key,fn])=>`case ${JSON.stringify(key)}: return (${fn});`).join('\n');
 return `function coolpropStaticFunction(...args){switch(JSON.stringify(args)){${factories}\ndefault:throw Error('Unsupported CoolProp binding factory');}}\n`+source.replace(/new Function\(/g,'coolpropStaticFunction(');
}
