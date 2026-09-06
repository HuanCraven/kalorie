/* Test v105 — veřejná verze k rozdávání.

   Aplikace má jeden zdroj kódu a dvě podoby. Osobní zůstává, jak byla; veřejná
   nemá klíč ke Claude API, nečte snímky z hodinek a nesynchronizuje přes GitHub.
   Přepíná to `VEREJNA`, schovává třída `verejna` na <body> a CSS.

   Dvě věci, které se tu hlídají a jinde by propadly:
   1. `VEREJNA` musí ve zdroji zůstat `false` — kdyby se překlopilo omylem,
      Huan by přišel o fotky jídla a o synchronizaci a nikdo by mu neřekl proč.
   2. Schovává se přes CSS právě proto, že vykreslovací funkce si `display`
      přepisují samy. Karta Zdraví se proto zkouší až POTÉ, co ji vykreslení
      s daty z hodinek zapne — v tu chvíli by ji JS řešení odhalilo. */
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

  /* ---- 1. nasazuje se osobní verze ---------------------------------- */
  ck('VEREJNA je ve zdroji vypnutá', await p.evaluate(() => VEREJNA === false),
     await p.evaluate(() => String(VEREJNA)));
  ck('a osobní verze má tělo bez třídy verejna',
     await p.evaluate(() => !document.body.classList.contains('verejna')));
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(400);
  ck('v osobní verzi je Popsat pořád k dispozici', await p.isVisible('#addSeg'));

  /* ---- 2. přepnutí do veřejné podoby -------------------------------- */
  await p.evaluate(() => document.body.classList.add('verejna'));
  await p.waitForTimeout(200);

  const skryto = async (nm, sel) => ck(nm + ' zmizí', !(await p.isVisible(sel)));
  const zustane = async (nm, sel) => ck(nm + ' zůstane', await p.isVisible(sel));

  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(400);
  await skryto('panel Popsat', '#addSeg');
  await skryto('rozbor přes API', '#apiChybi');
  await zustane('hledání', '#s-find');
  await zustane('pole hledání', '#nameQ');

  /* ---- 3. Pohyb: snímek pryč, ruční zápis zůstává -------------------- */
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(400);
  await skryto('nahrání snímku hodinek', '#fitFotoKarta');
  await zustane('ruční zápis aktivity', '#fitQ');
  await zustane('délka aktivity', '#fitMin');
  await zustane('spálené kcal', '#fitKcal');
  await zustane('celkový výdej za den', '#dTotal');
  await zustane('aktivní kcal za den', '#dBurn');

  /* ---- 4. Nastavení: propojení pryč, data zůstávají ------------------ */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  const zal = await p.locator('#setSeg button:visible').allTextContents();
  ck('záložka Propojení zmizí', zal.indexOf('Propojení') < 0, zal.join('|'));
  ck('Já a Data zůstávají', zal.indexOf('Já') >= 0 && zal.indexOf('Data') >= 0, zal.join('|'));
  await p.evaluate(() => setSetMode('data')); await p.waitForTimeout(300);
  await zustane('záloha do souboru', '#setData');

  /* ---- 5. nová potravina jen ručně ----------------------------------- */
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  await p.evaluate(() => setDbMode('obal')); await p.waitForTimeout(300);
  const tl = await p.locator('#dbObal button:visible').allTextContents();
  ck('fotka obalu zmizí', tl.join('|').indexOf('Vyfotit') < 0, tl.join('|'));
  ck('galerie zmizí', tl.join('|').indexOf('galerie') < 0, tl.join('|'));
  ck('ruční cesta zůstane a je hlavní', tl.length === 1 && tl[0].indexOf('Vyplnit') === 0, tl.join('|'));

  await p.evaluate(() => openEdit(null)); await p.waitForTimeout(400);
  ck('okno potraviny se otevře', await p.isVisible('#modEdit'));
  await skryto('čtení etikety z fotky', '#labFile');
  await skryto('popis pro model', '#edPopis');
  await zustane('název potraviny', '#edName');
  await p.evaluate(() => closeMod('modEdit')); await p.waitForTimeout(300);

  /* ---- 6. statistiky: rozbor nahrazen souhrnem ----------------------- */
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(900);
  await skryto('tlačítko rozboru', '#rozborBtn');
  const nadp = await p.locator('#p-stats .card:has(#rozborBtn) h3:visible').allTextContents();
  ck('karta se jmenuje Souhrn období', nadp.join('|') === 'Souhrn období', nadp.join('|'));
  const btn = await p.locator('#p-stats .card:has(#rozborBtn) button:visible').allTextContents();
  ck('souhrn jde zkopírovat', btn.join('|').indexOf('schránky') >= 0, btn.join('|'));
  ck('a stáhnout', btn.join('|').indexOf('Stáhnout') >= 0, btn.join('|'));

  /* ---- 7. karta Zdraví zůstane schovaná i po vykreslení s daty -------
     Tohle je jádro věci: `renderStats` kartě nastaví display podle toho, jestli
     má čísla. Kdyby se schovávalo JavaScriptem, tady by vykoukla. */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 1; i <= 12; i++) {
      await zapisDen(den(i), 'hodinky', { total: 2600, kroky: 9000, tep: 48, hrv: 62, spanek: 430 });
      await dbPut('log', { date: den(i), productId: 'x', name: 'Rýže', unit: 'g', amount: 200,
        meal: 'obed', kcal: 260, p: 5, c: 57, f: 1, ts: 100 + i });
    }
  });
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(1200);
  ck('karta Zdraví zůstane schovaná i s daty z hodinek',
     !(await p.isVisible('#zdraviKarta')));
  ck('ale statistiky se vykreslí', await p.isVisible('#kartaPostrehy'));

  /* ---- 8. co veřejná verze musí umět dál ----------------------------- */
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  ck('alkohol zůstává celý', await p.isVisible('#p-alc'));
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  ck('hlavní stránka beze změny', await p.isVisible('#dWeight'));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
