/* Test v111 — přenos na jiný telefon a databáze potravin pro dalšího člověka.

   Dva různé kontexty prohlížeče tu hrají dva telefony: Huanův, ze kterého se
   předává, a nový, kde začíná někdo další.

   Hlídá se hlavně to, co by v provozu nikdo neviděl, dokud by nebylo pozdě:
   · záloha dřív nenesla načtené databáze (`ext`) — na novém telefonu chyběly;
   · do souboru pro jiného člověka se nesmí dostat NutriDatabáze. Nejen z `ext`:
     použitá položka se zkopíruje do `products` se zdrojem `ext`, a tam by
     proklouzla, kdyby se filtroval jen import;
   · načtení databáze nesmí novému člověku nahrát cizí deník, váhu ani cíle,
     ani když omylem vybere celou zálohu. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const telefon = async () => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await PROSTREDI.blokujVenek(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
    await p.goto('http://127.0.0.1:8811/index.html');
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    await p.waitForTimeout(500);
    return p;
  };
  // sdílecí nabídku nahradí zachycením souboru — vrátí jeho text
  const zachytSoubor = async (p, akce) => {
    await p.evaluate(() => {
      window.soubor = null;
      navigator.canShare = () => true;
      navigator.share = async d => { window.soubor = { jmeno: d.files[0].name, text: await d.files[0].text() }; };
    });
    await p.evaluate(akce);
    await p.waitForTimeout(600);
    return p.evaluate(() => window.soubor);
  };

  /* ---- Huanův telefon --------------------------------------------- */
  const A = await telefon();
  await A.evaluate(async () => {
    goals.rmr = 1800; goals.pKg = 2.0; await dbPut('meta', { k: 'goals', v: goals });
    // načtené databáze: NutriDatabáze, Open Food Facts a CSV neznámého původu
    await dbPut('ext', { id: 'x-tvaroh', n: 'Tvaroh měkký', z: 'NutriDatabaze.cz', zd: 'nutridatab', e: 98, p: 18, c: 4, f: 1 });
    await dbPut('ext', { id: 'x-8594001', n: 'Jogurt bílý', z: 'Danone', zd: 'openfoodfa', e: 66, p: 4, c: 5, f: 3, k: '8594001' });
    await dbPut('ext', { id: 'x-neco', n: 'Něco z CSV', z: 'CSV', zd: 'csv', e: 200, p: 1, c: 1, f: 1 });
    extNazvy = { nutridatab: 'NutriDatabáze', openfoodfa: 'Open Food Facts' };
    await dbPut('meta', { k: 'extNazvy', v: extNazvy });
    extFoods = await dbAll('ext');
    // vlastní potraviny včetně kopií použitých importů
    const P = (id, name, source, extra) => dbPut('products', Object.assign(
      { id, name, brand: '', unit: 'g', kcal: 100, p: 5, c: 10, f: 3, source, uses: 17 }, extra || {}));
    await P('m-kase', 'Moje ovesná kaše', 'manual');
    await P('r-gulas', 'Gulášek podle Huana', 'recipe');
    await P('x-tvaroh', 'Tvaroh měkký', 'ext', { brand: 'NutriDatabaze.cz' });
    await P('x-8594001', 'Jogurt bílý', 'ext', { brand: 'Danone' });
    products = await dbAll('products');
    // deník a váha — ty nesmí odejít k nikomu cizímu
    await dbPut('log', { date: curDate, productId: 'm-kase', name: 'Moje ovesná kaše', unit: 'g',
      amount: 250, meal: 'snidane', kcal: 250, p: 12, c: 25, f: 7, ts: 1 });
    await zapisDen(curDate, 'uzivatel', { weight: 85 });
  });

  /* ---- 1. karta na Jídlech ukáže, co se předá ----------------------- */
  await A.click('nav button[data-p="db"]'); await A.waitForTimeout(600);
  ck('na Jídlech je karta Předat databázi', await A.isVisible('#potrKarta'));
  const stav = (await A.textContent('#potrStav')).replace(/\s+/g, ' ');
  // počítá se po potravinách: tvaroh je v importu i jako kopie mezi vlastními, ale je to jedna potravina
  ck('karta řekne, kolik zůstane jen u tebe', /2 z NutriDatabáze a neznámých CSV zůstane jen u tebe/.test(stav), stav);
  ck('a kolik se předá, každou potravinu jednou', /Předá se 3 /.test(stav), stav);

  /* ---- 2. soubor pro jiného člověka -------------------------------- */
  const sp = await zachytSoubor(A, () => exportPotraviny());
  ck('vznikne soubor s databází', !!sp && /^kalorie-potraviny-/.test(sp.jmeno), sp && sp.jmeno);
  const D = JSON.parse(sp.text);
  const ids = D.products.map(p => p.id), xids = D.ext.map(x => x.id);
  ck('je označený jako databáze potravin', D.typ === 'databaze-potravin');
  ck('nese vlastní potraviny i recepty', ids.indexOf('m-kase') >= 0 && ids.indexOf('r-gulas') >= 0, ids.join(','));
  ck('Open Food Facts jde s ním', ids.indexOf('x-8594001') >= 0 && xids.indexOf('x-8594001') >= 0,
     ids.join(',') + ' | ' + xids.join(','));
  ck('NutriDatabáze v importu nezůstala', xids.indexOf('x-tvaroh') < 0, xids.join(','));
  ck('ani její kopie mezi vlastními potravinami', ids.indexOf('x-tvaroh') < 0, ids.join(','));
  ck('CSV neznámého původu taky ne', xids.indexOf('x-neco') < 0, xids.join(','));
  ck('deník, váha ani cíle v souboru nejsou', !D.log && !D.daily && !D.goals && !D.drinks,
     Object.keys(D).join(','));
  ck('zvyky (počet použití) se nepředávají', D.products.every(p => p.uses === undefined));
  ck('název databáze OFF jde s ní, NutriDatabáze ne',
     D.extNazvy.openfoodfa === 'Open Food Facts' && !D.extNazvy.nutridatab, JSON.stringify(D.extNazvy));

  /* ---- 3. plná záloha pro vlastní nový telefon ---------------------- */
  const sz = await zachytSoubor(A, () => exportData());
  const Z = JSON.parse(sz.text);
  ck('záloha nese i načtené databáze', Z.ext && Z.ext.length === 3, Z.ext && Z.ext.length);
  ck('včetně jejich názvů', Z.extNazvy && Z.extNazvy.nutridatab === 'NutriDatabáze');
  ck('a samozřejmě deník', Z.log && Z.log.length === 1);

  /* ---- 4. vlastní nový telefon: import zálohy vrátí všechno --------- */
  const B = await telefon();
  await B.setInputFiles('#impFile', { name: sz.jmeno, mimeType: 'application/json', buffer: Buffer.from(sz.text) });
  await B.waitForTimeout(1200);
  const poB = await B.evaluate(async () => ({
    ext: (await dbAll('ext')).length, nazev: extNazvy.nutridatab,
    log: (await dbAll('log')).length, prod: (await dbAll('products')).length
  }));
  ck('na novém telefonu jsou zpátky i načtené databáze', poB.ext === 3, JSON.stringify(poB));
  ck('i s názvy', poB.nazev === 'NutriDatabáze', JSON.stringify(poB));
  ck('deník i potraviny', poB.log === 1 && poB.prod === 4, JSON.stringify(poB));

  /* ---- 5. telefon nového člověka: načte jen databázi ---------------- */
  const C = await telefon();
  await C.click('nav button[data-p="db"]'); await C.waitForTimeout(500);
  await C.setInputFiles('#potrFile', { name: sp.jmeno, mimeType: 'application/json', buffer: Buffer.from(sp.text) });
  await C.waitForTimeout(1200);
  const poC = await C.evaluate(async () => ({
    prod: (await dbAll('products')).map(p => p.id).sort(),
    ext: (await dbAll('ext')).map(x => x.id),
    log: (await dbAll('log')).length, daily: (await dbAll('daily')).length,
    rmr: goals.rmr || 0
  }));
  ck('nový člověk má Huanovy potraviny', poC.prod.join(',') === 'm-kase,r-gulas,x-8594001', poC.prod.join(','));
  ck('a z načtených databází jen Open Food Facts', poC.ext.join(',') === 'x-8594001', poC.ext.join(','));
  ck('deník má prázdný', poC.log === 0 && poC.daily === 0, JSON.stringify(poC));
  ck('a cíle vlastní, ne Huanovy', poC.rmr === 0, String(poC.rmr));
  ck('hledání u něj najde Huanův recept',
     (await C.evaluate(() => products.filter(p => /Gulášek/.test(p.name)).length)) === 1);

  /* ---- 6. omylem vybraná celá záloha cizí deník nepřenese ------------ */
  const E = await telefon();
  await E.click('nav button[data-p="db"]'); await E.waitForTimeout(500);
  await E.setInputFiles('#potrFile', { name: sz.jmeno, mimeType: 'application/json', buffer: Buffer.from(sz.text) });
  await E.waitForTimeout(1200);
  const poE = await E.evaluate(async () => ({
    log: (await dbAll('log')).length, daily: (await dbAll('daily')).length,
    rmr: goals.rmr || 0, prod: (await dbAll('products')).length
  }));
  ck('z celé zálohy se načtou jen potraviny', poE.prod === 4, JSON.stringify(poE));
  ck('cizí deník ani váha se nepřenesou', poE.log === 0 && poE.daily === 0, JSON.stringify(poE));
  ck('cizí cíle taky ne', poE.rmr === 0, String(poE.rmr));
  ck('a aplikace řekne, že je vynechala', (await E.textContent('#toast')).indexOf('schválně vynechal') >= 0,
     await E.textContent('#toast'));

  /* ---- 7. ve veřejné verzi to funguje stejně ------------------------ */
  await C.evaluate(() => document.body.classList.add('verejna'));
  await C.waitForTimeout(200);
  ck('karta předání je i ve veřejné verzi', await C.isVisible('#potrKarta'));
  await C.click('nav button[data-p="set"]'); await C.waitForTimeout(300);
  await C.evaluate(() => setSetMode('data')); await C.waitForTimeout(300);
  const pren = (await C.locator('#setData .card:has(h3:text("Přenést do jiného telefonu"))').innerText()).replace(/\s+/g, ' ');
  ck('návod na přenos je v Datech', /Export zálohy/.test(pren) && /Import zálohy/.test(pren), pren.slice(0, 120));
  ck('věta o párování přes synchronizaci se ve veřejné verzi neukáže', pren.indexOf('párovací kód') < 0, pren);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
