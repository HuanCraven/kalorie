/* Test v78 — výpis dnů se záznamem z hodinek.
   Vznikl proto, že se jeden zápis ze snímku trefil na datum v budoucnosti a
   nebyl k nalezení: statistiky staví řadu pozpátku od dneška, takže budoucí den
   se do nich nedostane. Tenhle výpis je jediné místo, kde je vidět všechno. */
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
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  const otevri = async () => {
    await p.evaluate(() => { go('set'); setSetMode('data'); });
    await p.waitForTimeout(700);
  };

  /* ---- 1. bez dat to řekne ---------------------------------------- */
  await otevri();
  ck('bez snímků to řekne',
     (await p.textContent('#hodinkyList')).indexOf('nenahrál') >= 0,
     await p.textContent('#hodinkyList'));

  /* ---- 2. vypíše dny se snímkem, ostatní ne ----------------------- */
  const dny = await p.evaluate(async () => {
    const posun = k => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() + k); return dstr(x); };
    const vcera = posun(-1), budouci = posun(45), jenVaha = posun(-2);
    await dbPut('daily', { date: vcera, total: 2650, kroky: 9800, tep: 54, hrv: 42, spanek: 430 });
    await dbPut('daily', { date: budouci, total: 2400, kroky: 5000 });
    await dbPut('daily', { date: jenVaha, weight: 81.5 });
    return { vcera, budouci, jenVaha };
  });
  await otevri();
  const txt = () => p.textContent('#hodinkyList');
  ck('vypíše se den se snímkem', (await txt()).indexOf('2650 kcal') >= 0, (await txt()).slice(0, 140));
  ck('den jen s váhou se nevypisuje', (await p.locator('#hodinkyList .item').count()) === 2,
     'řádků: ' + await p.locator('#hodinkyList .item').count());
  ck('ukáže se tep i spánek', (await txt()).indexOf('tep 54') >= 0 && (await txt()).indexOf('spánek') >= 0);

  /* ---- 3. budoucí den je označený a vysvětlený -------------------- */
  ck('budoucí den je označený', (await txt()).indexOf('budoucí den') >= 0);
  ck('a řekne se, co s ním', (await txt()).indexOf('špatné datum') >= 0);

  /* ---- 4. smazání zbaví den čísel z hodinek ----------------------- */
  await p.click('#hodinkyList .item >> nth=0 >> button');
  await p.waitForTimeout(800);
  const poSmazani = await p.evaluate(d => dbGet('daily', d), dny.budouci);
  ck('budoucí zápis se smaže celý', !poSmazani, JSON.stringify(poSmazani));
  ck('a zmizí z výpisu', (await p.locator('#hodinkyList .item').count()) === 1);
  ck('varování o budoucím dni zmizí taky', (await txt()).indexOf('budoucí den') < 0);

  /* ---- 5. váha a příznak dne mazání přežijí ----------------------- */
  await p.evaluate(async d => {
    const z = await dbGet('daily', d); z.weight = 82.4; z.neuplny = true; await dbPut('daily', z);
  }, dny.vcera);
  await otevri();
  await p.click('#hodinkyList .item >> nth=0 >> button');
  await p.waitForTimeout(800);
  const zbytek = await p.evaluate(d => dbGet('daily', d), dny.vcera);
  ck('váha a příznak dne zůstanou', zbytek && zbytek.weight === 82.4 && zbytek.neuplny === true,
     JSON.stringify(zbytek));
  ck('ale čísla z hodinek jsou pryč',
     zbytek && zbytek.total === undefined && zbytek.tep === undefined, JSON.stringify(zbytek));
  ck('výpis je zase prázdný', (await txt()).indexOf('nenahrál') >= 0, await txt());

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
