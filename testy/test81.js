/* Test v114 — běh uvnitř APK (Capacitor).

   APK se v testech spustit nedá, ale Capacitor jde napodobit: před načtením stránky
   se podstrčí `window.Capacitor` s doplňky Filesystem, Share a App, které si jen
   zapamatují, s čím je aplikace volala. Hlídá se tu všechno, co se v APK chová
   jinak než na webu — a hlavně že na webu zůstává všechno při starém.

   Skutečný běh na Androidu zkouší zvlášť emulátor v GitHub Actions (build/apk.sh). */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  /* ---- 1. na webu se nic nemění ------------------------------------- */
  const ctxW = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await PROSTREDI.blokujVenek(ctxW);
  const w = await ctxW.newPage();
  w.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await w.goto('http://127.0.0.1:8811/index.html');
  await w.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await w.waitForTimeout(800);
  ck('na webu NATIVNI není', await w.evaluate(() => NATIVNI === false));
  ck('a service worker se registruje', await w.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).length > 0));
  ck('poznámka o APK se na webu neukazuje', !(await w.evaluate(() =>
    getComputedStyle(document.getElementById('apkPozn')).display !== 'none')));

  /* ---- 2. APK: napodobený Capacitor ---------------------------------- */
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await PROSTREDI.blokujVenek(ctx);
  // poslední vydání na GitHubu
  await ctx.route('**/api.github.com/repos/HuanCraven/kalorie/releases/latest', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tag_name: 'apk-2099.01.01-999' }) }));
  await ctx.addInitScript(() => {
    window.__volani = [];
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Filesystem: { writeFile: async o => { window.__volani.push(['write', o.path, o.directory, o.data.length]); return { uri: 'file:///cache/' + o.path }; } },
        Share: { share: async o => { window.__volani.push(['share', o.files && o.files[0]]); } },
        App: {
          addListener: (ev, fn) => { window.__volani.push(['listen', ev]); window.__zpet = fn; },
          exitApp: () => { window.__volani.push(['exit']); }
        }
      }
    };
  });
  const p = await ctx.newPage();
  const konzole = [];
  p.on('console', m => konzole.push(m.text()));
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(900);

  ck('v APK se NATIVNI pozná', await p.evaluate(() => NATIVNI === true));
  ck('doplňky jsou dostupné', await p.evaluate(() =>
    !!nativniPlugin('Filesystem') && !!nativniPlugin('Share') && !!nativniPlugin('App')));
  const znacka = konzole.find(t => t.indexOf('KALORIE_NATIVNI') === 0) || '';
  ck('do logu se zapíše značka pro emulátor', /KALORIE_NATIVNI \S+ osobni pluginy=Filesystem,Share,App/.test(znacka), znacka);
  ck('tlačítko Zpět je zachycené', await p.evaluate(() => window.__volani.some(v => v[0] === 'listen' && v[1] === 'backButton')));

  /* ---- 3. záloha jde přes soubor a sdílení, ne přes stažení ----------- */
  await p.evaluate(async () => {
    await dbPut('log', { date: curDate, productId: 'x', name: 'Rýže', unit: 'g', amount: 100,
      meal: 'obed', kcal: 130, p: 3, c: 28, f: 0, ts: 1 });
    window.__stazeno = null;
    HTMLAnchorElement.prototype.click = function () { window.__stazeno = this.download; };
  });
  await p.evaluate(() => exportData()); await p.waitForTimeout(700);
  const v = await p.evaluate(() => window.__volani.filter(x => x[0] === 'write' || x[0] === 'share'));
  ck('záloha se zapíše do mezipaměti aplikace', v.some(x => x[0] === 'write' && /^kalorie-zaloha-/.test(x[1]) && x[2] === 'CACHE'),
     JSON.stringify(v));
  ck('a předá sdílecí nabídce', v.some(x => x[0] === 'share' && /kalorie-zaloha-/.test(x[1])), JSON.stringify(v));
  ck('přes <a download> se v APK nic nestahuje', (await p.evaluate(() => window.__stazeno)) === null);
  await p.evaluate(() => { window.__volani.length = 0; exportCsv(); }); await p.waitForTimeout(500);
  ck('stejně tak export deníku do CSV',
     (await p.evaluate(() => window.__volani.some(x => x[0] === 'share' && /kalorie-denik-/.test(x[1])))));

  /* ---- 4. bez service workeru a bez varování o úložišti -------------- */
  ck('v APK se service worker neregistruje', await p.evaluate(async () =>
    !navigator.serviceWorker || (await navigator.serviceWorker.getRegistrations()).length === 0));
  ck('varování o trvalém úložišti se v APK neukazuje', !(await p.isVisible('#persWarn')));

  /* ---- 5. tlačítko Zpět ---------------------------------------------- */
  await p.evaluate(() => openPortion('z-ryze-bila-varena')); await p.waitForTimeout(300);
  ck('okno porce je otevřené', await p.isVisible('#modPortion'));
  await p.evaluate(() => window.__zpet()); await p.waitForTimeout(200);
  ck('Zpět napřed zavře okno', !(await p.isVisible('#modPortion')));
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(400);
  await p.evaluate(() => window.__zpet()); await p.waitForTimeout(300);
  ck('pak vrátí na Hlavní', await p.evaluate(() => document.getElementById('p-day').classList.contains('on')));
  ck('a aplikaci zatím nezavře', !(await p.evaluate(() => window.__volani.some(x => x[0] === 'exit'))));
  await p.evaluate(() => window.__zpet()); await p.waitForTimeout(200);
  ck('na Hlavní Zpět aplikaci opustí', await p.evaluate(() => window.__volani.some(x => x[0] === 'exit')));

  /* ---- 6. aktualizace: dotaz na poslední vydání ---------------------- */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  await p.evaluate(() => setSetMode('data')); await p.waitForTimeout(200);
  ck('v Datech je poznámka, že jde o APK', await p.isVisible('#apkPozn'));
  await p.evaluate(() => checkUpdate()); await p.waitForTimeout(700);
  const upd = (await p.textContent('#updMsg')).replace(/\s+/g, ' ');
  ck('zjistí novější vydání na GitHubu', upd.indexOf('2099.01.01-999') >= 0, upd);
  ck('a odkáže na stažení nového APK',
     await p.evaluate(() => !!document.querySelector('#updMsg a[href*="github.com/HuanCraven/kalorie/releases"]')));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
