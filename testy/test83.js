/* Test v120 — jednodušší párování a varování, že synchronizace neběží.

   1. Párovací kód nese i šifrovací klíč (ne heslo) — páruje se na jeden krok.
   2. Kód jde zkopírovat jako text a na zařízení bez kamery vložit.
   3. Na Hlavní se ukáže varování, když synchronizace přestane běžet; prázdná
      aplikace nabídne spárování rovnou v kartě „Začni tady".
   GitHub je napodobený jako v test49. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };
  const gh = { file: null, sha: 0, stav: 200 };
  const mount = async ctx => {
    await PROSTREDI.blokujVenek(ctx);
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r => gh.stav !== 200
      ? r.fulfill({ status: gh.stav, contentType: 'application/json', body: '{}' })
      : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ private: true, permissions: { push: true } }) }));
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, async r => {
      const m = r.request().method();
      if (gh.stav !== 200) return r.fulfill({ status: gh.stav, contentType: 'application/json', body: '{}' });
      if (m === 'GET') {
        if (!gh.file) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: gh.file, sha: 's' + gh.sha, size: gh.file.length }) });
      }
      if (m === 'PUT') {
        const b = JSON.parse(r.request().postData());
        if (/\.zkouska$/.test(r.request().url())) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
        if ((b.sha || '') !== (gh.file ? 's' + gh.sha : '')) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
        gh.file = b.content; gh.sha++;
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.sha } }) });
      }
      r.fulfill({ status: 405, body: '' });
    });
  };
  const novy = async (sparovany) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
      permissions: ['clipboard-read', 'clipboard-write'] });
    await mount(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
    await p.goto('http://127.0.0.1:8811/index.html');
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    // last: Date.now() — viz test49: jinak si okno samo spustí kolo a rozhází počty
    await p.evaluate(async s => {
      await dbPut('meta', { k: 'sync', v: s
        ? { repo: 'ja/data', token: 'github_pat_tajny', path: 'kalorie-sync.json', last: Date.now(), on: true }
        : { repo: '', token: '', path: 'kalorie-sync.json', last: Date.now(), on: false } });
      await loadSync();
    }, sparovany);
    return p;
  };
  const obalka = () => JSON.parse(Buffer.from(gh.file, 'base64').toString('utf8'));

  /* ---- 1. zdroj: data, šifrování -------------------------------------- */
  const A = await novy(true);
  await A.evaluate(async () => {
    await dbPut('log', { date: '2026-10-01', ts: 1, name: 'Guláš', amount: 300, kcal: 450 });
    document.getElementById('syPass').value = 'tajneheslo123'; await syPassSave();
    await syncNow(true);
  });
  ck('soubor v repozitáři je zašifrovaný', obalka().enc === 1);

  /* ---- 2. QR i text nesou klíč, ne heslo ------------------------------ */
  const qr = JSON.parse(await A.evaluate(() => syQrData()));
  ck('kód nese repozitář, token i klíč', qr.repo === 'ja/data' && qr.tok && qr.k && qr.s, JSON.stringify(Object.keys(qr)));
  ck('kód nenese heslo', JSON.stringify(qr).indexOf('tajneheslo') < 0);
  await A.evaluate(() => syKodKopiruj());
  const kod = await A.evaluate(() => navigator.clipboard.readText());
  ck('zkopírovaný kód je text s předponou', kod.indexOf('kalorie-par:') === 0, kod.slice(0, 30));

  /* ---- 3. nové zařízení bez kamery: vložit a připojit ------------------ */
  const B = await novy(false);
  ck('nespárované zařízení nesynchronizuje', !(await B.evaluate(() => syCfg.on)));
  await B.evaluate(() => { document.getElementById('syKodVloz').value = 'nesmysl'; return syKodPouzij(); });
  ck('nesmysl se odmítne', /není párovací kód/.test(await B.textContent('#syScanMsg')));
  await B.evaluate(k => { document.getElementById('syKodVloz').value = k; return syKodPouzij(); }, kod);
  await B.waitForFunction(() => !sySyncing && syCfg.last && /Sladěno/.test(document.getElementById('syMsg').textContent),
    null, { timeout: 15000 }).catch(() => {});
  ck('spárováno jedním vložením', await B.evaluate(() => syCfg.on && syCfg.repo === 'ja/data'));
  ck('i se šifrováním, bez zadávání hesla', await B.evaluate(() => !!syKey));
  ck('a zašifrovaná data se rovnou stáhla', await B.evaluate(async () =>
    (await dbAll('log')).some(r => r.name === 'Guláš')));
  ck('pole s kódem se po použití vyprázdní', await B.inputValue('#syKodVloz') === '');

  /* ---- 4. QR se po minutě sám schová ---------------------------------- */
  await A.evaluate(() => syQrShow());
  ck('QR kód se ukáže', await A.evaluate(() => !!document.getElementById('syQr').firstChild));
  ck('a má nastavené schování', await A.evaluate(() => syQrSchovej !== null));

  /* ---- 5. starý neexportovatelný klíč: kód to řekne ------------------- */
  const C = await novy(true);
  await C.evaluate(async () => {
    syKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    sySalt = new Uint8Array(16);
  });
  const qrC = JSON.parse(await C.evaluate(() => syQrData()));
  ck('se starým klíčem kód šifrování nenese', !qrC.k && qrC.tok);
  await C.evaluate(() => syKodKopiruj());
  ck('a poradí zadat heslo znovu', /zadej tady heslo ještě jednou/.test(await C.textContent('#syPassMsg')));

  /* ---- 6. varování na Hlavní ------------------------------------------ */
  const vidi = p => p.evaluate(() => getComputedStyle(document.getElementById('syVarovani')).display !== 'none');
  ck('když synchronizace běží, varování není', !(await vidi(A)));
  gh.stav = 401;
  await A.evaluate(() => syncNow(true));
  ck('vypršelý token ukáže varování', await vidi(A));
  ck('s důvodem', /Token je neplatný/.test(await A.textContent('#syVarTxt')), await A.textContent('#syVarTxt'));
  ck('chyba přežije restart', await A.evaluate(async () => { await loadSync(); return !!syCfg.chyba; }));
  gh.stav = 200;
  await A.evaluate(() => syncNow(true));
  ck('po úspěšném sladění varování zmizí', !(await vidi(A)));
  await A.evaluate(async () => { syCfg.last = Date.now() - 5 * 864e5; await syStore(); syVarovani(); });
  ck('dlouho nesladěno: varování', await vidi(A));
  ck('s počtem dní', /před 5 dny/.test(await A.textContent('#syVarTxt')), await A.textContent('#syVarTxt'));
  await A.evaluate(() => syJdiParovat());
  await A.waitForTimeout(200);
  ck('tlačítko vede do synchronizace', await A.evaluate(() =>
    document.getElementById('p-set').classList.contains('on') &&
    getComputedStyle(document.getElementById('setProp')).display !== 'none'));

  /* ---- 7. prázdná aplikace nabídne spárování -------------------------- */
  const D = await novy(false);
  await D.evaluate(() => { go('day'); return obCheck(); });
  ck('nespárované zařízení varování nemá', !(await vidi(D)));
  ck('karta Začni tady nabízí spárování', await D.evaluate(() =>
    [...document.querySelectorAll('#obCard button')].some(b => /spárovat/.test(b.textContent))));

  await browser.close();
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  process.exit(fail ? 1 : 0);
})();
