// Presentation only: never translate values or identifiers inside the calculation engine.
export function createTranslator(catalogs,initial='uk'){
 if(!catalogs.uk)throw Error('The Ukrainian fallback catalog is required.');
 const languages=Object.keys(catalogs),source=catalogs.uk;
 let language=languages.includes(initial)?initial:'uk';
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 const t=(key,parameters={})=>{
  const value=own(catalogs[language],key)?catalogs[language][key]:own(source,key)?source[key]:key;
  return String(value).replace(/\{([a-zA-Z][\w]*)\}/g,(match,name)=>own(parameters,name)?String(parameters[name]):match);
 };
 // Adapter for existing Ukrainian UI templates and engine messages. Exact strings
 // take precedence; dynamic headings use the longest matching catalog fragments.
 // New UI should use semantic t() keys. Data remains in its original language.
 const keys=new Map(Object.entries(source).filter(([k])=>k!=='language.name').map(([k,v])=>[v,k]));
 const phrases=[...keys.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
 const word=character=>character!=null&&/[\p{L}\p{N}]/u.test(character);
 const byInitial=new Map();
 for(const phrase of phrases){const initial=phrase[0];if(!byInitial.has(initial))byInitial.set(initial,[]);byInitial.get(initial).push(phrase);}
 function text(value){
  const raw=String(value??'');
  if(language==='uk')return raw;
  const clean=raw.trim(),key=keys.get(clean);
  if(key)return raw.replace(clean,t(key));
  let output='';
  for(let index=0;index<raw.length;){
   const match=(byInitial.get(raw[index])||[]).find(phrase=>raw.startsWith(phrase,index)&&!(word(phrase[0])&&word(raw[index-1]))&&!(word(phrase.at(-1))&&word(raw[index+phrase.length])));
   if(match){output+=t(keys.get(match));index+=match.length;}else{output+=raw[index];index++;}
  }
  return output;
 }
 return {t,text,languages,get language(){return language;},get numberLocale(){return language==='uk'?'uk-UA':language;},setLanguage(next){language=languages.includes(next)?next:'uk';return language;}};
}
