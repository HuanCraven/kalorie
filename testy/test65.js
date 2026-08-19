/* Test v71 — nekompletní dny.
   Den, kdy se nestihlo zapsat všechno jídlo, se dá označit. Do průměrů příjmu,
   reálného výdeje ani rozboru nepatří — číslo by bylo nižší, než co se opravdu
   snědlo. Alkohol se z takového dne počítá dál, ten se zapisuje vždycky. */
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

  // 14 dní: tři z nich nekompletní — málo zapsaného jídla, ale alkohol zapsaný
  const naplnit = () => p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = false; await dbPut('meta', { k: 'goals', v: goals });
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 14; i++) {
      const neu = [1, 4, 8].indexOf(i) >= 0;
      await dbPut('daily', neu ? { date: den(i), total: 2500, neuplny: true } : { date: den(i), total: 2500 });
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Jídlo', unit: 'porce', amount: 1,
        meal: 'obed', kcal: neu ? 600 : 2200, p: 50, c: 100, f: 30, ts: Date.now() });
      if (neu) await dbPut('log', { date: den(i), productId: 'alk', name: 'Pivo', unit: 'ml', amount: 500,
        meal: 'vecere', kcal: 210, p: 0, c: 17, f: 0, alc: 20, abv: 5, ts: Date.now() });
    }
  });
  await naplnit();
  await p.evaluate(() => { go('stats'); setPeriod(30); });
  await p.waitForTimeout(1300);

  /* ---- 1. průměr příjmu je jen z kompletních dnů ------------------- */
  ck('průměr počítá jen kompletní dny', (await p.textContent('#stKcal')).trim() === '2200',
     await p.textContent('#stKcal'));
  const cover = (await p.textContent('#stCover')).replace(/\s+/g, ' ');
  ck('řekne se, kolik dnů je nekompletních', cover.indexOf('nekompletní') >= 0, cover);
  ck('a že alkohol se z nich počítá', cover.indexOf('alkohol') >= 0, cover);

  /* ---- 2. alkohol se počítá i z nekompletních dnů ------------------ */
  const alk = await p.evaluate(async () => (await alcStats()).avg30);
  ck('alkohol z nekompletních dnů se započítá', Math.round(alk * 10) / 10 === 2,
     'ø 30 dní: ' + alk + ' (3 dny × 20 g / 30)');

  /* ---- 3. bez příznaku průměr klesne ------------------------------- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (const i of [1, 4, 8]) { const d = await dbGet('daily', den(i)); delete d.neuplny; await dbPut('daily', d); }
    return renderStats();
  });
  await p.waitForTimeout(1000);
  const bez = n2(await p.textContent('#stKcal'));
  ck('bez příznaku se osekané dny do průměru přičtou', bez > 1700 && bez < 2000, String(bez));

  /* ---- 4. přepínač na Hlavní --------------------------------------- */
  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(500);
  ck('přepínač je v Záznamu dne', await p.isVisible('#dNeuplny'));
  await p.check('#dNeuplny');
  await p.waitForTimeout(800);
  ck('uloží se ke dni', await p.evaluate(async () => !!(await dbGet('daily', curDate)).neuplny));
  await p.evaluate(() => renderDay());
  await p.waitForTimeout(500);
  ck('na Hlavní je vidět, že bilance je orientační',
     (await p.textContent('#balHint')).indexOf('nekompletní') >= 0, await p.textContent('#balHint'));

  await p.uncheck('#dNeuplny');
  await p.waitForTimeout(800);
  ck('odškrtnutím se příznak zruší',
     !(await p.evaluate(async () => (await dbGet('daily', curDate)).neuplny)));

  /* ---- 5. souhrn pro Claude o tom ví ------------------------------- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (const i of [1, 4]) { const d = await dbGet('daily', den(i)); d.neuplny = true; await dbPut('daily', d); }
    go('stats'); return renderStats();
  });
  await p.waitForTimeout(1000);
  const souhrn = await p.evaluate(() => summaryText());
  ck('souhrn pro Claude nekompletní dny zmíní', souhrn.indexOf('nekompletní') >= 0,
     souhrn.split('\n').filter(r => r.indexOf('nekompletn') >= 0)[0] || '(nic)');
  ck('a upozorní, že příjem mohl být vyšší', souhrn.indexOf('mohl být vyšší') >= 0);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);

  function n2(t) { return parseFloat(String(t).replace(/[^0-9.]/g, '')) || 0; }
})();
