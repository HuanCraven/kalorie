/* Test v40 — dávka 3: záložka Jídla se segmenty Moje · Hotová · Základní · ČR */
const PROSTREDI = require('./prostredi');
const { chromium } = require('playwright');

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
    await put('ext', { id: 'x-test', n: 'Testovací extka', z: 'NutriDatabaze.cz', e: 100, p: 5, c: 10, f: 3, v: 1, s: 0.2 });
  });
  await p.reload(); await p.waitForTimeout(600);

  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(300);
  ck('výchozí segment Moje', await p.locator('#dbSeg button[data-d="moje"]').evaluate(b => b.classList.contains('on')));
  ck('Moje ukazuje můj produkt', (await p.textContent('#dbList')).includes('Můj sýr'));

  // Hotová
  await p.click('#dbSeg button[data-d="jidla"]'); await p.waitForTimeout(300);
  ck('Hotová: kategorie viditelné', (await p.locator('#jidCats button').count()) >= 5);
  ck('počet v hlavičce', (await p.textContent('#dbCount')).includes('hotových jídel'));
  await p.click('#jidCats button[data-c="polévky"]'); await p.waitForTimeout(300);
  ck('kategorie polévky vypsala jídla', (await p.textContent('#jidList')).includes('vývar'));
  // hledání uvnitř
  await p.fill('#dbSearch', 'guláš'); await p.waitForTimeout(300);
  ck('hledání najde guláš', (await p.textContent('#jidList')).toLowerCase().includes('guláš'));
  // klepnutí otevře porci
  await p.click('#jidList .item .grow >> nth=0'); await p.waitForTimeout(400);
  ck('klepnutí na jídlo otevře porci', await p.locator('#modPortion').isVisible());
  await p.evaluate(() => closeMod('modPortion'));

  // Základní
  await p.fill('#dbSearch', '');
  await p.click('#dbSeg button[data-d="zaklad"]'); await p.waitForTimeout(300);
  ck('Základní: kategorie viditelné', (await p.locator('#zakCats button').count()) >= 8);
  await p.click('#zakCats button[data-c="pečivo"]'); await p.waitForTimeout(300);
  ck('kategorie pečivo funguje', (await p.textContent('#zakList')).toLowerCase().includes('rohlík'));
  await p.fill('#dbSearch', 'jablko'); await p.waitForTimeout(300);
  ck('hledání najde jablko', (await p.textContent('#zakList')).includes('Jablko'));

  // ČR
  await p.fill('#dbSearch', '');
  await p.click('#dbSeg button[data-d="ext"]'); await p.waitForTimeout(300);
  ck('ČR ukazuje načtenou položku', (await p.textContent('#extList')).includes('Testovací extka'));
  await p.fill('#dbSearch', 'neexistuje-xyz'); await p.waitForTimeout(300);
  ck('hledání bez výsledku hlásí nic', (await p.textContent('#extList')).includes('Nic nenalezeno'));

  // Hledat pane už katalogy nemá
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.waitForTimeout(200);
  ck('katalogy zmizely z Hledat', (await p.locator('#s-find #jidCats, #s-find #zakCats').count()) === 0);

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
