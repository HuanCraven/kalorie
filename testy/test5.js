const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const fs = require('fs');
const ZX = fs.readFileSync(require.resolve('@zxing/library/umd/index.min.js'),'utf8');

(async () => {
  const b = await chromium.launch({
    executablePath:PROSTREDI.EXE,
    args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
          '--use-file-for-fake-video-capture='+PROSTREDI.DIR+'/bc.y4m']
  });
  const ctx = await b.newContext({viewport:{width:390,height:844}, permissions:['camera'], serviceWorkers:'block'});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});

  // 1) simulace Firefoxu: žádný BarcodeDetector
  await p.addInitScript(() => { try{ delete window.BarcodeDetector; }catch(e){} });
  // 2) CDN nedostupné v sandboxu -> podstrčíme lokální kopii ZXing
  let cdnHit = false;
  await p.route(/cdn\.jsdelivr\.net/, r => { cdnHit = true;
    r.fulfill({status:200, contentType:'application/javascript', body: ZX}); });
  // 3) OFF nemockujeme -> chceme vidět, že se sken dostane až k vyhledání
  await p.route(/openfoodfacts\.org/, r => r.fulfill({status:200,contentType:'application/json',
    body: JSON.stringify({status:0})}));

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(600);
  console.log('0. BarcodeDetector přítomen?', await p.evaluate(()=>'BarcodeDetector' in window));
  console.log('   info panel:', (await p.textContent('#infoTxt')).split('\n')[0]);

  await p.click('nav button[data-p="scan"]');
  await p.click('#addSeg button[data-s="code"]');   // v43: výchozí je Hledat
  await p.click('#camBtn');
  // čekáme, až se kód rozpozná (hit() -> lookup -> nenalezeno -> otevře formulář s předvyplněným kódem)
  let found = '';
  for (let i=0;i<40;i++){
    await p.waitForTimeout(500);
    const msg = await p.textContent('#scanMsg');
    if (msg.startsWith('Kód:')) { found = msg; break; }
  }
  console.log('1. CDN fallback načten =', cdnHit);
  console.log('2. výsledek skenu =', found || 'NIC ZA 20 s');
  await p.waitForTimeout(1500);
  console.log('3. formulář otevřen =', await p.isVisible('#modEdit'),
              '| předvyplněný kód =', await p.inputValue('#edCode'));
  console.log('   (očekávám 8593893770317)');
  console.log('4. kamera zastavena po skenu =', await p.textContent('#camBtn'));

  // Firefox nemá clipboard.readText -> ověř, že to appku nepoloží
  const clip = await p.evaluate(async () => {
    const orig = navigator.clipboard;
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('x')}},configurable:true});
    try { await pasteLabel(); } catch(e) { return 'VYHODILO VÝJIMKU: '+e.message; }
    return 'ošetřeno, toast: ' + document.getElementById('toast').textContent;
  });
  console.log('5. bez clipboard.readText:', clip);

  // navigator.share bez podpory souborů (jako Firefox)
  const shr = await p.evaluate(async () => {
    delete navigator.canShare; delete navigator.share;
    labelFile = new File([new Uint8Array([1,2,3])],'x.png',{type:'image/png'});
    try { await shareLabel(); } catch(e) { return 'VYHODILO VÝJIMKU: '+e.message; }
    return 'ošetřeno, toast: ' + document.getElementById('toast').textContent;
  });
  console.log('6. bez Web Share:', shr);

  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
