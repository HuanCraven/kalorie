/* Test v50 — citlivá pole bez type="password" a rozbor období přes Claude API */
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

  // falešné API — zachytíme, co se odesílá
  let poslano = null, odpoved = '1) JAK TO DOPADLO\nPříjem seděl.\n2) CO STOJÍ ZA POZORNOST\nAlkohol 0 g.\n3) NA PŘÍŠTĚ\nPřidej bílkoviny.';
  let stav = 200;
  await ctx.route(/api\.anthropic\.com/, r => {
    poslano = JSON.parse(r.request().postData());
    if (stav !== 200) return r.fulfill({ status: stav, contentType: 'application/json', body: '{"error":{"message":"nope"}}' });
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: odpoved }] }) });
  });

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  /* ---- 1. žádné pole není heslo ------------------------------------ */
  const pole = await p.evaluate(() => {
    const t = [...document.querySelectorAll('input')].filter(e => e.type === 'password').map(e => e.id);
    const tajna = [...document.querySelectorAll('input.tajne')].map(e => ({ id: e.id, typ: e.type }));
    return { hesla: t, tajna };
  });
  ck('v aplikaci není žádné pole typu password', pole.hesla.length === 0, JSON.stringify(pole.hesla));
  ck('citlivá pole jsou tři a maskovaná', pole.tajna.length === 3 && pole.tajna.every(x => x.typ === 'text'),
    JSON.stringify(pole.tajna));
  const skryte = await p.evaluate(() => {
    const el = document.getElementById('syTok');
    return getComputedStyle(el).webkitTextSecurity || getComputedStyle(el).textSecurity;
  });
  ck('obsah tokenu je opticky skrytý', skryte === 'disc', String(skryte));

  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { document.getElementById('syTok').value = 'github_pat_ukazka'; });
  await p.evaluate(() => setSetMode('prop')); await p.click('button:has-text("Ukázat token")');
  ck('tlačítko token odkryje', await p.evaluate(() =>
    document.getElementById('syTok').classList.contains('videt')));
  await p.click('button:has-text("Skrýt token")');
  ck('a zase skryje', await p.evaluate(() =>
    !document.getElementById('syTok').classList.contains('videt')));

  /* ---- 2. profil se uloží a přežije restart ----------------------- */
  await p.evaluate(() => setSetMode('ja')); await p.fill('#gProfil', '42 let, 178 cm, chci zhubnout na 72 kg.');
  await p.fill('#gRmr', '1800');
  await p.waitForTimeout(1000);
  ck('profil se uloží k cílům', await p.evaluate(async () => {
    const m = await dbGet('meta', 'goals');
    return !!(m && m.v && m.v.profil && m.v.profil.indexOf('72 kg') > 0);
  }));

  /* ---- 3. rozbor bez dat a bez klíče ------------------------------ */
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(700);
  await p.click('#rozborBtn'); await p.waitForTimeout(400);
  ck('bez klíče se řekne, že chybí klíč', (await p.textContent('#rozborMsg')).indexOf('klíč') > 0,
    await p.textContent('#rozborMsg'));
  ck('a nic se neodešle', poslano === null);

  /* ---- 4. rozbor s daty ------------------------------------------- */
  await p.evaluate(async () => {
    await dbPut('meta', { k: 'api', v: { key: 'sk-ant-test', model: 'claude-sonnet-4-6' } });
    await loadApi();
    await dbPut('log', { date: dstr(new Date()), ts: 1, name: 'Kuře s rýží', amount: 400, kcal: 620, p: 45, c: 70, f: 12 });
    await dbPut('daily', { date: dstr(new Date()), weight: 80, burn: 400 });
  });
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(900);
  await p.click('#rozborBtn');
  await p.waitForFunction(() => document.getElementById('rozborOut').style.display !== 'none', null, { timeout: 15000 });
  ck('rozbor se zobrazí', (await p.textContent('#rozborOut')).indexOf('NA PŘÍŠTĚ') > 0);
  ck('hlavička uvádí období a čas', /\d+ dní/.test(await p.textContent('#rozborMsg')), await p.textContent('#rozborMsg'));

  const zprava = poslano.messages[0].content[0].text;
  ck('do zprávy jde profil uživatele', zprava.indexOf('72 kg') > 0);
  ck('a souhrn s čísly', zprava.indexOf('KALORIE — souhrn') >= 0 && zprava.indexOf('Kuře s rýží') > 0);
  ck('zpráva nenese klíč ani token', zprava.indexOf('sk-ant-test') < 0 && zprava.indexOf('github_pat') < 0);
  ck('klíč jde v hlavičce, ne v textu', poslano.max_tokens > 0);
  ck('prompt zakazuje krajní doporučení', zprava.indexOf('Nedoporučuj krajní kroky') > 0);

  /* ---- 5. rozbor přežije restart ---------------------------------- */
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(500);
  ck('poslední rozbor je po restartu pořád vidět',
    (await p.textContent('#rozborOut')).indexOf('NA PŘÍŠTĚ') > 0);

  /* ---- 6. chyba API ----------------------------------------------- */
  stav = 401;
  await p.click('#rozborBtn'); await p.waitForTimeout(1500);
  ck('neplatný klíč se pozná', (await p.textContent('#rozborMsg')).indexOf('neplatný klíč') > 0,
    await p.textContent('#rozborMsg'));
  ck('tlačítko se odblokuje', await p.evaluate(() => !document.getElementById('rozborBtn').disabled));

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
