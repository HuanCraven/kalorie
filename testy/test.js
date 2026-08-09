const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  // Mock the Open Food Facts endpoint so we test our parsing, not the network
  await page.route(/openfoodfacts\.org/, route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 1, code: '8594001020304', product: {
      product_name: 'Test Jogurt', brands: 'Testland, Other', serving_quantity: '150',
      nutriments: { 'energy-kj_100g': 418, 'proteins_100g': 5.2, 'carbohydrates_100g': 4.1,
                    'fat_100g': 3.5, 'fiber_100g': 0, 'salt_100g': 0.12 } } })
  }));

  await page.goto('http://127.0.0.1:8811/index.html');
  await page.waitForTimeout(700);
  console.log('1. load ok, title =', await page.title());

  // --- lookup a barcode (miss locally -> OFF mock)
  await page.click('nav button[data-p="scan"]');
  await page.click('#addSeg button[data-s="code"]');
  await page.fill('#manualCode', '8594001020304');
  await page.click('#codeBtn');
  await page.waitForTimeout(600);
  const nm = await page.textContent('#poName');
  const sub = await page.textContent('#poSub');
  console.log('2. OFF lookup ->', nm, '|', sub);   // 418 kJ /4.184 = 99.9 kcal
  console.log('   amount prefilled =', await page.inputValue('#poAmt'));
  const calc = await page.textContent('#poK');
  console.log('3. 150 g =', calc, '| macros', await page.textContent('#poM'));  // 99.9*1.5=149.9

  await page.click('#modPortion .btn.pri');
  await page.waitForTimeout(500);
  console.log('4. day total kcal =', await page.textContent('#kcalNow'),
              '| log rows =', await page.locator('#logList .item').count());
  console.log('   protein bar =', await page.textContent('#pTxt'));

  // --- manual product
  await page.click('nav button[data-p="scan"]');
  await page.click('#addSeg button[data-s="man"]');
  await page.click('text=+ Zadat potravinu ručně');
  await page.fill('#edName', 'Tvaroh Albert');
  await page.fill('#edKcal', '75'); await page.fill('#edP', '13');
  await page.fill('#edC', '4'); await page.fill('#edF', '0.5');
  await page.fill('#edCode', '8590000111222');
  await page.click('#modEdit >> text=Uložit');
  await page.waitForTimeout(400);
  await page.fill('#poAmt', '250');
  await page.click('#modPortion .btn.pri');
  await page.waitForTimeout(500);
  console.log('5. after manual add, kcal =', await page.textContent('#kcalNow'),
              '(expect 150 + 187.5 = ~337)');

  // --- persistence: reload, data must survive
  await page.reload();
  await page.waitForTimeout(800);
  console.log('6. after reload kcal =', await page.textContent('#kcalNow'),
              '| rows =', await page.locator('#logList .item').count());
  await page.click('nav button[data-p="db"]');
  await page.waitForTimeout(300);
  console.log('7. db:', await page.textContent('#dbCount'));

  // --- barcode already in local DB -> no network needed
  await page.unroute(/openfoodfacts\.org/);
  await page.route(/openfoodfacts\.org/, r => r.abort());
  await page.click('nav button[data-p="scan"]');
  await page.click('#addSeg button[data-s="code"]');
  await page.fill('#manualCode', '8590000111222');
  await page.click('#codeBtn');
  // čekáme na otevřené okno, ne na pevný čas — jinak test občas klikne dřív, než se objeví
  await page.waitForSelector('#modPortion.on', { timeout: 10000 });
  console.log('8. local hit (offline) ->', await page.textContent('#poName'));
  await page.click('#modPortion >> text=Zrušit');
  await page.waitForSelector('#modPortion.on', { state: 'hidden', timeout: 10000 });

  // --- unknown code while offline -> manual form prefilled
  await page.fill('#manualCode', '1234567890128');
  await page.click('#codeBtn');
  await page.waitForTimeout(1200);
  console.log('9. unknown+offline -> edit sheet open =', await page.isVisible('#modEdit'),
              '| code prefilled =', await page.inputValue('#edCode'));
  await page.click('#modEdit >> text=Zrušit');

  // --- goals
  await page.click('nav button[data-p="set"]');
  await page.fill('#gKcal', '2400');
  await page.waitForTimeout(900);   // autosave (v40)
  await page.click('nav button[data-p="day"]');
  console.log('10. goal =', await page.textContent('#kcalGoal'));

  // --- export
  const dlp = page.waitForEvent('download');
  await page.click('nav button[data-p="set"]');
  await page.evaluate(() => setSetMode('data')); await page.click('text=Export zálohy (JSON)');
  const d = await dlp;
  console.log('11. export file =', d.suggestedFilename());

  // day navigation
  await page.click('nav button[data-p="day"]');
  await page.click('#dayPrev');
  await page.waitForTimeout(300);
  console.log('12. prev day label =', await page.textContent('#dayLabel'),
              '| kcal =', await page.textContent('#kcalNow'));

  await page.click('nav button[data-p="day"]');
  await page.screenshot({ path: PROSTREDI.DIR+'/shot-day.png' });
  await page.click('nav button[data-p="scan"]');
  await page.screenshot({ path: PROSTREDI.DIR+'/shot-scan.png' });

  console.log('\nERRORS:', errs.length ? errs.join('\n  ') : 'none');
  await browser.close();
})();
