/* Test v107 — katalog jídel ve vlastním souboru a záloha přes sdílecí nabídku.

   Veřejná verze je zamrzlá, katalog se ale zlepšovat má. Leží proto v
   `katalog.json` vedle aplikace. Tři stupně, aby to nešlo rozbít: soubor ze
   sítě → poslední uložený → vestavěné zaklad.js a jidla.js. Zkouší se všechny
   tři, protože prostřední se projeví jen offline a poslední jen na čisté
   aplikaci bez sítě — v provozu by si toho nikdo nevšiml, dokud by nepřestal
   fungovat vyhledávač jídel.

   Záloha: stažený soubor skončí ve Stažených, odkud si ho nikdo nepřenese na
   nový telefon. Sdílecí nabídka ho dostane na Disk. Kde ji prohlížeč neumí,
   musí zbýt stažení — jinak by člověk přišel o jedinou cestu k záloze. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  /* Service worker se tu vypíná schválně. V provozu je nad katalogem ještě jeho
     cache: offline vrátí uložený soubor a k záložním stupňům v kódu by se vůbec
     nedošlo. Blokádou se testuje to, co drží, až i cache selže. */
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 },
                                         serviceWorkers: 'block' });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });

  /* ---- 1. soubor ze sítě ------------------------------------------- */
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForFunction(() => katalogStav !== 'vestavěný', null, { timeout: 10000 })
    .catch(() => {});
  const stav1 = await p.evaluate(() => katalogStav);
  ck('katalog se stáhne ze souboru', stav1.indexOf('stažený') === 0, stav1);
  const poc = await p.evaluate(() => ({ z: ZAKLAD.length, j: JIDLA.length }));
  ck('základní potraviny jsou v něm', poc.z > 200, String(poc.z));
  ck('hotová jídla taky', poc.j > 50, String(poc.j));
  ck('a uložil se pro příště',
     await p.evaluate(async () => { const m = await dbGet('meta', 'katalog'); return !!(m && m.v.zaklad.length); }));

  // katalog musí umět totéž co vestavěné soubory — hledání jde skrz něj
  const nalez = await p.evaluate(() => zakladMatches('cizrna').length);
  ck('vyhledávání v základních potravinách funguje', nalez > 0, String(nalez));

  /* ---- 2. offline: poslední uložený --------------------------------- */
  await ctx.route('**/katalog.json', r => r.abort());
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForFunction(() => katalogStav !== 'vestavěný', null, { timeout: 10000 })
    .catch(() => {});
  const stav2 = await p.evaluate(() => katalogStav);
  ck('bez sítě se vezme uložený', stav2.indexOf('uložený') === 0, stav2);
  const poc2 = await p.evaluate(() => ({ z: ZAKLAD.length, j: JIDLA.length }));
  ck('a potraviny v aplikaci zůstanou', poc2.z === poc.z && poc2.j === poc.j,
     JSON.stringify(poc2));

  /* ---- 3. ani soubor, ani uložený → vestavěné ----------------------- */
  await p.evaluate(async () => { await dbDel('meta', 'katalog'); });
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(900);
  const stav3 = await p.evaluate(() => katalogStav);
  ck('úplně bez všeho zbydou vestavěné soubory', stav3 === 'vestavěný', stav3);
  const poc3 = await p.evaluate(() => ({ z: ZAKLAD.length, j: JIDLA.length }));
  ck('a aplikace pořád má co nabídnout', poc3.z > 200 && poc3.j > 50, JSON.stringify(poc3));
  await ctx.unroute('**/katalog.json');

  /* ---- 4. poškozený soubor se nesmí vzít ---------------------------- */
  await ctx.route('**/katalog.json', r => r.fulfill({ status: 200, body: '{"verze":"x","zaklad":[],"jidla":[]}' }));
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(900);
  ck('prázdný katalog se zahodí', await p.evaluate(() => ZAKLAD.length) > 200,
     String(await p.evaluate(() => ZAKLAD.length)));
  await ctx.unroute('**/katalog.json');

  /* ---- 5. záloha přes sdílecí nabídku ------------------------------- */
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.evaluate(async () => {
    await dbPut('log', { date: curDate, productId: 'x', name: 'Rýže', unit: 'g', amount: 100,
      meal: 'obed', kcal: 130, p: 3, c: 28, f: 0, ts: 1 });
    window.sdileno = null;
    navigator.canShare = () => true;
    navigator.share = async d => { window.sdileno = { pocet: d.files.length, jmeno: d.files[0].name }; };
  });
  await p.evaluate(() => exportData());
  await p.waitForTimeout(700);
  const sd = await p.evaluate(() => window.sdileno);
  ck('záloha jde do sdílecí nabídky', !!sd, JSON.stringify(sd));
  ck('a je to jeden soubor', sd && sd.pocet === 1, JSON.stringify(sd));
  ck('pojmenovaný podle dne', sd && sd.jmeno.indexOf('kalorie-zaloha-') === 0, sd && sd.jmeno);

  /* ---- 6. kde sdílení není, musí zbýt stažení ------------------------ */
  const stazeno = await p.evaluate(async () => {
    window.stazenoJmeno = null;
    navigator.canShare = () => false;      // prohlížeč, který soubory sdílet neumí
    const puv = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { window.stazenoJmeno = this.download; };
    await exportData();
    HTMLAnchorElement.prototype.click = puv;
    return window.stazenoJmeno;
  });
  ck('bez sdílení se soubor stáhne', !!stazeno && stazeno.indexOf('kalorie-zaloha-') === 0,
     String(stazeno));

  /* ---- 7. zrušené sdílení není chyba -------------------------------- */
  const zrus = await p.evaluate(async () => {
    navigator.canShare = () => true;
    navigator.share = async () => { const e = new Error('zrušeno'); e.name = 'AbortError'; throw e; };
    window.stazenoJmeno = null;
    const puv = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { window.stazenoJmeno = this.download; };
    await exportData();
    HTMLAnchorElement.prototype.click = puv;
    return window.stazenoJmeno;
  });
  ck('když člověk sdílení zavře, nic se nestáhne', zrus === null, String(zrus));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
