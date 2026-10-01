/* Test v112 — jedna databáze potravin.

   Uživatele nezajímá, odkud potravina je; zvlášť jsou jen hotová jídla. Jedno
   hledání a jeden seznam přes vestavěné, načtené i vlastní potraviny, každou jde
   upravit nebo odebrat. Použitá potravina se už mezi vlastní nekopíruje.

   Nejcitlivější je jednorázový úklid kopií (`dbSjednot`): poběží jednou na Huanově
   telefonu s jeho skutečnými daty. Kopie shodná s předlohou smí zmizet a předat
   četnost a gramáž; upravená kopie je úprava a musí zůstat. Kdyby to bylo naopak,
   přišel by o vlastní opravy hodnot, aniž by se to dozvěděl. */
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
  await p.waitForTimeout(600);

  /* ---- příprava: stav, jaký po sobě nechaly verze do v111 ---------------- */
  await p.evaluate(async () => {
    const zak = zakProduct(ZAKLAD.find(z => z.n === 'Rýže bílá vařená'));
    const jid = jidloProduct(JIDLA[0]);
    // načtené databáze — tvaroh z NutriDatabáze, jogurt s kódem z Open Food Facts,
    // a mrkev, která je i mezi vestavěnými (zdvojený název)
    await dbPut('ext', { id: 'x-tvaroh', n: 'Tvaroh měkký', z: 'NutriDatabaze.cz', zd: 'nutridatab', e: 98, p: 18, c: 4, f: 1 });
    await dbPut('ext', { id: 'x-8594001', n: 'Jogurt bílý', z: 'Danone', zd: 'openfoodfa', e: 66, p: 4, c: 5, f: 3, k: '8594001' });
    const mrkev = ZAKLAD.find(z => /^Mrkev/.test(z.n));
    await dbPut('ext', { id: 'x-mrkev', n: mrkev.n, z: 'NutriDatabaze.cz', zd: 'nutridatab', e: 41, p: 1, c: 9, f: 0 });
    // kopie, které dřív vznikly použitím: rýže nezměněná, jídlo ručně opravené, tvaroh nezměněný
    await dbPut('products', Object.assign({}, zak, { uses: 7, lastAmount: 180 }));
    await dbPut('products', Object.assign({}, jid, { kcal: jid.kcal + 50, uses: 2 }));
    await dbPut('products', Object.assign(extProduct({ id: 'x-tvaroh', n: 'Tvaroh měkký', z: 'NutriDatabaze.cz', e: 98, p: 18, c: 4, f: 1 }), { uses: 3, lastAmount: 250 }));
    // a vlastní potravina a recept
    await dbPut('products', { id: 'm-kase', name: 'Moje ovesná kaše', brand: '', unit: 'g', kcal: 110, p: 4, c: 18, f: 2, source: 'manual', uses: 1 });
    await dbPut('products', { id: 'r-gulas', name: 'Gulášek podle Huana', brand: '', unit: 'g', kcal: 160, p: 12, c: 8, f: 9, source: 'recipe', uses: 0 });
    await dbDel('meta', 'dbSjednoceno');
    await dbDel('meta', 'pouziti');
    window.__zak = zak.id; window.__jid = jid.id; window.__jidKcal = jid.kcal;
  });
  const ids = await p.evaluate(() => ({ zak: window.__zak, jid: window.__jid, jidKcal: window.__jidKcal }));
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(900);

  /* ---- 1. jednorázový úklid kopií ---------------------------------------- */
  const po = await p.evaluate(async ([zak, jid]) => {
    const pr = await dbAll('products');
    return {
      zak: pr.some(x => x.id === zak), jid: pr.some(x => x.id === jid), tvaroh: pr.some(x => x.id === 'x-tvaroh'),
      vlastni: pr.filter(x => x.id === 'm-kase' || x.id === 'r-gulas').length,
      puZak: dbPouziti[zak], puTvaroh: dbPouziti['x-tvaroh'],
      hotovo: !!(await dbGet('meta', 'dbSjednoceno'))
    };
  }, [ids.zak, ids.jid]);
  ck('nezměněná kopie vestavěné potraviny zmizela z vlastních', po.zak === false, JSON.stringify(po));
  ck('a předala četnost i gramáž', po.puZak && po.puZak.n === 7 && po.puZak.posl === 180, JSON.stringify(po.puZak));
  // kopie z načtené databáze zůstává: ta se nesynchronizuje a na druhém zařízení bez
  // načtené NutriDatabáze je vidět jen díky kopii — náhrobek by ji tam smazal
  ck('kopie z načtené databáze zůstává kvůli druhému zařízení', po.tvaroh === true, JSON.stringify(po));
  ck('upravená kopie zůstala — je to tvoje oprava', po.jid === true, JSON.stringify(po));
  ck('vlastní potraviny a recepty zůstaly', po.vlastni === 2, JSON.stringify(po));
  ck('úklid si poznamenal, že proběhl', po.hotovo === true);
  ck('odstranění šlo s náhrobkem, ať zmizí i z druhého zařízení',
     await p.evaluate(async zak => (await dbAll('tomb')).some(t => t.k.indexOf(zak) >= 0), ids.zak));

  /* ---- 2. upravená kopie přebíjí předlohu --------------------------------- */
  const jidKcal = await p.evaluate(jid => potravina(jid).kcal, ids.jid);
  ck('v databázi platí tvoje oprava hodnot', jidKcal === ids.jidKcal + 50, String(jidKcal));

  /* ---- 3. jeden seznam, zdvojený název jednou ------------------------------ */
  const mrkve = await p.evaluate(() => dbHledej('mrkev', 'potravina').filter(x => /^Mrkev/.test(x.name)).map(x => x.id));
  const mrkevZak = await p.evaluate(() => zakProduct(ZAKLAD.find(z => /^Mrkev/.test(z.n))).id);
  ck('potravina se stejným názvem z dvou zdrojů se ukáže jednou',
     mrkve.filter(id => id === 'x-mrkev' || id === mrkevZak).length === 1, mrkve.join(','));
  ck('a přednost má načtená databáze před vestavěnou', mrkve.indexOf('x-mrkev') >= 0, mrkve.join(','));
  const vsechny = await p.evaluate(() => dbHledej('o', null).map(x => x.id));
  ck('hledání sahá do vestavěných, načtených i vlastních najednou',
     vsechny.indexOf('m-kase') >= 0 && vsechny.indexOf('x-8594001') >= 0 && vsechny.some(id => /^z-/.test(id)));

  /* ---- 4. zdroj se neukazuje, značka výrobce ano --------------------------- */
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(300);
  await p.fill('#nameQ', 'tvaroh'); await p.waitForTimeout(500);
  const tv = (await p.textContent('#nameRes')).replace(/\s+/g, ' ');
  ck('u potraviny z NutriDatabáze se zdroj neukazuje', tv.indexOf('NutriDatab') < 0 && tv.indexOf('ČR') < 0, tv.slice(0, 120));
  await p.fill('#nameQ', 'jogurt'); await p.waitForTimeout(500);
  ck('značka výrobce zůstává', (await p.textContent('#nameRes')).indexOf('Danone') >= 0);
  await p.fill('#nameQ', 'gulášek'); await p.waitForTimeout(500);
  ck('hotové jídlo je označené', (await p.textContent('#nameRes')).indexOf('hotové jídlo') >= 0);
  await p.fill('#nameQ', 'rýže bílá vařená'); await p.waitForTimeout(500);
  const ryz = (await p.textContent('#nameRes')).replace(/\s+/g, ' ');
  ck('vestavěná potravina nemá štítek „základní"', ryz.indexOf('základní') < 0, ryz.slice(0, 120));

  /* ---- 5. použití nic nekopíruje, gramáž si pamatuje ----------------------- */
  const pred = await p.evaluate(async () => (await dbAll('products')).length);
  await p.evaluate(zak => openPortion(zak), ids.zak); await p.waitForTimeout(400);
  ck('okno porce vezme zapamatovanou gramáž', (await p.inputValue('#poAmt')) === '180', await p.inputValue('#poAmt'));
  await p.fill('#poAmt', '220');
  await p.evaluate(() => addPortion()); await p.waitForTimeout(700);
  const poZap = await p.evaluate(async zak => ({ n: (await dbAll('products')).length, pu: dbPouziti[zak] }), ids.zak);
  ck('zápis vestavěné potraviny ji mezi vlastní nezkopíroval', poZap.n === pred, pred + ' → ' + poZap.n);
  ck('ale připočetl použití a novou gramáž', poZap.pu.n === 8 && poZap.pu.posl === 220, JSON.stringify(poZap.pu));
  ck('a zapamatoval si je natrvalo', await p.evaluate(async zak => (await dbGet('meta', 'pouziti')).v[zak].posl === 220, ids.zak));

  /* ---- 6. čárový kód z načtené databáze ----------------------------------- */
  await p.evaluate(() => lookup('8594001')); await p.waitForTimeout(600);
  ck('kód z načtené databáze otevře porci', (await p.textContent('#poName')) === 'Jogurt bílý');
  ck('a nic mezi vlastní nekopíruje', (await p.evaluate(async () => (await dbAll('products')).length)) === pred);
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 7. vestavěnou potravinu jde upravit a vrátit ------------------------ */
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  await p.evaluate(zak => openEdit(zak), ids.zak); await p.waitForTimeout(300);
  ck('úprava vestavěné potraviny se otevře s jejími hodnotami', (await p.inputValue('#edName')) === 'Rýže bílá vařená');
  ck('tlačítko Vrátit původní zatím není', !(await p.isVisible('#edPuvodni')));
  await p.fill('#edKcal', '140');
  await p.evaluate(() => saveProduct()); await p.waitForTimeout(500);
  await p.evaluate(() => closeMod('modPortion'));
  const upr = await p.evaluate(zak => { const x = products.find(y => y.id === zak); return x && { kcal: x.kcal, source: x.source }; }, ids.zak);
  ck('úprava se uložila pod stejným id', upr && upr.kcal === 140, JSON.stringify(upr));
  ck('a zdroj zůstal vestavěný', upr && upr.source === 'zaklad', JSON.stringify(upr));
  ck('v databázi platí nová hodnota', (await p.evaluate(zak => potravina(zak).kcal, ids.zak)) === 140);
  await p.evaluate(zak => openEdit(zak), ids.zak); await p.waitForTimeout(300);
  ck('teď jde vrátit původní', await p.isVisible('#edPuvodni'));
  await p.evaluate(() => vratitPuvodni()); await p.waitForTimeout(500);
  const zpet = await p.evaluate(zak => potravina(zak).kcal, ids.zak);
  ck('po vrácení platí zase vestavěná hodnota', zpet !== 140, String(zpet));

  /* ---- 8. upravená položka z NutriDatabáze se nepředá ----------------------- */
  await p.evaluate(() => openEdit('x-tvaroh')); await p.waitForTimeout(300);
  await p.fill('#edKcal', '101');
  await p.evaluate(() => saveProduct()); await p.waitForTimeout(500);
  await p.evaluate(() => closeMod('modPortion'));
  const tvUpr = await p.evaluate(() => { const x = products.find(y => y.id === 'x-tvaroh'); return x && x.source; });
  ck('úprava položky z NutriDatabáze si drží zdroj', tvUpr === 'ext', String(tvUpr));
  const predani = await p.evaluate(async () => (await potravinyKPredani()).prod.map(x => x.id));
  ck('a do databáze pro jiného člověka nejde', predani.indexOf('x-tvaroh') < 0, predani.join(','));

  /* ---- 9. odebrání a vrácení --------------------------------------------- */
  p.once('dialog', d => d.accept());
  await p.evaluate(() => openEdit('x-8594001')); await p.waitForTimeout(300);
  await p.evaluate(() => deleteProduct()); await p.waitForTimeout(500);
  ck('odebraná potravina zmizí z hledání', !(await p.evaluate(() => dbHledej('jogurt', null).some(x => x.id === 'x-8594001'))));
  ck('ale v načtené databázi zůstala', await p.evaluate(async () => !!(await dbGet('ext', 'x-8594001'))));
  ck('odebrání se nepředává', (await p.evaluate(async () => (await potravinyKPredani()).prod.some(x => x.skryto))) === false);
  await p.evaluate(() => renderDb()); await p.waitForTimeout(300);
  ck('karta nabídne vrácení odebraných', (await p.textContent('#potrStav')).indexOf('vrátit') >= 0,
     await p.textContent('#potrStav'));
  await p.evaluate(() => dbOdkryj()); await p.waitForTimeout(500);
  ck('vrácení ji vrátí do hledání', await p.evaluate(() => dbHledej('jogurt', null).some(x => x.id === 'x-8594001')));

  /* ---- 10. vlastní potravina se maže doopravdy ------------------------------ */
  p.once('dialog', d => d.accept());
  await p.evaluate(() => openEdit('m-kase')); await p.waitForTimeout(300);
  await p.evaluate(() => deleteProduct()); await p.waitForTimeout(500);
  ck('vlastní potravina se smaže, ne skryje',
     await p.evaluate(async () => !(await dbGet('products', 'm-kase'))));

  /* ---- 11. recept je hotové jídlo ------------------------------------------ */
  await p.evaluate(() => { setDbMode('jidla'); }); await p.waitForTimeout(300);
  await p.fill('#dbSearch', 'gulášek'); await p.waitForTimeout(300);
  ck('vlastní recept je mezi hotovými jídly', (await p.textContent('#dbList')).indexOf('Gulášek podle Huana') >= 0);
  await p.evaluate(() => { setDbMode('potr'); }); await p.waitForTimeout(300);
  ck('a mezi potravinami není', (await p.textContent('#dbList')).indexOf('Gulášek podle Huana') < 0);

  /* ---- 12. úklid proběhne jen jednou ---------------------------------------- */
  await p.evaluate(async () => {
    await dbPut('products', Object.assign({}, zakProduct(ZAKLAD[0]), { uses: 1 }));
  });
  const znovu = await p.evaluate(() => dbSjednot());
  ck('podruhé se úklid nespustí', znovu === 0, String(znovu));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
