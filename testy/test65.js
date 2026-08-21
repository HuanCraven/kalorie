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

  /* ---- 2b. výjimka drží i po sjednocení řady (v87) -----------------
     Příjem i alkohol nově vycházejí z jedné denní řady (denniRada). Pravidlo
     musí zůstat asymetrické: `logged` filtruje příjem, alkohol se nefiltruje
     nikdy — ani u nekompletních dnů, ani u dnů úplně bez zápisu. */
  const rada = await p.evaluate(async () => {
    const z = await zdrojDnu();
    const r = denniRada(14, curDate, z);
    const neu = r.filter(d => d.neuplny);
    const prazdne = r.filter(d => !d.logged && !d.neuplny);
    return {
      neuplnych: neu.length,
      neuplneMajiAlk: neu.length > 0 && neu.every(d => d.alc > 0),
      neuplneNejsouLogged: neu.every(d => !d.logged),
      prazdnyJeNula: prazdne.every(d => d.alc === 0),
      soucetAlk: r.reduce((a, d) => a + d.alc, 0)
    };
  });
  ck('nekompletní dny jsou v řadě poznat', rada.neuplnych === 3, JSON.stringify(rada));
  ck('a nepočítají se do příjmu', rada.neuplneNejsouLogged, JSON.stringify(rada));
  ck('ale alkohol si nesou dál', rada.neuplneMajiAlk, JSON.stringify(rada));
  ck('den bez zápisu je u alkoholu nula, ne chybějící údaj', rada.prazdnyJeNula,
     JSON.stringify(rada));
  ck('součet gramů z řady sedí na zapsané pití', rada.soucetAlk === 60,
     'čekáno 60 g (3 dny x 20 g), je ' + rada.soucetAlk);

  // statsData je nově jen tenká slupka nad denniRada — musí dávat totéž
  const shoda = await p.evaluate(async () => {
    const a = await statsData(14);
    const b = denniRada(14, curDate, await zdrojDnu());
    return JSON.stringify(a) === JSON.stringify(b);
  });
  ck('statsData a denniRada dávají tutéž řadu', shoda);

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

  /* ---- 4b. formulář dne nesmí smazat čísla ze snímku (v76) --------
     Záznam dne zná jen výdej, váhu a příznak. Když se skládal od nuly, každé
     uložení smazalo tep, HRV, spánek i kroky, které tam zapsal snímek hodinek. */
  await p.evaluate(async () => {
    await dbPut('daily', { date: curDate, total: 2650, kroky: 9800, tep: 54, hrv: 42,
      spanek: 430, hluboky: 95, rem: 80, skore: 82 });
    go('day'); await loadDaily(); return renderDay();
  });
  await p.waitForTimeout(600);
  await p.check('#dNeuplny'); await p.waitForTimeout(700);
  const poZaskrtnuti = await p.evaluate(() => dbGet('daily', curDate));
  ck('zaškrtnutí nekompletního dne nechá čísla z hodinek být',
     poZaskrtnuti.tep === 54 && poZaskrtnuti.hrv === 42 && poZaskrtnuti.spanek === 430 &&
     poZaskrtnuti.kroky === 9800 && poZaskrtnuti.skore === 82, JSON.stringify(poZaskrtnuti));
  ck('a celkový výdej zůstane taky', poZaskrtnuti.total === 2650, JSON.stringify(poZaskrtnuti));

  await p.fill('#dWeight', '81.5');
  await p.dispatchEvent('#dWeight', 'change');
  await p.waitForTimeout(700);
  const poVaze = await p.evaluate(() => dbGet('daily', curDate));
  ck('zápis váhy je nechá být také',
     poVaze.tep === 54 && poVaze.spanek === 430 && poVaze.weight === 81.5, JSON.stringify(poVaze));

  // vymazání pole musí hodnotu pořád rušit — jinak by nešlo nic vzít zpátky
  await p.fill('#dWeight', '');
  await p.dispatchEvent('#dWeight', 'change');
  await p.waitForTimeout(700);
  const poVymazani = await p.evaluate(() => dbGet('daily', curDate));
  ck('vymazané pole hodnotu zruší, zbytek zůstane',
     poVymazani.weight === undefined && poVymazani.tep === 54, JSON.stringify(poVymazani));

  /* ---- 4c. zápis do dne vede jedinou cestou (v89) ------------------
     Do jednoho dne píšou dvě strany a každá zná jen svoje pole. Dřív si formulář
     skládal záznam od nuly a smazal tím čísla z hodinek (v76). Nově je `zapisDen`
     jediné místo, které do `daily` píše, a přepíše výhradně pole svého vlastníka. */
  const vlastnictvi = await p.evaluate(async () => {
    const d = '2026-01-15';
    await zapisDen(d, 'hodinky', { total: 2600, tep: 50, hrv: 44, spanek: 400 });
    await zapisDen(d, 'uzivatel', { weight: 80.1, neuplny: true });
    const poUzivateli = await dbGet('daily', d);
    await zapisDen(d, 'hodinky', { tep: 52 });
    const poHodinkach = await dbGet('daily', d);
    let chyba = '';
    try { await zapisDen(d, 'kdovico', { tep: 1 }); } catch (e) { chyba = e.message; }
    return { poUzivateli, poHodinkach, chyba };
  });
  ck('zápis uživatele nechá čísla z hodinek být',
     vlastnictvi.poUzivateli.tep === 50 && vlastnictvi.poUzivateli.spanek === 400,
     JSON.stringify(vlastnictvi.poUzivateli));
  ck('a přidá k nim svoje',
     vlastnictvi.poUzivateli.weight === 80.1 && vlastnictvi.poUzivateli.neuplny === true);
  ck('zápis z hodinek nechá být váhu i příznak dne',
     vlastnictvi.poHodinkach.weight === 80.1 && vlastnictvi.poHodinkach.neuplny === true,
     JSON.stringify(vlastnictvi.poHodinkach));
  ck('pole, o kterém se mlčí, zůstane nedotčené',
     vlastnictvi.poHodinkach.hrv === 44 && vlastnictvi.poHodinkach.tep === 52,
     JSON.stringify(vlastnictvi.poHodinkach));
  ck('cizí vlastník se odmítne', vlastnictvi.chyba.indexOf('vlastník') > 0,
     vlastnictvi.chyba);

  // vyprázdněný záznam jde pryč celý, ať v databázi nezůstávají prázdné dny
  const prazdny = await p.evaluate(async () => {
    const d = '2026-01-16';
    await zapisDen(d, 'uzivatel', { weight: 79 });
    await zapisDen(d, 'uzivatel', { weight: null });
    return (await dbGet('daily', d)) || null;
  });
  ck('vyprázdněný záznam dne zmizí celý', prazdny === null, JSON.stringify(prazdny));
  await p.uncheck('#dNeuplny'); await p.waitForTimeout(600);

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
