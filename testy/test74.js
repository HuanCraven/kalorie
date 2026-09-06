/* Test v106 — průvodce prvním spuštěním a zabudovaná nápověda.

   Nový člověk dostal prázdnou aplikaci, klidový výdej 0 a hlášku „Nejdřív
   nastav klidový výdej" — a nikde se nedozvěděl, jaké číslo tam patří. Průvodce
   ho spočítá z těla, nápověda vysvětlí zbytek.

   Průvodce se schválně ukazuje jen ve veřejné verzi: Huan má nastaveno a testům
   by okno překrývalo obrazovku. Proto se tu nejdřív ověřuje, že v osobní verzi
   nevyskočí — kdyby ano, padne na tom celá regrese a nebylo by hned vidět proč. */
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

  /* ---- 1. osobní verze průvodce nezná ------------------------------- */
  ck('v osobní verzi průvodce nevyskočí', !(await p.isVisible('#modUvod')));
  await p.evaluate(() => uvodMozna());
  await p.waitForTimeout(400);
  ck('a nespustí se ani na vyžádání', !(await p.isVisible('#modUvod')));

  /* ---- 2. rovnice klidového výdeje ---------------------------------- */
  const mif = await p.evaluate(() => ({
    muz: rmrMifflin('m', 85, 178, 40),
    zena: rmrMifflin('z', 65, 165, 35),
    prazdno: rmrMifflin('m', 0, 178, 40)
  }));
  // Mifflin–St Jeor: 10*kg + 6,25*cm − 5*věk, muž +5, žena −161
  ck('klidový výdej muže sedí na rovnici', mif.muz === 1768, String(mif.muz));
  ck('u ženy se odečítá 161', mif.zena === 1345, String(mif.zena));
  ck('bez váhy se nic nepočítá', mif.prazdno === 0, String(mif.prazdno));

  /* ---- 3. průvodce ve veřejné verzi --------------------------------- */
  await p.evaluate(() => document.body.classList.add('verejna'));
  await p.evaluate(() => uvodMozna());
  await p.waitForTimeout(400);
  ck('na čisté veřejné aplikaci se otevře', await p.isVisible('#modUvod'));

  await p.click('#uv1 button.pri'); await p.waitForTimeout(300);
  ck('druhý krok se ptá na tělo', await p.isVisible('#uvVyska'));
  ck('dokud pole nejsou vyplněná, dál to nepustí',
     await p.evaluate(() => document.getElementById('uvBtn2').disabled));

  await p.fill('#uvVek', '40'); await p.fill('#uvVyska', '178'); await p.fill('#uvVaha', '85');
  await p.waitForTimeout(300);
  const txt = await p.textContent('#uvRmrTxt');
  ck('spočítaný výdej se ukáže rovnou', txt.indexOf('1768') >= 0, txt);
  ck('a tlačítko se odemkne',
     await p.evaluate(() => !document.getElementById('uvBtn2').disabled));

  await p.click('#uvBtn2'); await p.waitForTimeout(300);
  ck('třetí krok nabízí cíle', await p.isVisible('#uv3'));
  await p.click('#uv3 button >> nth=0'); await p.waitForTimeout(800);

  const g = await p.evaluate(() => ({ rmr: goals.rmr, def: goals.def, dyn: goals.dyn }));
  ck('klidový výdej se uložil', g.rmr === 1768, String(g.rmr));
  // cíl se od v108 zadává v kilech za týden: půl kila = 7700/2/7 = 550 kcal denně
  ck('deficit podle zvoleného tempa', g.def === 550, String(g.def));
  ck('a cíl se řídí denním výdejem', g.dyn === true, String(g.dyn));
  const w = await p.evaluate(async () => (await dbGet('daily', curDate)).weight);
  ck('váha se zapsala na dnešek', w === 85, String(w));

  const sh = await p.textContent('#uvShrnuti');
  ck('shrnutí říká výdej i výsledný cíl',
     /Výdej asi \d+ kcal/.test(sh) && sh.indexOf('hubnutí') >= 0 && /vychází na \d+ kcal/.test(sh), sh);

  await p.click('#uv4 button'); await p.waitForTimeout(400);
  ck('po dokončení se okno zavře', !(await p.isVisible('#modUvod')));

  /* ---- 4. podruhé už neotravuje ------------------------------------- */
  await p.evaluate(() => uvodMozna());
  await p.waitForTimeout(400);
  ck('nastavenému člověku se už nevrátí', !(await p.isVisible('#modUvod')));

  /* ---- 5. hlavní stránka po průvodci dává smysl ---------------------- */
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  const varov = await p.textContent('#p-day');
  ck('zmizela výtka o nenastaveném klidovém výdeji',
     varov.indexOf('Nejdřív nastav klidový výdej') < 0);

  /* ---- 6. nápověda -------------------------------------------------- */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  const zal = await p.locator('#setSeg button:visible').allTextContents();
  ck('záložka Nápověda je v Nastavení', zal.indexOf('Nápověda') >= 0, zal.join('|'));
  await p.evaluate(() => setSetMode('napo')); await p.waitForTimeout(300);
  const nadp = (await p.locator('#setNapo h3:visible').allTextContents()).join('|');
  ck('vysvětluje zálohování', nadp.indexOf('Zálohuj') >= 0, nadp);
  ck('vysvětluje zápis jídla', nadp.indexOf('Zápis jídla') >= 0, nadp);
  ck('vysvětluje, odkud jsou cíle', nadp.indexOf('cíle') >= 0, nadp);
  ck('říká, co aplikace není', nadp.indexOf('není') >= 0, nadp);
  ck('ve veřejné verzi mlčí o fotkách', nadp.indexOf('fotkou') < 0, nadp);

  const licence = await p.textContent('#setNapo');
  ck('uvádí Open Food Facts jako zdroj', licence.indexOf('Open Food Facts') >= 0);
  ck('a licenci ODbL', licence.indexOf('ODbL') >= 0);
  ck('hotová jídla přiznává jako počítaná ze surovin',
     licence.indexOf('ze surovin') >= 0);

  /* ---- 7. v osobní verzi nápověda umí i o fotkách -------------------- */
  await p.evaluate(() => document.body.classList.remove('verejna'));
  await p.waitForTimeout(200);
  const nadp2 = (await p.locator('#setNapo h3:visible').allTextContents()).join('|');
  ck('osobní verze přidá odstavec o fotce a popisu', nadp2.indexOf('fotkou') >= 0, nadp2);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
