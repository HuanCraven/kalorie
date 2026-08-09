/* Test v45 — opravy po revizi synchronizace: dopředná kompatibilita, ověření
const PROSTREDI = require('./prostredi');
   práva zápisu, odstup mezi commity, pravdivé mazání dat */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const gh = { file: null, sha: 0, puts: 0, private: true, push: true, permKlic: true, contentsStatus: 0, zkousVDatech: 0 };
  const mount = async ctx => {
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r => {
      const o = { private: gh.private };
      if (gh.permKlic) o.permissions = { push: gh.push, pull: true };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    });
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, r => {
      if (gh.contentsStatus) return r.fulfill({ status: gh.contentsStatus, contentType: 'application/json', body: '{}' });
      const m = r.request().method();
      if (m === 'GET') {
        if (!gh.file) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: gh.file, sha: 's' + gh.sha, size: gh.file.length }) });
      }
      if (m === 'PUT') {
        // zkušební zápis na jiný soubor — GitHub nejdřív ověří práva, pak teprve sha
        if (r.request().url().indexOf('.zkouska') > 0) {
          if (!gh.push) return r.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Resource not accessible by personal access token"}' });
          return r.fulfill({ status: 422, contentType: 'application/json', body: '{"message":"Invalid request"}' });
        }
        gh.puts++;
        const b = JSON.parse(r.request().postData());
        if (b.sha === '0'.repeat(40)) gh.zkousVDatech++;   // zkouška oprávnění nesmí mířit sem
        if ((b.sha || '') !== (gh.file ? 's' + gh.sha : '')) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
        gh.file = b.content; gh.sha++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.sha } }) });
      }
      r.fulfill({ status: 405, body: '' });
    });
  };
  const novy = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mount(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
    await p.goto('http://127.0.0.1:8811/index.html');
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    await p.evaluate(async () => {
      await dbPut('meta', { k: 'sync', v: { repo: 'ja/data', token: 'github_pat_x', path: 'kalorie-sync.json', last: 0, on: true } });
      await loadSync();
    });
    return p;
  };
  // syTest vrací svou hlášku — čtení z obrazovky by mohl přepsat sync na pozadí
  const testSpojeni = p => p.evaluate(() => syTest());

  const A = await novy();

  /* ---- 1. neznámá data z novější verze ---------------------------- */
  const dopredu = await A.evaluate(() => {
    const stare = { log: [{ uid: 'a', upd: 5 }], tomb: [] };
    const nove = { log: [{ uid: 'b', upd: 5 }], tomb: [], spanek: [{ uid: 's1', upd: 9 }] };
    const m1 = mergeState(stare, nove), m2 = mergeState(nove, stare);
    return { z1: !!m1.spanek && m1.spanek.length === 1, z2: !!m2.spanek,
      logy: m1.log.length, nedotkl: JSON.stringify(m1.spanek) === JSON.stringify(nove.spanek) };
  });
  ck('neznámý store se sloučením neztratí', dopredu.z1 && dopredu.z2);
  ck('neznámý store zůstane beze změny', dopredu.nedotkl);
  ck('známá data se přitom slučují dál', dopredu.logy === 2);

  /* ---- 2. test spojení pozná chybějící právo zápisu --------------- */
  gh.push = false;
  let hl = await testSpojeni(A);
  ck('token bez práva zápisu se pozná', hl.indexOf('NEMÁ oprávnění') > 0, hl);
  gh.push = true;
  hl = await testSpojeni(A);
  ck('token s právem zápisu projde', hl.indexOf('smí zapisovat') > 0, hl);
  // vlastník repozitáře má v odpovědi push:true, i když token na obsah nesmí — na to se nesmí spoléhat
  gh.push = false; gh.permKlic = true;
  hl = await testSpojeni(A);
  ck('práva uživatele nepřebijí skutečnou zkoušku zápisu', hl.indexOf('NEMÁ oprávnění') > 0, hl);
  gh.push = true;
  ck('zkušební zápis nikdy nemíří na datový soubor', gh.zkousVDatech === 0, 'zásahů: ' + gh.zkousVDatech);

  /* ---- 3. odstup mezi commity ------------------------------------ */
  const odstup = await A.evaluate(() => {
    syCfg.last = 0; const prvni = syCekani();
    syCfg.last = Date.now(); const hned = syCekani();
    syCfg.last = Date.now() - 55000; const skoro = syCekani();
    syCfg.last = Date.now() - 120000; const davno = syCekani();
    syCfg.last = 0;
    return { prvni, hned, skoro, davno };
  });
  ck('po dlouhé pauze se čeká jen na doklepání změn', odstup.prvni === 6000 && odstup.davno === 6000,
    odstup.prvni + '/' + odstup.davno);
  ck('hned po sladění se čeká skoro minutu', odstup.hned > 55000 && odstup.hned <= 60000, '' + odstup.hned);
  ck('pět vteřin před koncem odstupu se čeká zbytek', odstup.skoro >= 5000 && odstup.skoro <= 6000, '' + odstup.skoro);

  /* ---- 4. mazání: jen tady ---------------------------------------- */
  await A.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 1, name: 'Zůstat na PC', amount: 1, kcal: 10 });
    await dbPut('log', { date: '2026-08-04', ts: 2, name: 'Druhý', amount: 1, kcal: 20 });
    await syncNow(true);
  });
  const B = await novy();
  await B.evaluate(() => syncNow(true));
  ck('obě zařízení mají data', (await B.evaluate(async () => (await dbAll('log')).length)) === 2);

  // na A zvolíme „smazat jen tady" (druhý dialog zamítneme)
  let dialogy = 0;
  A.on('dialog', d => { dialogy++; d[dialogy === 2 ? 'dismiss' : 'accept'](); });
  await A.evaluate(() => wipe());
  await A.waitForTimeout(500);
  const poA = await A.evaluate(async () => ({ log: (await dbAll('log')).length, on: syCfg.on }));
  ck('smazání jen tady vyprázdní zařízení', poA.log === 0);
  ck('a odpojí ho od synchronizace', !poA.on);
  await B.evaluate(() => syncNow(true));
  ck('druhé zařízení si data nechá', (await B.evaluate(async () => (await dbAll('log')).length)) === 2);

  /* ---- 5. mazání všude -------------------------------------------- */
  let dialogyB = 0;
  B.on('dialog', d => { dialogyB++; d.accept(); });          // obojí OK = smazat všude
  await B.evaluate(() => wipe());
  await B.waitForTimeout(800);
  ck('mazání všude vyprázdní i toto zařízení',
    (await B.evaluate(async () => (await dbAll('log')).length)) === 0);
  const C = await novy();
  await C.evaluate(() => syncNow(true));
  ck('třetí zařízení po připojení nic nestáhne',
    (await C.evaluate(async () => (await dbAll('log')).length)) === 0);

  /* ---- 6. neúspěšné mazání všude nesmí nechat past ---------------- */
  const D = await novy();
  await D.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 5, name: 'Nesmí zmizet', amount: 1, kcal: 30 });
  });
  gh.contentsStatus = 500;
  let dialogyD = 0;
  D.on('dialog', d => { dialogyD++; d.accept(); });
  await D.evaluate(() => wipe());
  await D.waitForTimeout(800);
  gh.contentsStatus = 0;
  const poD = await D.evaluate(async () => ({ log: (await dbAll('log')).length, tomb: (await dbAll('tomb')).length }));
  ck('při výpadku spojení se nemaže nic', poD.log === 1, JSON.stringify(poD));
  ck('a nezůstanou po tom náhrobky', poD.tomb === 0, 'náhrobků: ' + poD.tomb);
  await D.evaluate(() => syncNow(true));
  ck('další sladění data nesmaže', (await D.evaluate(async () => (await dbAll('log')).length)) === 1);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
