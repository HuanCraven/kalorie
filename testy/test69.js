/* Test v103 — nabídka v prázdném poli hledání podle chodu.
   Samostatná záložka „Časté" se v provozu neosvědčila a zrušila se; její funkci
   převzalo prázdné pole Hledat, kde ji člověk hledá. Nabídka se řídí chodem —
   k snídani chodí něco jiného než k obědu — a bere se z deníku, ne z
   products.uses, které u zápisu přes fotku nebo popis vůbec neroste. */
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

  const txt = () => p.textContent('#nameRes');

  /* ---- 1. zrušená záložka a výchozí panel -------------------------- */
  await p.click('nav button[data-p="scan"]');
  await p.waitForTimeout(500);
  const panely = await p.$$eval('#addSeg button', bs => bs.map(b => b.textContent.trim()));
  ck('záložka Časté je pryč', panely.indexOf('Časté') < 0, panely.join('|'));
  ck('Zadat se otevírá na Hledat',
     await p.evaluate(() => document.getElementById('s-find').classList.contains('on')));

  /* ---- 2. prázdný deník nic neslibuje ------------------------------ */
  ck('bez zápisů to řekne', (await txt()).indexOf('Napiš aspoň dvě písmena') >= 0, await txt());

  /* ---- 3. nabídka se řídí chodem ----------------------------------- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    // samé zástupné productId — cesty, které products.uses nikdy nezvýšily
    for (let i = 1; i <= 5; i++)
      await dbPut('log', { date: den(i), productId: 'foto', name: 'Ovesná kaše', unit: 'g',
        amount: 250, meal: 'snidane', kcal: 420, p: 18, c: 60, f: 10, ts: 100 + i });
    for (let i = 1; i <= 4; i++)
      await dbPut('log', { date: den(i), productId: 'popis', name: 'Svíčková', unit: 'porce',
        amount: 1, meal: 'obed', kcal: 700, p: 30, c: 60, f: 30, ts: 200 + i });
    // jednorázovka: mezi Nejčastější nepatří, ale jako Naposledy ano
    await dbPut('log', { date: den(1), productId: 'quick', name: 'Croissant', unit: 'porce',
      amount: 1, meal: 'snidane', kcal: 300, p: 5, c: 35, f: 15, ts: 300 });
    return renderRychle();
  });
  await p.waitForTimeout(600);

  await p.selectOption('#rychleMeal', 'snidane');
  await p.waitForTimeout(500);
  const sn = await txt();
  ck('u snídaně nabídne snídani', sn.indexOf('Ovesná kaše') >= 0, sn.replace(/\s+/g, ' ').slice(0, 110));
  ck('a ne oběd', sn.indexOf('Svíčková') < 0, sn.replace(/\s+/g, ' ').slice(0, 110));
  ck('zápis z fotky se do nabídky dostane', sn.indexOf('250 g') >= 0, sn.replace(/\s+/g, ' ').slice(0, 110));
  ck('u častých je vidět počet', sn.indexOf('5×') >= 0, sn.replace(/\s+/g, ' ').slice(0, 110));
  ck('jednorázovka je pod Naposledy, ne mezi častými',
     sn.indexOf('Naposledy') >= 0 && sn.indexOf('Naposledy') < sn.indexOf('Croissant'),
     sn.replace(/\s+/g, ' ').slice(0, 160));

  await p.selectOption('#rychleMeal', 'obed');
  await p.waitForTimeout(500);
  const ob = await txt();
  ck('u oběda nabídne oběd', ob.indexOf('Svíčková') >= 0, ob.replace(/\s+/g, ' ').slice(0, 110));
  ck('a ne snídani', ob.indexOf('Ovesná kaše') < 0, ob.replace(/\s+/g, ' ').slice(0, 110));

  /* ---- 4. z nabídky přes okno porce, aby šla změnit gramáž ---------- */
  const pred = await p.evaluate(async () => (await dbByIdx('log', 'date', curDate)).length);
  await p.click('#nameRes .item >> nth=0');
  await p.waitForTimeout(600);
  ck('ťuknutí otevře okno porce', await p.isVisible('#modPortion'));
  ck('gramáž je předvyplněná podle posledního zápisu',
     (await p.inputValue('#poAmt')) === '1', await p.inputValue('#poAmt'));
  ck('chod odpovídá nabídce, ne hodinám', (await p.inputValue('#poMeal')) === 'obed',
     await p.inputValue('#poMeal'));

  // gramáž jde přepsat a zápis to respektuje
  await p.fill('#poAmt', '2');
  await p.evaluate(() => addPortion());
  await p.waitForTimeout(700);
  const novy = await p.evaluate(async () => {
    const r = await dbByIdx('log', 'date', curDate);
    return { pocet: r.length, posl: r.filter(x => x.name === 'Svíčková')[0] };
  });
  ck('zápis vznikne na dnešku', novy.pocet === pred + 1, pred + ' → ' + novy.pocet);
  ck('se změněnou gramáží', novy.posl && novy.posl.amount === 2, JSON.stringify(novy.posl));
  ck('a s přepočtenými kaloriemi', novy.posl && Math.round(novy.posl.kcal) === 1400,
     novy.posl && novy.posl.kcal);
  ck('do zvoleného chodu', novy.posl && novy.posl.meal === 'obed', novy.posl && novy.posl.meal);

  /* ---- 5. při psaní nabídka ustoupí hledání ------------------------ */
  await p.click('nav button[data-p="scan"]');
  await p.waitForTimeout(500);
  await p.fill('#nameQ', 'sví');
  await p.waitForTimeout(600);
  ck('výběr chodu se při psaní schová',
     await p.evaluate(() => document.getElementById('rychleLista').style.display === 'none'));
  await p.fill('#nameQ', '');
  await p.evaluate(() => onNameInput());
  await p.waitForTimeout(600);
  ck('a po vymazání se vrátí i s nabídkou',
     await p.evaluate(() => document.getElementById('rychleLista').style.display !== 'none') &&
     (await txt()).indexOf('Svíčková') >= 0);

  /* ---- 6. zrušená karta zdrojů kalorií ----------------------------- */
  await p.click('nav button[data-p="stats"]');
  await p.waitForTimeout(800);
  ck('karta Největší zdroje kalorií je pryč',
     await p.evaluate(() => !document.getElementById('kartaZdroje')));
  ck('a nemá kotvu ani v liště',
     (await p.locator('#stKotvy .kotva').allTextContents()).indexOf('Zdroje') < 0);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
