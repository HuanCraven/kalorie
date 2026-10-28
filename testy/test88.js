/* Test v124 — uložit zapsané jídlo do Jídel.

   Jídlo z popisu nebo fotky šlo uložit jen při rozboru. Teď i dodatečně z deníku:
   jeden zápis z nabídky dlouhým stiskem, víc vybraných (jídlo po položkách) jako
   jedno jídlo. Hodnoty na 100 g ze součtu, porce = snědené gramy, žádné duplikáty. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  const dnes = PROSTREDI.den(0);
  const ids = await p.evaluate(async d => {
    const a = await dbPut('log', { date: d, productId: 'foto', name: 'Dýňová polévka', unit: 'g', meal: 'obed',
      amount: 400, kcal: 320, p: 8, c: 36, f: 16, ts: 1 });
    const b = await dbPut('log', { date: d, productId: 'popis', name: 'Kuskus vařený', unit: 'g', meal: 'vecere',
      amount: 150, kcal: 168, p: 5.7, c: 34.5, f: 0.3, ts: 2 });
    const c = await dbPut('log', { date: d, productId: 'popis', name: 'Zelenina restovaná', unit: 'g', meal: 'vecere',
      amount: 100, kcal: 82, p: 2.3, c: 8.5, f: 4.7, ts: 3 });
    await dbPut('log', { date: d, productId: 'alk', name: 'Pivo', unit: 'ml', meal: 'vecer',
      amount: 500, kcal: 210, p: 0, c: 18, f: 0, alc: 19.7, ts: 4 });
    await obDismiss(); curDate = d; await renderDay();
    return [a, b, c];
  }, dnes);
  await p.waitForTimeout(300);
  const nab = async nazev => {
    await p.locator('#logList .item[data-del]', { hasText: nazev }).locator('.grow').dispatchEvent('contextmenu');
    await p.waitForTimeout(300);
  };

  /* ---- 1. jeden zápis z nabídky -------------------------------------- */
  await nab('Pivo');
  ck('u nápoje se Uložit do Jídel nenabízí', !(await p.isVisible('#akUlozit')));
  await p.evaluate(() => closeMod('modAkce'));
  await nab('Dýňová polévka');
  ck('u zápisu z fotky/popisu se nabízí', await p.isVisible('#akUlozit'));
  await p.click('#akUlozit');
  await p.waitForTimeout(500);
  const pol = await p.evaluate(() => products.find(x => x.name === 'Dýňová polévka'));
  ck('uloží se jako hotové jídlo', pol && pol.source === 'recipe' && await p.evaluate(x => druhPotraviny(x) === 'jidlo', pol), JSON.stringify(pol));
  ck('hodnoty na 100 g a porce = snědeno', pol && pol.kcal === 80 && pol.p === 2 && pol.c === 9 && pol.f === 4 &&
    pol.serving === 400, JSON.stringify(pol));
  ck('zápis v deníku se na něj napojí', await p.evaluate(([id, pid]) => dbGet('log', id).then(r => r.productId === pid),
    [ids[0], pol && pol.id]));
  ck('najde se v hledání', await p.evaluate(() => dbHledej('dýňová').some(x => x.name === 'Dýňová polévka')));
  ck('a zítra se zapíše v uložené porci', await p.evaluate(id => { openPortion(id);
    return document.getElementById('poAmt').value === '400'; }, pol && pol.id));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 2. duplicita -------------------------------------------------- */
  await p.evaluate(async d => {
    await dbPut('log', { date: d, productId: 'foto', name: 'Dýňová polévka', unit: 'g', meal: 'vecere',
      amount: 300, kcal: 240, p: 6, c: 27, f: 12, ts: 5 });
    await renderDay();
  }, dnes);
  await p.waitForTimeout(300);
  await p.locator('#logList .item[data-del]', { hasText: 'Dýňová polévka' }).last().locator('.grow').dispatchEvent('contextmenu');
  await p.waitForTimeout(300);
  await p.click('#akUlozit');
  await p.waitForTimeout(500);
  ck('stejný název se neuloží podruhé', await p.evaluate(() =>
    products.filter(x => x.name === 'Dýňová polévka').length === 1));
  ck('místo toho ukáže existující', await p.isVisible('#modPotr'));
  await p.evaluate(() => closeMod('modPotr'));

  /* ---- 3. víc položek jako jedno jídlo ------------------------------- */
  await p.evaluate(([b, c]) => { vybrPrepni(b); vybrPrepni(c); }, [ids[1], ids[2]]);
  await p.waitForTimeout(200);
  ck('lišta výběru má pole pro název', await p.isVisible('#vybrNazev'));
  await p.click('#vybrLista button:has-text("Uložit jako jídlo")');
  await p.waitForTimeout(300);
  ck('bez názvu se nic neuloží', await p.evaluate(() => !products.some(x => x.source === 'recipe' && x.ing)));
  await p.fill('#vybrNazev', 'Kuskus se zeleninou');
  await p.click('#vybrLista button:has-text("Uložit jako jídlo")');
  await p.waitForTimeout(500);
  const ku = await p.evaluate(() => products.find(x => x.name === 'Kuskus se zeleninou'));
  ck('součet dvou položek jako jedno jídlo', ku && ku.serving === 250 && ku.kcal === 100 && ku.p === 3.2,
    JSON.stringify(ku));
  ck('se surovinami', ku && Array.isArray(ku.ing) && ku.ing.length === 2 && ku.ing[0].nazev === 'Kuskus vařený');
  ck('položky v deníku zůstanou, jak byly', await p.evaluate(([b, c]) =>
    Promise.all([dbGet('log', b), dbGet('log', c)]).then(r => r.every(x => x.productId === 'popis')), [ids[1], ids[2]]));
  ck('výběr se po uložení zruší', await p.evaluate(() => vybrane.size === 0));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
