import {calculate} from './engine.js';
import {gibbs} from './equations.js';
import {refractiveIndex} from './water-extra-properties.js';
// Formula mode for water and steam: property functions with named arguments,
// arithmetic, variables and one argument range per line, e.g.
//   h(p=10 бар; t=250 °C)
//   dh = h(p=10; t=550) - h(p=0.005; s=s(p=10; t=550))
//   cp(p=1; t=100..300 step 50)
// Arguments carry optional units; without a unit the base unit is used (MPa, °C for t,
// K for T, kJ/kg, kJ/(kg·K), kg/m³, m³/kg, fraction). Results use the same base units.
// Arithmetic is unit-free: it combines numbers in these base units.
// Errors are FnError objects with a stable code and parameters for translation.

export class FnError extends Error{constructor(code,params={}){super(code);this.name='FnError';this.code=code;this.params=params;}}
const fnFail=(code,params)=>{throw new FnError(code,params);};
const FN_K0=273.15;

// Property functions: key -> [base unit, kind]. kind: state | sat (saturation only).
export const FN_PROPERTIES=Object.freeze({
 p:['МПа','state'],t:['°C','state'],T:['K','state'],rho:['кг/м³','state'],v:['м³/кг','state'],h:['кДж/кг','state'],s:['кДж/(кг·K)','state'],u:['кДж/кг','state'],
 cp:['кДж/(кг·K)','state'],cv:['кДж/(кг·K)','state'],w:['м/с','state'],x:['–','state'],region:['–','state'],k:['–','state'],
 A:['кДж/кг','state'],G:['кДж/кг','state'],Z:['–','state'],alpha:['1/K','state'],kappa:['1/МПа','state'],
 dvdt:['м³/(кг·K)','state'],dvdp:['м³/(кг·МПа)','state'],dpdt:['МПа/K','state'],dpdv:['МПа·кг/м³','state'],
 drhodh:['кг²/(м³·кДж)','state'],drhodph:['кг/(м³·МПа)','state'],jt:['K/МПа','state'],ijt:['кДж/(кг·МПа)','state'],
 dc:['–','state'],pKw:['–','state'],nD:['–','state'],mu:['Па·с','state'],nu:['м²/с','state'],lambda:['Вт/(м·K)','state'],
 a:['м²/с','state'],Pr:['–','state'],sigma:['Н/м','state'],
 psat:['МПа','sat'],tsat:['°C','sat'],Tsat:['K','sat'],r:['кДж/кг','sat'],dpsdt:['МПа/K','sat']
});
// Function name -> key of the calculator state when they differ.
const FN_STATE_KEY={k:'isentropic',a:'diffusivity'};
export const FN_MATH=Object.freeze({sqrt:Math.sqrt,exp:Math.exp,ln:Math.log,log10:Math.log10,abs:Math.abs});

// Argument kinds with units: unit -> [factor, offset] to the base unit.
const FN_P_UNITS={'МПа':1,'MPa':1,'кПа':1e-3,'kPa':1e-3,'Па':1e-6,'Pa':1e-6,'бар':.1,'bar':.1,'мбар':1e-4,'mbar':1e-4,'атм':.101325,'atm':.101325,'кгс/см²':.0980665,'kgf/cm2':.0980665,'psi':.00689475729316836};
const FN_T_UNITS={'°C':[1,FN_K0],'℃':[1,FN_K0],'C':[1,FN_K0],'K':[1,0],'К':[1,0],'°F':[1/1.8,FN_K0-32/1.8],'F':[1/1.8,FN_K0-32/1.8]};
const FN_E_UNITS={'кДж/кг':1,'kJ/kg':1,'Дж/кг':1e-3,'J/kg':1e-3,'МДж/кг':1e3,'MJ/kg':1e3};
const FN_S_UNITS={'кДж/(кг·K)':1,'кДж/(кг·К)':1,'кДж/(кг K)':1,'kJ/(kg·K)':1,'kJ/(kg K)':1,'kJ/kgK':1,'Дж/(кг·K)':1e-3,'Дж/(кг·К)':1e-3,'J/(kg·K)':1e-3,'J/(kg K)':1e-3};
const FN_RHO_UNITS={'кг/м³':1,'кг/м3':1,'kg/m³':1,'kg/m3':1,'г/см³':1e3,'г/см3':1e3,'g/cm³':1e3,'g/cm3':1e3};
const FN_V_UNITS={'м³/кг':1,'м3/кг':1,'m³/kg':1,'m3/kg':1,'дм³/кг':1e-3,'л/кг':1e-3,'L/kg':1e-3,'см³/г':1e-3,'cm3/g':1e-3};
const FN_FRACTION_UNITS={'%':.01};
const FN_WL_UNITS={'мкм':1,'μm':1,'um':1,'нм':1e-3,'nm':1e-3};
export const FN_ARGUMENTS=Object.freeze({
 p:{units:FN_P_UNITS,base:'МПа'},t:{units:FN_T_UNITS,base:'°C',defaultUnit:'°C'},T:{units:FN_T_UNITS,base:'K',defaultUnit:'K'},
 h:{units:FN_E_UNITS,base:'кДж/кг'},u:{units:FN_E_UNITS,base:'кДж/кг'},s:{units:FN_S_UNITS,base:'кДж/(кг·K)'},
 rho:{units:FN_RHO_UNITS,base:'кг/м³'},v:{units:FN_V_UNITS,base:'м³/кг'},x:{units:FN_FRACTION_UNITS,base:'–'},
 p2:{units:FN_P_UNITS,base:'МПа'},eta:{units:FN_FRACTION_UNITS,base:'–'},wl:{units:FN_WL_UNITS,base:'мкм'},
 region:{units:{},base:'–'},model:{text:true}
});
const FN_ALL_UNITS=[...new Set(Object.values(FN_ARGUMENTS).flatMap(a=>Object.keys(a.units||{})))].sort((a,b)=>b.length-a.length);
// Pair of state arguments -> calculator mode (argument order follows the mode name).
const FN_MODES={'p,t':'pt','h,p':'ph','p,s':'ps','p,x':'px','t,x':'tx','h,s':'hs','h,t':'th','s,t':'ts','p,rho':'prho','rho,t':'trho','p,v':'pv','t,v':'tv','p,u':'pu','t,u':'tu','s,u':'us','s,v':'vs','h,v':'hv','u,v':'uv'};
const FN_MODE_ORDER={pt:['p','t'],ph:['p','h'],ps:['p','s'],px:['p','x'],tx:['t','x'],hs:['h','s'],th:['t','h'],ts:['t','s'],prho:['p','rho'],trho:['t','rho'],pv:['p','v'],tv:['t','v'],pu:['p','u'],tu:['t','u'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v']};
export const FN_MAX_POINTS=1000;

// ---------- Parser ----------
const fnIsDigit=c=>c>='0'&&c<='9';
const fnIsIdentStart=c=>/[A-Za-z_]/.test(c);
const fnIsIdent=c=>/[A-Za-z0-9_]/.test(c);
export function parseFnLine(source){
 const src=String(source);let i=0;
 const ws=()=>{while(i<src.length&&/\s/.test(src[i]))i++;};
 const peek=s=>{ws();return src.startsWith(s,i);};
 const eat=s=>{if(peek(s)){i+=s.length;return true;}return false;};
 const expect=s=>{if(!eat(s))fnFail('expected',{token:s,position:i+1});};
 function ident(){ws();if(!fnIsIdentStart(src[i]??''))return null;const start=i;while(i<src.length&&fnIsIdent(src[i]))i++;return src.slice(start,i);}
 function number(){
  ws();const start=i;while(fnIsDigit(src[i]??''))i++;
  if((src[i]==='.'||src[i]===',')&&fnIsDigit(src[i+1]??'')&&src[i+1]!=='.'){i++;while(fnIsDigit(src[i]??''))i++;}
  if(i===start)return null;
  if(/[eE]/.test(src[i]??'')&&(fnIsDigit(src[i+1]??'')||(/[+-]/.test(src[i+1]??'')&&fnIsDigit(src[i+2]??'')))){i+=2;while(fnIsDigit(src[i]??''))i++;}
  return Number(src.slice(start,i).replace(',','.'));
 }
 function expr(){let node=term();for(;;){if(peek('..'))return node;if(eat('+'))node={type:'bin',op:'+',a:node,b:term()};else if(eat('-'))node={type:'bin',op:'-',a:node,b:term()};else return node;}}
 function term(){let node=power();for(;;){if(eat('*'))node={type:'bin',op:'*',a:node,b:power()};else if(eat('/'))node={type:'bin',op:'/',a:node,b:power()};else return node;}}
 function power(){const base=unary();if(eat('^'))return {type:'bin',op:'^',a:base,b:power()};return base;}
 function unary(){if(eat('-'))return {type:'neg',a:unary()};if(eat('+'))return unary();return primary();}
 function primary(){
  ws();const n=number();if(n!=null)return {type:'num',value:n};
  if(eat('(')){const e=expr();expect(')');return e;}
  const start=i,name=ident();if(name==null)fnFail(i>=src.length?'unexpectedEnd':'unexpected',{token:src[i],position:i+1});
  if(eat('(')){
   if(FN_MATH[name]){const a=expr();expect(')');return {type:'math',name,a};}
   if(!FN_PROPERTIES[name])fnFail('unknownFunction',{name});
   const args=[];if(!peek(')'))do args.push(argument());while(eat(';'));expect(')');
   const seen=new Set();for(const a of args){if(seen.has(a.name))fnFail('duplicateArgument',{name:a.name});seen.add(a.name);}
   return {type:'call',name,args,position:start+1};
  }
  return {type:'var',name};
 }
 function unit(arg){
  ws();const spec=FN_ARGUMENTS[arg];
  for(const u of FN_ALL_UNITS){if(src.startsWith(u,i)&&!(fnIsIdent(u.at(-1))&&fnIsIdent(src[i+u.length]??''))){if(!spec.units[u])fnFail('wrongUnit',{unit:u,name:arg});i+=u.length;return u;}}
  return null;
 }
 function argument(){
  const name=ident();if(name==null)fnFail('expectedArgument',{position:i+1});
  if(!FN_ARGUMENTS[name])fnFail('unknownArgument',{name});
  expect('=');
  if(FN_ARGUMENTS[name].text){ws();const m=/^[A-Za-z0-9-]+/.exec(src.slice(i));if(!m)fnFail('expectedModel');i+=m[0].length;return {name,text:m[0]};}
  const value=expr();let to=null,step=null;
  if(eat('..')){to=expr();ws();const m=/^(step|крок)\b/u.exec(src.slice(i))||/^крок/.exec(src.slice(i));if(m){i+=m[0].length;step=expr();}}
  return {name,value,to,step,unit:unit(name)};
 }
 ws();let target=null;
 const save=i,name=ident();
 if(name!=null&&eat('=')&&!peek('='))target=name;else i=save;
 if(target&&(FN_PROPERTIES[target]||FN_MATH[target]))fnFail('reservedName',{name:target});
 const node=expr();ws();if(i<src.length)fnFail('unexpected',{token:src[i],position:i+1});
 return {target,node};
}

// ---------- Evaluation ----------
function fnConvert(arg,value,unit){
 const spec=FN_ARGUMENTS[arg];const u=unit??spec.defaultUnit;
 if(arg==='t'||arg==='T'){const [f,o]=FN_T_UNITS[u];return value*f+o;}
 return unit?value*spec.units[unit]:value;
}
function fnRangeValues(from,to,step){
 if(![from,to].every(Number.isFinite))fnFail('badRange');
 if(step==null)step=(to-from)/10;
 if(!Number.isFinite(step)||step===0||Math.sign(step)!==Math.sign(to-from||step))fnFail('badRange');
 const n=Math.floor((to-from)/step+1e-9)+1;if(n>FN_MAX_POINTS)fnFail('tooManyPoints',{max:FN_MAX_POINTS});
 const out=[];for(let k=0;k<n;k++)out.push(from+k*step);
 if(Math.abs(out.at(-1)-to)>Math.abs(step)*1e-9)out.push(to);
 return out.map(v=>Math.abs(v)<Math.abs(step)*1e-12?0:v);
}
function fnCollectRanges(node,out=[]){
 if(!node||typeof node!=='object')return out;
 if(node.type==='call')for(const a of node.args){if(a.to)out.push(a);fnCollectRanges(a.value,out);fnCollectRanges(a.to,out);fnCollectRanges(a.step,out);}
 for(const k of ['a','b'])fnCollectRanges(node[k],out);
 return out;
}
function fnNormalizeModel(text){const t=String(text).toUpperCase().replace(/[^A-Z0-9]/g,'');if(t==='IF97'||t==='IAPWSIF97')return 'IF97';if(t==='IAPWS95'||t==='95')return 'IAPWS-95';fnFail('unknownModel',{name:text});}

export function createFnEvaluator({model='IF97',calc=calculate}={}){
 const cache=new Map(),notes=new Set();
 const run=(mode,a,b,m)=>{const key=[mode,a,b,m].join('|');if(!cache.has(key)){try{cache.set(key,{value:calc(mode,a,b,m)});}catch(error){cache.set(key,{error});}}const r=cache.get(key);if(r.error)throw r.error;return r.value;};
 function stateValue(name,q,args){
  if(name==='t')return q.T-FN_K0;
  if(name==='nD'&&args.wl!=null)return refractiveIndex(q.T,q.rho,args.wl);
  const v=q[FN_STATE_KEY[name]??name];
  return v===undefined?null:v;
 }
 function saturationFor(args,m){
  const keys=Object.keys(args).filter(k=>['p','t'].includes(k));
  if(keys.length!==1||Object.keys(args).some(k=>!['p','t','model'].includes(k)))fnFail('saturationArgs');
  return keys[0]==='p'?run('satp',args.p,undefined,m).saturation:run('satt',args.t,undefined,m).saturation;
 }
 function call(node,env,fixed){
  const args={};let m=model;
  for(const a of node.args){
   if(a.name==='model'){m=fnNormalizeModel(a.text);continue;}
   const raw=a===fixed.arg?fixed.value:evaluate(a.value,env,fixed);
   if(!Number.isFinite(raw))fnFail('notNumber',{name:a.name});
   args[a.name==='T'?'t':a.name]=a.name==='region'?raw:fnConvert(a.name,raw,a.unit);
   if(a.name==='T'&&node.args.some(b=>b.name==='t'))fnFail('duplicateArgument',{name:'t'});
  }
  const [,kind]=FN_PROPERTIES[node.name];
  if(kind==='sat'){
   const sat=saturationFor(args,m);
   const value={psat:sat.p,tsat:sat.T-FN_K0,Tsat:sat.T,r:sat.latentHeat,dpsdt:sat.dpsdt}[node.name];
   if(!Number.isFinite(value))fnFail('unavailable',{name:node.name});return value;
  }
  const stateArgs=Object.keys(args).filter(k=>!['p2','eta','wl','region'].includes(k));
  if(node.name==='sigma'&&stateArgs.length===1){const sat=saturationFor({[stateArgs[0]]:args[stateArgs[0]]},m);return sat.liquid.sigma??fnFail('unavailable',{name:'sigma'});}
  if(stateArgs.length!==2)fnFail('pairNeeded',{name:node.name});
  const pair=[...stateArgs].sort().join(','),mode=FN_MODES[pair];if(!mode)fnFail('unsupportedPair',{pair:stateArgs.join(', ')});
  const [first,second]=FN_MODE_ORDER[mode].map(k=>args[k]);
  let q;
  if(args.region!=null){
   if(mode!=='pt'||m!=='IF97')fnFail('regionNeedsPT');
   if(![1,2,5].includes(args.region))fnFail('regionValue');
   if(args.p2!=null)fnFail('regionExpansion');
   notes.add('regionForced');
   q=gibbs(first,second,args.region);
   const v=name=>({t:q.T-FN_K0,T:q.T,p:q.p,rho:q.rho,v:q.v,h:q.h,s:q.s,u:q.u,cp:q.cp,cv:q.cv,w:q.w,alpha:q.alpha,region:args.region,k:q.w*q.w*q.rho/(q.p*1e6)})[name];
   const value=v(node.name);if(!Number.isFinite(value))fnFail('regionProperty',{name:node.name});return value;
  }
  const start=run(mode,first,second,m);
  q=start.state??null;
  if(args.p2!=null){
   if(!q)fnFail('unavailable',{name:node.name});
   const eta=args.eta??1;if(!(eta>0&&eta<=1))fnFail('etaRange');
   const ideal=run('ps',args.p2,q.s,m).state,h2=q.h-eta*(q.h-ideal.h);
   q=run('ph',args.p2,h2,m).state;notes.add('expansion');
  }else if(args.eta!=null)fnFail('etaNeedsP2');
  if(!q)fnFail('unavailable',{name:node.name});
  if(node.name==='dpsdt'&&q.dpsdt==null)fnFail('unavailable',{name:node.name});
  const value=stateValue(node.name,q,args);
  if(value==null||!Number.isFinite(value))fnFail('unavailable',{name:node.name});
  return value;
 }
 function evaluate(node,env,fixed={}){
  switch(node.type){
   case 'num':return node.value;
   case 'var':if(!(node.name in env))fnFail('unknownVariable',{name:node.name});return env[node.name];
   case 'neg':return -evaluate(node.a,env,fixed);
   case 'math':{const v=FN_MATH[node.name](evaluate(node.a,env,fixed));if(!Number.isFinite(v))fnFail('mathDomain',{name:node.name});return v;}
   case 'bin':{const a=evaluate(node.a,env,fixed),b=evaluate(node.b,env,fixed);const v=node.op==='+'?a+b:node.op==='-'?a-b:node.op==='*'?a*b:node.op==='/'?a/b:a**b;if(!Number.isFinite(v))fnFail('mathDomain',{name:node.op});return v;}
   case 'call':return call(node,env,fixed);
  }
  fnFail('unexpected',{token:node.type});
 }
 return {evaluate,fnCollectRanges,notes};
}

function fnResultUnit(node){
 if(node.type==='call')return FN_PROPERTIES[node.name][0];
 if(node.type==='neg')return fnResultUnit(node.a);
 return '';
}
// Evaluates the program text line by line. Empty lines and lines starting with # or // are skipped.
export function evaluateFnProgram(text,{model='IF97',calc}={}){
 const evaluator=createFnEvaluator({model,calc}),env={},lines=[];
 String(text??'').split(/\r?\n/).forEach((source,index)=>{
  const trimmed=source.trim();if(!trimmed||trimmed.startsWith('#')||trimmed.startsWith('//'))return;
  const line={line:index+1,source:trimmed};evaluator.notes.clear();
  try{
   const {target,node}=parseFnLine(trimmed);line.target=target;line.unit=fnResultUnit(node);
   const ranges=fnCollectRanges(node);
   if(ranges.length>1)fnFail('oneRange');
   if(ranges.length===1){
    if(target)fnFail('rangeAssign');
    const arg=ranges[0],from=evaluator.evaluate(arg.value,env),to=evaluator.evaluate(arg.to,env),step=arg.step?evaluator.evaluate(arg.step,env):null;
    line.argument=arg.name;line.argumentUnit=arg.unit??FN_ARGUMENTS[arg.name].defaultUnit??FN_ARGUMENTS[arg.name].base;
    line.rows=fnRangeValues(from,to,step).map(value=>{try{return {argument:value,value:evaluator.evaluate(node,env,{arg,value})};}catch(error){return {argument:value,value:null,error:fnErrorInfo(error)};}});
   }else{
    line.value=evaluator.evaluate(node,env);
    if(target)env[target]=line.value;
   }
  }catch(error){line.error=fnErrorInfo(error);}
  if(evaluator.notes.size)line.notes=[...evaluator.notes];
  lines.push(line);
 });
 return {model,lines,variables:{...env}};
}
export function fnErrorInfo(error){return error instanceof FnError?{code:error.code,params:error.params}:{code:'engine',params:{message:String(error?.message??error)}}}

// Builds a formula from a property, two named inputs and an optional model, e.g. for the form helper.
export function buildFnFormula(property,inputs,model){
 const parts=inputs.filter(i=>i&&i.name&&String(i.value??'').trim()!=='').map(i=>`${i.name}=${String(i.value).trim()}${i.unit?' '+i.unit:''}`);
 if(model&&model!=='IF97')parts.push('model='+model);
 return `${property}(${parts.join('; ')})`;
}

// CSV with ";" separators (decimal point kept) for a program result.
export function fnProgramCSV(result){
 const q=v=>{const s=String(v??'');return /[";\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 const rows=[['line','formula','argument','argument_unit','value','unit','error']];
 for(const l of result.lines){
  if(l.rows)for(const r of l.rows)rows.push([l.line,l.source,r.argument,l.argumentUnit,r.value??'',l.unit,r.error?.code??'']);
  else rows.push([l.line,l.source,'','',l.value??'',l.unit??'',l.error?.code??'']);
 }
 return rows.map(r=>r.map(q).join(';')).join('\n')+'\n';
}
