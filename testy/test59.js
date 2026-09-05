/* Test v59 — zjednodušené zadávání: dva panely, nulový stav hledání,
   Časté nahoře, gramáže podle poslední porce, dotykové cíle 44 px */
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

  /* ---- 1. Zadat má jen dvě cesty ----------------------------------- */
  const panely = await p.$$eval('#addSeg button', bs => bs.map(b => b.textContent.trim()));
  // Smyslem v59 nebyl počet panelů, ale to, že Kód, Ručně a Recept přestaly být
  // samostatné volby — Kód a Ručně jsou odbočky z Hledat, Recept je v Jídlech.
  // (v61 přibyl panel Vyfotit, což je samostatný způsob zápisu, a proto sem patří.
  //  v96 přibyly Časté a jsou první — nejrychlejší cesta má být na ráně.)
  ck('Zadat nabízí Hledat i Popsat',
     panely.join('|') === 'Hledat|Popsat', panely.join(' | '));
  ck('Kód, Ručně ani Recept nejsou samostatné panely',
     !panely.some(t => ['Kód', 'Ručně', 'Recept'].indexOf(t) >= 0), panely.join(' | '));

  await p.click('nav button[data-p="scan"]');
  await p.waitForTimeout(300);
  ck('Zadat se otevírá rovnou na Hledat',
     await p.evaluate(() => document.getElementById('s-find').classList.contains('on')));
  ck('ikona čtečky je v poli hledání', await p.isVisible('#nameScan'));
  ck('ruční zápis je dostupný z hledání',
     await p.isVisible('#s-find >> text=Nenašel jsem to'));

  /* ---- 2. čtečka i ruční zápis jsou odbočky, ne slepé uličky -------- */
  await p.click('#nameScan');
  await p.waitForTimeout(200);
  ck('čtečka otevře svůj panel', await p.isVisible('#s-code'));
  ck('a v přepínači zůstane zvýrazněné Hledat',
     (await p.$eval('#addSeg button.on', b => b.dataset.s)) === 'find');
  ck('ze čtečky vede cesta zpět', await p.isVisible('#s-code >> text=Zpět na hledání'));
  await p.click('#s-code >> text=Zpět na hledání');
  await p.waitForTimeout(200);
  ck('zpět na hledání funguje', await p.isVisible('#s-find'));

  /* ---- 3. hledání nabízí, i když se nic nenapsalo ------------------- */
  /* Od v103 se nabídka bere z DENÍKU a řídí se chodem, ne z products.uses —
     to rostlo jen u potravin z databáze, takže zápis přes fotku či popis se do
     nabídky nikdy nedostal. Jedno ťuknutí rovnou zapíše. */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 1; i <= 4; i++)
      await dbPut('log', { date: den(i), productId: 'foto', name: 'Tvaroh měkký', unit: 'g',
        amount: 200, meal: 'snidane', kcal: 150, p: 24, c: 8, f: 1, ts: 100 + i });
    for (let i = 1; i <= 2; i++)
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Rohlík', unit: 'g',
        amount: 60, meal: 'snidane', kcal: 174, p: 5, c: 33, f: 2, ts: 200 + i });
    await dbPut('log', { date: den(1), productId: 'quick', name: 'Jen k večeři', unit: 'g',
      amount: 100, meal: 'vecere', kcal: 100, p: 1, c: 1, f: 1, ts: 300 });
    setAdd('find');
    document.getElementById('rychleMeal').value = 'snidane';
    return renderRychle();
  });
  await p.waitForTimeout(400);
  const nabidka = await p.evaluate(() => ({
    polozek: document.querySelectorAll('#nameRes .item').length,
    text: document.getElementById('nameRes').textContent
  }));
  ck('prázdné hledání nabídne, co se jí nejčastěji', nabidka.polozek >= 2, 'položek: ' + nabidka.polozek);
  ck('a je označené jako Nejčastější', nabidka.text.indexOf('Nejčastější') >= 0, nabidka.text.slice(0, 50));
  ck('jídlo z jiného chodu se do nabídky nedostane',
     nabidka.text.indexOf('Jen k večeři') < 0, nabidka.text.slice(0, 80));

  /* Ťuknutí otevře okno porce, ne rovnou zápis: gramáž se u téhož jídla mění
     často, takže ušetřené ťuknutí by vzalo možnost, která je potřeba víc. */
  await p.click('#nameRes .item >> nth=0');
  await p.waitForTimeout(500);
  ck('ťuknutí na nabídku otevře okno porce', await p.isVisible('#modPortion'));
  ck('s předvyplněnou gramáží podle posledního zápisu (200 g)',
     (await p.inputValue('#poAmt')) === '200', await p.inputValue('#poAmt'));
  ck('a s chodem podle nabídky', (await p.inputValue('#poMeal')) === 'snidane',
     await p.inputValue('#poMeal'));
  const knofliky = await p.evaluate(() => ['poQ1', 'poQ2', 'poQ3'].map(i => document.getElementById(i).textContent));
  ck('rychlé gramáže vychází z poslední porce', knofliky.join('/') === '100/200/400', knofliky.join('/'));
  await p.evaluate(() => closeMod('modPortion'));

  await p.evaluate(async () => {
    await dbPut('products', { id: 'p-d', name: 'Olej', unit: 'g', kcal: 900, p: 0, c: 0, f: 100, uses: 2, lastUsed: Date.now(), lastAmount: 10 });
    products = await dbAll('products');
    openPortion('p-d');
  });
  await p.waitForTimeout(200);
  const male = await p.evaluate(() => ['poQ1', 'poQ2', 'poQ3'].map(i => document.getElementById(i).textContent));
  ck('u malé porce (10 g) se nabídne 5/10/20', male.join('/') === '5/10/20', male.join('/'));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 5. recept se přestěhoval do Jídel --------------------------- */
  const segJidla = await p.$$eval('#dbSeg button', bs => bs.map(b => b.textContent.trim()));
  ck('Jídla mají segment Recept', segJidla.indexOf('Recept') >= 0, segJidla.join(' | '));
  await p.evaluate(() => { go('db'); setDbMode('rec'); });
  await p.waitForTimeout(200);
  ck('recept se v Jídlech otevře', await p.isVisible('#recName'));
  ck('a schová hledání v databázi', !(await p.isVisible('#dbHledatKarta')));
  await p.evaluate(() => setDbMode('moje'));
  await p.waitForTimeout(200);
  ck('přepnutím zpět se hledání vrátí', await p.isVisible('#dbHledatKarta'));

  /* ---- 6. nabídka častých je na ráně (v96 → v103) -------------------
     Původně se hlídalo, že je na Hlavní nad Záznamem dne; pak se stěhovala na
     Zadat jako vlastní záložka a ta se v provozu neosvědčila. Skončila v prázdném
     poli hledání. Smysl tvrzení se nemění: musí být na ráně, bez rolování. */
  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(400);
  ck('na Hlavní už Časté nejsou', await p.evaluate(() => !document.getElementById('favCard')));
  await p.evaluate(() => { go('scan'); setAdd('find'); });
  await p.waitForTimeout(500);
  const top = await p.evaluate(() =>
    Math.round(document.getElementById('nameRes').getBoundingClientRect().top));
  ck('a nabídka se vejde na první obrazovku', top < 812, 'top=' + top);

  /* ---- 7. dotykové cíle ------------------------------------------- */
  const podMiru = await p.evaluate(() => [...document.querySelectorAll('#p-day button')]
    .map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(x => x.h > 0 && (x.h < 44 || x.w < 44)));
  ck('na Hlavní nezůstal dotykový cíl pod 44 px', podMiru.length === 0,
     podMiru.map(x => `"${x.t}" ${x.w}×${x.h}`).join(', '));

  const kopie = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#logList .mealhead button')].find(x => x.textContent.indexOf('⧉') >= 0);
    return b ? { text: b.textContent.trim(), popis: b.getAttribute('aria-label') || '' } : null;
  });
  ck('tlačítko kopie ze včerejška je popsané slovem, ne jen ikonou',
     kopie && kopie.text.length > 2 && kopie.popis.length > 0, JSON.stringify(kopie));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
