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
  // v97: zakládání potraviny z obalu se přesunulo do Jídel — nezapisuje do dne
  ck('Zadat má jen cesty zápisu dne', panely.join('|') === 'Časté|Hledat|Popsat', panely.join('|'));
  const jidla = await p.$$eval('#dbSeg button', bs => bs.map(b => b.textContent.trim()));
  ck('a zakládání potraviny je v Jídlech', jidla.indexOf('Přidat') >= 0, jidla.join('|'));
  await p.click('nav button[data-p="db"]');
  await p.click('#dbSeg button[data-d="obal"]');
  await p.waitForTimeout(200);
  ck('panel Z obalu se otevře', await p.isVisible('#dbObal'));
  ck('a schová hledání v databázi, protože nejde o procházení',
     !(await p.isVisible('#dbHledatKarta')));

  /* ---- 2. bez klíče se řekne, jak dál ------------------------------ */
  ck('bez klíče panel řekne, co chybí',
     (await p.textContent('#obalNote')).indexOf('klíč ke Claude API') >= 0, await p.textContent('#obalNote'));

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
  await p.evaluate(() => { go('db'); setDbMode('obal'); });
  await vyfot();
  ck('u opsané tabulky se varování neukáže',
     !(await p.evaluate(() => document.getElementById('edOdhad').style.display !== 'none')));
  ck('a hodnoty sedí', (await p.inputValue('#edName')) === 'Tvaroh měkký' &&
     (await p.inputValue('#edKcal')) === '75');
  await p.evaluate(() => closeMod('modEdit'));

  /* ---- 5. nečitelná fotka nesmí nic vymyslet ----------------------- */
  // Uživatel vyfotil šunku a dostal čokoládu: zadání dřív dovolovalo hádat výrobek,
  // když tabulka nebyla čitelná. Teď se v takovém případě nevyplňuje nic.
  claude.odpoved = '{"nazev":"","znacka":"","jed":"g","kcal":0,"b":0,"s":0,"t":0,' +
    '"vlaknina":0,"sul":0,"porce":0,"abv":0,"zdroj":"necitelne"}';
  await p.evaluate(() => { go('db'); setDbMode('obal'); });
  await vyfot();
  const po = await p.evaluate(() => ({
    nazev: document.getElementById('edName').value,
    kcal: document.getElementById('edKcal').value,
    varovani: document.getElementById('edOdhad').style.display !== 'none',
    toast: (document.getElementById('toast') || {}).textContent || ''
  }));
  ck('u nečitelné fotky se nevyplní název', po.nazev === '', po.nazev);
  ck('ani hodnoty', po.kcal === '', po.kcal);
  ck('a řekne se, že to nejde přečíst', po.toast.indexOf('přečíst') >= 0, po.toast);
  ck('varování o odhadu se přitom neukáže', !po.varovani);
  await p.evaluate(() => closeMod('modEdit'));

  ck('zadání zakazuje domýšlet si výrobek',
     claude.zadani.indexOf('necitelne') > 0 && claude.zadani.indexOf('NIKDY') > 0);

  /* ---- 6. etiketa se posílá ve větším rozlišení --------------------- */
  // z 1024 px byl drobný tisk často nečitelný a model pak hádal, o co jde
  const poslano = JSON.parse(claude.zadani || '{}');
  const obrazek = (((poslano.messages || [])[0] || {}).content || [])
    .find(c => c.type === 'image');
  ck('do API se posílá obrázek', !!obrazek && !!(obrazek.source || {}).data);
  ck('a jde o JPEG v base64', obrazek && obrazek.source.media_type === 'image/jpeg',
     obrazek && obrazek.source.media_type);

  /* ---- 7. prohozené bílkoviny a tuky ------------------------------- */
  /* Česká tabulka má pořadí energie–tuky–sacharidy–bílkoviny, takže model
     opisující shora dolů prohazoval bílkoviny s tuky. Kontrola proti energii
     (Atwater 4/4/9) to pozná a vrátí zpátky. */
  const vyplnPres = async json => {
    await p.evaluate(() => openEdit(null));
    await p.evaluate(t => processLabel(t), json);
    await p.waitForTimeout(250);
    return p.evaluate(() => ({
      B: document.getElementById('edP').value, S: document.getElementById('edC').value,
      T: document.getElementById('edF').value,
      pozor: document.getElementById('edPozor').style.display !== 'none'
        ? document.getElementById('edPozor').textContent : ''
    }));
  };

  let v = await vyplnPres('{"nazev":"Šunka","kcal":100,"tuky":3,"sacharidy":1,"bilkoviny":18,"zdroj":"etiketa"}');
  ck('správná čísla projdou beze změny', v.B === '18' && v.T === '3' && !v.pozor, JSON.stringify(v));

  v = await vyplnPres('{"nazev":"Šunka","kcal":100,"tuky":18,"sacharidy":1,"bilkoviny":3,"zdroj":"etiketa"}');
  ck('prohozené bílkoviny a tuky se vrátí zpátky', v.B === '18' && v.T === '3', JSON.stringify(v));
  ck('a řekne se to', v.pozor.indexOf('prohozené') >= 0, v.pozor.slice(0, 60));

  v = await vyplnPres('{"nazev":"Hořká čokoláda","kcal":550,"tuky":35,"sacharidy":50,"bilkoviny":7,"zdroj":"etiketa"}');
  ck('vysoký tuk u čokolády se neopravuje', v.T === '35' && v.B === '7' && !v.pozor, JSON.stringify(v));

  v = await vyplnPres('{"nazev":"Pivo","kcal":43,"tuky":0,"sacharidy":3.8,"bilkoviny":0.5,"abv":5,"zdroj":"etiketa"}');
  ck('u alkoholu se energie nekontroluje (etanol není ve vzorci)', !v.pozor, v.pozor.slice(0, 60));

  v = await vyplnPres('{"nazev":"Nesmysl","kcal":500,"tuky":1,"sacharidy":1,"bilkoviny":1,"zdroj":"etiketa"}');
  ck('nesmyslná čísla se ohlásí, i když prohození nepomůže',
     v.pozor.indexOf('nesedí') >= 0, v.pozor.slice(0, 60));

  v = await vyplnPres('{"nazev":"Tvaroh","kcal":75,"b":12,"s":4,"t":0.5,"zdroj":"etiketa"}');
  ck('starý tvar klíčů b/s/t se pořád přijme', v.B === '12' && v.S === '4', JSON.stringify(v));
  await p.evaluate(() => closeMod('modEdit'));

  ck('zadání pro Claude používá plné názvy živin',
     claude.zadani.indexOf('bilkoviny') > 0 && claude.zadani.indexOf('tuky') > 0);

  /* ---- 8. alkohol z obalu se dostane do pole abv -------------------- */
  claude.odpoved = '{"nazev":"Pivo 12","znacka":"Pilsner","jed":"ml","kcal":43,"b":0.5,' +
    '"s":3.8,"t":0,"vlaknina":0,"sul":0,"porce":500,"abv":5,"zdroj":"etiketa"}';
  await p.evaluate(() => { go('db'); setDbMode('obal'); });
  await vyfot();
  ck('procenta alkoholu se předvyplní', (await p.inputValue('#edAbv')) === '5', await p.inputValue('#edAbv'));

  /* ---- popis jako třetí opora (v98) --------------------------------
     Dřív byl žebřík dvoustupňový: čitelná tabulka, nebo název na obalu. Když
     nebylo ani jedno, aplikace to vzdala — i když uživatel věděl, co to je. */
  ck('zadání ví, že fotka nemusí být',
     claude.zadani.indexOf('Fotka nemusí být vůbec') > 0);
  ck('a že popis má přednost před domýšlením z obrázku',
     claude.zadani.indexOf('Popis má přednost') > 0);

  await p.evaluate(() => { go('db'); setDbMode('obal'); openEdit(null); });
  await p.waitForTimeout(400);
  ck('formulář má pole na popis', await p.isVisible('#edPopis'));
  ck('bez fotky i popisu se nic nenabízí', !(await p.isVisible('#apiLabBtn')));

  await p.fill('#edPopis', 'tvaroh polotučný Pilos');
  await p.waitForTimeout(300);
  ck('se samotným popisem se nabídne odhad',
     (await p.textContent('#apiLabBtn')).indexOf('Odhadnout z popisu') >= 0,
     await p.textContent('#apiLabBtn'));

  claude.odpoved = JSON.stringify({ nazev: 'Tvaroh polotučný', znacka: 'Pilos', jed: 'g',
    kcal: 130, tuky: 4.5, sacharidy: 3.5, bilkoviny: 18, vlaknina: 0, sul: 0.1,
    porce: 250, abv: 0, zdroj: 'popis' });
  await p.click('#apiLabBtn');
  await p.waitForTimeout(1200);
  ck('popis se pošle Claudeovi',
     claude.zadani.indexOf('tvaroh polotučný Pilos') > 0);
  ck('a formulář se vyplní', (await p.inputValue('#edKcal')) === '130',
     await p.inputValue('#edKcal'));
  ck('u odhadu z popisu se to řekne',
     (await p.textContent('#edOdhad')).indexOf('podle tvého popisu') > 0,
     await p.textContent('#edOdhad'));

  /* ---- cesty k nové potravině (v99) --------------------------------
     Uživatel našel tři díry: fotka šla jen z fotoaparátu, popisek mluvil jen
     o tabulce, a do formuláře se nedalo dostat bez fotky. */
  await p.evaluate(() => { closeMod('modEdit'); go('db'); setDbMode('obal'); });
  await p.waitForTimeout(400);
  ck('fotka jde i z galerie', await p.evaluate(() => !!document.getElementById('obalGal')));
  ck('popisek mluví i o samotné potravině',
     (await p.textContent('#dbObal')).indexOf('samotné potraviny') > 0);
  ck('a nabízí vyplnit sám, bez fotky',
     (await p.textContent('#dbObal')).indexOf('Vyplnit sám') > 0);

  await p.click('#dbObal >> text=Vyplnit sám, bez fotky');
  await p.waitForTimeout(400);
  ck('otevře prázdný formulář nové potraviny',
     (await p.textContent('#edTitle')) === 'Nová potravina' && (await p.inputValue('#edName')) === '');
  await p.evaluate(() => closeMod('modEdit'));
  await p.waitForTimeout(400);

  // a totéž u čtení kódu, ať se nemusí napřed neúspěšně skenovat
  await p.evaluate(() => { go('scan'); setAdd('code'); });
  await p.waitForTimeout(400);
  await p.fill('#manualCode', '8594001020304');
  await p.click('#s-code >> text=Není v databázi? Zadat rovnou');
  await p.waitForTimeout(400);
  ck('od kódu se dá jít rovnou do formuláře',
     (await p.textContent('#edTitle')) === 'Nová potravina');
  ck('a napsaný kód se přenese', (await p.inputValue('#edCode')) === '8594001020304',
     await p.inputValue('#edCode'));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
