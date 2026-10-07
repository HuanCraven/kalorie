/* Test v121 — detail potraviny a „Proč tohle číslo?".

   Detail: ťuknutí v Jídlech otevře panel s živinami na 100 g i na porci, podílem
   maker na energii a historií zápisů; z okna porce vede odkaz Detail jen u skutečné
   potraviny. Vysvětlení: rozpad cíle kalorií, maker a bilance — čísla musí sedět
   s tím, co aplikace opravdu spočítala (dayTargets), ne s vlastním přepočtem. */
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
  const dnes = PROSTREDI.den(0), vcera = PROSTREDI.den(-1);

  // vlastní potravina se dvěma zápisy
  await p.evaluate(async ([d, v]) => {
    const pr = { id: 'mtvaroh', name: 'Tvaroh polotučný', unit: 'g', kcal: 120, p: 12, c: 4, f: 6,
      fib: 0, salt: 0.1, serving: 250, lastAmount: 250, source: 'manual', createdAt: 1, updatedAt: 1 };
    await dbPut('products', pr); products = await dbAll('products');
    await dbPut('log', { date: v, productId: 'mtvaroh', name: pr.name, unit: 'g', meal: 'snidane',
      amount: 200, kcal: 240, p: 24, c: 8, f: 12, ts: 1 });
    await dbPut('log', { date: d, productId: 'mtvaroh', name: pr.name, unit: 'g', meal: 'snidane',
      amount: 300, kcal: 360, p: 36, c: 12, f: 18, ts: 2 });
  }, [dnes, vcera]);

  /* ---- 1. detail z Jídel --------------------------------------------- */
  await p.evaluate(() => { go('db'); renderDb(); });
  await p.waitForTimeout(300);
  await p.locator('#dbList .item .grow', { hasText: 'Tvaroh polotučný' }).first().click();
  await p.waitForTimeout(300);
  ck('ťuknutí v Jídlech otevře detail', await p.evaluate(() => document.getElementById('modPotr').classList.contains('on')));
  const t = await p.textContent('#ptBody');
  ck('detail má živiny na 100 g i na porci', /100 g/.test(t) && /porce 250 g/.test(t) && /300 kcal/.test(t), t.slice(0, 300));
  ck('podíl maker na energii', /bílkoviny 41 %/.test(t) && /tuky 46 %/.test(t), t);
  ck('historie zápisů', /Zapsáno 2×/.test(t) && /průměrná porce 250 g/.test(t), t);
  ck('koláč má tři výseče', await p.evaluate(() => document.querySelectorAll('#ptBody svg circle').length === 3));

  // Zapsat z detailu otevře okno porce
  await p.locator('#ptBody button', { hasText: 'Zapsat' }).click();
  await p.waitForTimeout(300);
  ck('Zapsat otevře okno porce', await p.evaluate(() =>
    document.getElementById('modPortion').classList.contains('on') && !document.getElementById('modPotr').classList.contains('on')));
  ck('v okně porce je odkaz Detail', await p.isVisible('#poDetail'));
  await p.evaluate(() => closeMod('modPortion'));

  // u zápisu bez potraviny (popis) detail není
  await p.evaluate(async d => {
    const id = await dbPut('log', { date: d, productId: 'popis', name: 'Něco z popisu', unit: 'g', meal: 'obed',
      amount: 100, kcal: 200, p: 10, c: 20, f: 8, ts: 3 });
    await editLog(id);
  }, dnes);
  await p.waitForTimeout(300);
  ck('u zápisu z popisu odkaz Detail chybí', !(await p.isVisible('#poDetail')));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 2. najít v deníku --------------------------------------------- */
  await p.evaluate(() => potrDetail('mtvaroh'));
  await p.waitForTimeout(200);
  await p.locator('#ptBody button', { hasText: 'Najít v deníku' }).click();
  await p.waitForTimeout(800);
  ck('Najít v deníku přepne na Statistiky s dotazem', await p.evaluate(() =>
    document.getElementById('p-stats').classList.contains('on') && document.getElementById('denikQ').value === 'Tvaroh polotučný'));

  /* ---- 3. proč tohle číslo: dynamické cíle --------------------------- */
  await p.evaluate(async d => {
    go('day');
    goals.dyn = true; goals.rmr = 1800; goals.pal = 1.2; goals.def = 500; goals.pKg = 1.5; goals.fKg = 0.9;
    await zapisDen(d, 'uzivatel', { weight: 80, burn: 300 });
    await renderDay();
  }, dnes);
  await p.waitForTimeout(300);
  const TG = await p.evaluate(async d => {
    const v = vydejDne(await dbGet('daily', d), await workoutSum(d));
    return dayTargets(d, v.out);
  }, dnes);
  ck('cíle jsou dynamické', TG.dyn === true && TG.out === 2460, JSON.stringify(TG));
  await p.click('#procKcal');
  await p.waitForTimeout(300);
  let pr = await p.textContent('#prBody');
  ck('ⓘ u kruhu otevře rozpad kalorií', await p.evaluate(() => document.getElementById('modProc').classList.contains('on')));
  ck('výdej po krocích', /Klidový výdej1800 kcal/.test(pr) && /× 1,2|× 1\.2/.test(pr) && /aktivní kcal z hodinek300 kcal/.test(pr) && /výdej dne2460 kcal/.test(pr), pr);
  ck('deficit a cíl sedí s dayTargets', /deficit500 kcal/.test(pr) && pr.includes('= cíl' + TG.kcal + ' kcal'), pr);
  ck('snědeno a zbývá', /Snědeno560 kcal/.test(pr), pr);
  await p.evaluate(() => closeMod('modProc'));

  await p.locator('.bar.procKlik', { hasText: 'Bílkoviny' }).click();
  await p.waitForTimeout(300);
  pr = await p.textContent('#prBody');
  ck('bílkoviny: g na kilo × váha', /1,5 g na kilo × 80 kg120 g|1\.5 g na kilo × 80 kg120 g/.test(pr), pr);
  ck('a cíl je ten z dayTargets', pr.includes('= cíl' + TG.p + ' g'), pr);
  await p.evaluate(() => closeMod('modProc'));
  await p.locator('.bar.procKlik', { hasText: 'Sacharidy' }).click();
  await p.waitForTimeout(300);
  pr = await p.textContent('#prBody');
  ck('sacharidy jsou zbytek', /zbytek/.test(pr) && pr.includes('= cíl' + TG.c + ' g'), pr);
  await p.evaluate(() => closeMod('modProc'));

  await p.locator('.procKlik', { has: p.locator('#balExp') }).click();
  await p.waitForTimeout(300);
  pr = await p.textContent('#prBody');
  ck('bilance = příjem − výdej', /Příjem \(snědeno\)560 kcal/.test(pr) && /příjem − výdej−1900 kcal|příjem − výdej-1900 kcal/.test(pr), pr);
  await p.evaluate(() => closeMod('modProc'));

  /* ---- 4. pevné cíle se vysvětlí jako pevné ------------------------- */
  await p.evaluate(async () => { goals.dyn = false; await renderDay(); });
  await p.click('#procKcal');
  await p.waitForTimeout(300);
  pr = await p.textContent('#prBody');
  ck('pevný cíl řekne, že je pevný', /Pevný cíl/.test(pr) && /dynamické cíle jsou vypnuté/.test(pr), pr);
  ck('ťuknutí na kruh dál přepíná snědeno/zbývá', await p.evaluate(async () => {
    closeMod('modProc'); const a = ringLeft; toggleRing(); const b = ringLeft; toggleRing(); return a !== b;
  }));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
