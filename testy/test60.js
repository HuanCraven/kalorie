/* Test v60 — zástupné productId nesmí přebíjet záznamy.
   Záznamy, které nevznikly z potraviny v databázi, nesou stejné zástupné
   productId ('popis', 'quick', 'foto', 'recept', 'alk'). Když se pod takové id
   uložila potravina, začala všechny takové záznamy přepisovat sebou: uživateli
   se při změně chodu proměnil kuřecí plátek na minerální vodu. */
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

  /* ---- 1. přesný případ od uživatele ------------------------------- */
  await p.evaluate(async () => {
    const mk = (n, meal, mn, kcal) => ({ date: curDate, productId: 'popis', name: n, unit: 'g',
      meal, amount: mn, kcal, p: 1, c: 1, f: 1, ts: Date.now() });
    await dbPut('log', mk('Kuřecí plátek', 'odpsvac', 120, 200));
    await dbPut('log', mk('Minerální voda', 'obed', 300, 0));
    await renderDay();
  });

  // uživatel u minerálky použije „Upravit potravinu" a uloží ji do databáze
  await p.evaluate(async () => { const r = (await dbAll('log')).find(x => x.name === 'Minerální voda'); await editLog(r.id); });
  await p.waitForTimeout(250);
  await p.evaluate(() => editCurrent());
  await p.waitForTimeout(250);
  ck('formulář se předvyplní z upravovaného záznamu',
     (await p.inputValue('#edName')) === 'Minerální voda', await p.inputValue('#edName'));
  await p.evaluate(() => saveProduct());
  await p.waitForTimeout(400);
  await p.evaluate(() => closeMod('modPortion'));

  const ulozene = await p.evaluate(async () => (await dbAll('products')).map(x => x.id));
  ck('nová potravina nedostala zástupné id', ulozene.every(id =>
     ['quick', 'popis', 'foto', 'recept', 'alk'].indexOf(id) < 0), ulozene.join(', '));

  // a teď u druhého záznamu změní jen chod
  await p.evaluate(async () => { const r = (await dbAll('log')).find(x => x.name === 'Kuřecí plátek'); await editLog(r.id); });
  await p.waitForTimeout(250);
  ck('editace ukazuje ten správný záznam',
     (await p.textContent('#poName')) === 'Kuřecí plátek', await p.textContent('#poName'));
  await p.selectOption('#poMeal', 'obed');
  await p.evaluate(() => addPortion());
  await p.waitForTimeout(500);

  const po = await p.evaluate(async () => (await dbAll('log'))
    .map(r => ({ name: r.name, meal: r.meal, kcal: Math.round(r.kcal) })));
  const kure = po.find(r => r.name === 'Kuřecí plátek');
  ck('kuřecí plátek zůstal kuřecím plátkem', !!kure, JSON.stringify(po));
  ck('a přesunul se do oběda i s kaloriemi', kure && kure.meal === 'obed' && kure.kcal === 200,
     JSON.stringify(kure));
  ck('minerálka se nezdvojila', po.filter(r => r.name === 'Minerální voda').length === 1,
     JSON.stringify(po));

  /* ---- 2. oprava databáze, která už je poškozená ------------------- */
  await p.evaluate(async () => {
    await dbPut('products', { id: 'popis', name: 'Podvržená potravina', unit: 'g',
      kcal: 999, p: 0, c: 0, f: 0 });
  });
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db && Array.isArray(products), null, { timeout: 15000 });
  await p.waitForTimeout(600);
  const poOprave = await p.evaluate(async () => (await dbAll('products'))
    .map(x => ({ id: x.id, name: x.name })));
  ck('potravina se zástupným id se při startu přeznačí',
     poOprave.every(x => x.id !== 'popis'), JSON.stringify(poOprave));
  ck('ale nezmizí — jen dostane vlastní id',
     poOprave.some(x => x.name === 'Podvržená potravina'), JSON.stringify(poOprave));
  // U potravin slouží jako klíč pro synchronizaci jejich `id` (uidOf), ne zvláštní uid.
  // Nové id proto nesmí mít náhrobek, jinak by sloučení potravinu zase smazalo.
  ck('a její nové id není mezi náhrobky (jinak by ji sloučení zase smazalo)',
     await p.evaluate(async () => {
       const p2 = (await dbAll('products')).find(x => x.name === 'Podvržená potravina');
       const nahrobky = await dbAll('tomb');
       return !!p2 && !nahrobky.some(t => t.store === 'products' && t.uid === p2.id);
     }));

  /* ---- 3. po opravě už záznamy nikdo nepřebíjí --------------------- */
  await p.evaluate(async () => { const r = (await dbAll('log')).find(x => x.name === 'Kuřecí plátek'); await editLog(r.id); });
  await p.waitForTimeout(250);
  ck('editace po opravě ukazuje pořád ten správný záznam',
     (await p.textContent('#poName')) === 'Kuřecí plátek', await p.textContent('#poName'));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 4. platí i pro rychlý zápis -------------------------------- */
  await p.evaluate(async () => {
    await dbPut('products', { id: 'quick', name: 'Cizí potravina', unit: 'porce', kcal: 500, p: 0, c: 0, f: 0 });
    products = await dbAll('products');
    await dbPut('log', { date: curDate, productId: 'quick', name: 'Oběd v restauraci',
      unit: 'porce', amount: 1, meal: 'obed', kcal: 700, p: 30, c: 60, f: 25, ts: Date.now() });
  });
  await p.evaluate(async () => { const r = (await dbAll('log')).find(x => x.name === 'Oběd v restauraci'); await editLog(r.id); });
  await p.waitForTimeout(250);
  ck('ani rychlý zápis se nepřepíše cizí potravinou',
     (await p.textContent('#poName')) === 'Oběd v restauraci', await p.textContent('#poName'));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
