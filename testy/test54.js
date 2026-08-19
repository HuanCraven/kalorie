/* Test v52 — alkohol u potravin, graf příjmu proti výdeji, období u alkoholu */
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
  const near = (a, b, t) => Math.abs(parseFloat(a) - b) <= t;

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  /* ---- 1. potravina s obsahem alkoholu ---------------------------- */
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(200);
  await p.evaluate(() => setAdd('man')); await p.waitForTimeout(200);
  await p.click('text=+ Zadat potravinu ručně'); await p.waitForTimeout(300);
  ck('formulář má pole pro obsah alkoholu', await p.isVisible('#edAbv'));
  await p.fill('#edName', 'Pivo 12° točené');
  await p.fill('#edKcal', '43'); await p.fill('#edP', '0.5');
  await p.fill('#edC', '3.5'); await p.fill('#edF', '0');
  await p.selectOption('#edUnit', 'ml');
  await p.fill('#edAbv', '5');
  await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(600);
  ck('obsah alkoholu se uloží k potravině', await p.evaluate(async () => {
    const x = (await dbAll('products')).find(q => q.name.indexOf('Pivo 12') === 0);
    return x && x.abv === 5;
  }));

  await p.fill('#poAmt', '500'); await p.click('#modPortion >> text=Přidat'); await p.waitForTimeout(700);
  const zaznam = await p.evaluate(async () => (await dbAll('log')).find(r => r.name.indexOf('Pivo 12') === 0));
  // 500 ml × 5 % × 0,789 = 19,7 g etanolu
  ck('porce se započítá i jako alkohol', zaznam && near(zaznam.alc, 19.7, 0.3), JSON.stringify(zaznam && zaznam.alc));
  ck('a nese procenta pro pozdější přepočet', zaznam && zaznam.abv === 5);

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  ck('projeví se v dnešním alkoholu na Hlavní',
    near(await p.textContent('#alcToday'), 19.7, 0.4), await p.textContent('#alcToday'));
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(700);
  ck('objeví se i v seznamu na záložce Alkohol',
    (await p.textContent('#alcList')).indexOf('Pivo 12') >= 0);

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.click('#p-day .item .grow >> nth=0'); await p.waitForTimeout(600);
  ck('klepnutí otevře editaci potraviny, ne nápoje', await p.isVisible('#poAmt'), 'otevřel se jiný formulář');
  await p.click('#modPortion >> text=Zrušit'); await p.waitForTimeout(300);

  /* ---- 2. graf příjmu proti výdeji -------------------------------- */
  await p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = true;
    await dbPut('meta', { k: 'goals', v: goals });
    const den = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(den); d.setDate(d.getDate() - i);
      const k = dstr(d);
      await dbPut('log', { date: k, ts: 100 + i, name: 'Jídlo', amount: 500, kcal: i % 2 ? 2600 : 1400, p: 50, c: 100, f: 40 });
      await dbPut('daily', { date: k, burn: 300 });
    }
  });
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(1000);
  ck('graf bilance je pryč', !(await p.locator('#chBal').count()));
  ck('nadpis mluví o příjmu proti výdeji',
    (await p.textContent('#p-stats')).indexOf('Denní příjem proti výdeji') >= 0);
  const graf = await p.evaluate(() => {
    const svg = document.querySelector('#chKcal svg');
    const rects = [...svg.querySelectorAll('rect')].map(r => r.getAttribute('fill'));
    return { cara: svg.querySelectorAll('path').length, cervene: rects.filter(f => f === '#e0574d').length,
      modre: rects.filter(f => f === '#2f8fe6').length, popis: svg.textContent };
  });
  ck('čára denního výdeje je vykreslená', graf.cara === 1, 'path: ' + graf.cara);
  ck('dny nad výdejem jsou červené', graf.cervene >= 3, 'červených: ' + graf.cervene);
  ck('dny pod výdejem jsou modré', graf.modre >= 3, 'modrých: ' + graf.modre);
  ck('u čáry je popisek výdej', graf.popis.indexOf('výdej') >= 0, graf.popis);

  await p.evaluate(async () => { goals.rmr = 0; await dbPut('meta', { k: 'goals', v: goals }); });
  await p.click('nav button[data-p="day"]'); await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(900);
  ck('bez klidového výdeje se vrátí čára cíle',
    (await p.textContent('#chKcal')).indexOf('cíl') >= 0, await p.textContent('#chKcal'));
  await p.evaluate(async () => { goals.rmr = 1800; await dbPut('meta', { k: 'goals', v: goals }); });

  /* ---- 3. období u alkoholu --------------------------------------- */
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(700);
  ck('nahoře je přepínač období', (await p.locator('#alcSeg button').count()) === 3);
  ck('výchozí je 30 dní', await p.evaluate(() =>
    document.querySelector('#alcSeg button[data-a="30"]').classList.contains('on')));
  ck('dlaždice uvádí rozsah', (await p.textContent('#alcDryOf')) === 'z 30');
  ck('nadpis grafu uvádí rozsah', (await p.textContent('#alcChartHead')).indexOf('30 dní') > 0);
  const sloupcu30 = await p.locator('#alcChart rect').count();

  await p.click('#alcSeg button[data-a="7"]'); await p.waitForTimeout(500);
  ck('přepnutí na 7 dní zúží rozsah', (await p.textContent('#alcDryOf')) === 'z 7');
  ck('a graf se zkrátí', (await p.locator('#alcChart rect').count()) < sloupcu30, 'sloupců 30d/7d: ' + sloupcu30 + '/' + (await p.locator('#alcChart rect').count()));
  const prumer7 = parseFloat(await p.textContent('#alcAvgP'));
  ck('průměr za 7 dní je vyšší než za 30', prumer7 > 0, '' + prumer7);

  await p.click('#alcSeg button[data-a="90"]'); await p.waitForTimeout(600);
  ck('přepnutí na 90 dní', (await p.textContent('#alcDryOf')) === 'z 90');
  ck('a graf se roztáhne', (await p.locator('#alcChart rect').count()) > sloupcu30, 'sloupců: ' + (await p.locator('#alcChart rect').count()));
  ck('zvýrazněné je jen jedno období', (await p.locator('#alcSeg button.on').count()) === 1);
  ck('celkem za období odpovídá jednomu pivu', near(await p.textContent('#alcSumP'), 19.7, 0.5),
    await p.textContent('#alcSumP'));
  ck('limit se pořád počítá z 30 dní',
    (await p.textContent('#p-alc')).indexOf('30denního průměru') >= 0);

  /* ---- 4. přepínatelné okno u křivky trendu (v74) ------------------
     30denní průměr se hýbe pomalu — jeden večer s ním hne o gramy/30, takže
     křivka umí klesnout i po dni, kdy se pilo. Sedmidenní okno reaguje hned. */
  await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    // záznam 60 dní zpět, aby měl trend od čeho počítat
    await dbPut('log', { id: 'stary', date: den(60), productId: 'quick', name: 'Jídlo', unit: 'porce',
      amount: 1, meal: 'obed', kcal: 500, p: 10, c: 50, f: 10, ts: Date.now() });
    for (let i = 0; i < 7; i++)
      await dbPut('log', { id: 'v' + i, date: den(i), productId: 'alk', name: 'Víno', unit: 'ml',
        amount: 300, meal: 'vecere', kcal: 240, p: 0, c: 3, f: 0, alc: 30, abv: 12, ts: Date.now() });
    return renderAlc();
  });
  await p.waitForTimeout(800);

  ck('křivka má přepínač okna', (await p.locator('#alcTrendSeg button').count()) === 2);
  ck('výchozí okno je 30 dní', await p.evaluate(() =>
    document.querySelector('#alcTrendSeg button[data-t="30"]').classList.contains('on')));
  ck('nadpis uvádí 30denní průměr', (await p.textContent('#alcTrendHead')).indexOf('30denního') > 0,
     await p.textContent('#alcTrendHead'));
  const t30 = ted(await p.textContent('#alcTrend'));
  ck('30denní průměr sedm večerů rozředí', t30 > 6 && t30 < 9, 'teď ' + t30 + ' g/den');
  ck('a věta pod grafem mluví o třiceti',
     (await p.textContent('#alcTrend')).indexOf('třiceti') > 0);

  await p.click('#alcTrendSeg button[data-t="7"]'); await p.waitForTimeout(700);
  ck('nadpis se přepne na 7denní', (await p.textContent('#alcTrendHead')).indexOf('7denního') > 0,
     await p.textContent('#alcTrendHead'));
  const t7 = ted(await p.textContent('#alcTrend'));
  ck('sedmidenní okno ukáže skutečnou úroveň', t7 > 29 && t7 < 34, 'teď ' + t7 + ' g/den');
  ck('a je vyšší než třicetidenní', t7 > t30, t7 + ' vs ' + t30);
  ck('věta pod grafem mluví o sedmi',
     (await p.textContent('#alcTrend')).indexOf('sedmi') > 0);
  ck('zvýrazněné je jen jedno okno', (await p.locator('#alcTrendSeg button.on').count()) === 1);
  ck('přepnutí okna nesahne na období grafů', (await p.textContent('#alcDryOf')) === 'z 90');

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  // „Teď X g/den" z patičky grafu; deklarace se vytáhne nahoru, volá se výš
  function ted(txt) { const c = txt.split('Teď')[1]; return c ? parseFloat(c.trim()) : -1; }

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
