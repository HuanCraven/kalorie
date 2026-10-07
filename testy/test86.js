/* Test v122 — nabídka dlouhým stiskem, týdenní ohlédnutí, „Co ještě sníst".

   Nabídka: contextmenu (dlouhý stisk na Androidu, pravé tlačítko na PC) na položce
   deníku → Upravit / Detail / Duplikovat / Přesunout / Smazat.
   Týden: karta za minulý pondělí–neděli jen u dneška; po zavření do dalšího týdne mlčí.
   Co ještě sníst: z potravin, které člověk jí, v obvyklé porci, vejde-li se do kcal. */
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

  await p.evaluate(async d => {
    await dbPut('products', { id: 'mtvaroh', name: 'Tvaroh polotučný', unit: 'g', kcal: 120, p: 12, c: 4, f: 6,
      serving: 250, lastAmount: 250, uses: 3, source: 'manual' });
    await dbPut('products', { id: 'mcokol', name: 'Čokoláda', unit: 'g', kcal: 540, p: 6, c: 58, f: 31,
      lastAmount: 100, uses: 2, source: 'manual' });
    await dbPut('products', { id: 'mkure', name: 'Kuřecí prsa', unit: 'g', kcal: 110, p: 23, c: 0, f: 1.5,
      lastAmount: 150, uses: 1, source: 'manual' });
    products = await dbAll('products');
    await dbPut('log', { date: d, productId: 'mtvaroh', name: 'Tvaroh polotučný', unit: 'g', meal: 'snidane',
      amount: 250, kcal: 300, p: 30, c: 10, f: 15, ts: 1 });
    await obDismiss(); curDate = d; await renderDay();
  }, dnes);
  await p.waitForTimeout(300);
  const pocet = () => p.evaluate(d => dbByIdx('log', 'date', d).then(r => r.length), dnes);

  /* ---- 1. nabídka dlouhým stiskem ------------------------------------ */
  await p.locator('#logList .item[data-del] .grow').first().dispatchEvent('contextmenu');
  await p.waitForTimeout(300);
  ck('dlouhý stisk otevře nabídku', await p.isVisible('#modAkce'));
  ck('s názvem a detailem u skutečné potraviny', /Tvaroh/.test(await p.textContent('#akNazev')) && await p.isVisible('#akDetail'));
  await p.click('#modAkce button:has-text("Duplikovat")');
  await p.waitForTimeout(400);
  ck('Duplikovat přidá druhý záznam', await pocet() === 2);
  ck('kopie má vlastní uid', await p.evaluate(d => dbByIdx('log', 'date', d).then(r => new Set(r.map(x => x.uid)).size === 2), dnes));
  await p.locator('#logList .item[data-del] .grow').first().dispatchEvent('contextmenu');
  await p.waitForTimeout(300);
  await p.selectOption('#akMeal', 'vecere');
  await p.click('#modAkce button:has-text("Přesunout")');
  await p.waitForTimeout(400);
  ck('Přesunout změní chod', await p.evaluate(d => dbByIdx('log', 'date', d).then(r => r.some(x => x.meal === 'vecere'))
    , dnes));
  await p.locator('#logList .item[data-del] .grow').first().dispatchEvent('contextmenu');
  await p.waitForTimeout(300);
  await p.click('#modAkce button:has-text("Smazat")');
  await p.waitForTimeout(500);
  ck('Smazat odebere záznam', await pocet() === 1);
  await p.locator('#logList .item[data-del] .grow').first().dispatchEvent('contextmenu');
  await p.waitForTimeout(300);
  await p.click('#modAkce button:has-text("Upravit")');
  await p.waitForTimeout(300);
  ck('Upravit otevře úpravu záznamu', await p.isVisible('#modPortion') && /Uložit změnu/.test(await p.textContent('#poAdd')));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 2. co ještě sníst --------------------------------------------- */
  await p.evaluate(async () => { goals.dyn = false; goals.kcal = 2000; goals.p = 150; await renderDay(); });
  await p.locator('.bar.procKlik', { hasText: 'Bílkoviny' }).click();
  await p.waitForTimeout(300);
  const pr = await p.textContent('#prBody');
  ck('nabídne co ještě sníst', /Co ještě sníst/.test(pr), pr.slice(-300));
  ck('kuře je první (nejvíc bílkovin na kcal)', await p.evaluate(() =>
    /Kuřecí prsa/.test(document.querySelector('#prBody .item .nm').textContent)));
  ck('v obvyklé porci', /150 g · \+35 g B/.test(pr), pr);
  ck('čokoláda s málem bílkovin ne', !/Čokoláda/.test(pr));
  await p.locator('#prBody .item button', { hasText: 'Zapsat' }).first().click();
  await p.waitForTimeout(300);
  ck('Zapsat otevře porci kuřete', /Kuřecí/.test(await p.textContent('#poName')) && await p.inputValue('#poAmt') === '150');
  await p.evaluate(() => closeMod('modPortion'));
  await p.evaluate(async () => { goals.kcal = 320; await renderDay(); });
  await p.locator('.bar.procKlik', { hasText: 'Bílkoviny' }).click();
  await p.waitForTimeout(300);
  ck('bez zbývajících kalorií řekne, že jsou vyčerpané', /vyčerpané/.test(await p.textContent('#prBody')));
  await p.evaluate(() => closeMod('modProc'));

  /* ---- 3. týdenní ohlédnutí ------------------------------------------ */
  const konec = await p.evaluate(d => tydenKonec(d), dnes);
  await p.evaluate(async k => {
    goals.kcal = 2000;
    const base = new Date(k + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const x = new Date(base); x.setDate(x.getDate() - i); const ds = dstr(x);
      await dbPut('log', { date: ds, productId: 'quick', name: 'Den ' + i, unit: 'g', meal: 'obed', amount: 100,
        kcal: 1800, p: 120, c: 180, f: 60, alc: i === 0 ? 14 : 0, ts: 10 + i });
    }
    const pon = new Date(base); pon.setDate(pon.getDate() - 6);
    await zapisDen(dstr(pon), 'uzivatel', { weight: 82 });
    await zapisDen(k, 'uzivatel', { weight: 81.2, pozn: 'oslava' });
    await renderDay();
  }, konec);
  await p.waitForTimeout(400);
  const tk = await p.textContent('#tydenKarta');
  ck('karta týdne se u dneška ukáže', await p.isVisible('#tydenKarta'), tk);
  ck('průměr proti cíli', /Průměr 1800 kcal · cíl 2000 \(-10 %\)/.test(tk), tk);
  ck('úplné dny a bílkoviny', /Úplných dnů 7 ze 7/.test(tk) && /Bílkoviny 120 g\/den/.test(tk), tk);
  ck('váha od-do', /82 → 81[.,]2 kg \(-0[.,]8\)/.test(tk), tk);
  ck('alkohol na den a poznámka', /Alkohol 2 g\/den/.test(tk) && /oslava/.test(tk), tk);
  ck('žádné srovnání ani známky', !/odznak|lepší než|ostatní/i.test(tk));
  await p.evaluate(() => shiftDay(-1)); await p.waitForTimeout(300);
  ck('u jiného dne se karta neukazuje', !(await p.isVisible('#tydenKarta')));
  await p.evaluate(() => shiftDay(1)); await p.waitForTimeout(300);
  await p.click('#tydenKarta button[aria-label="Zavřít"]');
  await p.waitForTimeout(300);
  await p.evaluate(() => renderDay()); await p.waitForTimeout(300);
  ck('po zavření se ten týden už neukáže', !(await p.isVisible('#tydenKarta')));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
