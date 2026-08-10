/* Test v62 — externí databáze s čárovými kódy.
   Import umí nově číst sloupec s kódem a značkou; skenování se pak nejdřív
   podívá do databáze v telefonu a teprve potom na internet. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

const CSV_S_KODY = ['kod;nazev;znacka;kcal;bilkoviny;sacharidy;tuky;vlaknina;sul',
  '8594001170012;Selský jogurt bílý;HOLLANDIA;67;3.9;4.4;3.7;0;0.1',
  '4014400400007;Toffifee 15er;Storck;521;6;58.9;29;16;0.27',
  '8584004030000;Mila oplatka;Sedita;547;8;47;36;3;0.2'].join('\n');

// starý tvar bez kódů (NutriDatabáze) musí fungovat dál
const CSV_BEZ_KODU = ['origFdNm;ENERC [kcal];PROT [g];CHO [g];FAT [g];FIBT [g];NACL [g]',
  'Mrkev syrová;41;0.9;9.6;0.2;2.8;0.07',
  'Brambory vařené;87;2;20;0.1;1.8;0.01'].join('\n');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  // internet je zakázaný — celý test musí projít z databáze v telefonu
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  /* ---- 1. import databáze s kódy ----------------------------------- */
  await p.evaluate(t => parseExt(t), CSV_S_KODY);
  await p.waitForTimeout(800);
  const po = await p.evaluate(async () => {
    const e = await dbAll('ext');
    return { pocet: e.length, sKodem: e.filter(x => x.k).length, prvni: e.find(x => x.k === '8594001170012') };
  });
  ck('naimportují se všechny řádky', po.pocet === 3, 'položek: ' + po.pocet);
  ck('u všech se uloží čárový kód', po.sKodem === 3, 's kódem: ' + po.sKodem);
  ck('id vychází z kódu, ne z názvu', po.prvni && po.prvni.id === 'x-8594001170012',
     po.prvni && po.prvni.id);
  ck('přebere se i značka', po.prvni && po.prvni.z === 'HOLLANDIA', po.prvni && po.prvni.z);

  /* ---- 2. skenování najde v telefonu, bez internetu ---------------- */
  await p.evaluate(k => lookup(k), '4014400400007');
  await p.waitForTimeout(700);
  ck('naskenovaný kód otevře okno porce', await p.isVisible('#modPortion'));
  ck('a je to ten správný produkt', (await p.textContent('#poName')) === 'Toffifee 15er',
     await p.textContent('#poName'));
  ck('hodnoty sedí', (await p.textContent('#poSub')).indexOf('521 kcal') > 0,
     await p.textContent('#poSub'));

  ck('nalezené se uloží mezi moje potraviny (kvůli gramáži a četnosti)',
     (await p.evaluate(async () => (await dbAll('products')).length)) === 1);
  await p.evaluate(() => closeMod('modPortion'));

  // podruhé se najde rovnou mezi mými potravinami
  await p.evaluate(k => lookup(k), '4014400400007');
  await p.waitForTimeout(500);
  ck('opakované naskenování nezdvojí potravinu',
     (await p.evaluate(async () => (await dbAll('products')).length)) === 1);
  await p.evaluate(() => closeMod('modPortion'));

  /* ---- 3. neznámý kód bez internetu selže srozumitelně ------------- */
  await p.evaluate(k => lookup(k), '1111111111116');
  await p.waitForTimeout(900);
  const hlaska = await p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  ck('neznámý kód nabídne ruční zadání', await p.isVisible('#modEdit'), 'hláška: ' + hlaska);
  ck('a předvyplní naskenovaný kód',
     (await p.inputValue('#edCode')) === '1111111111116', await p.inputValue('#edCode'));
  await p.evaluate(() => closeMod('modEdit'));

  /* ---- 4. databáze bez kódů funguje dál ---------------------------- */
  await p.evaluate(t => parseExt(t), CSV_BEZ_KODU);
  await p.waitForTimeout(800);
  // import je od v63 přírůstkový, proto se díváme jen na řádky té jedné databáze
  const bez = await p.evaluate(async () => {
    const vse = await dbAll('ext');
    const e = vse.filter(x => (x.zd || '') .indexOf('nutri') === 0);
    return { pocet: e.length, sKodem: e.filter(x => x.k).length, prvni: e[0], vsech: vse.length };
  });
  ck('starý tvar bez kódů se naimportuje', bez.pocet === 2, 'položek: ' + bez.pocet + ' z ' + bez.vsech);
  ck('a nikomu se kód nevymyslí', bez.sKodem === 0, 's kódem: ' + bez.sKodem);
  ck('id se tam pořád tvoří z názvu', bez.prvni && bez.prvni.id.indexOf('x-') === 0 &&
     !/^x-\d+$/.test(bez.prvni.id), bez.prvni && bez.prvni.id);
  ck('a pozná se jako NutriDatabáze',
     bez.prvni && bez.prvni.z.indexOf('NutriDatab') >= 0, bez.prvni && bez.prvni.z);

  /* ---- 5. hledání podle názvu funguje u obojího -------------------- */
  const nalez = await p.evaluate(() => extMatches('mrkev').map(x => x.name));
  ck('externí databáze se dá prohledat i názvem', nalez.indexOf('Mrkev syrová') >= 0, JSON.stringify(nalez));

  /* ---- 6. obě databáze naráz -------------------------------------- */
  // v kroku 4 se načetla NutriDatabáze; teď k ní přidáme tu s kódy
  await p.evaluate(t => parseExt(t), CSV_S_KODY);
  await p.waitForTimeout(900);
  const obe = await p.evaluate(async () => {
    const e = await dbAll('ext'), m = {};
    for (const x of e) m[x.zd || '(bez)'] = (m[x.zd || '(bez)'] || 0) + 1;
    return { celkem: e.length, podle: m, info: document.getElementById('extInfo').textContent };
  });
  ck('vedle sebe žijí obě databáze', obe.celkem === 5, JSON.stringify(obe.podle));
  ck('a je vidět, které to jsou', obe.info.indexOf('NutriDatabáze') >= 0 &&
     obe.info.indexOf('Databáze s kódy') >= 0, obe.info.slice(0, 90));

  ck('hledání sahá do obou najednou', await p.evaluate(() =>
     extMatches('mrkev').length > 0 && extMatches('toffifee').length > 0));

  await p.evaluate(k => lookup(k), '8584004030000');
  await p.waitForTimeout(700);
  ck('skenování funguje i když je vedle NutriDatabáze',
     (await p.textContent('#poName')) === 'Mila oplatka', await p.textContent('#poName'));
  await p.evaluate(() => closeMod('modPortion'));

  // znovunačtení jedné databáze se nesmí dotknout druhé
  await p.evaluate(t => parseExt(t), CSV_BEZ_KODU);
  await p.waitForTimeout(900);
  const potom = await p.evaluate(async () => {
    const e = await dbAll('ext'), m = {};
    for (const x of e) m[x.zd || '(bez)'] = (m[x.zd || '(bez)'] || 0) + 1;
    return { celkem: e.length, podle: m };
  });
  ck('znovunačtení jedné nesmaže druhou', potom.celkem === 5, JSON.stringify(potom.podle));

  /* ---- 7. tatáž potravina ve dvou databázích se ukáže jednou -------- */
  await p.evaluate(t => parseExt(t), ['nazev;kcal;bilkoviny;sacharidy;tuky;zdroj',
    'Mrkev syrová;41;0.9;9.6;0.2;Jiná databáze'].join('\n'));
  await p.waitForTimeout(800);
  const dupl = await p.evaluate(() => extMatches('mrkev').map(x => x.name));
  ck('duplicita se v nabídce neopakuje',
     dupl.filter(x => x === 'Mrkev syrová').length === 1, JSON.stringify(dupl));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
