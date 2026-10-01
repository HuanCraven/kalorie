/* Test v40, přepsaný ve v112 — záložka Jídla.

   Dřív čtyři segmenty (Moje · Hotová · Základní · ČR), každý nad jiným zdrojem.
   Od v112 jedna databáze: uživatele nezajímá, odkud potravina je, zvlášť jsou jen
   hotová jídla. Segmenty jsou Potraviny · Hotová jídla · Recept · Přidat. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);
  await p.evaluate(async () => {
    const put = (s, v) => new Promise(r => { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = r; });
    await put('meta', { k: 'obDone', v: 1 });
    await put('products', { id: 'tp1', barcode: null, name: 'Můj sýr', brand: '', unit: 'g', kcal: 300, p: 25, c: 1, f: 22, fib: 0, salt: 1.5, serving: null, source: 'manual', uses: 0, createdAt: Date.now(), updatedAt: Date.now() });
    await put('ext', { id: 'x-test', n: 'Testovací extka', z: 'NutriDatabaze.cz', zd: 'nutridatab', e: 100, p: 5, c: 10, f: 3, v: 1, s: 0.2 });
  });
  await p.reload(); await p.waitForTimeout(700);

  /* ---- segmenty ----------------------------------------------------- */
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(300);
  const seg = await p.locator('#dbSeg button').allTextContents();
  ck('segmenty jsou Potraviny, Hotová jídla, Recept, Přidat',
     seg.join('|') === 'Potraviny|Hotová jídla|Recept|Přidat', seg.join('|'));
  ck('výchozí jsou Potraviny', await p.locator('#dbSeg button[data-d="potr"]').evaluate(b => b.classList.contains('on')));
  ck('bez dotazu ukáže tvoje potraviny', (await p.textContent('#dbList')).includes('Můj sýr'));
  ck('a řekne, kolik jich je v databázi celkem', /V databázi je \d+ potravin/.test(await p.textContent('#dbCount')),
     await p.textContent('#dbCount'));

  /* ---- jedno hledání přes všechny zdroje ----------------------------- */
  await p.fill('#dbSearch', 'jablko'); await p.waitForTimeout(300);
  ck('hledání najde vestavěnou potravinu', (await p.textContent('#dbList')).includes('Jablko'));
  await p.fill('#dbSearch', 'extka'); await p.waitForTimeout(300);
  ck('i načtenou z databáze', (await p.textContent('#dbList')).includes('Testovací extka'));
  ck('a neprozradí, odkud je', (await p.textContent('#dbList')).indexOf('NutriDatab') < 0,
     (await p.textContent('#dbList')).replace(/\s+/g, ' ').slice(0, 120));
  await p.fill('#dbSearch', 'sýr'); await p.waitForTimeout(300);
  ck('i vlastní', (await p.textContent('#dbList')).includes('Můj sýr'));
  await p.fill('#dbSearch', 'neexistuje-xyz'); await p.waitForTimeout(300);
  ck('hledání bez výsledku hlásí nic', (await p.textContent('#dbList')).includes('Nic nenalezeno'));

  /* ---- kategorie u potravin ----------------------------------------- */
  await p.fill('#dbSearch', ''); await p.evaluate(() => renderDb()); await p.waitForTimeout(300);
  ck('kategorie jsou vidět', (await p.locator('#dbKat button').count()) >= 8,
     String(await p.locator('#dbKat button').count()));
  await p.click('#dbKat button[data-k="pečivo"]'); await p.waitForTimeout(300);
  ck('kategorie pečivo vypíše pečivo', (await p.textContent('#dbList')).toLowerCase().includes('rohlík'));
  await p.click('#dbKat button[data-k="pečivo"]'); await p.waitForTimeout(300);
  ck('druhé ťuknutí kategorii zruší', (await p.textContent('#dbList')).includes('Můj sýr'));

  /* ---- hotová jídla zvlášť ------------------------------------------ */
  await p.click('#dbSeg button[data-d="jidla"]'); await p.waitForTimeout(300);
  ck('hotová jídla mají kategorie', (await p.locator('#dbKat button').count()) >= 5);
  ck('počet v hlavičce', (await p.textContent('#dbCount')).includes('hotových jídel'));
  ck('mezi hotovými jídly nejsou suroviny', (await p.textContent('#dbList')).indexOf('Můj sýr') < 0);
  await p.click('#dbKat button[data-k="polévky"]'); await p.waitForTimeout(300);
  ck('kategorie polévky vypsala jídla', (await p.textContent('#dbList')).includes('vývar'));
  await p.fill('#dbSearch', 'guláš'); await p.waitForTimeout(300);
  ck('hledání najde guláš', (await p.textContent('#dbList')).toLowerCase().includes('guláš'));
  await p.click('#dbList .item .grow >> nth=0'); await p.waitForTimeout(400);
  ck('klepnutí na jídlo otevře porci', await p.locator('#modPortion').isVisible());
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- staré záložky už nejsou ---------------------------------------- */
  ck('staré seznamy ze stránky zmizely',
     (await p.locator('#jidCats, #zakCats, #jidList, #zakList, #extList, #dbExt').count()) === 0);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.waitForTimeout(200);
  ck('katalogy nejsou ani na Hledat', (await p.locator('#s-find #jidCats, #s-find #zakCats').count()) === 0);

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
