/* Test v40 — dávka 1: swipe mazání + Vrátit, kruh zbývá/snědeno, onboarding karta,
const PROSTREDI = require('./prostredi');
   smazání z editace záznamu a nápoje */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);

  // --- onboarding: prázdná aplikace ho ukáže, zavření ho skryje natrvalo
  ck('onboarding karta viditelná na prázdné app', await p.locator('#obCard').isVisible());
  await p.click('#obCard button[aria-label="zavřít"]'); await p.waitForTimeout(300);
  ck('onboarding zmizí po zavření', !(await p.locator('#obCard').isVisible()));
  await p.reload(); await p.waitForTimeout(600);
  ck('onboarding se po restartu nevrací', !(await p.locator('#obCard').isVisible()));

  // --- seed: goals + 2 záznamy dnes
  await p.evaluate(async () => {
    const put = (s, v) => new Promise(r => { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = r; });
    await put('meta', { k: 'goals', v: { kcal: 2000, p: 130, c: 220, f: 65, alcDay: 0, rmr: 0, fib: 30, salt: 5 } });
    await put('log', { date: curDate, productId: 'x', name: 'Testovací chléb', unit: 'g', meal: 'snidane', amount: 100, kcal: 250, p: 8, c: 50, f: 1, ts: Date.now() });
    await put('log', { date: curDate, productId: 'alk', name: 'Pivo 12° 0,5 l', unit: 'ml', amount: 500, meal: 'vecere', kcal: 222, p: 0, c: 20, f: 0, alc: 19.7, abv: 5, ts: Date.now() + 1 });
  });
  await p.reload(); await p.waitForTimeout(700);

  // --- kruh: výchozí snědeno, klepnutí přepne na zbývá
  ck('kruh: snědeno 472', (await p.textContent('#kcalNow')).trim() === '472', await p.textContent('#kcalNow'));
  await p.click('#ringBox'); await p.waitForTimeout(400);
  ck('kruh po klepnutí: zbývá 1528', (await p.textContent('#kcalNow')).trim() === '1528'
    && (await p.textContent('#kcalGoal')).includes('zbývá'), await p.textContent('#kcalNow'));
  await p.reload(); await p.waitForTimeout(600);
  ck('volba zbývá přežije restart', (await p.textContent('#kcalGoal')).includes('zbývá'));
  await p.click('#ringBox'); await p.waitForTimeout(300);   // zpět na snědeno

  // --- řádky nemají ✕, mazání jde swipem
  ck('v deníku nejsou ✕ tlačítka', (await p.locator('#logList .btn.dan').count()) === 0);
  const item = p.locator('#logList .item[data-del]').first();
  const box = await item.boundingBox();
  // swipe doleva přes práh (pointer events)
  await p.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width - 120, box.y + box.height / 2, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  ck('swipe smazal záznam (zbývá 1)', (await p.locator('#logList .item[data-del]').count()) === 1,
    'počet=' + await p.locator('#logList .item[data-del]').count());
  ck('toast nabízí Vrátit', (await p.locator('#toast button').count()) === 1);
  await p.click('#toast button'); await p.waitForTimeout(500);
  ck('Vrátit obnovil záznam (zase 2)', (await p.locator('#logList .item[data-del]').count()) === 2,
    'počet=' + await p.locator('#logList .item[data-del]').count());

  // --- krátký swipe nemaže a nespustí editaci
  const it2 = p.locator('#logList .item[data-del]').first();
  const b2 = await it2.boundingBox();
  await p.mouse.move(b2.x + b2.width - 20, b2.y + b2.height / 2);
  await p.mouse.down();
  await p.mouse.move(b2.x + b2.width - 50, b2.y + b2.height / 2, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  ck('krátký swipe nemaže', (await p.locator('#logList .item[data-del]').count()) === 2);
  ck('krátký swipe neotevřel editaci', !(await p.locator('#modPortion').isVisible()));

  // --- mazání z editace záznamu (klepnutí na řádek → Smazat záznam)
  await p.click('#logList .item[data-del] .grow >> nth=0'); await p.waitForTimeout(400);
  ck('editace záznamu ukazuje Smazat', await p.locator('#poDel').isVisible());
  await p.click('#poDel'); await p.waitForTimeout(500);
  ck('smazáno z editace (zbývá 1)', (await p.locator('#logList .item[data-del]').count()) === 1);
  await p.click('#toast button'); await p.waitForTimeout(400);   // vrátit zpět

  // --- nový záznam nemá Smazat (jen editace ho má)
  await p.evaluate(async () => {
    const put = (s, v) => new Promise(r => { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = r; });
    await put('products', { id: 'tp1', barcode: null, name: 'Sýr', brand: '', unit: 'g', kcal: 300, p: 25, c: 1, f: 22, fib: 0, salt: 1.5, serving: null, source: 'manual', uses: 0, createdAt: Date.now(), updatedAt: Date.now() });
    products = await new Promise(r => { const q = db.transaction('products', 'readonly').objectStore('products').getAll(); q.onsuccess = () => r(q.result); });
    openPortion('tp1');
  });
  await p.waitForTimeout(300);
  ck('nový zápis nemá tlačítko Smazat', !(await p.locator('#poDel').isVisible()));
  await p.evaluate(() => closeMod('modPortion'));

  // --- alkohol: swipe funguje i tam, editace nápoje má Smazat
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(600);
  ck('alkohol: řádek bez ✕', (await p.locator('#alcList .btn.dan').count()) === 0);
  await p.click('#alcList .item[data-del] .grow'); await p.waitForTimeout(400);
  ck('editace nápoje ukazuje Smazat', await p.locator('#dkDel').isVisible());
  await p.click('#dkDel'); await p.waitForTimeout(500);
  ck('nápoj smazán', (await p.locator('#alcList .item[data-del]').count()) === 0);
  await p.click('#toast button'); await p.waitForTimeout(500);
  ck('nápoj vrácen', (await p.locator('#alcList .item[data-del]').count()) === 1);

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
