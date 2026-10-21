import {calculate} from './engine.js';
import {parseNumber,toCanonical,englishProperty} from './units.js';
export function batchUnits(mode){const energy=['kJkg','Jkg','Btulb'],volume=['m3kg','ft3lb'];return {a:['satt','tx','th','ts','trho','tv','tu'].includes(mode)?['C','K','F']:['hs','hv','us','uv'].includes(mode)?energy:mode==='vs'?volume:['MPa','kPa','Pa','bar','atm','psi'],b:['prho','trho'].includes(mode)?['kgm3','lbft3']:['pv','tv','hv','uv'].includes(mode)?volume:['px','tx'].includes(mode)?['fraction','percent']:['ph','th','pu','tu'].includes(mode)?energy:['ps','ts','hs','us','vs'].includes(mode)?['kJkgK','JkgK','BtulbR']:['C','K','F']};}
export function batchRange({mode,vary,start,end,count,fixed,ua,ub}){
 if(!['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'].includes(mode)||!['a','b'].includes(vary))throw Error('Невірний режим серії.');
 if(![start,end,count].every(Number.isFinite)||!Number.isInteger(count)||count<2||count>500)throw Error('Кількість точок має бути цілим числом 2…500.');
 if(!mode.startsWith('sat')&&!Number.isFinite(fixed))throw Error('Введіть фіксований параметр.');
 if(mode.startsWith('sat')&&vary!=='a')throw Error('Для насичення змінюється лише перший параметр.');
 return Array.from({length:count},(_,i)=>({mode,a:vary==='a'?start+(end-start)*i/(count-1):fixed,b:vary==='b'?start+(end-start)*i/(count-1):fixed,ua,ub,name:`Точка ${i+1}`}));
}
export function parseBatchCSV(text){
 if(typeof text!=='string'||text.length>1000000)throw Error('CSV має бути не більшим за 1 МБ.');
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];const delimiter=first.includes(';')?';':',';
 const records=[];let fields=[],field='',quoted=false,closed=false;
 for(let i=0;i<=text.length;i++){
 const c=i===text.length?'\n':text[i];
 if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c==='"'){if(field||closed)throw Error('Некоректні лапки CSV.');quoted=true;continue;}
 if(c===delimiter||c==='\n'||c==='\r'){fields.push(field);field='';closed=false;if(c!==delimiter){if(c==='\r'&&text[i+1]==='\n')i++;if(fields.some(v=>v.trim()))records.push(fields);fields=[];}continue;}
 if(closed&&!/\s/.test(c))throw Error('Текст після закритих лапок CSV.');if(!closed)field+=c;
 }
 if(quoted)throw Error('Незакриті лапки CSV.');
 const header=records.shift()?.map(x=>x.trim());const required=['mode','a','b','unit_a','unit_b'];
 if(!header||!required.every(k=>header.includes(k))||new Set(header).size!==header.length||header.some(k=>!required.concat('name').includes(k)))throw Error('Заголовок CSV: mode,a,b,unit_a,unit_b,name (name необов’язково).');
 if(!records.length||records.length>500)throw Error('CSV має містити 1…500 станів.');
 return records.map((r,i)=>{if(r.length!==header.length)throw Error(`Рядок ${i+2}: неправильна кількість стовпців.`);const q=Object.fromEntries(header.map((k,j)=>[k,r[j].trim()]));return {mode:q.mode,a:q.a,b:q.b,ua:q.unit_a,ub:q.unit_b,name:q.name||`CSV ${i+1}`};});
}
export function calculateBatch(inputs,model='IF97'){
 if(!Array.isArray(inputs)||inputs.length<1||inputs.length>500)throw Error('Серія має містити 1…500 станів.');
 return inputs.map((input,i)=>{try{
 if(!['pt','ph','ps','satp','satt','px','tx','hs','th','ts','prho','trho','pv','tv','pu','tu','us','vs','hv','uv'].includes(input.mode))throw Error('Невідомий режим.');
 const units=batchUnits(input.mode);if(!units.a.includes(input.ua)||(!input.mode.startsWith('sat')&&!units.b.includes(input.ub)))throw Error('Одиниці не відповідають режиму.');
 const a=toCanonical(parseNumber(input.a),input.ua),b=input.mode.startsWith('sat')?undefined:toCanonical(parseNumber(input.b),input.ub),result=calculate(input.mode,a,b,model);
 if(model==='HEOS::Water'){
  for(const state of [result.state,...(result.alternatives||[])].filter(Boolean))state.source={mode:input.mode,a,b};
  if(result.saturation)for(const state of [result.saturation.liquid,result.saturation.vapor])state.source={mode:'px',a:state.p,b:state.x};
 }
 return {input:{...input,name:String(input.name||`Точка ${i+1}`).slice(0,80)},result};
 }catch(e){return {input:{...input,name:String(input.name||`Точка ${i+1}`).slice(0,80)},error:e.message};}});
}
export function batchStates(record){return record.result?.state?[record.result.state]:record.result?.saturation?[record.result.saturation.liquid,record.result.saturation.vapor]:[];}
export function batchCSV(records,system='si',energy='kJ'){
 const keys=['p','T','h','s','v','rho','cp','cv','w','x','region'];
 const units={p:'MPa',T:'K',h:'kJ/kg',s:'kJ/(kg K)',v:'m3/kg',rho:'kg/m3',cp:'kJ/(kg K)',cv:'kJ/(kg K)',w:'m/s',x:'-',region:'-'};
 const conv=(k,v)=>system==='english'?englishProperty(k,v,units[k]):energy==='J'&&['h','s','cp','cv'].includes(k)?[v==null?null:v*1000,units[k].replace('kJ','J')]:[v,units[k]];
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const safe=s=>/^[=+\-@]/.test(s)?"'"+s:s;
 const table=[['name','status',...keys.map(k=>`${k} [${conv(k,null)[1]}]`),'model','phase','message']];
 for(const r of records){if(r.error)table.push([safe(r.input.name),'error',...keys.map(()=>''),'','',safe(r.error)]);else for(const q of batchStates(r))table.push([safe(r.input.name),'ok',...keys.map(k=>conv(k,q[k])[0]),q.model||'IF97',q.phase,(q.notes||[]).join(' | ')]);}
 return '\uFEFF'+table.map(row=>row.map(quote).join(',')).join('\r\n');
}
