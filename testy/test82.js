/* Test v119 — poznámka ke dni.

   Jedno pole hned u „nekompletního dne": zaškrtnutí nabídne napsat proč, jinak
   je to volná poznámka. Ukládá se do `daily` přes zapisDen (vlastník uživatel),
   v kalendáři má den tečku a poznámka jde i do souhrnu pro Clauda. */
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
  const den = () => p.evaluate(d => dbGet('daily', d), dnes);

  // den s jídlem, ať je v kalendáři i ve statistikách vidět
  await p.evaluate(async d => {
    await dbPut('log', { date: d, productId: 'quick', name: 'Oběd', unit: 'g', meal: 'obed',
      amount: 300, kcal: 600, p: 30, c: 60, f: 20, ts: Date.now() });
    await renderDay(); await loadDaily();
  }, dnes);

  /* ---- 1. poznámka se uloží a nic jiného nezmění ---------------------- */
  ck('pole poznámky je hned vedle zaškrtávátka', await p.evaluate(() =>
    document.getElementById('dPozn').parentElement === document.getElementById('dNeuplny').closest('.row').parentElement));
  ck('bez nekompletního dne nabízí obecnou poznámku',
    await p.getAttribute('#dPozn', 'placeholder') === 'Poznámka ke dni');
  await p.fill('#dPozn', 'narozeniny u babičky');
  await p.dispatchEvent('#dPozn', 'change');
  await p.waitForTimeout(300);
  let d = await den();
  ck('poznámka je v záznamu dne', d && d.pozn === 'narozeniny u babičky', JSON.stringify(d));
  ck('den kvůli ní není nekompletní', d && !d.neuplny);

  /* ---- 2. nekompletní den nabídne napsat proč ------------------------- */
  await p.fill('#dPozn', '');
  await p.dispatchEvent('#dPozn', 'change');
  await p.waitForTimeout(300);
  ck('smazaná poznámka zmizí a prázdný den jde pryč celý', !(await den()));
  await p.check('#dNeuplny');
  await p.waitForTimeout(400);
  ck('po zaškrtnutí se ptá proč',
    await p.getAttribute('#dPozn', 'placeholder') === 'Proč je den nekompletní?');
  ck('a kurzor je v poznámce', await p.evaluate(() => document.activeElement.id === 'dPozn'));
  await p.fill('#dPozn', 'večer <b>párty</b>, nestihl jsem zapsat');
  await p.dispatchEvent('#dPozn', 'change');
  await p.waitForTimeout(300);
  d = await den();
  ck('nekompletní i s důvodem', d && d.neuplny === true && /párty/.test(d.pozn || ''), JSON.stringify(d));

  /* ---- 3. čísla z hodinek poznámku nesmažou --------------------------- */
  await p.evaluate(dd => zapisDen(dd, 'hodinky', { kroky: 8000, tep: 55 }), dnes);
  d = await den();
  ck('zápis z hodinek nechá poznámku být', d && /párty/.test(d.pozn || '') && d.kroky === 8000);
  ck('pole poznámky patří uživateli', await p.evaluate(() =>
    DEN_POLE.uzivatel.includes('pozn') && !DEN_POLE.hodinky.includes('pozn')));

  /* ---- 4. po přepnutí dne a zpět se načte ----------------------------- */
  await p.evaluate(() => shiftDay(-1)); await p.waitForTimeout(400);
  ck('jiný den má pole prázdné', await p.inputValue('#dPozn') === '');
  await p.evaluate(() => shiftDay(1)); await p.waitForTimeout(400);
  ck('vlastní den poznámku ukáže', /párty/.test(await p.inputValue('#dPozn')));

  /* ---- 5. kalendář: tečka a escapovaný text --------------------------- */
  await p.evaluate(() => kalOtevri()); await p.waitForTimeout(400);
  const btn = p.locator('#kalMrizka button[data-den="' + dnes + '"]');
  ck('den s poznámkou má v kalendáři značku', /\bpozn\b/.test(await btn.getAttribute('class') || ''));
  ck('poznámka je v popisku dne', /párty/.test(await btn.getAttribute('title') || ''));
  ck('a HTML z ní se nevykreslí', await p.evaluate(() =>
    !document.querySelector('#kalMrizka b')));
  await p.evaluate(() => closeMod('modKal'));

  /* ---- 6. podvržená záloha: ne-řetězec se ignoruje -------------------- */
  ck('poznDne bere jen text', await p.evaluate(() =>
    poznDne({ pozn: { x: 1 } }) === '' && poznDne({ pozn: 'a'.repeat(900) }).length === POZN_MAX));

  /* ---- 7. souhrn pro Clauda ------------------------------------------- */
  await p.evaluate(async () => { go('stats'); await renderStats(); });
  await p.waitForTimeout(800);
  const sh = await p.evaluate(() => summaryText());
  ck('souhrn má sekci poznámek', /POZNÁMKY KE DNŮM/.test(sh), sh.slice(-400));
  ck('s datem, stavem a textem', sh.includes(dnes + ';neúplný;večer <b>párty</b>, nestihl jsem zapsat'));
  ck('a zadání říká, jak s nimi naložit', await p.evaluate(() =>
    /Poznámky ke dnům ber jako kontext/.test(rozborPrompt())));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
