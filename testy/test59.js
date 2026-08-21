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
  ck('Zadat nabízí Časté, Hledat i Popsat',
     panely.join('|') === 'Časté|Hledat|Popsat', panely.join(' | '));
  ck('Kód, Ručně ani Recept nejsou samostatné panely',
     !panely.some(t => ['Kód', 'Ručně', 'Recept'].indexOf(t) >= 0), panely.join(' | '));

  await p.click('nav button[data-p="scan"]');
  await p.waitForTimeout(300);
  ck('Zadat se otevírá rovnou na Častých',
     await p.evaluate(() => document.getElementById('s-caste').classList.contains('on')));
  await p.evaluate(() => setAdd('find'));      // dál se testuje hledání
  await p.waitForTimeout(300);
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
  await p.evaluate(async () => {
    await dbPut('products', { id: 'p-a', name: 'Tvaroh měkký', unit: 'g', kcal: 75, p: 12, c: 4, f: 0.5, uses: 9, lastUsed: Date.now(), lastAmount: 200 });
    await dbPut('products', { id: 'p-b', name: 'Rohlík', unit: 'g', kcal: 290, p: 9, c: 55, f: 3, uses: 4, lastUsed: Date.now() - 1000 });
    await dbPut('products', { id: 'p-c', name: 'Nikdy nepoužité', unit: 'g', kcal: 100, p: 1, c: 1, f: 1 });
    products = await dbAll('products');
    setAdd('find');
  });
  await p.waitForTimeout(300);
  const nabidka = await p.evaluate(() => ({
    polozek: document.querySelectorAll('#nameRes .item').length,
    text: document.getElementById('nameRes').textContent
  }));
  ck('prázdné hledání nabídne, co se jí nejčastěji', nabidka.polozek >= 2, 'položek: ' + nabidka.polozek);
  ck('a je označené jako Nejčastější', nabidka.text.indexOf('Nejčastější') >= 0, nabidka.text.slice(0, 50));
  ck('nepoužitá potravina se do nabídky nedostane', nabidka.text.indexOf('Nikdy nepoužité') < 0);

  // z nabídky jde rovnou zapsat — dva ťuky, bez psaní
  await p.click('#nameRes .item >> nth=0');
  await p.waitForTimeout(300);
  ck('ťuknutí na nabídku otevře okno porce', await p.isVisible('#modPortion'));

  /* ---- 4. gramáže podle toho, co se u té potraviny zapisuje --------- */
  const knofliky = await p.evaluate(() => ['poQ1', 'poQ2', 'poQ3'].map(i => document.getElementById(i).textContent));
  ck('rychlé gramáže vychází z poslední porce (200 g)',
     knofliky.join('/') === '100/200/400', knofliky.join('/'));
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

  /* ---- 6. Časté jsou na ráně, jen jinde než dřív (v96) -------------
     Původně se hlídalo, že jsou na Hlavní nad Záznamem dne. Po rozdělení na chody
     tam zabíraly půl obrazovky, takže se přestěhovaly na Zadat. Smysl tvrzení
     zůstává: musí být na ráně, ne přes dvě obrazovky rolování. */
  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(400);
  ck('na Hlavní už Časté nejsou', await p.evaluate(() => !document.getElementById('favCard')));
  await p.evaluate(() => { go('scan'); setAdd('caste'); });
  await p.waitForTimeout(400);
  const top = await p.evaluate(() =>
    Math.round(document.getElementById('favList').getBoundingClientRect().top));
  ck('a vejdou se na první obrazovku', top < 812, 'top=' + top);

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
