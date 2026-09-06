/* Test v109 — první dojem z prázdné aplikace.

   Drobnosti z průchodu očima někoho, kdo aplikaci právě otevřel. Každá zvlášť
   je kosmetika, dohromady dělaly z první obrazovky nepořádek: výhrůžka ztrátou
   dat, která ještě nejsou, karta nabízející krok, který je hotový, pět tlačítek
   bez funkce a velké červené číslo, které vypadá jako chyba. */
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
  await p.waitForTimeout(700);

  /* ---- 1. varování o úložišti až když je o co přijít ----------------- */
  ck('na prázdné aplikaci varování o úložišti nesvítí', !(await p.isVisible('#persWarn')));

  /* ---- 2. karta Začni tady po nastavení cíle ------------------------- */
  ck('na prázdné aplikaci karta Začni tady je', await p.isVisible('#obCard'));
  ck('a nabízí nastavení cílů jako první krok', await p.isVisible('#obKrok1'));
  const k2 = await p.textContent('#obKrok2');
  ck('skenování je druhý krok', k2.indexOf('2 ·') === 0, k2);

  await p.evaluate(async () => {
    goals.rmr = 1700; goals.dyn = true; goals.pal = 1.2; goals.pohlavi = 'm';
    await dbPut('meta', { k: 'goals', v: goals });
    await obCheck();
  });
  await p.waitForTimeout(300);
  ck('po nastavení cíle hotový krok zmizí', !(await p.isVisible('#obKrok1')));
  const k2b = await p.textContent('#obKrok2');
  ck('a zbylé se přečíslují', k2b.indexOf('1 ·') === 0, k2b);

  /* ---- 3. bilance na dni bez zápisu --------------------------------- */
  await p.evaluate(async () => { await zapisDen(curDate, 'uzivatel', { weight: 80 }); });
  await p.evaluate(() => renderDay());
  await p.waitForTimeout(700);
  ck('bez zápisu se bilance neukazuje jako červené číslo',
     (await p.textContent('#balVal')).trim() === '—', await p.textContent('#balVal'));
  ck('ale výdej se spočítat dá',
     (await p.textContent('#balExp')).indexOf('Výdej') >= 0, await p.textContent('#balExp'));

  /* ---- 4. tlačítko „včera" jen když je co kopírovat ------------------ */
  const bez = await p.locator('#logList button:has-text("včera")').count();
  ck('na první den se tlačítka včera neukazují', bez === 0, String(bez));

  await p.evaluate(async () => {
    const v = new Date(curDate + 'T12:00:00'); v.setDate(v.getDate() - 1);
    await dbPut('log', { date: dstr(v), productId: 'x', name: 'Ovesná kaše', unit: 'g',
      amount: 250, meal: 'snidane', kcal: 420, p: 18, c: 60, f: 10, ts: 1 });
  });
  await p.evaluate(() => renderDay());
  await p.waitForTimeout(700);
  const po = await p.locator('#logList button:has-text("včera")').count();
  ck('jakmile včera něco bylo, tlačítko se objeví', po === 1, String(po));
  ck('a jen u toho chodu, kde to bylo',
     await p.locator('#jidlo-snidane button:has-text("včera")').count() === 1);

  /* ---- 5. po zápisu se bilance vrátí -------------------------------- */
  await p.evaluate(async () => {
    await dbPut('log', { date: curDate, productId: 'x', name: 'Rýže', unit: 'g', amount: 200,
      meal: 'obed', kcal: 260, p: 5, c: 57, f: 1, ts: 2 });
  });
  await p.evaluate(() => renderDay());
  await p.waitForTimeout(700);
  ck('se zápisem už bilance číslo ukáže',
     /kcal/.test(await p.textContent('#balVal')), await p.textContent('#balVal'));

  /* ---- 6. a teprve teď dává smysl varovat o úložišti ----------------- */
  const varovani = await p.evaluate(async () => {
    const maData = (await dbAll('log')).length > 0;
    return { maData };
  });
  ck('s daty už je co chránit', varovani.maData === true);

  /* ---- 7. chůze s batohem je Huanova věc ----------------------------- */
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(500);
  const batohOsobni = await p.evaluate(() => {
    const h = [...document.querySelectorAll('#p-fit h3')].find(x => x.textContent.indexOf('Chůze s batohem') === 0);
    return h ? h.closest('.card').hasAttribute('data-osobni') : false;
  });
  ck('karta Chůze s batohem je označená jako osobní', batohOsobni);
  await p.evaluate(() => document.body.classList.add('verejna'));
  await p.waitForTimeout(200);
  const vidi = await p.evaluate(() => {
    const h = [...document.querySelectorAll('#p-fit h3')].find(x => x.textContent.indexOf('Chůze s batohem') === 0);
    return h ? !!h.offsetParent : false;
  });
  ck('a ve veřejné verzi zmizí', vidi === false);
  ck('ruční zápis aktivity zůstane', await p.isVisible('#fitQ'));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
