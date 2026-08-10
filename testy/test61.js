/* Test v61 — nová potravina z fotky obalu (panel Vyfotit).
   Tabulku výživových údajů Claude opíše, bez ní odhadne podle výrobku;
   podle pole "zdroj" se pozná, co nastalo. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

// platný 1×1 JPEG — shrinkPhoto kreslí fotku na plátno, takže neplatná data neprojdou
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
    claude.dotazu++;
    claude.zadani = r.request().postData() || '';
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: claude.odpoved }] }) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  const vyfot = async () => {
    await p.setInputFiles('#obalFile', { name: 'obal.jpg', mimeType: 'image/jpeg',
      buffer: Buffer.from(JPEG_1PX, 'base64') });
    await p.waitForTimeout(1200);
  };

  /* ---- 1. panel je dostupný vedle Hledat a Popsat ------------------ */
  await p.click('nav button[data-p="scan"]');
  const panely = await p.$$eval('#addSeg button', bs => bs.map(b => b.textContent.trim()));
  ck('Zadat má tři panely včetně Vyfotit', panely.join('|') === 'Hledat|Popsat|Vyfotit', panely.join('|'));
  await p.click('#addSeg button[data-s="lab"]');
  await p.waitForTimeout(200);
  ck('panel Vyfotit se otevře', await p.isVisible('#s-lab'));

  /* ---- 2. bez klíče se řekne, jak dál ------------------------------ */
  ck('bez klíče panel vysvětlí ruční cestu',
     (await p.textContent('#obalNote')).indexOf('Bez klíče') >= 0, await p.textContent('#obalNote'));

  await p.evaluate(async () => {
    await dbPut('meta', { k: 'api', v: { key: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' } });
    apiCfg = { key: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' };
    apiUi();
  });
  ck('s klíčem se slíbí předvyplnění',
     (await p.textContent('#obalNote')).indexOf('předvyplní') >= 0, await p.textContent('#obalNote'));

  /* ---- 3. odhad z obalu (bez tabulky) ------------------------------ */
  claude.odpoved = '{"nazev":"Birell Pomelo","znacka":"Radegast","jed":"ml","kcal":26,"b":0.3,' +
    '"s":5.6,"t":0,"vlaknina":0,"sul":0.01,"porce":500,"abv":0,"zdroj":"odhad"}';
  await vyfot();

  ck('fotka se poslala Claudeovi', claude.dotazu === 1, 'dotazů: ' + claude.dotazu);
  ck('zadání počítá i s odhadem bez tabulky',
     claude.zadani.indexOf('odhad') > 0 && claude.zadani.indexOf('zdroj') > 0);
  const f = await p.evaluate(() => ({
    otevreno: document.getElementById('modEdit').classList.contains('on'),
    nazev: document.getElementById('edName').value,
    znacka: document.getElementById('edBrand').value,
    kcal: document.getElementById('edKcal').value,
    sac: document.getElementById('edC').value,
    jed: document.getElementById('edUnit').value,
    porce: document.getElementById('edServ').value,
    varovani: document.getElementById('edOdhad').style.display !== 'none'
  }));
  ck('otevře se formulář nové potraviny', f.otevreno);
  ck('název a značka se předvyplní', f.nazev === 'Birell Pomelo' && f.znacka === 'Radegast', JSON.stringify(f));
  ck('hodnoty se předvyplní', f.kcal === '26' && f.sac === '5.6', JSON.stringify(f));
  ck('u nápoje se přepne na ml', f.jed === 'ml', f.jed);
  ck('velikost porce se převezme', f.porce === '500', f.porce);
  ck('odhad je označený varováním', f.varovani);

  await p.evaluate(() => saveProduct());
  await p.waitForTimeout(400);
  const ulozeno = await p.evaluate(async () => (await dbAll('products')).map(x => ({ n: x.name, k: x.kcal, u: x.unit, id: x.id })));
  ck('potravina se uloží do databáze', ulozeno.length === 1 && ulozeno[0].n === 'Birell Pomelo', JSON.stringify(ulozeno));
  ck('a nedostane zástupné id', ulozeno[0] && ['popis', 'quick', 'foto', 'alk', 'recept'].indexOf(ulozeno[0].id) < 0, ulozeno[0] && ulozeno[0].id);
  ck('rovnou se nabídne zápis porce', await p.evaluate(() => document.getElementById('modPortion').classList.contains('on')));
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 4. opsaná tabulka se jako odhad neoznačuje ------------------- */
  claude.odpoved = '{"nazev":"Tvaroh měkký","znacka":"Pilos","jed":"g","kcal":75,"b":12,' +
    '"s":4,"t":0.5,"vlaknina":0,"sul":0.1,"porce":0,"abv":0,"zdroj":"etiketa"}';
  await p.evaluate(() => { go('scan'); setAdd('lab'); });
  await vyfot();
  ck('u opsané tabulky se varování neukáže',
     !(await p.evaluate(() => document.getElementById('edOdhad').style.display !== 'none')));
  ck('a hodnoty sedí', (await p.inputValue('#edName')) === 'Tvaroh měkký' &&
     (await p.inputValue('#edKcal')) === '75');
  await p.evaluate(() => closeMod('modEdit'));

  /* ---- 5. alkohol z obalu se dostane do pole abv -------------------- */
  claude.odpoved = '{"nazev":"Pivo 12","znacka":"Pilsner","jed":"ml","kcal":43,"b":0.5,' +
    '"s":3.8,"t":0,"vlaknina":0,"sul":0,"porce":500,"abv":5,"zdroj":"etiketa"}';
  await p.evaluate(() => { go('scan'); setAdd('lab'); });
  await vyfot();
  ck('procenta alkoholu se předvyplní', (await p.inputValue('#edAbv')) === '5', await p.inputValue('#edAbv'));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
