/* Test v46 — synchronizace přes GitHub: nastavení, první nahrání, sloučení
   s druhým zařízením, konflikt zápisu, chybové stavy, odpojení */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  /* ---- falešný GitHub ---- */
  let soubor = null, sha = 0, priv = true, repoStatus = 200, getStatus = 0, putStatus = 0;
  let konfliktJednou = false, puts = 0, gets = 0;
  const json = (r, st, o) => r.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) });

  await p.route(/api\.github\.com/, r => {
    const u = new URL(r.request().url()), m = r.request().method();
    const contents = u.pathname.indexOf('/contents/') >= 0;
    if (!contents) return json(r, repoStatus, repoStatus === 200 ? { private: priv } : { message: 'x' });
    if (m === 'GET') {
      gets++;
      if (getStatus) return json(r, getStatus, { message: 'x' });
      if (soubor === null) return json(r, 404, { message: 'Not Found' });
      return json(r, 200, { content: Buffer.from(soubor, 'utf8').toString('base64'), sha: 's' + sha, size: soubor.length });
    }
    if (m === 'PUT') {
      puts++;
      if (putStatus) return json(r, putStatus, { message: 'x' });
      /* Ověření práva zápisu (syTestZapis) míří na JINOU cestu — „…​.zkouska" — a posílá
         schválně neplatný sha. Skutečný GitHub na to odpoví 422 a nic nevytvoří.
         Mock to musí dělat taky: dřív zkoušku přijal a uložil její obsah („x") jako
         sync soubor, takže první opravdové sladění pak narazilo na cizí obsah. */
      if (u.pathname.endsWith('.zkouska')) return json(r, 422, { message: 'invalid sha' });
      const b = JSON.parse(r.request().postData());
      if (konfliktJednou) { konfliktJednou = false; return json(r, 409, { message: 'conflict' }); }
      if (soubor !== null && b.sha !== 's' + sha) return json(r, 409, { message: 'sha mismatch' });
      soubor = Buffer.from(b.content, 'base64').toString('utf8');
      sha++;
      return json(r, 200, { content: { sha: 's' + sha } });
    }
    r.fulfill({ status: 405, body: '' });
  });

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db && db.version === 5, null, { timeout: 15000 });

  /* ---- 1. obálka souboru ---------------------------------------- */
  const obal = await p.evaluate(async () => {
    const st = { log: [{ uid: 'a', name: 'ěščřž', upd: 5 }], tomb: [], meta: {} };
    const txt = await syEncode(st);
    const zpet = await syDecode(txt);
    const o = JSON.parse(txt);
    return { f: o.f, gz: o.gz, jmeno: zpet.log[0].name,
      mensi: txt.length < JSON.stringify(st).length * 4 };
  });
  ck('soubor má vlastní hlavičku', obal.f === 'kal-sync');
  ck('obsah se komprimuje', obal.gz === 1);
  ck('diakritika přežije kolečko tam a zpět', obal.jmeno === 'ěščřž');

  /* ---- 2. nastavení a test spojení ------------------------------- */
  await p.click('nav button[data-p="set"]');
  await p.evaluate(() => setSetMode('prop')); await p.fill('#syRepo', 'Nekdo/kalorie-data');
  await p.fill('#syTok', 'github_pat_test');
  await p.dispatchEvent('#syTok', 'change');
  await p.waitForTimeout(300);
  await p.click('text=Vyzkoušet spojení'); await p.waitForTimeout(500);
  ck('test spojení potvrdí privátní repozitář', (await p.textContent('#syMsg')).indexOf('privátní') >= 0,
    await p.textContent('#syMsg'));
  priv = false;
  await p.click('text=Vyzkoušet spojení'); await p.waitForTimeout(500);
  ck('veřejný repozitář se ohlásí jako riziko', (await p.textContent('#syMsg')).indexOf('VEŘEJNÝ') >= 0);
  priv = true;

  /* ---- 3. první nahrání ------------------------------------------ */
  await p.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 1, name: 'Mobilní snídaně', amount: 100, kcal: 250 });
  });
  const prvni = await p.evaluate(() => syncNow(true));
  ck('první synchronizace projde', prvni === true);
  ck('soubor v repozitáři vznikl', soubor !== null);
  const vzdaleny = await p.evaluate(async t => await syDecode(t), soubor);
  ck('nahraný stav obsahuje můj záznam', (vzdaleny.log || []).some(r => r.name === 'Mobilní snídaně'));
  ck('token není součástí nahraných dat', soubor.indexOf('github_pat_test') < 0);

  /* ---- 4. druhé zařízení přidá záznam ---------------------------- */
  soubor = await p.evaluate(async t => {
    const st = await syDecode(t);
    st.log.push({ uid: 'pc-99', date: '2026-08-04', ts: 2, name: 'Oběd z počítače', amount: 300, kcal: 600, upd: Date.now() });
    return await syEncode(st);
  }, soubor);
  sha++;
  const druhy = await p.evaluate(() => syncNow(true));
  const poSlouceni = await p.evaluate(async () => (await dbAll('log')).map(r => r.name));
  ck('druhá synchronizace projde', druhy === true);
  ck('záznam z počítače dorazil do telefonu', poSlouceni.indexOf('Oběd z počítače') >= 0, poSlouceni.join(','));
  ck('vlastní záznam zůstal', poSlouceni.indexOf('Mobilní snídaně') >= 0);

  /* ---- 5. mazání se přenese ------------------------------------- */
  await p.evaluate(async () => {
    const r = (await dbAll('log')).find(x => x.uid === 'pc-99');
    await dbDel('log', r.id);
  });
  await p.evaluate(() => syncNow(true));
  const poSmazani = await p.evaluate(async t => await syDecode(t), soubor);
  ck('smazání se propíše do repozitáře', !(poSmazani.log || []).some(r => r.uid === 'pc-99'));
  ck('v souboru je náhrobek', (poSmazani.tomb || []).some(t => t.uid === 'pc-99'));

  /* ---- 6. zbytečný zápis se neposílá ----------------------------- */
  const pred = puts;
  await p.evaluate(() => syncNow(true));
  ck('beze změn se nic nenahrává', puts === pred, 'puts ' + pred + ' -> ' + puts);

  /* ---- 7. konflikt: druhé zařízení psalo dřív -------------------- */
  konfliktJednou = true;
  await p.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 3, name: 'Večeře', amount: 200, kcal: 400 });
  });
  const poKonfliktu = await p.evaluate(() => syncNow(true));
  const vKonfliktu = await p.evaluate(async t => await syDecode(t), soubor);
  ck('při konfliktu se kolo zopakuje a projde', poKonfliktu === true);
  ck('data se po konfliktu neztratila', (vKonfliktu.log || []).some(r => r.name === 'Večeře'));

  /* ---- 8. chybové stavy ------------------------------------------ */
  getStatus = 401;
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(200);
  ck('neplatný token se pozná', (await p.textContent('#syMsg')).indexOf('neplatný') >= 0, await p.textContent('#syMsg'));
  getStatus = 404; repoStatus = 404;
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(300);
  ck('chybějící repozitář se pozná', (await p.textContent('#syMsg')).indexOf('nenalezen') >= 0);
  repoStatus = 200; getStatus = 403;
  await p.evaluate(() => syncNow(true)); await p.waitForTimeout(200);
  ck('chybějící oprávnění se pozná', (await p.textContent('#syMsg')).indexOf('oprávnění') >= 0);
  getStatus = 0;
  const dataCela = await p.evaluate(async () => (await dbAll('log')).length);
  ck('chyby spojení nesahají na data', dataCela >= 2, 'záznamů: ' + dataCela);

  /* ---- 9. nastavení není v záloze ------------------------------- */
  const skryto = await p.evaluate(async () => {
    const st = await collectState();
    return JSON.stringify(st).indexOf('github_pat_test') < 0;
  });
  ck('token není v synchronizovaném stavu', skryto);

  /* ---- 10. odpojení --------------------------------------------- */
  p.on('dialog', d => d.accept());
  await p.click('text=Odpojit toto zařízení'); await p.waitForTimeout(600);
  const po = await p.evaluate(async () => {
    const m = await dbGet('meta', 'sync');
    return { token: (m && m.v && m.v.token) || '', ready: syReady, pole: document.getElementById('syTok').value };
  });
  ck('odpojení smaže token', !po.token && !po.pole);
  ck('po odpojení se přestane synchronizovat', po.ready === false);
  const putsPredKoncem = puts;
  await p.evaluate(async () => { await dbPut('log', { date: '2026-08-04', ts: 9, name: 'Po odpojení', amount: 1, kcal: 1 }); });
  await p.waitForTimeout(1200);
  ck('po odpojení se nic neposílá', puts === putsPredKoncem);

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
