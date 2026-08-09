/* Test v40 — dávka 4: alkohol pročištěný, nastavení autosave, foto sbalený návod */
const PROSTREDI = require('./prostredi');
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
    await put('log', { date: curDate, productId: 'alk', name: 'Pivo 12° 0,5 l', unit: 'ml', amount: 500, meal: 'vecere', kcal: 222, p: 0, c: 20, f: 0, alc: 19.7, abv: 5, ts: Date.now() });
  });
  await p.reload(); await p.waitForTimeout(600);

  // --- alkohol: hlavní čísla viditelná, podrobnosti sbalené
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(600);
  for (const [id, nm] of [['alcAvgP', 'ø za období'], ['alcSumP', 'celkem za období'], ['alcAAll', 'ø celkem'], ['alcDry', 'dní bez']])
    ck(nm + ' viditelné', await p.locator('#' + id).isVisible());
  ck('trend graf viditelný', await p.locator('#alcTrend').isVisible());
  ck('graf dnů viditelný (od v52 mimo podrobnosti)', await p.locator('#alcChart').isVisible());
  ck('měsíc sbalený v podrobnostech', !(await p.locator('#alcAM').isVisible()));
  ck('součty g sbalené', !(await p.locator('#alc7').isVisible()));
  await p.click('#p-alc details summary >> nth=2'); await p.waitForTimeout(300);
  ck('podrobnosti jdou rozbalit (měsíc)', await p.locator('#alcAM').isVisible());
  ck('hodnoty se počítají (ø období > 0)', parseFloat(await p.textContent('#alcAvgP')) > 0, await p.textContent('#alcAvgP'));

  // --- nastavení: žádné tlačítko Uložit, změna se uloží sama
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  const saveBtns = await p.locator('#p-set button', { hasText: 'Uložit' }).count();
  ck('v Nastavení není tlačítko Uložit', saveBtns === 0, 'nalezeno ' + saveBtns);
  await p.fill('#gKcal', '2345'); await p.waitForTimeout(900);   // oninput + debounce 600 ms
  await p.reload(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('cíl kcal přežil restart (autosave)', (await p.inputValue('#gKcal')) === '2345', await p.inputValue('#gKcal'));
  await p.fill('#gAlcDay', '15'); await p.waitForTimeout(900);
  await p.reload(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('limit alkoholu přežil restart', (await p.inputValue('#gAlcDay')) === '15');

  // --- kalkulačka RMR ukládá sama
  await p.click('#p-set details summary >> nth=0'); await p.waitForTimeout(200);
  await p.fill('#cAge', '40'); await p.fill('#cH', '180'); await p.fill('#cW', '90');
  await p.click('text=Spočítat a doplnit'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('RMR z kalkulačky přežil restart', (await p.inputValue('#gRmr')) === '1830', await p.inputValue('#gRmr'));

  // --- foto: návody otevřené před prvním úspěchem
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.waitForTimeout(200);
  ck('varování ke sdílení otevřené', await p.evaluate(() => $('fotoHelp2').open));
  // zpracuj odpověď a ulož → návody se sbalí
  await p.fill('#aiIn', '{"jidlo":"Test","polozky":[{"nazev":"rýže","mn":200,"kcal":130,"b":2.7,"s":28,"t":0.3}],"pozn":""}');
  await p.click('text=Zpracovat'); await p.waitForTimeout(400);
  await p.click('text=Přidat jako jedno jídlo'); await p.waitForTimeout(500);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  ck('po úspěchu je varování sbalené', !(await p.evaluate(() => $('fotoHelp2').open)));
  await p.reload(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  ck('sbalení přežije restart', !(await p.evaluate(() => $('fotoHelp2').open)));

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
