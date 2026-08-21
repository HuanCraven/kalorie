/* Test v92 — karta „Časté" se plní z deníku, ne z databáze potravin.
   Dřív rostla z products.uses, což zápisy přes fotku, popis ani rychlý zápis
   nezvyšují — komu ty cesty stačí, tomu karta zůstala navždy prázdná. */
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

  /* ---- 1. prázdný deník to řekne bez slibů ------------------------ */
  await p.evaluate(() => renderDay());
  await p.waitForTimeout(600);
  ck('bez opakovaného zápisu karta nic neslibuje',
     (await p.textContent('#favList')).indexOf('podruh\u00e9') >= 0,
     await p.textContent('#favList'));

  /* ---- 2. plní se ze zápisů bez potraviny v databázi -------------- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    // samé zástupné productId — přesně ty cesty, které dřív kartu neplnily
    for (let i = 1; i <= 5; i++)
      await dbPut('log', { date: den(i), productId: 'foto', name: 'Ovesná kaše', unit: 'porce',
        amount: 1, meal: 'snidane', kcal: 420, p: 18, c: 60, f: 10, ts: 1000 + i });
    for (let i = 1; i <= 3; i++)
      await dbPut('log', { date: den(i), productId: 'popis', name: 'Losos pečený', unit: 'g',
        amount: 180, meal: 'vecere', kcal: 410, p: 40, c: 0, f: 26, ts: 2000 + i });
    // jednorázovka se mezi časté dostat nesmí
    await dbPut('log', { date: den(1), productId: 'quick', name: 'Svatební dort', unit: 'porce',
      amount: 1, meal: 'svacina', kcal: 600, p: 5, c: 80, f: 30, ts: 3000 });
    return renderDay();
  });
  await p.waitForTimeout(700);
  const txt = () => p.textContent('#favList');
  ck('zápis z fotky se mezi časté dostane', (await txt()).indexOf('Ovesná kaše') >= 0, await txt());
  ck('a zápis z popisu taky', (await txt()).indexOf('Losos pečený') >= 0);
  ck('jednorázovka ne', (await txt()).indexOf('Svatební dort') < 0, await txt());
  ck('u položky je vidět, kolikrát to bylo', (await txt()).indexOf('5×') >= 0, await txt());
  ck('řadí se od nejčastějšího',
     (await txt()).indexOf('Ovesná kaše') < (await txt()).indexOf('Losos pečený'));

  /* ---- 3. klepnutím se zapíše totéž znovu ------------------------- */
  const pred = await p.evaluate(async () => (await dbByIdx('log', 'date', curDate)).length);
  await p.click('#favList button >> nth=0');
  await p.waitForTimeout(700);
  const novy = await p.evaluate(async () => {
    const r = (await dbByIdx('log', 'date', curDate));
    return { pocet: r.length, posl: r[r.length - 1] };
  });
  ck('klepnutí přidá záznam na dnešek', novy.pocet === pred + 1, pred + ' → ' + novy.pocet);
  ck('se stejnou gramáží i živinami',
     novy.posl.name === 'Ovesná kaše' && novy.posl.amount === 1 && novy.posl.kcal === 420 &&
     novy.posl.p === 18, JSON.stringify(novy.posl));
  ck('a jako nový záznam, ne kopie starého id',
     novy.posl.id !== undefined && novy.posl.date === await p.evaluate(() => curDate));

  /* ---- 4. chod se určí podle denní doby, ne podle předlohy -------- */
  ck('chod odpovídá denní době',
     novy.posl.meal === await p.evaluate(() => defaultMeal()),
     novy.posl.meal + ' vs ' + await p.evaluate(() => defaultMeal()));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
