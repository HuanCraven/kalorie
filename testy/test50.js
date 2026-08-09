/* Test v48 — sladění z hlavní stránky a pravidelné kolo u otevřeného okna */
const PROSTREDI = require('./prostredi');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  // zpozdeni = uměle pomalá odpověď GitHubu. Bez něj mock odpoví dřív, než se stihne
  // podívat na tlačítko, a kontrola průběhu by procházela jen na pomalém stroji.
  const gh = { file: null, sha: 0, puts: 0, gets: 0, zpozdeni: 0 };
  const mount = async ctx => {
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"private":true}' }));
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, async r => {
      if (gh.zpozdeni) await new Promise(res => setTimeout(res, gh.zpozdeni));
      const m = r.request().method();
      if (m === 'GET') {
        gh.gets++;
        if (!gh.file) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: gh.file, sha: 's' + gh.sha, size: gh.file.length }) });
      }
      if (m === 'PUT') {
        gh.puts++;
        const b = JSON.parse(r.request().postData());
        if ((b.sha || '') !== (gh.file ? 's' + gh.sha : '')) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
        gh.file = b.content; gh.sha++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.sha } }) });
      }
      r.fulfill({ status: 405, body: '' });
    });
  };
  const novy = async (zapnout) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mount(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
    await p.goto('http://127.0.0.1:8811/index.html');
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    if (zapnout) await p.evaluate(async () => {
      await dbPut('meta', { k: 'sync', v: { repo: 'ja/data', token: 'github_pat_x', path: 'kalorie-sync.json', last: 0, on: true } });
      await loadSync();
    });
    return p;
  };

  /* ---- 1. tlačítko na hlavní stránce ------------------------------ */
  const N = await novy(false);
  ck('bez nastavené synchronizace se tlačítko neukazuje',
    await N.evaluate(() => document.getElementById('daySync').style.display === 'none'));

  const A = await novy(true);
  ck('po nastavení je tlačítko na hlavní stránce vidět',
    await A.evaluate(() => document.getElementById('daySync').style.display !== 'none'));
  ck('a je na hlavní stránce, ne v nastavení',
    await A.evaluate(() => !!document.querySelector('#p-day #daySync')));
  ck('nepřepíná stránku', await A.evaluate(() => document.getElementById('p-day').classList.contains('on')));

  /* ---- 2. sladí a dá zpětnou vazbu -------------------------------- */
  await A.evaluate(async () => { await dbPut('log', { date: '2026-08-04', ts: 1, name: 'Oběd', amount: 300, kcal: 500 }); });
  const putsPred = gh.puts;
  gh.zpozdeni = 400;                       // ať sladění opravdu chvíli trvá
  const stav = await A.evaluate(async () => {
    const b = document.getElementById('daySync');
    const p = syncNow(true);
    await new Promise(r => setTimeout(r, 60));
    const behem = { txt: b.textContent, blok: b.disabled };
    await p;
    return { behem: behem, po: b.textContent };
  });
  gh.zpozdeni = 0;
  ck('během sladění tlačítko hlásí průběh a nejde zmáčknout dvakrát',
    stav.behem.txt === '⟳…' && stav.behem.blok, JSON.stringify(stav.behem));
  ck('po úspěchu tlačítko potvrdí', stav.po === '✓', stav.po);
  ck('data se opravdu nahrála', gh.puts === putsPred + 1);
  await A.waitForTimeout(3000);
  ck('a po chvíli se vrátí do klidu', (await A.textContent('#daySync')) === '⟳');

  /* ---- 3. neúspěch se pozná --------------------------------------- */
  await A.evaluate(() => { syCfg.repo = ''; syCfg.on = true; });
  const chyba = await A.evaluate(async () => { await syncNow(true); return document.getElementById('daySync').textContent; });
  ck('při neúspěchu tlačítko ukáže křížek', chyba === '✕', chyba);
  await A.evaluate(async () => { syCfg.repo = 'ja/data'; await syStore(); });

  /* ---- 4. otevřené okno se samo doptá ----------------------------- */
  const B = await novy(true);
  await B.evaluate(() => syncNow(true));
  const dataB = await B.evaluate(async () => (await dbAll('log')).length);
  ck('druhé zařízení má data', dataB === 1, 'záznamů: ' + dataB);

  // na prvním zařízení přibude záznam a nahraje se
  await A.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 2, name: 'Večeře', amount: 200, kcal: 400 });
    await syncNow(true);
  });
  // druhé zařízení zůstává otevřené a nikdo na něj nesahá — musí se doptat samo
  const getsPred = gh.gets;
  await B.evaluate(() => { syCfg.last = Date.now() - 130000; });   // posledně sladěno před 2+ minutami
  await B.waitForTimeout(65000);
  const poCekani = await B.evaluate(async () => (await dbAll('log')).map(r => r.name).sort());
  ck('otevřené okno se samo doptá', gh.gets > getsPred, 'dotazů +' + (gh.gets - getsPred));
  ck('a stáhne, co přibylo jinde', poCekani.indexOf('Večeře') >= 0, JSON.stringify(poCekani));

  /* ---- 5. beze změn se pravidelné kolo nepromění v commit --------- */
  const putsPred2 = gh.puts;
  await B.evaluate(() => { syCfg.last = Date.now() - 130000; });
  await B.waitForTimeout(65000);
  ck('pravidelné kolo bez změn nezakládá commit', gh.puts === putsPred2, 'commitů +' + (gh.puts - putsPred2));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
