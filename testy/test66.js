/* Test v72, přepsaný ve v110 — všední dny proti víkendu.

   Vlastní karta ve Statistikách byla v72–v109. Huan ji v provozu nepoužíval,
   takže se zrušila. Zbyla jedna věta v postřehu o kolísání příjmu — když za
   kolísáním stojí víkend, řekne se to rovnou, protože obecná rada „vyrovnanější
   dny" se pak špatně použije. Hlídá se tady, že karta je opravdu pryč i s kotvou,
   a že výpočet pod tou větou pořád správně zachází s nekompletními dny. */
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

  /* ---- 1. karta je pryč ------------------------------------------- */
  await p.evaluate(() => { go('stats'); setPeriod(30); });
  await p.waitForTimeout(1000);
  ck('karta Všední dny proti víkendu ve stránce není',
     await p.evaluate(() => !document.getElementById('tydenKarta') && !document.getElementById('stTyden')));
  ck('a nemá ani kotvu v liště',
     (await p.locator('#stKotvy .kotva').allTextContents()).indexOf('Víkend') < 0);

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

  const v1 = await p.evaluate(() => {
    const v = tydenniVzorec(statCache.list);
    return { p: Math.round(v.p.k), v: Math.round(v.v.k), r: Math.round(v.rozdil), alcV: v.v.alc, alcP: v.p.alc };
  });
  ck('výpočet dá všední den 1800 kcal', v1.p === 1800, JSON.stringify(v1));
  ck('a víkend 3600 kcal', v1.v === 3600, JSON.stringify(v1));
  ck('alkohol se dělí všemi dny skupiny', v1.alcV === 30 && v1.alcP === 0, JSON.stringify(v1));

  /* ---- 3. postřeh o kolísání pořád jmenuje víkend ------------------ */
  const ins = (await p.textContent('#stInsights')).replace(/\s+/g, ' ');
  ck('postřeh o kolísání jmenuje víkend', /kolísá[\s\S]*víkend/.test(ins), ins.slice(0, 160));
  const cil = await p.evaluate(() => {
    const el = [...document.querySelectorAll('#stInsights .postreh')].find(x => /kolísá/.test(x.textContent));
    return el ? (el.getAttribute('data-cil') || el.getAttribute('onclick') || '') : '';
  });
  ck('a odkazuje na příjem, ne na zrušenou kartu', cil.indexOf('tydenKarta') < 0, cil);

  /* ---- 4. nekompletní víkendový den do příjmu nejde, alkohol ano --- */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 30; i++) {
      const d = den(i), w = new Date(d + 'T12:00:00').getDay();
      if (w === 0 || w === 6) {
        await dbPut('daily', { date: d, total: 2500, neuplny: true });
        const j = await dbGet('log', 'j' + i); j.kcal = 200; await dbPut('log', j);
        return renderStats();
      }
    }
  });
  await p.waitForTimeout(1200);
  const v2 = await p.evaluate(() => {
    const v = tydenniVzorec(statCache.list);
    return { v: Math.round(v.v.k), alcV: v.v.alc };
  });
  ck('osekaný víkendový den průměr nesrazí', v2.v === 3600, JSON.stringify(v2));
  ck('ale alkohol z něj se počítá dál', v2.alcV === 30, JSON.stringify(v2));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
