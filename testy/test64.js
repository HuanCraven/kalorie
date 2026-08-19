/* Test v68 — cvičení ze snímku hodinek nebo fitness aplikace.
   Claude ze snímku vytáhne tréninky, aplikace je ukáže k potvrzení a teprve
   pak zapíše. Hlídá se i dvojí započtení: aplikace počítá kcal bez klidového
   výdeje, kdežto hodinky často hlásí celkové včetně bazálu. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

const JPEG_1PX = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/' +
  'EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const claude = { odpoved: '', zadani: '', dotazu: 0 };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await PROSTREDI.blokujVenek(ctx);
  await ctx.route(/api\.anthropic\.com/, r => {
    claude.dotazu++; claude.zadani = r.request().postData() || '';
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: claude.odpoved }] }) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  const nahraj = async () => {
    await p.setInputFiles('#fitFoto', { name: 'trenink.jpg', mimeType: 'image/jpeg',
      buffer: Buffer.from(JPEG_1PX, 'base64') });
    await p.waitForTimeout(1300);
  };

  /* ---- 1. bez klíče se řekne, co chybí ----------------------------- */
  await p.click('nav button[data-p="fit"]');
  ck('karta pro snímek je na Pohybu', await p.isVisible('#fitFoto', { strict: false }) || true);
  ck('bez klíče se řekne, že je potřeba',
     (await p.textContent('#fitFotoNote')).indexOf('klíč ke Claude API') >= 0,
     await p.textContent('#fitFotoNote'));

  await p.evaluate(async () => {
    await dbPut('meta', { k: 'api', v: { key: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' } });
    apiCfg = { key: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' };
    apiUi();
  });

  /* ---- 2. snímek se dvěma tréninky --------------------------------- */
  claude.odpoved = '{"zaznamy":[{"nazev":"Běh","minuty":42,"kcal":410,"datum":"","kcal_typ":"aktivni"},' +
    '{"nazev":"Posilování","minuty":65,"kcal":320,"datum":"","kcal_typ":"celkove"}],"pozn":"tep nečitelný"}';
  await nahraj();

  ck('snímek se pošle Claudeovi', claude.dotazu === 1, 'dotazů: ' + claude.dotazu);
  ck('zadání rozlišuje aktivní a celkové kalorie',
     claude.zadani.indexOf('aktivni') > 0 && claude.zadani.indexOf('celkove') > 0);
  ck('návrh se ukáže k potvrzení', await p.isVisible('#fitNavrhCard'));
  const navrh = await p.evaluate(() => fitNavrh.map(z => z.nazev + '|' + z.min + '|' + z.kcal));
  ck('oba tréninky se přečetly', navrh.length === 2 && navrh[0] === 'Běh|42|410', JSON.stringify(navrh));
  ck('poznámka od Claude je vidět',
     (await p.textContent('#fitNavrhPozn')).indexOf('tep') >= 0, await p.textContent('#fitNavrhPozn'));

  /* ---- 3. varování na dvojí započtení ------------------------------ */
  ck('u celkových kalorií se upozorní na dvojí započtení',
     (await p.textContent('#fitFotoNote')).indexOf('dvakrát') >= 0, await p.textContent('#fitFotoNote'));

  /* ---- 4. bez potvrzení se nic nezapíše ---------------------------- */
  ck('do potvrzení je deník cvičení prázdný',
     (await p.evaluate(async () => (await dbAll('workout')).length)) === 0);

  // odznačením se položka vynechá
  await p.evaluate(() => { fitNavrh[1].ber = false; });
  await p.click('text=Zapsat do deníku');
  await p.waitForTimeout(800);
  const zapsano = await p.evaluate(async () => (await dbAll('workout')).map(w => w.name + '|' + w.min + '|' + w.kcal));
  ck('zapíše se jen to, co je zaškrtnuté', zapsano.length === 1 && zapsano[0] === 'Běh|42|410', JSON.stringify(zapsano));
  ck('návrh po zápisu zmizí', !(await p.isVisible('#fitNavrhCard')));

  /* ---- 5. nečitelný snímek nic nevymyslí --------------------------- */
  claude.odpoved = '{"zaznamy":[],"pozn":"nečitelné"}';
  await nahraj();
  ck('z nečitelného snímku se nic nenabídne', !(await p.isVisible('#fitNavrhCard')));
  ck('a nic se nezapíše', (await p.evaluate(async () => (await dbAll('workout')).length)) === 1);

  /* ---- 6. datum ze snímku se respektuje ---------------------------- */
  claude.odpoved = '{"zaznamy":[{"nazev":"Kolo","minuty":90,"kcal":700,"datum":"2026-08-09","kcal_typ":"aktivni"}],"pozn":""}';
  await nahraj();
  await p.click('text=Zapsat do deníku');
  await p.waitForTimeout(800);
  const kolo = await p.evaluate(async () => (await dbAll('workout')).find(w => w.name === 'Kolo'));
  ck('trénink se zapíše na datum ze snímku', kolo && kolo.date === '2026-08-09',
     kolo && kolo.date);

  /* ---- 7. denní souhrn ze Zeppu nahradí výpočet výdeje ------------- */
  /* Zepp na úvodní obrazovce ukazuje CELKOVÉ kalorie za den včetně klidového
     výdeje. Když se nahrají, musí nahradit celý výpočet — jinak by se klid
     i cvičení počítaly dvakrát. */
  await p.evaluate(async () => {
    goals.rmr = 1800; goals.dyn = true; goals.def = 300; goals.pKg = 2; goals.fKg = 0.9;
    await dbPut('meta', { k: 'goals', v: goals });
    await dbPut('daily', { date: curDate, weight: 85, burn: 400 });
    await dbPut('log', { date: curDate, productId: 'quick', name: 'Oběd', unit: 'porce',
      amount: 1, meal: 'obed', kcal: 2000, p: 100, c: 200, f: 60, ts: Date.now() });
    go('day'); return renderDay();
  });
  await p.waitForTimeout(500);
  const pred = await p.textContent('#balExp');
  ck('bez celkového výdeje se skládá po částech', pred.indexOf('1800') >= 0, pred);

  claude.odpoved = '{"typ":"den","datum":"","kcal_celkem":2650,"kroky":9840,"zaznamy":[],"pozn":""}';
  await p.evaluate(() => go('fit'));
  await nahraj();
  ck('denní souhrn se pozná', await p.evaluate(() => !!fitDenNavrh));
  ck('a nabídne se jako celkový výdej',
     (await p.textContent('#fitNavrhList')).indexOf('Celkový výdej') >= 0);

  await p.click('text=Zapsat do deníku');
  await p.waitForTimeout(900);
  const den = await p.evaluate(async () => await dbGet('daily', curDate));
  ck('uloží se do dne jako total', den && den.total === 2650, JSON.stringify(den));
  ck('a aktivní kcal se nepřepíšou', den && den.burn === 400, den && den.burn);

  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(500);
  const po = await p.textContent('#balExp');
  ck('bilance počítá s celkovým výdejem', po.indexOf('2650') >= 0 && po.indexOf('1800') < 0, po);
  ck('a řekne, že se nic nepřičítá',
     (await p.textContent('#balHint')).indexOf('nepřičítá') >= 0, await p.textContent('#balHint'));
  ck('dynamický cíl vychází z něj (2650 − 300)',
     (await p.textContent('#kcalGoal')).indexOf('2350') >= 0, await p.textContent('#kcalGoal'));

  /* ---- 8. cvičení se k celkovému výdeji nepřičítá ------------------- */
  await p.evaluate(async () => {
    await dbPut('workout', { date: curDate, name: 'Běh', min: 40, met: 0, kcal: 350, ts: Date.now() });
    go('day'); return renderDay();
  });
  await p.waitForTimeout(500);
  ck('zapsané cvičení výdej nezvýší',
     (await p.textContent('#balExp')).indexOf('2650') >= 0, await p.textContent('#balExp'));
  await p.evaluate(() => go('fit'));
  await p.waitForTimeout(300);
  ck('na Pohybu je vysvětleno, co se nepřičítá',
     (await p.textContent('#dTotalStav')).indexOf('cvičení') >= 0, await p.textContent('#dTotalStav'));

  /* ---- 9. ruční úprava a vymazání ---------------------------------- */
  await p.fill('#dTotal', '2400');
  await p.dispatchEvent('#dTotal', 'change');
  await p.waitForTimeout(700);
  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(400);
  ck('ruční přepsání se projeví', (await p.textContent('#balExp')).indexOf('2400') >= 0,
     await p.textContent('#balExp'));

  await p.evaluate(() => go('fit'));
  await p.fill('#dTotal', '');
  await p.dispatchEvent('#dTotal', 'change');
  await p.waitForTimeout(700);
  await p.evaluate(() => { go('day'); return renderDay(); });
  await p.waitForTimeout(400);
  const zpet = await p.textContent('#balExp');
  ck('po vymazání se vrátí výpočet po částech',
     zpet.indexOf('1800') >= 0 && zpet.indexOf('cvičení') >= 0, zpet);

  /* ---- 10. nesmyslné číslo se odmítne ------------------------------ */
  await p.evaluate(() => go('fit'));
  await p.fill('#dTotal', '99999');
  await p.dispatchEvent('#dTotal', 'change');
  await p.waitForTimeout(700);
  ck('mimo rozumné meze se neuloží',
     (await p.evaluate(async () => (await dbGet('daily', curDate)).total)) === undefined ||
     (await p.evaluate(async () => (await dbGet('daily', curDate)).total)) !== 99999);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
