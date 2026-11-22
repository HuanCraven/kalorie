/* Test v125 — období sledování (nový začátek po pauze).

   Po pauze jde začít nové období: statistiky, alkohol, týdenní karta i souhrn pro
   Clauda se počítají od jeho začátku, starší období zůstávají ve Statistikách pod
   výběrem. Po 7+ dnech bez zápisu Hlavní nabídne nové období. Nic se nemaže. */
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
  const dnes = PROSTREDI.den(0);

  // staré období: 40–12 dní zpátky každý den 2000 kcal a 20 g alkoholu; pak pauza; dnes 1500 kcal
  await p.evaluate(async d => {
    for (let i = 12; i <= 40; i++) {
      const x = new Date(); x.setDate(x.getDate() - i); const ds = dstr(x);
      await dbPut('log', { date: ds, productId: 'quick', name: 'Staré', unit: 'g', meal: 'obed', amount: 100,
        kcal: 2000, p: 100, c: 200, f: 70, ts: i });
      await dbPut('log', { date: ds, productId: 'alk', name: 'Pivo', unit: 'ml', meal: 'vecer', amount: 500,
        kcal: 210, p: 0, c: 18, f: 0, alc: 20, ts: 100 + i });
    }
    await dbPut('log', { date: d, productId: 'quick', name: 'Nové', unit: 'g', meal: 'obed', amount: 100,
      kcal: 1500, p: 120, c: 150, f: 50, ts: 999 });
    await obDismiss(); curDate = d; await renderDay();
  }, dnes);
  await p.waitForTimeout(400);

  /* ---- 1. nabídka po pauze ------------------------------------------- */
  ck('po pauze se nabídne nové období', await p.isVisible('#navratKarta'));
  ck('s délkou pauzy', /11 dnů bez zápisu/.test(await p.textContent('#navratKarta')), await p.textContent('#navratKarta'));
  ck('bez období statistiky berou všechno', await p.evaluate(async () => {
    go('stats'); setPeriod(30); await renderStats(); return statCache.a.logged === 19 && !statCache.obd;
  }), await p.evaluate(() => statCache && statCache.a.logged));
  await p.evaluate(() => go('day'));
  await p.fill('#navratNazev', 'Hubnutí zima');
  await p.click('#navratKarta button:has-text("Začít nové období")');
  await p.waitForTimeout(500);
  ck('období se založí od dneška s názvem', await p.evaluate(d => obdobi.length === 1 && obdobi[0].od === d &&
    obdobi[0].nazev === 'Hubnutí zima', dnes));
  ck('nabídka zmizí', !(await p.isVisible('#navratKarta')));
  ck('období se ukládá do synchronizované vrstvy', await p.evaluate(async () =>
    SYNC_META.includes('obdobi') && !!(await collectState()).meta.obdobi));

  /* ---- 2. statistiky od začátku období ------------------------------- */
  await p.evaluate(async () => { go('stats'); setPeriod(30); await renderStats(); });
  await p.waitForTimeout(400);
  ck('statistiky začínají začátkem období', await p.evaluate(() =>
    statCache.list.length === 1 && statCache.a.logged === 1 && r0(statCache.a.avgK) === 1500),
    await p.evaluate(() => statCache.list.length + ' / ' + statCache.a.avgK));
  ck('popisek říká, odkud se počítá', /Hubnutí zima \(od začátku období\)/.test(await p.textContent('#stRange')),
    await p.textContent('#stRange'));
  ck('výběr období je vidět', await p.isVisible('#stObdobi'));
  ck('souhrn pro Clauda zná období', await p.evaluate(() => /Období sledování: Hubnutí zima/.test(summaryText())));

  /* ---- 3. starší období v historii ----------------------------------- */
  await p.selectOption('#stObdobi', '_drive');
  await p.waitForTimeout(800);
  ck('starší období ukáže svoje data', await p.evaluate(() =>
    statCache.obd && statCache.obd.id === '_drive' && statCache.a.logged === 19 && r0(statCache.a.avgK) === 2210),   // 2000 jídlo + 210 pivo
    await p.evaluate(() => statCache.a.logged + ' / ' + statCache.a.avgK));
  ck('a končí den před novým začátkem', await p.evaluate(d => statCache.list[statCache.list.length - 1].date < d, dnes));
  await p.selectOption('#stObdobi', '');
  await p.waitForTimeout(600);

  /* ---- 4. alkohol se počítá jen v období ----------------------------- */
  await p.evaluate(async () => { go('alc'); setPeriod(30); await renderAlc(); });
  await p.waitForTimeout(500);
  ck('alkohol v novém období: nula, ne zbytek ze staré doby', /^0(\.0|,0)?$/.test((await p.textContent('#alcAvgP')).trim()),
    await p.textContent('#alcAvgP'));
  ck('dny bez alkoholu z 1', /z 1$/.test((await p.textContent('#alcDryOf')).trim()), await p.textContent('#alcDryOf'));
  ck('30denní limit nepočítá pauzu ani staré období', await p.evaluate(async () => (await alcStats()).avg30 === 0));

  /* ---- 5. týdenní karta před obdobím mlčí ---------------------------- */
  await p.evaluate(async () => { go('day'); await renderDay(); });
  await p.waitForTimeout(300);
  ck('karta minulého týdne (před obdobím) se neukáže', !(await p.isVisible('#tydenOhled')));

  /* ---- 6. Nastavení: seznam a smazání -------------------------------- */
  await p.evaluate(() => { go('set'); setSetMode('data'); });
  await p.waitForTimeout(300);
  ck('Nastavení ukazuje seznam období', /Hubnutí zima/.test(await p.textContent('#obdSeznam')));
  p.once('dialog', dl => dl.accept());
  await p.locator('#obdSeznam button').first().click();
  await p.waitForTimeout(500);
  ck('smazání začátku spojí období zpátky', await p.evaluate(async () => {
    go('stats'); await renderStats(); return obdobi.length === 0 && statCache.a.logged === 19;   // dnes + 18 starých dnů v okně 30
  }));
  ck('záznamy zůstaly všechny', await p.evaluate(async () => (await dbAll('log')).length === 59));

  /* ---- 7. zavření nabídky platí pro tuhle pauzu ---------------------- */
  await p.evaluate(async () => { go('day'); await renderDay(); });
  await p.waitForTimeout(300);
  ck('bez období se nabídka vrátí', await p.isVisible('#navratKarta'));
  await p.click('#navratKarta button[aria-label="Zavřít"]');
  await p.waitForTimeout(300);
  await p.evaluate(() => renderDay()); await p.waitForTimeout(300);
  ck('po zavření se pro tutéž pauzu neukáže', !(await p.isVisible('#navratKarta')));

  /* ---- 8. záloha nese období ----------------------------------------- */
  ck('podvržená období se vyčistí', await p.evaluate(() =>
    obdobiCisti([{ od: 'nesmysl' }, { od: '2026-01-05', nazev: 5 }, { od: '2026-01-05' }]).length === 1));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
