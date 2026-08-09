/* Test v45 — synchronizační jádro: uid/upd, náhrobky, mergeState, applyState,
const PROSTREDI = require('./prostredi');
   migrace DB v4→v5, export/import s náhrobky, simulace dvou zařízení */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  /* ---- 1. migrace ze staré DB v4 ---------------------------------- */
  // seed děláme na stránce bez aplikace — jinak by aplikace držela otevřené spojení
  await p.goto('http://127.0.0.1:8811/manifest.json');
  await p.evaluate(() => new Promise(res => {
    const del = indexedDB.deleteDatabase('kaltrack');
    del.onblocked = del.onerror = del.onsuccess = () => {
      const rq = indexedDB.open('kaltrack', 4);
      rq.onupgradeneeded = e => {
        const d = e.target.result;
        d.createObjectStore('ext', { keyPath: 'id' });
        d.createObjectStore('workout', { keyPath: 'id', autoIncrement: true }).createIndex('date', 'date');
        d.createObjectStore('daily', { keyPath: 'date' });
        d.createObjectStore('products', { keyPath: 'id' }).createIndex('name', 'name');
        d.createObjectStore('log', { keyPath: 'id', autoIncrement: true }).createIndex('date', 'date');
        d.createObjectStore('meta', { keyPath: 'k' });
      };
      rq.onsuccess = () => {
        const d = rq.result;
        const t = d.transaction(['log', 'products'], 'readwrite');
        t.objectStore('log').put({ date: '2026-08-01', ts: 1000, name: 'Starý záznam', amount: 100, kcal: 200 });
        t.objectStore('products').put({ id: 'p-old', name: 'Stará potravina', kcal: 100 });
        t.oncomplete = () => { d.close(); res(); };
      };
    };
  }));
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db && db.version === 5, null, { timeout: 15000 });
  const mig = await p.evaluate(async () => {
    const l = await dbAll('log'), pr = await dbAll('products');
    return { ver: db.version, tomb: db.objectStoreNames.contains('tomb'),
      uid: !!(l[0] && l[0].uid), upd: l[0] && l[0].upd, pupd: pr[0] && pr[0].upd, name: l[0] && l[0].name };
  });
  ck('DB povýšena na verzi 5', mig.ver === 5, 'ver=' + mig.ver);
  ck('store tomb existuje', mig.tomb);
  ck('starý záznam přežil migraci', mig.name === 'Starý záznam');
  ck('starý záznam dostal uid', mig.uid);
  ck('upd převzat z ts', mig.upd === 1000, 'upd=' + mig.upd);
  ck('stará potravina má upd=1', mig.pupd === 1, 'upd=' + mig.pupd);

  /* ---- 2. razítkování a náhrobky ---------------------------------- */
  const stamp = await p.evaluate(async () => {
    await dbPut('log', { date: '2026-08-04', ts: 5, name: 'Nový', amount: 50, kcal: 60 });
    const rows = await dbAll('log');
    const nov = rows.find(r => r.name === 'Nový');
    const uid = nov.uid, upd1 = nov.upd;
    nov.kcal = 99;
    await dbPut('log', nov);                       // úprava: uid drží, upd roste
    const after = (await dbAll('log')).find(r => r.uid === uid);
    await dbDel('log', after.id);
    const tombs = await dbAll('tomb');
    return { uid: !!uid, grew: after.upd > upd1, sameUid: after.uid === uid,
      gone: !(await dbAll('log')).some(r => r.uid === uid),
      tomb: tombs.some(t => t.uid === uid && t.store === 'log') };
  });
  ck('nový záznam dostal uid', stamp.uid);
  ck('úprava drží uid a zvyšuje upd', stamp.sameUid && stamp.grew);
  ck('smazání záznam odstraní', stamp.gone);
  ck('smazání zanechá náhrobek', stamp.tomb);

  /* ---- 2b. kopie záznamu musí dostat vlastní identitu ------------- */
  const kop = await p.evaluate(async () => {
    await dbPut('log', { date: '2026-08-03', ts: 11, meal: 'snidane', name: 'Kaše', amount: 250, kcal: 320 });
    const src = (await dbAll('log')).find(r => r.name === 'Kaše');
    // přesně to, co dělá kopie jídla ze včerejška
    const c = Object.assign({}, src); delete c.id; delete c.uid; delete c.upd;
    c.date = '2026-08-04'; c.ts = Date.now();
    await dbPut('log', c);
    // a i kdyby uid v objektu zůstalo, řádek bez id musí dostat nové
    const c2 = Object.assign({}, src); delete c2.id; c2.date = '2026-08-05';
    await dbPut('log', c2);
    const kase = (await dbAll('log')).filter(r => r.name === 'Kaše');
    const uids = kase.map(r => r.uid);
    return { pocet: kase.length, unikat: new Set(uids).size === uids.length, bezId: uids.every(u => !!u) };
  });
  ck('kopie jídla vznikne jako tři samostatné záznamy', kop.pocet === 3, 'pocet=' + kop.pocet);
  ck('každá kopie má vlastní uid', kop.unikat && kop.bezId);

  /* ---- 3. mergeState: pravidla --------------------------------- */
  const mg = await p.evaluate(() => {
    const A = { log: [{ uid: 'x', name: 'A verze', upd: 100 }], tomb: [] };
    const B = { log: [{ uid: 'x', name: 'B verze', upd: 200 }], tomb: [] };
    const novejsi = mergeState(A, B).log[0].name;
    const opacne = mergeState(B, A).log[0].name;

    const T = Date.now();
    const C = { log: [{ uid: 'y', name: 'zůstat', upd: T - 5000 }], tomb: [] };
    const D = { log: [], tomb: [{ k: 'log|y', store: 'log', uid: 'y', ts: T - 4000 }] };
    const smazano = mergeState(C, D).log.length;

    // vrácení smazání: záznam zapsaný po náhrobku vyhrává
    const E = { log: [{ uid: 'z', name: 'vráceno', upd: T - 1000 }], tomb: [{ k: 'log|z', store: 'log', uid: 'z', ts: T - 4000 }] };
    const vraceno = mergeState(E, { log: [], tomb: [] }).log.length;

    // idempotence: sloučení výsledku se sebou nic nemění
    const m1 = mergeState(A, B), m2 = mergeState(m1, m1);
    const idem = JSON.stringify(m1.log) === JSON.stringify(m2.log);

    // sjednocení různých záznamů
    const F = { log: [{ uid: 'a', upd: 10 }], tomb: [] };
    const G = { log: [{ uid: 'b', upd: 10 }], tomb: [] };
    const spojeno = mergeState(F, G).log.length;

    // starý náhrobek se po půl roce zahodí
    const H = { log: [], tomb: [{ k: 'log|q', store: 'log', uid: 'q', ts: Date.now() - 200 * 86400000 }] };
    const uklid = mergeState(H, { log: [], tomb: [] }).tomb.length;

    return { novejsi, opacne, smazano, vraceno, idem, spojeno, uklid };
  });
  ck('vyhrává novější upd', mg.novejsi === 'B verze', mg.novejsi);
  ck('výsledek nezávisí na pořadí', mg.opacne === 'B verze', mg.opacne);
  ck('náhrobek smaže starší záznam', mg.smazano === 0);
  ck('vrácení mazání porazí náhrobek', mg.vraceno === 1);
  ck('slučování je idempotentní', mg.idem);
  ck('různé záznamy se spojí', mg.spojeno === 2);
  ck('starý náhrobek se uklidí', mg.uklid === 0);

  /* ---- 4. applyState: lokální id se nerozbije --------------------- */
  const ap = await p.evaluate(async () => {
    const mine = await collectState();
    const cizi = JSON.parse(JSON.stringify(mine));
    cizi.log.push({ uid: 'remote-1', date: '2026-08-04', ts: 7, name: 'Z druhého zařízení', amount: 10, kcal: 11, upd: Date.now() });
    const merged = mergeState(mine, cizi);
    await applyState(merged);
    const rows = await dbAll('log');
    const ids = rows.map(r => r.id);
    return { pocet: rows.length, mam: rows.some(r => r.uid === 'remote-1'),
      idUnikat: new Set(ids).size === ids.length, idyCisla: ids.every(i => typeof i === 'number') };
  });
  ck('cizí záznam se zapsal', ap.mam);
  ck('lokální id zůstala unikátní čísla', ap.idUnikat && ap.idyCisla);

  /* ---- 5. simulace dvou zařízení ---------------------------------- */
  const dva = await p.evaluate(async () => {
    // telefon = aktuální DB, počítač = kopie stavu, na které provedeme jiné změny
    const telefon = await collectState();
    const pocitac = JSON.parse(JSON.stringify(telefon));
    const t0 = Date.now();
    pocitac.log.push({ uid: 'pc-1', date: '2026-08-04', ts: 8, name: 'Oběd na PC', amount: 300, kcal: 500, upd: t0 - 5000 });
    await dbPut('log', { date: '2026-08-04', ts: 9, name: 'Svačina na mobilu', amount: 50, kcal: 120 });

    let tel = await collectState();
    let spol = mergeState(tel, pocitac);
    await applyState(spol);
    const obojiTam = ['Oběd na PC', 'Svačina na mobilu'].every(n => spol.log.some(r => r.name === n));

    // teď na telefonu smažu položku, která přišla z počítače
    const row = (await dbAll('log')).find(r => r.uid === 'pc-1');
    await dbDel('log', row.id);
    tel = await collectState();
    // počítač mezitím nic nedělal — má pořád starý stav se záznamem
    const spol2 = mergeState(tel, pocitac);
    const zmizelo = !spol2.log.some(r => r.uid === 'pc-1');
    // a při dalším kole se nevrátí
    const spol3 = mergeState(spol2, pocitac);
    const zustaloPryc = !spol3.log.some(r => r.uid === 'pc-1');
    return { obojiTam, zmizelo, zustaloPryc };
  });
  ck('změny z obou zařízení se sejdou', dva.obojiTam);
  ck('mazání se přenese na druhé zařízení', dva.zmizelo);
  ck('smazaný záznam se nevrací', dva.zustaloPryc);

  /* ---- 6. export a import zálohy ---------------------------------- */
  const io = await p.evaluate(async () => {
    const st = await collectState();
    const zaloha = { v: 5, goals: goals, drinks: drinks, products: st.products, log: st.log,
      daily: st.daily, ext: st.ext, workout: st.workout, tomb: st.tomb };
    const pred = (await dbAll('log')).length;
    // import téže zálohy nesmí nic zdvojit
    const inp = { files: [new File([JSON.stringify(zaloha)], 'z.json', { type: 'application/json' })], value: '' };
    importData(inp);
    await new Promise(r => setTimeout(r, 1200));
    return { pred, po: (await dbAll('log')).length, tombVEporte: zaloha.tomb.length > 0 };
  });
  ck('export nese náhrobky', io.tombVEporte);
  ck('opakovaný import nezdvojí záznamy', io.po === io.pred, io.pred + ' -> ' + io.po);

  /* ---- 7. klíč k API se nesynchronizuje --------------------------- */
  const priv = await p.evaluate(async () => {
    await dbPut('meta', { k: 'api', v: { key: 'sk-tajne', model: 'x' } });
    const st = await collectState();
    return JSON.stringify(st).indexOf('sk-tajne') < 0;
  });
  ck('API klíč není v synchronizovaném stavu', priv);

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
