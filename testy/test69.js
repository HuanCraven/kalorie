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
    for (let i = 1; i <= 3; i++)
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Jogurt', unit: 'g',
        amount: 150, meal: 'snidane', kcal: 90, p: 9, c: 6, f: 3, ts: 4000 + i });
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
  ck('uvnitř chodu se řadí od nejčastějšího', await p.evaluate(() => {
    const sk = [...document.querySelectorAll('#favList .casteChod')]
      .find(x => x.textContent.indexOf('Snídaně') >= 0);
    return !!sk && sk.textContent.indexOf('Ovesná kaše') < sk.textContent.indexOf('Jogurt');
  }));

  /* v95: rozděleno po chodech — k snídani se hodí něco jiného než k večeři. */
  ck('položky jsou rozdělené po chodech',
     (await p.locator('#favList .casteChod').count()) >= 2,
     'skupin: ' + await p.locator('#favList .casteChod').count());
  ck('a chody jsou pojmenované',
     (await txt()).indexOf('Snídaně') >= 0 && (await txt()).indexOf('Večeře') >= 0, await txt());
  ck('ovesná kaše je u snídaně, ne u večeře', await p.evaluate(() => {
    const sk = [...document.querySelectorAll('#favList .casteChod')]
      .find(x => x.textContent.indexOf('Snídaně') >= 0);
    return !!sk && sk.textContent.indexOf('Ovesná kaše') >= 0;
  }));

  /* ---- 3. klepnutím se zapíše totéž znovu ------------------------- */
  const pred = await p.evaluate(async () => (await dbByIdx('log', 'date', curDate)).length);
  await p.evaluate(() => [...document.querySelectorAll('#favList button')]
    .find(x => x.textContent.indexOf('Ovesná kaše') >= 0).click());
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

  /* ---- 4. chod se bere z položky, ne z hodin (v95) -----------------
     Dřív se hádal podle denní doby. Jenže kdo v deset večer dohání oběd, nechce
     ho mít ve večerní svačině — a položka svůj chod zná, byla podle něj vybrána. */
  ck('zápis jde do chodu, ke kterému položka patří', novy.posl.meal === 'snidane',
     novy.posl.name + ' do ' + novy.posl.meal);

  // oběd zapsaný večer musí skončit v obědě, ne v tom, co zrovna ukazují hodiny
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 1; i <= 4; i++)
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Svíčková', unit: 'porce',
        amount: 1, meal: 'obed', kcal: 700, p: 30, c: 60, f: 30, ts: 5000 + i });
    return renderDay();
  });
  await p.waitForTimeout(700);
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#favList button')].find(x => x.textContent.indexOf('Svíčková') >= 0);
    b.click();
  });
  await p.waitForTimeout(700);
  const svickova = await p.evaluate(async () =>
    (await dbByIdx('log', 'date', curDate)).filter(r => r.name === 'Svíčková')[0]);
  ck('oběd se zapíše do oběda bez ohledu na hodiny', svickova && svickova.meal === 'obed',
     JSON.stringify(svickova));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
