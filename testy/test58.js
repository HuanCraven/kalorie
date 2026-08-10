/* Test v58 — po zápisu porce: prázdné hledání a návrat k tomu jídlu, kam se psalo */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  // dvě vlastní potraviny, ať je co hledat
  await p.evaluate(async () => {
    await dbPut('products', { id: 'p-tvaroh', name: 'Tvaroh měkký', unit: 'g', kcal: 75, p: 12, c: 4, f: 0.5 });
    await dbPut('products', { id: 'p-sunka', name: 'Šunka kuřecí', unit: 'g', kcal: 110, p: 18, c: 1, f: 4 });
    products = await dbAll('products');
  });

  const zapis = async (dotaz, pid, jidlo) => {
    await p.click('nav button[data-p="scan"]');
    await p.click('#addSeg button[data-s="find"]');
    await p.fill('#nameQ', dotaz);
    await p.waitForTimeout(250);
    await p.evaluate(id => openPortion(id), pid);
    await p.waitForTimeout(200);
    await p.selectOption('#poMeal', jidlo);
    await p.fill('#poAmt', '120');
    await p.evaluate(() => addPortion());
    await p.waitForTimeout(700);
  };

  /* ---- 1. hledání se po zápisu vyprázdní --------------------------- */
  await zapis('tvaroh', 'p-tvaroh', 'vecere');
  const poPrvnim = await p.evaluate(() => ({
    dotaz: document.getElementById('nameQ').value,
    text: document.getElementById('nameRes').textContent,
    krizek: document.getElementById('nameClr').style.display
  }));
  ck('po zápisu je pole hledání prázdné', poPrvnim.dotaz === '', `"${poPrvnim.dotaz}"`);
  // od v59 tu po vyprázdnění nezůstane prázdno, ale nabídka nejčastějších —
  // podstatné je, že tam není výsledek minulého hledání
  ck('a nezůstaly výsledky minulého hledání', poPrvnim.text.indexOf('Šunka') < 0, poPrvnim.text.slice(0, 60));
  ck('místo nich je nabídka nejčastějších', poPrvnim.text.indexOf('Nejčastější') >= 0 ||
     poPrvnim.text.indexOf('Naposledy') >= 0, poPrvnim.text.slice(0, 60));
  ck('křížek na smazání dotazu se schová', poPrvnim.krizek === 'none', poPrvnim.krizek);

  // ověř i to, že se panel Hledat opravdu ukáže prázdný, ne jen podkladová data
  await p.click('nav button[data-p="scan"]');
  await p.click('#addSeg button[data-s="find"]');
  await p.waitForTimeout(200);
  ck('nové hledání začíná prázdné',
     (await p.inputValue('#nameQ')) === '', await p.inputValue('#nameQ'));

  /* ---- 2. po zápisu se pohled vrátí k tomu jídlu -------------------- */
  await zapis('šunka', 'p-sunka', 'vecere');
  await p.waitForTimeout(900);                       // plynulé posunutí doběhne
  const kde = await p.evaluate(() => {
    const el = document.getElementById('jidlo-vecere');
    if (!el) return { chyba: 'blok jídla nemá id' };
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), vyska: window.innerHeight, scroll: Math.round(window.scrollY) };
  });
  ck('blok Večeře má vlastní id', !kde.chyba, kde.chyba);
  ck('po zápisu je Večeře vidět na obrazovce', kde.top >= -20 && kde.top < kde.vyska,
     'top=' + kde.top + ' výška=' + kde.vyska);
  ck('a stránka není odrolovaná na úplný začátek', kde.scroll > 0, 'scrollY=' + kde.scroll);

  /* ---- 3. zápis skončil tam, kde měl -------------------------------- */
  const radky = await p.evaluate(async () =>
    (await dbAll('log')).map(r => r.name + '/' + r.meal + '/' + r.amount).sort());
  ck('oba záznamy jsou ve večeři po 120 g',
     radky.length === 2 && radky.every(r => r.indexOf('/vecere/120') > 0), JSON.stringify(radky));

  /* ---- 4. úprava záznamu taky vrátí k jídlu ------------------------- */
  await p.evaluate(async () => { const r = (await dbAll('log'))[0]; await editLog(r.id); });
  await p.waitForTimeout(300);
  await p.fill('#poAmt', '150');
  await p.evaluate(() => addPortion());
  await p.waitForTimeout(900);
  const poUprave = await p.evaluate(() => {
    const el = document.getElementById('jidlo-vecere');
    return el ? { top: Math.round(el.getBoundingClientRect().top), scroll: Math.round(window.scrollY) }
              : { chybi: true, scroll: Math.round(window.scrollY) };
  });
  ck('po úpravě záznamu zůstaneme u Večeře', poUprave.scroll > 0, 'scrollY=' + poUprave.scroll);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
