/* Test v53 — úprava záznamu si drží identitu, takže se po sladění nezdvojí */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const gh = { file: null, sha: 0 };
  const mount = async ctx => {
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"private":true}' }));
    await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, r => {
      const m = r.request().method();
      if (m === 'GET') {
        if (!gh.file) return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: gh.file, sha: 's' + gh.sha, size: gh.file.length }) });
      }
      const b = JSON.parse(r.request().postData());
      if ((b.sha || '') !== (gh.file ? 's' + gh.sha : '')) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
      gh.file = b.content; gh.sha++;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.sha } }) });
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
      /* `last` schválně NENÍ 0: aplikace slaďuje i sama od sebe — při získání fokusu
         okna (>30 s od posledního kola) a při návratu viditelnosti (>60 s), a to hned,
         ne přes časovač. Zakládání dalšího okna v testu takovou událost vyvolá a kolo
         navíc pak rozhází počty i obsah. Zařízení proto zakládáme jako čerstvě sladěné. */
      await dbPut('meta', { k: 'sync', v: { repo: 'ja/data', token: 't', path: 'kalorie-sync.json', last: Date.now(), on: true } });
      await loadSync();
    });
    return p;
  };

  /* ---- 1. úprava přes formulář drží uid --------------------------- */
  const A = await novy();
  const uidy = await A.evaluate(async () => {
    await dbPut('log', { date: dstr(new Date()), ts: 1, name: 'Rýže', amount: 200, kcal: 260, p: 5, c: 56, f: 1 });
    const r1 = (await dbAll('log'))[0];
    // přesně to, co dělá addPortion při úpravě: nový objekt, původní id, žádné uid
    const rec = { date: r1.date, productId: r1.productId, name: 'Rýže', unit: 'g', meal: 'obed',
      amount: 300, kcal: 390, p: 7.5, c: 84, f: 1.5, ts: r1.ts, id: r1.id };
    await dbPut('log', rec);
    const po = await dbAll('log');
    return { pred: r1.uid, po: po[0].uid, pocet: po.length, mn: po[0].amount };
  });
  ck('po úpravě zůstal jeden záznam', uidy.pocet === 1, 'záznamů: ' + uidy.pocet);
  ck('a má novou hodnotu', uidy.mn === 300);
  ck('identita záznamu se nezměnila', uidy.pred === uidy.po, uidy.pred + ' → ' + uidy.po);

  /* ---- 2. celé kolečko přes dvě zařízení -------------------------- */
  await A.evaluate(() => syncNow(true));
  const B = await novy();
  await B.evaluate(() => syncNow(true));
  ck('druhé zařízení má jeden záznam',
    (await B.evaluate(async () => (await dbAll('log')).length)) === 1);

  // úprava na prvním zařízení přes skutečný formulář
  await A.click('nav button[data-p="day"]'); await A.waitForTimeout(400);
  await A.click('#p-day .item .grow >> nth=0'); await A.waitForTimeout(500);
  await A.fill('#poAmt', '450');
  await A.click('#modPortion >> text=Uložit'); await A.waitForTimeout(700);
  ck('úprava na Hlavní nezdvojí záznam hned',
    (await A.evaluate(async () => (await dbAll('log')).length)) === 1);

  await A.evaluate(() => syncNow(true));
  await B.evaluate(() => syncNow(true));
  const naB = await B.evaluate(async () => (await dbAll('log')).map(r => r.amount));
  ck('a nezdvojí ho ani po sladění na druhém zařízení', naB.length === 1, JSON.stringify(naB));
  ck('druhé zařízení vidí upravenou hodnotu', naB[0] === 450, JSON.stringify(naB));

  await A.evaluate(() => syncNow(true));
  const naA = await A.evaluate(async () => (await dbAll('log')).map(r => r.amount));
  ck('a nevrátí se ani zpátky na první', naA.length === 1 && naA[0] === 450, JSON.stringify(naA));

  /* ---- 3. totéž u nápoje a u cvičení ------------------------------ */
  const ostatni = await A.evaluate(async () => {
    await dbPut('log', { date: dstr(new Date()), ts: 5, name: 'Pivo', amount: 500, kcal: 200, alc: 19.7, abv: 5, productId: 'alk' });
    await dbPut('workout', { date: dstr(new Date()), ts: 6, name: 'Běh', min: 30, kcal: 300 });
    const napoj = (await dbAll('log')).find(r => r.name === 'Pivo');
    const cvic = (await dbAll('workout'))[0];
    await dbPut('log', { date: napoj.date, ts: napoj.ts, id: napoj.id, name: 'Pivo', amount: 300, kcal: 120, alc: 11.8, abv: 5, productId: 'alk' });
    await dbPut('workout', { date: cvic.date, ts: cvic.ts, id: cvic.id, name: 'Běh', min: 45, kcal: 450 });
    const n2 = (await dbAll('log')).filter(r => r.name === 'Pivo');
    const c2 = await dbAll('workout');
    return { napojUid: napoj.uid === n2[0].uid, napojPocet: n2.length,
      cvicUid: cvic.uid === c2[0].uid, cvicPocet: c2.length };
  });
  ck('úprava nápoje drží identitu', ostatni.napojUid && ostatni.napojPocet === 1, JSON.stringify(ostatni));
  ck('úprava cvičení drží identitu', ostatni.cvicUid && ostatni.cvicPocet === 1, JSON.stringify(ostatni));

  /* ---- 4. kopie musí naopak identitu dostat novou ----------------- */
  const kopie = await A.evaluate(async () => {
    const src = (await dbAll('log')).find(r => r.name === 'Pivo');
    const c = Object.assign({}, src); delete c.id; delete c.uid; delete c.upd;
    c.ts = Date.now();
    await dbPut('log', c);
    const vse = (await dbAll('log')).filter(r => r.name === 'Pivo');
    return { pocet: vse.length, ruzna: new Set(vse.map(r => r.uid)).size };
  });
  ck('kopie zůstává samostatným záznamem', kopie.pocet === 2 && kopie.ruzna === 2, JSON.stringify(kopie));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
