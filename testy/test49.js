/* Test v46 — šifrování zálohy heslem a párování přes QR */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const gh = { file: null, sha: 0, puts: 0 };
  const mount = async ctx => {
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ private: true, permissions: { push: true } }) }));
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, r => {
      const m = r.request().method();
      if (m === 'GET') {
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
  const novy = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await mount(ctx);
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
    await p.goto('http://127.0.0.1:8811/index.html');
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    await p.evaluate(async () => {
      await dbPut('meta', { k: 'sync', v: { repo: 'ja/data', token: 'github_pat_tajny', path: 'kalorie-sync.json', last: 0, on: true } });
      await loadSync();
    });
    return p;
  };
  // obálku čteme jako text — takhle se na soubor dívá kdokoli, kdo se do repozitáře dostane
  const obalka = () => JSON.parse(Buffer.from(gh.file, 'base64').toString('utf8'));
  const heslo = async (p, h) => {
    await p.evaluate(async x => { document.getElementById('syPass').value = x; await syPassSave(); }, h);
    return await p.textContent('#syPassMsg');
  };

  /* ---- 1. bez hesla ------------------------------------------------ */
  const A = await novy();
  await A.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 1, name: 'Svíčková na smetaně', amount: 350, kcal: 600 });
    await syncNow(true);
  });
  ck('bez hesla se ukládá nezašifrovaně', obalka().enc === 0);
  ck('a název jídla je v souboru čitelný po rozbalení',
    await A.evaluate(async t => JSON.stringify(await syDecode(t)).indexOf('Svíčková') > 0,
      Buffer.from(gh.file, 'base64').toString('utf8')));

  /* ---- 2. zapnutí šifrování --------------------------------------- */
  ck('krátké heslo se odmítne', (await heslo(A, 'kratke')).indexOf('aspoň 8') > 0, await A.textContent('#syPassMsg'));
  const zap = await heslo(A, 'tajneheslo123');
  ck('heslo se přijme', zap.indexOf('✓') === 0, zap);
  const klic = await A.evaluate(() => ({ mam: !!syKey, ext: syKey && syKey.extractable, alg: syKey && syKey.algorithm.name }));
  ck('klíč je uložený a nejde z prohlížeče vyčíst', klic.mam && klic.ext === false, JSON.stringify(klic));
  ck('klíč je AES-GCM', klic.alg === 'AES-GCM', klic.alg);

  await A.evaluate(() => syncNow(true));
  const ob = obalka();
  ck('soubor je označený jako zašifrovaný', ob.enc === 1);
  ck('soubor nese sůl a jednorázový vektor', !!ob.salt && !!ob.iv);
  ck('v souboru nejde najít název jídla',
    Buffer.from(gh.file, 'base64').toString('utf8').indexOf('Svíčková') < 0 &&
    Buffer.from(ob.d, 'base64').toString('latin1').indexOf('Svíčková') < 0);

  /* ---- 3. klíč přežije zavření aplikace --------------------------- */
  await A.reload();
  await A.waitForFunction(() => typeof syKey !== 'undefined' && syKey !== null, null, { timeout: 15000 });
  ck('po znovuotevření se heslo nezadává znovu', await A.evaluate(() => !!syKey));
  ck('a data se dají sladit dál', await A.evaluate(() => syncNow(true)), await A.textContent('#syMsg'));

  /* ---- 4. druhé zařízení bez hesla a se špatným heslem ------------ */
  const B = await novy();
  const vysB = await B.evaluate(async () => ({ ok: await syncNow(true), msg: document.getElementById('syMsg').textContent }));
  ck('bez hesla se soubor nepřečte', !vysB.ok);
  ck('a řekne se proč', vysB.msg.indexOf('zašifrovaný') > 0, vysB.msg);
  ck('data se přitom nepoškodí', (await B.evaluate(async () => (await dbAll('log')).length)) === 0);

  const spatne = await heslo(B, 'uplnejineheslo');
  ck('špatné heslo se pozná hned při zadání', spatne.indexOf('otevřít nejde') > 0, spatne);
  ck('a klíč se neuloží', await B.evaluate(() => !syKey));

  /* ---- 5. správné heslo na druhém zařízení ------------------------ */
  const dobre = await heslo(B, 'tajneheslo123');
  ck('správné heslo projde', dobre.indexOf('✓') === 0, dobre);
  ck('druhé zařízení si odvodí stejnou sůl',
    await B.evaluate(t => b64FromBytes(sySalt) === JSON.parse(t).salt, Buffer.from(gh.file, 'base64').toString('utf8')));
  await B.evaluate(() => syncNow(true));
  const dataB = await B.evaluate(async () => (await dbAll('log')).map(r => r.name));
  ck('a stáhne si data', dataB.indexOf('Svíčková na smetaně') >= 0, JSON.stringify(dataB));

  /* ---- 6. vypnutí šifrování --------------------------------------- */
  B.on('dialog', d => d.accept());
  await B.evaluate(async () => { await syPassOff(); await dbPut('log', { date: '2026-08-04', ts: 9, name: 'Po vypnutí', amount: 1, kcal: 1 }); await syncNow(true); });
  ck('po vypnutí se ukládá zase nezašifrovaně', obalka().enc === 0);
  ck('klíč zmizel i z databáze', await B.evaluate(async () => !(await dbGet('meta', 'crypt')) && !syKey));

  /* ---- 7. odpojení zařízení zahodí heslo -------------------------- */
  const C = await novy();
  await heslo(C, 'tajneheslo123');
  C.on('dialog', d => d.accept());
  await C.evaluate(() => syLogout());
  ck('odpojení zahodí i klíč k šifrování',
    await C.evaluate(async () => !syKey && !(await dbGet('meta', 'crypt'))));

  /* ---- 8. párování přes QR ---------------------------------------- */
  const D = await novy();
  const qr = await D.evaluate(() => syQrData());
  const qrO = JSON.parse(qr);
  ck('kód nese repozitář i token', qrO.repo === 'ja/data' && qrO.tok === 'github_pat_tajny');
  ck('kód nenese heslo k šifrování', qr.indexOf('tajneheslo') < 0 && !qrO.pass);

  const E = await novy();
  await E.evaluate(async () => { syCfg = { repo: '', token: '', path: 'kalorie-sync.json', last: 0, on: false }; await syStore(); await loadSync(); });
  ck('nespárované zařízení nesynchronizuje', !(await E.evaluate(() => syCfg.on)));
  ck('cizí text se jako kód nepřijme', !(await E.evaluate(() => syQrUse('8594001020304'))));
  ck('cizí JSON se jako kód nepřijme', !(await E.evaluate(() => syQrUse('{"neco":"jineho"}'))));
  ck('párovací kód nastavení nastaví', await E.evaluate(t => syQrUse(t), qr));
  const poQr = await E.evaluate(() => ({ repo: syCfg.repo, tok: syCfg.token, on: syCfg.on }));
  ck('a spojení je rovnou zapnuté', poQr.on && poQr.repo === 'ja/data' && poQr.tok === 'github_pat_tajny', JSON.stringify(poQr));
  ck('spárované zařízení si stáhne data',
    (await E.evaluate(async () => { await syncNow(true); return (await dbAll('log')).length; })) > 0);

  const svg = await D.evaluate(async () => {
    await syQrShow();
    const b = document.getElementById('syQr').firstChild;
    return b ? { tag: b.tagName.toLowerCase(), deti: b.childElementCount } : null;
  });
  ck('kód se vykreslí jako obrázek', svg && svg.tag === 'svg' && svg.deti > 0, JSON.stringify(svg));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
