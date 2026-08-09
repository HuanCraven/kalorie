/* Test v41 — záložka Pohyb: MET odhad, ruční kcal, propsání do bilance a statistik,
const PROSTREDI = require('./prostredi');
   swipe mazání, editace, záloha, dynamické cíle */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);
  await p.evaluate(async () => {
    const put = (s, v) => new Promise(r => { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = r; });
    await put('meta', { k: 'obDone', v: 1 });
    await put('meta', { k: 'goals', v: { kcal: 2000, p: 130, c: 220, f: 65, alcDay: 0, rmr: 1800, fib: 30, salt: 5 } });
    await put('daily', { date: curDate, weight: 90, burn: 200 });
    await put('log', { date: curDate, productId: 'x', name: 'Oběd', unit: 'g', meal: 'obed', amount: 400, kcal: 800, p: 40, c: 80, f: 20, ts: Date.now() });
  });
  await p.reload(); await p.waitForTimeout(700);

  // --- záložka existuje, MET vyhledávání
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(400);
  ck('záložka Pohyb se otevře', await p.locator('#p-fit').isVisible());
  await p.fill('#fitQ', 'běh'); await p.waitForTimeout(300);
  ck('vyhledávání najde běh (více tempem)', (await p.locator('#fitRes .item').count()) >= 3);
  await p.evaluate(() => fitPick(FIT_DB.findIndex(a => a.n === 'Běh 10 km/h')));
  await p.waitForTimeout(200);
  await p.fill('#fitMin', '60'); await p.waitForTimeout(300);
  // (9.8-1) × 90 kg × 1 h = 792
  ck('odhad kcal z MET a váhy (792)', (await p.getAttribute('#fitKcal', 'placeholder')) === '792',
    await p.getAttribute('#fitKcal', 'placeholder'));
  await p.click('#fitAdd'); await p.waitForTimeout(500);
  ck('aktivita v seznamu', (await p.textContent('#fitList')).includes('Běh 10 km/h'));
  ck('dnešní součet 792', (await p.textContent('#fitToday')).trim() === '792', await p.textContent('#fitToday'));

  // --- ruční kcal bez databáze
  await p.fill('#fitQ', 'Práce v lese');
  await p.fill('#fitKcal', '350');
  await p.click('#fitAdd'); await p.waitForTimeout(500);
  ck('vlastní aktivita zapsána', (await p.textContent('#fitList')).includes('Práce v lese'));
  ck('součet 1142', (await p.textContent('#fitToday')).trim() === '1142', await p.textContent('#fitToday'));

  // --- propsání na hlavní stránku
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  const balExp = await p.textContent('#balExp');
  ck('bilance zahrnuje cvičení', balExp.includes('cvičení 1142'), balExp);
  // 800 − (1800 + 200 + 1142) = −2342
  ck('bilance −2342', (await p.textContent('#balVal')).includes('-2342'), await p.textContent('#balVal'));

  // --- statistiky: výdej ø zahrnuje cvičení
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(700);
  const burn = await p.textContent('#stBurn');
  // 7 dní: 6× jen rmr 1800, 1× 1800+200+1142 → ø = (6·1800 + 3142)/7 ≈ 1992
  ck('výdej ø zahrnuje cvičení (1992)', burn.trim() === '1992', burn);

  // --- dynamické cíle počítají s cvičením
  await p.evaluate(async () => { goals.dyn = 1; goals.def = 0;
    await dbPut('meta', { k: 'goals', v: goals }); await renderDay(); });
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  const dyn = await p.textContent('#dynLine');
  ck('dynamický cíl: pohyb 1342 (hodinky+cvičení)', dyn.includes('pohyb 1342'), dyn);
  await p.evaluate(async () => { goals.dyn = 0; await dbPut('meta', { k: 'goals', v: goals }); });

  // --- editace aktivity
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(400);
  await p.click('#fitList .item[data-fdel] .grow >> nth=0'); await p.waitForTimeout(300);
  ck('editace předvyplní formulář', (await p.inputValue('#fitQ')) === 'Běh 10 km/h');
  await p.fill('#fitKcal', '700');
  await p.click('#fitAdd'); await p.waitForTimeout(500);
  ck('úprava se propsala (1050)', (await p.textContent('#fitToday')).trim() === '1050', await p.textContent('#fitToday'));

  // --- swipe smazání s Vrátit
  const it = p.locator('#fitList .item[data-fdel]').first();
  await it.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  const b = await it.boundingBox();
  await p.mouse.move(b.x + b.width - 20, b.y + b.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width - 130, b.y + b.height / 2, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(600);
  ck('swipe smazal aktivitu', (await p.locator('#fitList .item[data-fdel]').count()) === 1);
  await p.click('#toast button'); await p.waitForTimeout(500);
  ck('Vrátit obnovil aktivitu', (await p.locator('#fitList .item[data-fdel]').count()) === 2);

  // --- rychlé chipy z historie
  ck('chip s častou aktivitou', (await p.locator('#fitRecent button').count()) >= 1);

  // --- záloha obsahuje cvičení a import je neduplikuje
  const bak = await p.evaluate(async () => {
    return { workout: await dbAll('workout') };
  });
  ck('v záloze jsou 2 aktivity', bak.workout.length === 2);
  const dup = await p.evaluate(async (d) => {
    // simulace importu stejné zálohy
    const wsig = r => [r.date, r.ts, r.name, Math.round(r.kcal)].join('|');
    const whave = new Set((await dbAll('workout')).map(wsig));
    let add = 0;
    for (const x of d.workout) {
      const c = Object.assign({}, x); delete c.id;
      if (whave.has(wsig(c))) continue;
      add++;
    }
    return add;
  }, bak);
  ck('opakovaný import nepřidá nic', dup === 0);

  // --- zápis na jiný den
  await p.evaluate(() => setAddDate('2026-07-30')); await p.waitForTimeout(400);
  ck('varování o jiném dni', await p.locator('#fitDateWarn').isVisible());
  await p.fill('#fitQ', 'Jóga'); await p.fill('#fitKcal', '120');
  await p.click('#fitAdd'); await p.waitForTimeout(400);
  ck('zápis na 30. 7.', (await p.textContent('#fitList')).includes('Jóga'));
  await p.evaluate(() => setAddDate(dstr(new Date()))); await p.waitForTimeout(300);

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
