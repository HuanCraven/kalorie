/* Test v40 — dávka 2: rychlý zápis kcal, ✕ v hledání, poslední gramáž, naposledy použité */
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
    await put('products', { id: 'tp1', barcode: null, name: 'Sýr eidam', brand: 'Madeta', unit: 'g', kcal: 300, p: 25, c: 1, f: 22, fib: 0, salt: 1.5, serving: 100, source: 'manual', uses: 0, createdAt: Date.now(), updatedAt: Date.now() });
  });
  await p.reload(); await p.waitForTimeout(600);

  // --- rychlý zápis
  await p.click('nav button[data-p="scan"]');
  await p.click('#addSeg button[data-s="man"]'); await p.waitForTimeout(200);
  ck('panel Ručně má rychlý zápis', await p.locator('#qaKcal').isVisible());
  ck('panel Ručně má i plný formulář', (await p.locator('text=+ Zadat potravinu ručně').count()) === 1);
  await p.fill('#qaKcal', '450'); await p.fill('#qaB', '20');
  await p.click('text=Zapsat'); await p.waitForTimeout(500);
  ck('rychlý zápis přistál v deníku', (await p.textContent('#logList')).includes('Rychlý zápis'));
  ck('deník ukazuje 450 kcal', (await p.textContent('#logList')).includes('450'));
  ck('sub ukazuje 1 porce', (await p.textContent('#logList')).includes('1 porce'));
  // editace rychlého zápisu drží čísla
  await p.click('#logList .item[data-del] .grow'); await p.waitForTimeout(400);
  ck('editace rychlého zápisu: 450 kcal', (await p.textContent('#poK')).includes('450'), await p.textContent('#poK'));
  await p.evaluate(() => closeMod('modPortion'));

  // --- rychlý zápis bez kcal se odmítne
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="man"]');
  await p.click('text=Zapsat'); await p.waitForTimeout(300);
  ck('bez kcal nic nezapsal', (await p.evaluate(async () =>
    (await new Promise(r => { const q = db.transaction('log', 'readonly').objectStore('log').getAll(); q.onsuccess = () => r(q.result); })).length)) === 1);

  // --- hledání: ✕ se objeví a maže
  await p.click('#addSeg button[data-s="find"]'); await p.waitForTimeout(200);
  ck('✕ skryté bez dotazu', !(await p.locator('#nameClr').isVisible()));
  await p.fill('#nameQ', 'sýr'); await p.waitForTimeout(300);
  ck('✕ viditelné při dotazu', await p.locator('#nameClr').isVisible());
  ck('našeptávač našel eidam', (await p.textContent('#nameRes')).includes('Sýr eidam'));
  await p.click('#nameClr'); await p.waitForTimeout(200);
  ck('✕ smazal dotaz i výsledky', (await p.inputValue('#nameQ')) === '' &&
    (await p.textContent('#nameRes')).trim() === '');
  ck('fokus zůstal v poli', await p.evaluate(() => document.activeElement.id === 'nameQ'));

  // --- poslední gramáž: zapiš 145 g, znovu otevři → předvyplněno 145
  await p.evaluate(() => openPortion('tp1'));
  await p.waitForTimeout(300);
  ck('poprvé předvyplní porci (100)', (await p.inputValue('#poAmt')) === '100');
  await p.fill('#poAmt', '145');
  await p.click('#poAdd'); await p.waitForTimeout(500);
  await p.evaluate(() => openPortion('tp1'));
  await p.waitForTimeout(300);
  ck('podruhé předvyplní 145', (await p.inputValue('#poAmt')) === '145', await p.inputValue('#poAmt'));
  await p.evaluate(() => closeMod('modPortion'));

  // --- naposledy použité na panelu Kód
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="code"]');
  await p.waitForTimeout(300);
  ck('karta Naposledy použité viditelná', await p.locator('#recentCard').isVisible());
  ck('obsahuje eidam s poslední gramáží', (await p.textContent('#recentList')).includes('naposledy 145 g'));
  // klepnutí otevře porci
  await p.click('#recentList .item .grow'); await p.waitForTimeout(300);
  ck('klepnutí otevře zápis porce', await p.locator('#modPortion').isVisible());

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
