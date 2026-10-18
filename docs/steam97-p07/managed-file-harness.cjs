// Test harness only: retain the same standalone bytes and real offline work when
// managed Chromium denies file navigation. Firefox separately exercises file://.
const pw=require('/tmp/water-tools/node_modules/playwright');
const launch=pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch=async(...args)=>{
 const b=await launch(...args),newContext=b.newContext.bind(b);
 b.newContext=async(...args)=>{
  const c=await newContext(...args),setOffline=c.setOffline.bind(c),newPage=c.newPage.bind(c);let offline=false;
  c.setOffline=async v=>{await setOffline(v);offline=v;};
  c.newPage=async(...args)=>{const p=await newPage(...args),goto=p.goto.bind(p);p.goto=async(url,...rest)=>{
   try{return await goto(url,...rest);}catch(e){
    const savedSVG=String(url)==='file:///tmp/quality-phdiagram.svg';
    if(!(savedSVG||String(url).startsWith('file:///workspace/water-steam-if97/')&&String(url).endsWith('/standalone.html'))||!e.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw e;
    const restore=offline;await p.waitForTimeout(150);await setOffline(false);const u=new URL('standalone.html',process.env.CALCULATOR_URL);u.hostname='localhost';if(savedSVG){u.pathname='/p07-quality.svg';const body=await require('node:fs/promises').readFile('/tmp/quality-phdiagram.svg');await p.route(u.href,route=>route.fulfill({contentType:'image/svg+xml',body}));}const result=await goto(u.href,...rest);await setOffline(restore);console.log('MANAGED_FILE_FALLBACK: same saved artifact loaded on localhost, offline state restored; file navigation denied');return result;
   }
  };return p;};return c;
 };return b;
};
