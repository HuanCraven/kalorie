/* Test v123 — období 180 dní (půl roku).

   Statistiky i Alkohol mají volbu 180 dní. Alkohol dřív bral nejvýš 90 dní
   (`long.slice(-90)`) a řadu jen 150 dní — při půlroce by tiše počítal z kratšího
   okna. Hlídá se, že obě obrazovky opravdu pracují se 180 dny. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(800);

  // 200 dní záznamů; alkohol jen ve dnech 100–170 zpátky — mimo 90denní okno
  await p.evaluate(async () => {
    for (let i = 0; i < 200; i++) {
      const x = new Date(); x.setDate(x.getDate() - i); const d = dstr(x);
      await dbPut('log', { date: d, productId: 'quick', name: 'j', unit: 'g', meal: 'obed', amount: 100,
        kcal: 2000, p: 100, c: 200, f: 70, ts: i });
      if (i >= 100 && i < 170 && i % 10 === 0)
        await dbPut('log', { date: d, productId: 'alk', name: 'Pivo', unit: 'ml', meal: 'vecer', amount: 500,
          kcal: 210, p: 0, c: 18, f: 0, alc: 20, ts: 1000 + i });
    }
    await obDismiss();
  });

  /* ---- Statistiky ---------------------------------------------------- */
  await p.evaluate(() => go('stats'));
  await p.waitForTimeout(500);
  await p.click('#per180');
  await p.waitForTimeout(1500);
  ck('Statistiky mají volbu 180 dní a je vybraná', await p.evaluate(() =>
    period === 180 && document.getElementById('per180').classList.contains('pri')));
  ck('řada má 180 dní', await p.evaluate(() => statCache && statCache.list.length === 180),
    await p.evaluate(() => statCache && statCache.list.length));
  ck('souhrn pro Clauda je za 180 dní', await p.evaluate(() => /souhrn za 180 dní/.test(summaryText())));
  ck('tlačítko se nezalamuje', await p.evaluate(() => {
    const b = document.getElementById('per180'); return b.scrollHeight <= document.getElementById('per7').scrollHeight;
  }));

  /* ---- Alkohol ------------------------------------------------------- */
  await p.evaluate(() => go('alc'));
  await p.waitForTimeout(500);
  await p.click('#alcSeg button[data-a="180"]');
  await p.waitForTimeout(1200);
  ck('Alkohol má volbu 180 dní', await p.evaluate(() =>
    document.querySelector('#alcSeg button[data-a="180"]').classList.contains('on')));
  ck('nadpis grafu i dny bez alkoholu jsou za 180', /180 dní/.test(await p.textContent('#alcChartHead')) &&
    /z 180/.test(await p.textContent('#alcDryOf')));
  // 7 večerů po 20 g = 140 g za 180 dní; při starém oknu 90 dní by vyšla nula
  ck('průměr počítá i alkohol starší než 90 dní', /0[.,]8/.test(await p.textContent('#alcAvgP')),
    await p.textContent('#alcAvgP'));
  ck('řada stačí na 180denní klouzavý průměr', await p.evaluate(async () => {
    const s = await alcStats(); return s.days.length === 180 && s.long.length >= 360;
  }));
  await p.click('#alcSeg button[data-a="90"]');
  await p.waitForTimeout(800);
  ck('90 dní dál funguje (alkohol jen starší → nula)', /^0$|^0[.,]0$/.test((await p.textContent('#alcAvgP')).trim()),
    await p.textContent('#alcAvgP'));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
