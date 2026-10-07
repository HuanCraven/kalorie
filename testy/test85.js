/* Test v121 — tah prstem mezi dny a náhled dne v kalendáři.

   Tah na Hlavní: doleva = další den, doprava = předchozí. Nesmí se plést se
   smazáním tahem na položce deníku, se svislým posouváním ani s otevřeným oknem.
   Kalendář: první ťuknutí ukáže náhled (kcal, alkohol, váha, poznámka), druhé
   den otevře. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true,
    serviceWorkers: 'block' });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  const dnes = PROSTREDI.den(0), vcera = PROSTREDI.den(-1);
  await p.evaluate(async ([d, v]) => {
    await dbPut('log', { date: v, productId: 'quick', name: 'Řízek', unit: 'g', meal: 'obed',
      amount: 200, kcal: 520, p: 40, c: 20, f: 30, ts: 1 });
    await dbPut('log', { date: v, productId: 'alk', name: 'Pivo', unit: 'ml', meal: 'vecer',
      amount: 500, kcal: 210, p: 0, c: 18, f: 0, alc: 19.7, ts: 2 });
    await zapisDen(v, 'uzivatel', { weight: 81.4, neuplny: true, pozn: 'oslava u <i>Petra</i>' });
    await dbPut('log', { date: d, productId: 'quick', name: 'Snídaně', unit: 'g', meal: 'snidane',
      amount: 100, kcal: 300, p: 10, c: 40, f: 10, ts: 3 });
    await obDismiss(); curDate = d; await renderDay();
  }, [dnes, vcera]);

  // tah: syntetické touch události na zadaném prvku
  const tah = (sel, dx, dy) => p.evaluate(([sel, dx, dy]) => {
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + Math.min(20, r.height / 2);
    const t = (cx, cy) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x, y)], changedTouches: [t(x, y)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx, y + dy)] }));
  }, [sel, dx, dy]);
  const den = () => p.evaluate(() => curDate);

  /* ---- 1. tah mezi dny ----------------------------------------------- */
  await tah('.card.hero', 120, 5);
  await p.waitForTimeout(300);
  ck('tah doprava = předchozí den', await den() === vcera, await den());
  ck('a Hlavní ukazuje jeho jídlo', /Řízek/.test(await p.textContent('#logList')));
  await tah('.card.hero', -120, 5);
  await p.waitForTimeout(300);
  ck('tah doleva = další den', await den() === dnes, await den());
  await tah('.card.hero', 40, 0);
  await p.waitForTimeout(200);
  ck('krátký tah nic neudělá', await den() === dnes);
  await tah('.card.hero', 90, 80);
  await p.waitForTimeout(200);
  ck('šikmý (svislý) tah nic neudělá', await den() === dnes);
  await tah('#logList .item', 120, 0);
  await p.waitForTimeout(200);
  ck('tah na položce deníku den nepřepne', await den() === dnes);
  await p.evaluate(() => kalOtevri());
  await p.waitForTimeout(300);
  await tah('.card.hero', 120, 0);
  await p.waitForTimeout(200);
  ck('při otevřeném okně se nelistuje', await den() === dnes);

  /* ---- 2. náhled dne v kalendáři ------------------------------------- */
  const btn = d => '#kalMrizka button[data-den="' + d + '"]';
  await p.evaluate(s => document.querySelector(s).click(), btn(vcera));
  await p.waitForTimeout(300);
  const nh = await p.textContent('#kalNahled');
  ck('první ťuknutí ukáže náhled', await p.isVisible('#kalNahled') && await p.isVisible('#modKal'));
  ck('náhled: kcal a makra', /730 kcal/.test(nh) && /B 40/.test(nh), nh);
  ck('náhled: alkohol, váha, nekompletní', /alkohol 19\.7 g|alkohol 19,7 g/.test(nh) && /81\.4 kg|81,4 kg/.test(nh) && /nekompletní/.test(nh), nh);
  ck('náhled: poznámka escapovaná', /oslava u <i>Petra<\/i>/.test(nh) && !(await p.evaluate(() => !!document.querySelector('#kalNahled i'))), nh);
  ck('den je v mřížce zvýrazněný', /\bnahled\b/.test(await p.getAttribute(btn(vcera), 'class') || ''));
  ck('a Hlavní se zatím nepřepnula', await den() === dnes);
  await p.evaluate(s => document.querySelector(s).click(), btn(dnes));
  await p.waitForTimeout(300);
  ck('ťuknutí na jiný den přepne náhled', /300 kcal/.test(await p.textContent('#kalNahled')) && await p.isVisible('#modKal'));
  await p.evaluate(s => document.querySelector(s).click(), btn(vcera));
  await p.waitForTimeout(200);
  await p.locator('#kalNahled button', { hasText: 'Otevřít' }).click();
  await p.waitForTimeout(500);
  ck('Otevřít v náhledu přepne den a zavře kalendář', await den() === vcera && !(await p.isVisible('#modKal')));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
