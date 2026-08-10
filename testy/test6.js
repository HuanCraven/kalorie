const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
async function run(engine){
  const b = await chromium.launch({executablePath:PROSTREDI.EXE,
    args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
          '--use-file-for-fake-video-capture='+PROSTREDI.DIR+'/bc.y4m']});
  const ctx = await b.newContext({viewport:{width:390,height:844},permissions:['camera'],serviceWorkers:'block'});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  if(engine==='zxing') await p.addInitScript(()=>{try{delete window.BarcodeDetector}catch(e){}});
  await p.route(/openfoodfacts\.org/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"status":0}'}));
  await p.route(/cdn\.jsdelivr\.net/, r=>r.abort());   // CDN musí být zbytečné
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(500);
  await p.click('nav button[data-p="scan"]');
  const t0=Date.now();
  await p.evaluate(() => setAdd('code'));   // v43: výchozí je Hledat
  await p.click('#camBtn');
  let code='', ms=0;
  for(let i=0;i<60;i++){
    await p.waitForTimeout(250);
    if(await p.isVisible('#modEdit')){ code=await p.inputValue('#edCode'); ms=Date.now()-t0; break; }
  }
  const detected = await p.evaluate(()=>({native:'BarcodeDetector' in window, zx: !!window.ZXing}));
  await b.close();
  return {engine, code, ms, detected, errs};
}
(async()=>{
  for(const e of ['native','zxing']){
    const r = await run(e);
    console.log(`${r.engine.padEnd(7)} kód=${r.code||'NIC'} za ${r.ms} ms | nativní API=${r.detected.native} | ZXing načten=${r.detected.zx} | chyby=${r.errs.length?r.errs.join(';'):'none'}`);
  }
})();
