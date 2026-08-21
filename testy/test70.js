/* Test v93 — postřehy vedou na kartu, ze které vycházejí, a u matoucích čísel
   je krátké vysvětlení. Dřív postřeh jen konstatoval a kartu si člověk musel
   najít rolováním; vysvětlení bylo jen v dlouhých odstavcích pod kartami. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  // 30 dní s málem bílkovin a s alkoholem → postřehy na makra i na alkohol
  await p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = false; goals.kcal = 2000; goals.p = 150;
    await dbPut('meta', { k: 'goals', v: goals });
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 30; i++) {
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Jídlo', unit: 'porce',
        amount: 1, meal: 'obed', kcal: 2000, p: 40, c: 250, f: 60, ts: Date.now() });
      if (i % 3 === 0) await dbPut('log', { date: den(i), productId: 'alk', name: 'Pivo',
        unit: 'ml', amount: 500, meal: 'vecere', kcal: 210, p: 0, c: 17, f: 0, alc: 20, abv: 5, ts: Date.now() });
    }
    go('stats'); setPeriod(30); return renderStats();
  });
  await p.waitForTimeout(1000);

  /* ---- 1. postřehy jsou klikatelné a vědí kam ---------------------- */
  const klik = await p.locator('#stInsights button.postreh').count();
  ck('postřehy jsou tlačítka, ne jen text', klik >= 3, 'klikatelných: ' + klik);
  ck('a je na nich vidět, že někam vedou',
     (await p.locator('#stInsights .sip').count()) === klik);

  const cile = await p.evaluate(() => [...document.querySelectorAll('#stInsights button.postreh')]
    .map(b => (b.getAttribute('onclick') || '').replace(/[^a-zA-Z-]/g, '')));
  ck('postřeh o bílkovinách míří na makra',
     cile.some(c => c.indexOf('kartaMakra') >= 0), JSON.stringify(cile));
  ck('postřeh o alkoholu míří na stránku Alkohol',
     cile.some(c => c.indexOf('p-alc') >= 0), JSON.stringify(cile));

  /* ---- 2. proklik opravdu někam vede ------------------------------ */
  await p.evaluate(() => skocNaKartu('p-alc'));
  await p.waitForTimeout(600);
  ck('skok na jinou stránku přepne stránku',
     await p.evaluate(() => document.getElementById('p-alc').classList.contains('on')));

  await p.evaluate(() => { go('stats'); return renderStats(); });
  await p.waitForTimeout(800);
  const zvyrazneno = await p.evaluate(() => {
    skocNaKartu('kartaMakra');
    return document.getElementById('kartaMakra').style.outline !== '';
  });
  ck('skok na kartu ji zvýrazní, ať je vidět, kam to skočilo', zvyrazneno);

  /* ---- 3. bublinky u matoucích čísel ------------------------------ */
  ck('u výdeje i bilance je otazník', (await p.locator('#p-stats .ib').count()) >= 2);
  ck('vysvětlení je schované, dokud se nezeptáš',
     (await p.locator('#p-stats .bub:not([hidden])').count()) === 0);
  await p.click('#p-stats .ib >> nth=0'); await p.waitForTimeout(300);
  ck('klepnutím se ukáže', (await p.locator('#p-stats .bub:not([hidden])').count()) === 1);
  const txt = await p.textContent('#p-stats .bub:not([hidden])');
  ck('a vysvětluje právě to číslo', txt.indexOf('hodinek') > 0, txt.slice(0, 90));
  await p.click('#p-stats .ib >> nth=1'); await p.waitForTimeout(300);
  ck('druhé klepnutí první zavře', (await p.locator('#p-stats .bub:not([hidden])').count()) === 1);
  await p.click('#p-stats .ib >> nth=1'); await p.waitForTimeout(300);
  ck('a klepnutí na tentýž otazník zavře i ten',
     (await p.locator('#p-stats .bub:not([hidden])').count()) === 0);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
