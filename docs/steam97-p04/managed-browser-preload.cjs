// Local environment accommodation only. Explicit P03/P08/P09 fallbacks retain
// their own accurate mode reporting; other legacy browser tests log the fallback.
const script=require('node:path').basename(process.argv[1]||'');
if(script==='check-reactor-course-browser.cjs')require('/workspace/water-steam-if97/docs/steam97-p03/managed-report-harness.cjs');
else if(/^check-.*browser\.cjs$/.test(script)&&!/^check-steam97-p(?:03|04|08|09)/.test(script))require('/workspace/water-steam-if97/docs/steam97-p07/managed-file-harness.cjs');
