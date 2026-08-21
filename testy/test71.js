/* Test v100 — výběr více položek naráz, přesun mezi chody, kopie na jiný den,
   a volba chodu u jídla z rozboru. Dřív šlo jídlo jen přesouvat po jednom přes
   úpravu záznamu a kopie na jiný den nešla vůbec. */
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

  await p.evaluate(async () => {
    for (const [nm, m, k] of [['Kaše', 'snidane', 400], ['Jablko', 'snidane', 90],
      ['Kuře', 'obed', 330], ['Rýže', 'obed', 260]])
      await dbPut('log', { date: curDate, productId: 'quick', name: nm, unit: 'porce',
        amount: 1, meal: m, kcal: k, p: 10, c: 20, f: 5, ts: Date.now() });
    go('day'); return renderDay();
  });
  await p.waitForTimeout(700);

  /* ---- 1. zaškrtávátka jsou vidět rovnou -------------------------- */
  ck('každý řádek má zaškrtávátko', (await p.locator('#logList .vyb').count()) === 4,
     'nalezeno: ' + await p.locator('#logList .vyb').count());
  ck('lišta s akcemi je schovaná, dokud nic nevybereš',
     !(await p.isVisible('#vybrLista')));

  /* ---- 2. výběr ji vyvolá ----------------------------------------- */
  await p.click('#logList .vyb >> nth=0');
  await p.waitForTimeout(300);
  ck('po zaškrtnutí lišta naskočí', await p.isVisible('#vybrLista'));
  ck('a řekne, kolik je vybráno', (await p.textContent('#vybrPocet')).indexOf('1') === 0,
     await p.textContent('#vybrPocet'));
  await p.click('#logList .vyb >> nth=1');
  await p.waitForTimeout(300);
  ck('počet roste', (await p.textContent('#vybrPocet')).indexOf('2') === 0,
     await p.textContent('#vybrPocet'));

  /* ---- 3. přesun mezi chody --------------------------------------- */
  await p.selectOption('#vybrMeal', 'vecere');
  await p.click('text=Přesunout');
  await p.waitForTimeout(800);
  const poPresunu = await p.evaluate(async () => {
    const r = await dbByIdx('log', 'date', curDate);
    return r.map(x => x.name + ':' + x.meal).sort().join(' ');
  });
  ck('obě vybrané se přesunuly do večeře',
     poPresunu.indexOf('Kaše:vecere') >= 0 && poPresunu.indexOf('Jablko:vecere') >= 0, poPresunu);
  ck('ostatní zůstaly, kde byly', poPresunu.indexOf('Kuře:obed') >= 0, poPresunu);
  ck('a výběr se po akci zruší', !(await p.isVisible('#vybrLista')));

  /* ---- 4. kopie na jiný den ---------------------------------------- */
  const zitra = await p.evaluate(() => {
    const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() + 1); return dstr(x);
  });
  await p.click('#logList .vyb >> nth=0');
  await p.waitForTimeout(300);
  await p.fill('#vybrDatum', zitra);
  await p.click('text=Kopírovat');
  await p.waitForTimeout(800);
  const kopie = await p.evaluate(async d => ({
    dnes: (await dbByIdx('log', 'date', curDate)).length,
    cil: (await dbByIdx('log', 'date', d)).map(x => x.name)
  }), zitra);
  ck('kopie vznikla na cílovém dni', kopie.cil.length === 1, JSON.stringify(kopie));
  ck('a originál zůstal, kde byl', kopie.dnes === 4, JSON.stringify(kopie));
  ck('kopie má vlastní identitu, ne uid předlohy', await p.evaluate(async d => {
    const a = (await dbByIdx('log', 'date', d))[0];
    const b = (await dbByIdx('log', 'date', curDate)).find(x => x.name === a.name);
    return !!a.uid && a.uid !== b.uid && a.id !== b.id;
  }, zitra));

  /* ---- 5. chod u jídla z rozboru ----------------------------------- */
  await p.evaluate(() => { go('scan'); setAdd('photo'); aiItems = [
    { nazev: 'Těstoviny', mn: 200, jd: 'g', kcal: 150, b: 5, s: 30, t: 1 }];
    renderAI(); document.getElementById('aiCard').style.display = ''; });
  await p.waitForTimeout(500);
  ck('návrh nabízí výběr chodu', await p.isVisible('#aiMeal'));
  await p.selectOption('#aiMeal', 'obed');
  await p.click('text=Přidat po položkách');
  await p.waitForTimeout(800);
  const testo = await p.evaluate(async () =>
    (await dbByIdx('log', 'date', curDate)).find(r => r.name === 'Těstoviny'));
  ck('zapíše se do zvoleného chodu, ne podle hodin', testo && testo.meal === 'obed',
     JSON.stringify(testo));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
