/* Test v42 — kickbox v databázi, kalkulačka chůze s batohem (Pandolf) */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

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
    await put('daily', { date: curDate, weight: 90 });
  });
  await p.reload(); await p.waitForTimeout(700);
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(500);

  // --- kickbox v databázi
  await p.fill('#fitQ', 'kickbox'); await p.waitForTimeout(300);
  ck('kickbox v databázi (10.3 MET)', (await p.textContent('#fitRes')).includes('10.3 MET'),
    await p.textContent('#fitRes'));
  await p.fill('#fitQ', '');

  // --- kalkulačka: váha se předvyplní z deníku
  ck('váha předvyplněna (90)', (await p.inputValue('#rkW')) === '90', await p.inputValue('#rkW'));

  // --- Pandolf: 90 kg + 15 kg, 5 km/h, les (1.2), 60 min, rovina → net 345
  await p.fill('#rkV', '5'); await p.fill('#rkL', '15'); await p.fill('#rkMin', '60');
  await p.selectOption('#rkTer', '1.2'); await p.waitForTimeout(300);
  ck('výpočet 345 kcal', (await p.textContent('#rkOut')).trim() === '345 kcal', await p.textContent('#rkOut'));
  ck('poznámka: 5 km, zátěž, rovina', /5 km · 15 kg na zádech · po rovině/.test(await p.textContent('#rkNote')),
    await p.textContent('#rkNote'));

  // --- s převýšením roste (250 m na 5 km = 5 %)
  await p.fill('#rkElev', '250'); await p.waitForTimeout(300);
  const withHill = parseInt(await p.textContent('#rkOut'));
  ck('převýšení zvýší odhad (>500)', withHill > 500, withHill);
  ck('sklon v poznámce 5 %', (await p.textContent('#rkNote')).includes('sklon 5 %'), await p.textContent('#rkNote'));

  // --- zápis pochodu
  await p.fill('#rkElev', '');
  await p.waitForTimeout(200);
  await p.click('text=Zapsat pochod'); await p.waitForTimeout(500);
  ck('pochod v seznamu', (await p.textContent('#fitList')).includes('Chůze s batohem 15 kg'));
  ck('345 kcal v seznamu', (await p.textContent('#fitList')).includes('345'));
  ck('součet dne 345', (await p.textContent('#fitToday')).trim() === '345');
  ck('čas se po zápisu vynuloval', (await p.inputValue('#rkMin')) === '');

  // --- hodnoty přežijí restart (meta ruck)
  await p.reload(); await p.waitForTimeout(700);
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(500);
  ck('rychlost si pamatuje (5)', (await p.inputValue('#rkV')) === '5', await p.inputValue('#rkV'));
  ck('zátěž si pamatuje (15)', (await p.inputValue('#rkL')) === '15', await p.inputValue('#rkL'));

  // --- propsání do bilance
  await p.click('nav button[data-p="day"]'); await p.evaluate(() => renderDay()); await p.waitForTimeout(400);
  ck('bilance zahrnuje pochod', (await p.textContent('#balExp')).includes('cvičení 345'), await p.textContent('#balExp'));

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
