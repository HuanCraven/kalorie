/* Test v85 — přepínání dne přímo na Statistikách.
   statsData staví řadu dnů pozpátku od curDate, takže statistiky vždycky končí
   prohlíženým dnem. Dokud to nebylo vidět ani přepnutelné, vypadala data zapsaná
   na pozdější den jako ztracená — uživatele to chytilo dvakrát. */
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

  // včera 1000 kcal, dnes 3000 — podle prohlíženého dne musí průměr vyjít jinak
  await p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = false; await dbPut('meta', { k: 'goals', v: goals });
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    await dbPut('log', { date: den(1), productId: 'quick', name: 'Včera', unit: 'porce', amount: 1,
      meal: 'obed', kcal: 1000, p: 10, c: 10, f: 10, ts: Date.now() });
    await dbPut('log', { date: den(0), productId: 'quick', name: 'Dnes', unit: 'porce', amount: 1,
      meal: 'obed', kcal: 3000, p: 10, c: 10, f: 10, ts: Date.now() });
    go('stats'); setPeriod(7); return renderStats();
  });
  await p.waitForTimeout(900);

  /* ---- 1. den je na Statistikách vidět ---------------------------- */
  ck('na Statistikách je popisek dne', await p.isVisible('#stDayLabel'));
  ck('a na dnešku hlásí Dnes', (await p.textContent('#stDayLabel')).trim() === 'Dnes',
     await p.textContent('#stDayLabel'));
  ck('tlačítko na dnešek je schované, když na něm jsme',
     !(await p.isVisible('#stDnes')));
  const prumerDnes = await p.textContent('#stKcal');
  ck('průměr počítá s dneškem', prumerDnes.trim() === '2000', prumerDnes);

  /* ---- 2. krok zpět statistiky posune ------------------------------ */
  await p.click('#p-stats >> text=‹');
  await p.waitForTimeout(900);
  ck('popisek se přepne na konkrétní den',
     (await p.textContent('#stDayLabel')).trim() !== 'Dnes', await p.textContent('#stDayLabel'));
  ck('objeví se tlačítko na dnešek', await p.isVisible('#stDnes'));
  const prumerVcera = await p.textContent('#stKcal');
  ck('dnešek se do průměru už nepočítá', prumerVcera.trim() === '1000', prumerVcera);
  const rozsah = await p.textContent('#stRange');
  ck('a řekne se, že období končí prohlíženým dnem',
     rozsah.indexOf('kon\u010d\u00ed prohl\u00ed\u017een\u00fdm dnem') > 0, rozsah);

  /* ---- 3. návrat na dnešek jedním klepnutím ----------------------- */
  await p.click('#stDnes');
  await p.waitForTimeout(900);
  ck('skok na dnešek vrátí popisek', (await p.textContent('#stDayLabel')).trim() === 'Dnes');
  ck('a průměr je zase včetně dneška', (await p.textContent('#stKcal')).trim() === '2000',
     await p.textContent('#stKcal'));
  ck('poznámka o konci období zmizí',
     (await p.textContent('#stRange')).indexOf('kon\u010d\u00ed prohl\u00ed\u017een\u00fdm') < 0);

  /* ---- 4. den je společný s Hlavní -------------------------------- */
  await p.click('#p-stats >> text=‹'); await p.waitForTimeout(800);
  const naStatech = await p.evaluate(() => curDate);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(700);
  ck('Hlavní ukazuje týž den', await p.evaluate(d => curDate === d, naStatech));
  ck('a popisek na Hlavní není Dnes', (await p.textContent('#dayLabel')).trim() !== 'Dnes');

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
