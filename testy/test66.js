/* Test v72 — všední dny proti víkendu + četnost u zdrojů kalorií.
   Že příjem kolísá, statistika říkala i dřív, ale ne kdy. Víkend se počítá jen
   z kompletních dnů (jako ostatní průměry), alkohol ze všech dnů skupiny. */
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

  /* ---- 1. bez dat se karta neukazuje ------------------------------- */
  await p.evaluate(() => { go('stats'); setPeriod(30); });
  await p.waitForTimeout(1200);
  ck('bez dat je karta schovaná',
     await p.evaluate(() => $('tydenKarta').style.display === 'none'));

  /* ---- 2. 30 dní: po–pá 1800 kcal, so–ne 3300 + pivo 300 ----------- */
  await p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = false; await dbPut('meta', { k: 'goals', v: goals });
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 30; i++) {
      const d = den(i), w = new Date(d + 'T12:00:00').getDay(), vik = (w === 0 || w === 6);
      await dbPut('daily', { date: d, total: 2500 });
      await dbPut('log', { id: 'j' + i, date: d, productId: 'quick', name: 'Jídlo', unit: 'porce',
        amount: 1, meal: 'obed', kcal: vik ? 3300 : 1800, p: 50, c: 100, f: 30, ts: Date.now() });
      if (vik) await dbPut('log', { id: 'b' + i, date: d, productId: 'alk', name: 'Pivo', unit: 'ml',
        amount: 700, meal: 'vecere', kcal: 300, p: 0, c: 24, f: 0, alc: 30, abv: 5, ts: Date.now() });
    }
    return renderStats();
  });
  await p.waitForTimeout(1300);

  ck('s daty se karta ukáže',
     await p.evaluate(() => $('tydenKarta').style.display !== 'none'));
  const t = (await p.textContent('#stTyden')).replace(/\s+/g, ' ');
  ck('všední den ukáže 1800 kcal', /po–pá 1800 kcal/.test(t), t.slice(0, 90));
  ck('víkend ukáže 3600 kcal', /so–ne 3600 kcal/.test(t), t.slice(0, 90));

  /* ---- 3. rozdíl a jeho dopad na týdenní průměr -------------------- */
  ck('řekne rozdíl 1800 kcal', t.indexOf('o 1800 kcal víc') >= 0, t);
  ck('a přepočte ho na týdenní průměr (514 kcal/den)', t.indexOf('514 kcal/den') >= 0, t);
  const vzorec = await p.evaluate(() => { const v = tydenniVzorec(statCache.list); return { r: v.rozdil, n: Math.round(v.naTyden) }; });
  ck('výpočet naTyden = rozdíl × 2 / 7', vzorec.n === Math.round(vzorec.r * 2 / 7), JSON.stringify(vzorec));

  /* ---- 4. alkohol se dělí všemi dny skupiny ------------------------ */
  ck('alkohol po–pá je 0 g/den', /po–pá 0 g\/den/.test(t), t);
  ck('alkohol so–ne je 30 g/den', /so–ne 30 g\/den/.test(t), t);

  /* ---- 5. postřeh o kolísání ukáže na víkend ----------------------- */
  const ins = (await p.textContent('#stInsights')).replace(/\s+/g, ' ');
  ck('postřeh o kolísání jmenuje víkend', /kol\u00edsá[\s\S]*víkend/.test(ins), ins.slice(0, 160));

  /* ---- 6. zdroje kalorií ukážou četnost ---------------------------- */
  const top = (await p.textContent('#stTop')).replace(/\s+/g, ' ');
  ck('u zdroje je počet opakování', /Jídlo 30×/.test(top), top.slice(0, 120));
  ck('a průměr na jedno zapsání', top.indexOf('ø') >= 0, top.slice(0, 120));

  /* ---- 7. nekompletní víkendový den do příjmu nejde, alkohol ano --- */
  const vikIdx = await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 30; i++) {
      const d = den(i), w = new Date(d + 'T12:00:00').getDay();
      if (w === 0 || w === 6) {
        await dbPut('daily', { date: d, total: 2500, neuplny: true });
        const j = await dbGet('log', 'j' + i); j.kcal = 200; await dbPut('log', j);
        await renderStats(); return i;
      }
    }
    return -1;
  });
  await p.waitForTimeout(1200);
  const t2 = (await p.textContent('#stTyden')).replace(/\s+/g, ' ');
  ck('osekaný víkendový den průměr nesrazí', /so–ne 3600 kcal/.test(t2), 'den ' + vikIdx + ': ' + t2.slice(0, 90));
  ck('ale alkohol z něj se počítá dál', /so–ne 30 g\/den/.test(t2), t2);

  /* ---- 8. bez příznaku průměr klesne ------------------------------- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 30; i++) {
      const d = den(i), w = new Date(d + 'T12:00:00').getDay();
      if (w === 0 || w === 6) { await dbPut('daily', { date: d, total: 2500 }); await renderStats(); return; }
    }
  });
  await p.waitForTimeout(1200);
  const t3 = (await p.textContent('#stTyden')).replace(/\s+/g, ' ');
  ck('bez příznaku se osekaný den do víkendu započítá', !/so–ne 3600 kcal/.test(t3), t3.slice(0, 90));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
