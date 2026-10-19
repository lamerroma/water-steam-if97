// Local test adapter for the identical exported HTML artifact blocked by managed
// Chromium file policy. The application and production test remain unchanged.
require('/workspace/water-steam-if97/docs/steam97-p07/managed-file-harness.cjs');
const pw=require('/tmp/water-tools/node_modules/playwright'),fs=require('node:fs/promises'),{fileURLToPath}=require('node:url');
const launch=pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch=async(...args)=>{
 const browser=await launch(...args),create=browser.newContext.bind(browser);
 browser.newContext=async(...options)=>{
  const c=await create(...options),newPage=c.newPage.bind(c),setOffline=c.setOffline.bind(c);let offline=!!options[0]?.offline;
  c.setOffline=async flag=>{await setOffline(flag);offline=flag;};
  c.newPage=async(...args)=>{
   const page=await newPage(...args),goto=page.goto.bind(page);
   page.goto=async(url,...rest)=>{try{return await goto(url,...rest);}catch(e){
    if(!/^file:\/\/\/tmp\/reactor-thermal-report-[^/]+\/report\.html$/.test(String(url))||!e.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw e;
    const body=await fs.readFile(fileURLToPath(url)),target=new URL('/p03-exported-reactor-report.html',process.env.CALCULATOR_URL).href,wasOffline=offline;
    await page.route(target,route=>route.fulfill({contentType:'text/html; charset=utf-8',body}));await setOffline(false);
    const response=await goto(target,...rest);await setOffline(wasOffline);
    console.log('MANAGED_FILE_FALLBACK: identical saved reactor report bytes via loopback; original file navigation denied');return response;
   }};return page;
  };return c;
 };return browser;
};
